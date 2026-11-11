import { filterForTilt, sawVoiceById, type SawVoice, type SawVoiceId } from "./sawVoices"

type ChordVoice = { osc: OscillatorNode; gain: GainNode }

export class SynthEngine {
  private ctx: AudioContext | null = null
  private filter: BiquadFilterNode | null = null
  private waveShaper: WaveShaperNode | null = null
  private masterGain: GainNode | null = null
  private chordVoices: ChordVoice[] = []
  private currentKey: string | null = null
  private voice: SawVoice = sawVoiceById("classic")
  private lastFreqs: number[] = []
  private lastTilt = 0
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
      this.applyVoice()

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

  setVoice(id: SawVoiceId) {
    this.voice = sawVoiceById(id)
    this.applyVoice()
    if (!this.currentKey || this.lastFreqs.length === 0) return
    this.currentKey = null
    this.playNotes(this.lastFreqs)
  }

  getVoice(): SawVoiceId {
    return this.voice.id
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
    this.lastTilt = tilt
    if (!this.filter || !this.ctx) return
    const { freq, q } = filterForTilt(tilt, this.voice)
    const now = this.ctx.currentTime
    this.filter.frequency.setTargetAtTime(freq, now, 0.04)
    this.filter.Q.setTargetAtTime(q, now, 0.04)
  }

  playNotes(freqs: number[]) {
    this.ensureContext()
    if (!this.ctx || !this.waveShaper || freqs.length === 0) return
    this.stopTheremin()
    this.lastFreqs = freqs
    const key = `${this.voice.id}|${freqs.map((f) => f.toFixed(1)).join(",")}`
    if (key === this.currentKey) return
    this.stopChordOscillators()
    this.chordVoices = freqs.flatMap((hz) => this.voice.partials.map((partial) => {
      const osc = this.ctx!.createOscillator()
      const gain = this.ctx!.createGain()
      osc.type = "sawtooth"
      osc.frequency.value = hz * partial.ratio
      osc.detune.value = partial.detune
      gain.gain.value = partial.gain
      osc.connect(gain)
      gain.connect(this.waveShaper!)
      osc.start()
      return { osc, gain }
    }))
    this.currentKey = key
  }

  private applyVoice() {
    if (this.waveShaper) this.waveShaper.curve = this.voice.curve
    this.updateFilterSweep(this.lastTilt)
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
      this.thereminGain.connect(this.filter!)
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
    this.chordVoices.forEach(({ osc, gain }) => {
      try { osc.stop() } catch { /* already stopped */ }
      osc.disconnect()
      gain.disconnect()
    })
    this.chordVoices = []
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
