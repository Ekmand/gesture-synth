export class SynthEngine {
  private ctx: AudioContext | null = null
  private filter: BiquadFilterNode | null = null
  private waveShaper: WaveShaperNode | null = null
  private masterGain: GainNode | null = null
  private oscillators: OscillatorNode[] = []
  private currentKey: string | null = null
  private thereminOsc: OscillatorNode | null = null
  private thereminGain: GainNode | null = null
  private mode: "gesture" | "theremin" = "gesture"

  // Audio bus — everything connects here, routed through <audio> element
  // so Chrome keeps audio alive in background tabs
  private bus: GainNode | null = null
  private bgAudio: HTMLAudioElement | null = null

  ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

      // Shared output bus (live synth + loop tracks). Hear it once via destination —
      // dual-routing to MediaStreamDestination as well doubles the signal and causes
      // comb-filter / phase artifacts when oscillators restart on note changes.
      this.bus = this.ctx.createGain()
      this.bus.gain.value = 1
      this.bus.connect(this.ctx.destination)

      // Silent MediaStream → <audio> keepalive so Chrome is less likely to suspend
      // the tab / AudioContext while loops play in the background. Muted so it does
      // not mix a second copy of the bus into the speakers.
      const keepAliveDest = this.ctx.createMediaStreamDestination()
      const keepAlive = this.ctx.createConstantSource()
      keepAlive.offset.value = 0
      keepAlive.connect(keepAliveDest)
      keepAlive.start()
      this.bgAudio = document.createElement("audio")
      this.bgAudio.srcObject = keepAliveDest.stream
      this.bgAudio.autoplay = true
      this.bgAudio.muted = true
      this.bgAudio.play().catch(() => { /* retried on user gesture / visibility */ })

      // Synth signal chain → bus
      this.waveShaper = this.ctx.createWaveShaper()
      this.waveShaper.curve = null
      this.waveShaper.oversample = "4x"
      this.filter = this.ctx.createBiquadFilter()
      this.filter.type = "lowpass"
      this.filter.frequency.value = 1200
      this.filter.Q.value = 0.7
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = 0
      this.waveShaper.connect(this.filter)
      this.filter.connect(this.masterGain)
      this.masterGain.connect(this.bus)

      const ctx = this.ctx
      const audio = this.bgAudio
      document.addEventListener("visibilitychange", () => {
        if (ctx.state === "suspended") void ctx.resume()
        if (audio.paused) audio.play().catch(() => {})
      })
      ctx.addEventListener("statechange", () => {
        if (ctx.state === "suspended") void ctx.resume()
      })

      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "Gesture Synth",
          artist: "Loop Playback",
        })
        navigator.mediaSession.playbackState = "playing"
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume()
    return this.ctx
  }

  getContext(): AudioContext {
    return this.ensureContext()
  }

  // Output bus — LoopEngine tracks connect here for background tab support
  getOutputBus(): GainNode {
    this.ensureContext()
    return this.bus!
  }

  setMode(mode: "gesture" | "theremin") {
    if (this.mode === mode) return
    this.stopAll()
    this.mode = mode
  }

  setVolume(level: number) {
    if (!this.ctx || !this.masterGain) return
    const t = Math.max(0, Math.min(1, level))
    this.masterGain.gain.linearRampToValueAtTime(t, this.ctx.currentTime + 0.05)
  }

  updateFilterSweep(tilt: number) {
    if (!this.filter || !this.ctx) return
    let freq = 1200
    let q = 0.7
    if (tilt < 0) {
      const r = Math.abs(tilt)
      freq = 1200 - r * 950
      q = 0.7 + r * 1.5
    } else if (tilt > 0) {
      freq = 1200 + tilt * 3800
      q = 0.7 + tilt * 4.5
    }
    const now = this.ctx.currentTime
    this.filter.frequency.setTargetAtTime(freq, now, 0.04)
    this.filter.Q.setTargetAtTime(q, now, 0.04)
  }

  playNotes(freqs: number[]) {
    this.ensureContext()
    if (!this.ctx || !this.waveShaper || freqs.length === 0) return
    this.stopTheremin()
    const key = freqs.map((f) => f.toFixed(1)).join(",")
    if (key === this.currentKey) return
    this.oscillators.forEach((o) => {
      try { o.stop() } catch { /* already stopped */ }
    })
    this.oscillators = freqs.map((hz) => {
      const osc = this.ctx!.createOscillator()
      osc.type = "sawtooth"
      osc.frequency.value = hz
      osc.connect(this.waveShaper!)
      osc.start()
      return osc
    })
    this.currentKey = key
  }

  playTheremin(freq: number, volume: number) {
    this.ensureContext()
    if (!this.ctx || !this.waveShaper || !this.masterGain) return
    this.stopChordOscillators()
    if (!this.thereminOsc) {
      this.thereminGain = this.ctx.createGain()
      this.thereminGain.gain.value = 0
      this.thereminOsc = this.ctx.createOscillator()
      this.thereminOsc.type = "sine"
      this.thereminOsc.connect(this.thereminGain)
      this.thereminGain.connect(this.waveShaper)
      this.thereminOsc.start()
    }
    const now = this.ctx.currentTime
    this.thereminOsc.frequency.setTargetAtTime(Math.max(20, freq), now, 0.03)
    this.thereminGain!.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), now, 0.04)
    this.masterGain.gain.setTargetAtTime(1, now, 0.04)
  }

  stopThereminAudio() {
    if (!this.ctx || !this.thereminGain || !this.masterGain) return
    this.thereminGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04)
    this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05)
  }

  private stopChordOscillators() {
    this.oscillators.forEach((o) => {
      try { o.stop() } catch { /* already stopped */ }
    })
    this.oscillators = []
    this.currentKey = null
  }

  private stopTheremin() {
    if (this.thereminOsc) {
      try { this.thereminOsc.stop() } catch { /* already stopped */ }
      this.thereminOsc.disconnect()
      this.thereminOsc = null
    }
    if (this.thereminGain) {
      this.thereminGain.disconnect()
      this.thereminGain = null
    }
  }

  stopAll() {
    this.setVolume(0)
    this.stopChordOscillators()
    this.stopTheremin()
  }

  stop() {
    this.stopAll()
  }
}
