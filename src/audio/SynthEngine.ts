import { arpSequence, nextIndex, stepSeconds, type ArpSettings } from "./arp"

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

  // --- Arpeggiator ---
  private arp: ArpSettings | null = null
  private arpBpm = 120
  private arpSeq: number[] = []
  /** Last chord handed to the arp, so the figure can be reshaped in place. */
  private arpChord: number[] = []
  private arpStep = -1
  private arpNextTime = 0
  private arpTimer: number | null = null
  /** Notes handed to the audio clock but not yet finished, for loop capture. */
  private arpScheduled: { freq: number; start: number; end: number }[] = []

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

    if (this.arp) {
      if (key === this.currentKey) return
      this.currentKey = key
      this.arpChord = freqs
      this.arpSeq = arpSequence(freqs, this.arp.octaves, this.arp.pattern)
      // Restart the figure on a new chord, but keep the time grid so the
      // groove does not stutter when chords change mid-bar.
      this.arpStep = -1
      this.startArpClock()
      return
    }

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

  /** Enable/reconfigure the arpeggiator. Passing a disabled config stops it. */
  setArp(settings: ArpSettings | null) {
    const prev = this.arp
    const next = settings && settings.enabled ? settings : null
    this.arp = next
    const wasOn = prev !== null
    const isOn = next !== null

    if (wasOn !== isOn) {
      // Either way the held chord has to be re-voiced, so clear the cached key
      // that would otherwise make the next playNotes call a no-op.
      this.currentKey = null
      if (isOn) {
        this.stopChordOscillators()
        this.arpStep = -1
        this.arpNextTime = 0
        this.startArpClock()
      } else {
        this.stopArp()
      }
      return
    }

    // Still running: rebuild the figure in place so pattern and octave edits
    // apply to the chord already being held, not only to the next one. Rate
    // and gate need no rebuild — the scheduler reads them each step.
    if (prev && next && (prev.pattern !== next.pattern || prev.octaves !== next.octaves)) {
      this.arpSeq = arpSequence(this.arpChord, next.octaves, next.pattern)
      this.arpStep = -1
    }
  }

  /**
   * Chord released (hands down, or no quality selected). Stops the arp from
   * scheduling further notes — otherwise it keeps minting oscillators behind a
   * silent master gain for as long as the app is open.
   */
  releaseChord() {
    if (!this.arp) return
    this.arpSeq = []
    this.arpStep = -1
    this.currentKey = null
  }

  setArpBpm(bpm: number) {
    this.arpBpm = bpm
  }

  isArpOn(): boolean {
    return this.arp !== null
  }

  /**
   * Notes currently audible. With the arp running this is the single note in
   * its open gate rather than the whole chord, so a recorded loop plays back
   * the arpeggio you actually heard instead of a block chord.
   */
  getSoundingNotes(fallback: number[]): number[] {
    if (!this.arp || !this.ctx) return fallback
    const now = this.ctx.currentTime
    return this.arpScheduled.filter((n) => n.start <= now && n.end > now).map((n) => n.freq)
  }

  private startArpClock() {
    if (this.arpTimer !== null) return
    // Lookahead scheduling: a coarse timer queues notes slightly ahead on the
    // audio clock, so timing does not depend on timer jitter.
    this.arpTimer = window.setInterval(() => this.scheduleArp(), 25)
  }

  private stopArp() {
    if (this.arpTimer !== null) {
      clearInterval(this.arpTimer)
      this.arpTimer = null
    }
    this.arpSeq = []
    this.arpScheduled = []
    this.arpStep = -1
  }

  private scheduleArp() {
    const arp = this.arp
    if (!arp || !this.ctx || !this.waveShaper) return
    const now = this.ctx.currentTime
    this.arpScheduled = this.arpScheduled.filter((n) => n.end > now - 0.5)
    if (this.arpSeq.length === 0) return

    const step = stepSeconds(this.arpBpm, arp.rate)
    // Align to an absolute grid so the arp stays phase-locked to the audio
    // clock — and therefore to loop playback — instead of drifting from
    // whenever the chord happened to start.
    if (this.arpNextTime < now) {
      this.arpNextTime = Math.ceil(now / step) * step
    }

    const horizon = now + 0.12
    while (this.arpNextTime < horizon) {
      this.arpStep = nextIndex(this.arpStep, this.arpSeq.length, arp.pattern)
      const freq = this.arpSeq[this.arpStep]
      if (freq) this.scheduleArpNote(freq, this.arpNextTime, step * arp.gate)
      this.arpNextTime += step
    }
  }

  private scheduleArpNote(freq: number, at: number, durationSec: number) {
    if (!this.ctx || !this.waveShaper) return
    const dur = Math.max(0.03, durationSec)
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = "sawtooth"
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(this.waveShaper)

    // Short attack and an exponential tail: without an envelope each step
    // clicks, because a bare oscillator starts and stops at full amplitude.
    const attack = Math.min(0.012, dur * 0.3)
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.9, at + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)

    osc.start(at)
    osc.stop(at + dur + 0.02)
    osc.onended = () => {
      try { osc.disconnect() } catch { /* already gone */ }
      try { gain.disconnect() } catch { /* already gone */ }
    }
    this.arpScheduled.push({ freq, start: at, end: at + dur })
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
    this.stopArp()
    this.stopTheremin()
  }

  stop() {
    this.stopAll()
  }
}
