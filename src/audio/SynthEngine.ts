/** Hard ceiling for the synth's master gain (full hand height = this). Leaves headroom for the mic. */
const MASTER_CAP = 0.125

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
  // Final output: bus (synth + loops) and the mic both feed mixBus → limiter → speakers / recordings
  private mixBus: GainNode | null = null
  /** Sidechain duck: the synth path eases down while someone is singing over it. */
  private duck: GainNode | null = null
  private speakerBus: GainNode | null = null
  private micMonitor: GainNode | null = null
  private synthDucked: GainNode | null = null
  private synthDirect: GainNode | null = null
  private monitorMic = false
  private analyser: AnalyserNode | null = null
  private analyserBuf: Float32Array<ArrayBuffer> | null = null

  ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

      // Shared output bus (live synth + loop tracks). Hear it once via destination —
      // dual-routing to MediaStreamDestination as well doubles the signal and causes
      // comb-filter / phase artifacts when oscillators restart on note changes.
      this.bus = this.ctx.createGain()
      this.bus.gain.value = 1
      this.mixBus = this.ctx.createGain()
      const limiter = this.ctx.createDynamicsCompressor()
      limiter.threshold.value = -3
      limiter.knee.value = 4
      limiter.ratio.value = 12
      limiter.attack.value = 0.003
      limiter.release.value = 0.15
      this.duck = this.ctx.createGain()
      // mixBus = what recordings capture (synth + mic). The speakers get their own feed so the
      // mic can be left out of what you hear ("mic monitor" off) while still being recorded.
      this.speakerBus = this.ctx.createGain()
      this.micMonitor = this.ctx.createGain()
      this.synthDucked = this.ctx.createGain()
      this.synthDirect = this.ctx.createGain()
      this.applyMonitor()
      this.bus.connect(this.duck)
      this.duck.connect(this.mixBus)
      this.duck.connect(this.synthDucked).connect(this.speakerBus) // ducked under the voice when monitoring it
      this.bus.connect(this.synthDirect).connect(this.speakerBus) // full level when the voice isn't in the speakers
      this.micMonitor.connect(this.speakerBus)
      this.speakerBus.connect(limiter)
      limiter.connect(this.ctx.destination)
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 1024
      this.analyserBuf = new Float32Array(this.analyser.fftSize)
      this.bus.connect(this.analyser)

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

  /** Whether the mic is heard on the output. Off by default; recordings always include the mic. */
  setMonitor(on: boolean) {
    this.monitorMic = on
    this.applyMonitor()
  }

  private applyMonitor() {
    const on = this.monitorMic
    if (this.micMonitor) this.micMonitor.gain.value = on ? 1 : 0
    if (this.synthDucked) this.synthDucked.gain.value = on ? 1 : 0
    if (this.synthDirect) this.synthDirect.gain.value = on ? 0 : 1
  }

  /** Mic feed for the speakers (silent unless mic monitor is on). */
  getMicMonitorNode(): GainNode {
    this.ensureContext()
    return this.micMonitor!
  }

  /** Final mix (synth + mic). Recordings and the mic connect here. */
  getMixBus(): GainNode {
    this.ensureContext()
    return this.mixBus!
  }

  /** Duck the synth (and loops) under the voice: 1 = untouched, lower = quieter. */
  setDuck(amount: number) {
    if (!this.ctx || !this.duck) return
    // Fast attack so the first syllable is clear, slower release so it doesn't pump.
    const tc = amount < this.duck.gain.value ? 0.04 : 0.45
    this.duck.gain.setTargetAtTime(amount, this.ctx.currentTime, tc)
  }

  /** RMS of the synth + loop signal (before the mic joins), ~0..0.3 in practice. */
  getSynthLevel(): number {
    if (!this.analyser || !this.analyserBuf) return 0
    this.analyser.getFloatTimeDomainData(this.analyserBuf)
    let sum = 0
    for (const v of this.analyserBuf) sum += v * v
    return Math.sqrt(sum / this.analyserBuf.length)
  }

  setMode(mode: "gesture" | "theremin") {
    if (this.mode === mode) return
    this.stopAll()
    this.mode = mode
  }

  setVolume(level: number) {
    if (!this.ctx || !this.masterGain) return
    const t = Math.max(0, Math.min(1, level)) * MASTER_CAP
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
    this.masterGain.gain.setTargetAtTime(MASTER_CAP, now, 0.04)
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
