export type LoopState = "idle" | "countIn" | "recording"

export type LoopFrame = {
  t: number
  freqs: number[]
  volume: number
  filterTilt: number
  chord: string | null
  mode: "gesture" | "theremin"
  pitchHz: number
  thereminVol: number
}

export type StepDisplay = {
  chord: string | null
  hasAudio: boolean
  muted: boolean
}

export type TrackInfo = {
  steps: StepDisplay[]
  playing: boolean
  hasContent: boolean
  volume: number
  muted: boolean
  solo: boolean
}

const MAX_TRACKS = 4
const SUBS_PER_BEAT = 4

class LoopTrack {
  frames: LoopFrame[] = []
  stepMask: boolean[] = []
  stepChords: (string | null)[] = []
  stepHasAudio: boolean[] = []

  playing = false
  hasContent = false
  volume = 1.0
  muted = false
  solo = false

  private ctx: AudioContext
  private bufferSource: AudioBufferSourceNode | null = null
  private trackGain: GainNode

  constructor(ctx: AudioContext, outputBus: GainNode) {
    this.ctx = ctx
    this.trackGain = ctx.createGain()
    this.trackGain.gain.value = 1
    this.trackGain.connect(outputBus)
  }

  init(totalSteps: number) {
    this.frames = []
    this.stepMask = new Array(totalSteps).fill(false)
    this.stepChords = new Array(totalSteps).fill(null)
    this.stepHasAudio = new Array(totalSteps).fill(false)
    this.hasContent = false
  }

  updateGain(effectivelyMuted: boolean) {
    const v = effectivelyMuted ? 0 : this.volume
    this.trackGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01)
  }

  addFrame(frame: LoopFrame, stepIdx: number) {
    this.frames.push(frame)
    const hasAudio = frame.freqs.length > 0 || frame.pitchHz > 0
    if (hasAudio) {
      this.stepMask[stepIdx] = true
      this.stepHasAudio[stepIdx] = true
      this.hasContent = true
    }
    if (frame.chord) this.stepChords[stepIdx] = frame.chord
  }

  findFrameForStep(stepIdx: number, stepDurMs: number): LoopFrame | null {
    if (this.frames.length === 0) return null
    const stepStart = stepIdx * stepDurMs
    const stepEnd = stepStart + stepDurMs
    for (const f of this.frames) {
      if (f.t >= stepStart && f.t < stepEnd && (f.freqs.length > 0 || f.pitchHz > 0)) return f
    }
    return null
  }

  // Render the track to an AudioBuffer using OfflineAudioContext
  async renderBuffer(loopDurSec: number, stepDurMs: number, totalSteps: number): Promise<AudioBuffer | null> {
    if (!this.hasContent) return null

    const sampleRate = this.ctx.sampleRate
    const length = Math.ceil(sampleRate * loopDurSec)
    const offline = new OfflineAudioContext(2, length, sampleRate)

    // Recreate audio chain in offline context
    const ws = offline.createWaveShaper()
    ws.curve = null
    ws.oversample = "4x"
    const filt = offline.createBiquadFilter()
    filt.type = "lowpass"
    filt.frequency.value = 1200
    filt.Q.value = 0.7
    ws.connect(filt)
    filt.connect(offline.destination)

    const stepDurSec = stepDurMs / 1000
    const ramp = 0.006 // 6ms attack/release

    // Group consecutive steps with the same chord into sustained runs
    // This prevents choppy gaps between same-chord steps
    type Run = { start: number; end: number; frame: LoopFrame }
    const runs: Run[] = []
    let i = 0
    while (i < totalSteps) {
      if (!this.stepMask[i]) { i++; continue }
      const frame = this.findFrameForStep(i, stepDurMs)
      if (!frame) { i++; continue }

      // Key = unique identifier for this chord/pitch combination
      const key = frame.mode === "gesture"
        ? frame.freqs.map((f) => f.toFixed(1)).join(",")
        : `t:${frame.pitchHz.toFixed(1)}`

      // Extend run as long as consecutive steps have the same chord
      let j = i + 1
      while (j < totalSteps && this.stepMask[j]) {
        const nf = this.findFrameForStep(j, stepDurMs)
        if (!nf) break
        const nk = nf.mode === "gesture"
          ? nf.freqs.map((f) => f.toFixed(1)).join(",")
          : `t:${nf.pitchHz.toFixed(1)}`
        if (nk !== key) break
        j++
      }

      runs.push({ start: i, end: j, frame })
      i = j
    }

    // Render each run as a single sustained tone
    for (const run of runs) {
      const startSec = run.start * stepDurSec
      const endSec = run.end * stepDurSec
      const { frame } = run

      // Filter — interpolate across the run using first frame's values
      let freq = 1200, q = 0.7
      if (frame.filterTilt < 0) {
        const r = Math.abs(frame.filterTilt)
        freq = 1200 - r * 950
        q = 0.7 + r * 1.5
      } else if (frame.filterTilt > 0) {
        freq = 1200 + frame.filterTilt * 3800
        q = 0.7 + frame.filterTilt * 4.5
      }
      filt.frequency.setValueAtTime(freq, startSec)
      filt.Q.setValueAtTime(q, startSec)

      if (frame.mode === "gesture" && frame.freqs.length > 0) {
        frame.freqs.forEach((hz) => {
          const osc = offline.createOscillator()
          osc.type = "sawtooth"
          osc.frequency.value = hz
          const g = offline.createGain()
          // Smooth attack at run start, sustain through, release at run end
          g.gain.setValueAtTime(0, startSec)
          g.gain.linearRampToValueAtTime(frame.volume, startSec + ramp)
          g.gain.setValueAtTime(frame.volume, endSec - ramp)
          g.gain.linearRampToValueAtTime(0, endSec)
          osc.connect(g)
          g.connect(ws)
          osc.start(startSec)
          osc.stop(endSec + 0.01)
        })
      } else if (frame.mode === "theremin" && frame.pitchHz > 0) {
        const osc = offline.createOscillator()
        osc.type = "sine"
        osc.frequency.value = Math.max(20, frame.pitchHz)
        const g = offline.createGain()
        g.gain.setValueAtTime(0, startSec)
        g.gain.linearRampToValueAtTime(frame.thereminVol, startSec + ramp)
        g.gain.setValueAtTime(frame.thereminVol, endSec - ramp)
        g.gain.linearRampToValueAtTime(0, endSec)
        osc.connect(g)
        g.connect(ws)
        osc.start(startSec)
        osc.stop(endSec + 0.01)
      }
    }

    return offline.startRendering()
  }

  // Start looped buffer playback — synced to a loop position
  async startPlayback(loopDurSec: number, stepDurMs: number, totalSteps: number, offsetSec = 0) {
    this.stopPlayback()
    console.log("[Loop] Rendering buffer...", { loopDurSec, totalSteps, activeSteps: this.stepMask.filter(Boolean).length })
    const buffer = await this.renderBuffer(loopDurSec, stepDurMs, totalSteps)
    if (!buffer) { console.warn("[Loop] Buffer render returned null"); return }

    console.log("[Loop] Buffer rendered:", buffer.duration.toFixed(2) + "s", buffer.numberOfChannels + "ch", buffer.sampleRate + "Hz")
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(this.trackGain)
    source.start(0, offsetSec % loopDurSec)
    this.bufferSource = source
    console.log("[Loop] Playback started. AudioContext state:", this.ctx.state, "trackGain:", this.trackGain.gain.value)
  }

  stopPlayback() {
    if (this.bufferSource) {
      try { this.bufferSource.stop() } catch { /* */ }
      this.bufferSource.disconnect()
      this.bufferSource = null
    }
  }

  silence() {
    this.stopPlayback()
    this.trackGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.02)
  }

  // --- Editing helpers ---
  addStepFromNearest(stepIdx: number, stepDurMs: number): boolean {
    let nearest = -1, minDist = Infinity
    for (let i = 0; i < this.stepMask.length; i++) {
      if (this.stepHasAudio[i] && this.stepMask[i]) {
        const d = Math.abs(i - stepIdx)
        if (d < minDist) { minDist = d; nearest = i }
      }
    }
    if (nearest === -1) return false
    const srcStart = nearest * stepDurMs, srcEnd = srcStart + stepDurMs
    let src: LoopFrame | null = null
    for (const f of this.frames) {
      if (f.t >= srcStart && f.t < srcEnd && (f.freqs.length > 0 || f.pitchHz > 0)) { src = f; break }
    }
    if (!src) return false
    const tStart = stepIdx * stepDurMs
    const synth: LoopFrame = { ...src, t: tStart }
    let insertAt = this.frames.length
    for (let i = 0; i < this.frames.length; i++) {
      if (this.frames[i].t > tStart) { insertAt = i; break }
    }
    this.frames.splice(insertAt, 0, synth)
    this.stepMask[stepIdx] = true
    this.stepHasAudio[stepIdx] = true
    this.stepChords[stepIdx] = src.chord
    this.hasContent = true
    return true
  }

  removeStep(stepIdx: number) { this.stepMask[stepIdx] = false }

  placeChord(stepIdx: number, chord: string, freqs: number[], volume: number, filterTilt: number, stepDurMs: number) {
    const t = stepIdx * stepDurMs
    const frame: LoopFrame = { t, freqs, volume, filterTilt, chord, mode: "gesture", pitchHz: 0, thereminVol: 0 }
    let insertAt = this.frames.length
    for (let i = 0; i < this.frames.length; i++) {
      if (this.frames[i].t > t) { insertAt = i; break }
    }
    this.frames.splice(insertAt, 0, frame)
    this.stepMask[stepIdx] = true
    this.stepHasAudio[stepIdx] = true
    this.stepChords[stepIdx] = chord
    this.hasContent = true
  }

  getSteps(): StepDisplay[] {
    return this.stepMask.map((_, i) => ({
      chord: this.stepChords[i], hasAudio: this.stepHasAudio[i], muted: !this.stepMask[i],
    }))
  }
}

export class LoopEngine {
  private ctx: AudioContext
  private bus: GainNode
  private tracks: LoopTrack[]
  private activeTrack = 0
  private gridBpm = 120
  private gridBars = 4
  private beatsPerBar = 4
  private metronome = false
  private metronomeVolume = 0.25
  private metronomeSound: "click" | "wood" | "beep" | "hihat" = "click"
  /** Free-running click track for guided practice (not tied to loop record/play). */
  private practiceMetro = false
  private practiceMetroVolume = 0.75
  private practiceMetroNextBeat = 0
  private practiceMetroBeatIndex = 0
  /** AudioContext time of beat 0 for practice transport sync. */
  private practiceMetroOrigin = 0
  private globalState: LoopState = "idle"
  private countInStart = 0
  private countInDuration = 0
  private countInBeat = -1
  private recordStart = 0
  private loopDuration = 0
  private audioPlayStart = 0
  private _currentStep = -1
  private _didRestart = false
  private lastDisplayedStep = -1
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null

  constructor(ctx: AudioContext, bus: GainNode) {
    this.ctx = ctx
    this.bus = bus
    this.tracks = Array.from({ length: MAX_TRACKS }, () => new LoopTrack(ctx, bus))
  }

  // --- Grid ---
  setGrid(bpm: number, bars: number) { this.gridBpm = bpm; this.gridBars = bars }
  setBpm(bpm: number) { this.gridBpm = bpm }
  setBars(bars: number) { this.gridBars = bars }
  setBeatsPerBar(b: number) { this.beatsPerBar = b }
  getBeatsPerBar() { return this.beatsPerBar }
  getBpm() { return this.gridBpm }
  getBars() { return this.gridBars }
  getSubsPerBeat() { return SUBS_PER_BEAT }
  setMetronome(on: boolean) { this.metronome = on }
  getMetronome() { return this.metronome }
  setMetronomeVolume(v: number) { this.metronomeVolume = Math.max(0, Math.min(1, v)) }
  getMetronomeVolume() { return this.metronomeVolume }
  setMetronomeSound(s: "click" | "wood" | "beep" | "hihat") { this.metronomeSound = s }
  getMetronomeSound() { return this.metronomeSound }

  /** Start a continuous metronome at the current grid BPM (used by Learn / guided practice). */
  startPracticeMetronome() {
    void this.ctx.resume()
    this.practiceMetro = true
    this.practiceMetroOrigin = this.ctx.currentTime + 0.05
    this.practiceMetroNextBeat = this.practiceMetroOrigin
    this.practiceMetroBeatIndex = 0
    this.schedulePracticeMetronomeAhead()
  }

  stopPracticeMetronome() {
    this.practiceMetro = false
  }

  getPracticeMetronome() {
    return this.practiceMetro
  }

  /** Elapsed beats since practice metronome beat 0 (for chart playhead sync). */
  getPracticeTransportBeats() {
    if (!this.practiceMetro) return 0
    const beatSec = this.beatDurationSec()
    if (beatSec <= 0) return 0
    return Math.max(0, (this.ctx.currentTime - this.practiceMetroOrigin) / beatSec)
  }

  setPracticeMetronomeVolume(v: number) {
    this.practiceMetroVolume = Math.max(0, Math.min(1, v))
  }

  getPracticeMetronomeVolume() {
    return this.practiceMetroVolume
  }

  private schedulePracticeMetronomeAhead() {
    if (!this.practiceMetro || this.practiceMetroVolume <= 0) return
    const beatSec = this.beatDurationSec()
    if (beatSec <= 0) return
    const horizon = this.ctx.currentTime + 1.5
    // If BPM jumped and next beat is far in the past, resync
    if (this.practiceMetroNextBeat < this.ctx.currentTime - beatSec) {
      this.practiceMetroNextBeat = this.ctx.currentTime
    }
    while (this.practiceMetroNextBeat < horizon) {
      const accent = this.practiceMetroBeatIndex % this.beatsPerBar === 0
      this.playClick(this.practiceMetroNextBeat, accent)
      this.practiceMetroNextBeat += beatSec
      this.practiceMetroBeatIndex++
    }
  }

  getTotalSteps() { return this.gridBars * this.beatsPerBar * SUBS_PER_BEAT }
  private gridDurationMs() { return this.gridBars * this.beatsPerBar * (60 / this.gridBpm) * 1000 }
  private stepDurationMs() { return (60 / this.gridBpm) / SUBS_PER_BEAT * 1000 }
  private loopDurationSec() { return this.loopDuration / 1000 }
  private beatDurationSec() { return 60 / this.gridBpm }

  // --- Track management ---
  setActiveTrack(idx: number) { if (idx >= 0 && idx < MAX_TRACKS) this.activeTrack = idx }
  getActiveTrack() { return this.activeTrack }
  getTrackCount() { return MAX_TRACKS }

  getTrackInfo(idx: number): TrackInfo {
    const t = this.tracks[idx]
    return {
      steps: t.getSteps(), playing: t.playing, hasContent: t.hasContent,
      volume: t.volume, muted: t.muted, solo: t.solo,
    }
  }

  private updateAllTrackGains() {
    const anySolo = this.tracks.some((t) => t.solo)
    for (const t of this.tracks) {
      const effectivelyMuted = t.muted || (anySolo && !t.solo)
      t.updateGain(effectivelyMuted)
    }
  }

  setTrackVolume(idx: number, vol: number) {
    this.tracks[idx].volume = Math.max(0, Math.min(1, vol))
    this.updateAllTrackGains()
  }

  setTrackMuted(idx: number, muted: boolean) {
    this.tracks[idx].muted = muted
    this.updateAllTrackGains()
  }

  setTrackSolo(idx: number, solo: boolean) {
    this.tracks[idx].solo = solo
    this.updateAllTrackGains()
  }

  // --- Count-in ---
  startCountIn() {
    const track = this.tracks[this.activeTrack]
    track.silence()
    track.playing = false
    track.init(this.getTotalSteps())
    this.loopDuration = this.gridDurationMs()
    this.globalState = "countIn"
    this.countInBeat = -1

    const now = this.ctx.currentTime
    const beatSec = this.beatDurationSec()
    this.countInDuration = this.beatsPerBar * beatSec * 1000
    this.countInStart = performance.now()

    for (let i = 0; i < this.beatsPerBar; i++) this.playClick(now + i * beatSec, i === 0)
  }

  tickCountIn(): boolean {
    if (this.globalState !== "countIn") return false
    const elapsed = performance.now() - this.countInStart
    this.countInBeat = Math.floor(elapsed / (this.beatDurationSec() * 1000))
    if (elapsed >= this.countInDuration) {
      this.globalState = "recording"
      this.recordStart = performance.now()
      if (this.metronome) this.scheduleRecordingMetronome()
      return true
    }
    return false
  }

  getCountInBeat() { return this.countInBeat }

  private playClick(time: number, accent: boolean) {
    const base = this.practiceMetro ? this.practiceMetroVolume : this.metronomeVolume
    if (base <= 0) return
    const vol = base * (accent ? 1.0 : 0.7)
    const g = this.ctx.createGain()
    g.connect(this.bus)

    switch (this.metronomeSound) {
      case "click": {
        const osc = this.ctx.createOscillator()
        osc.type = "sine"
        osc.frequency.value = accent ? 1000 : 800
        g.gain.setValueAtTime(vol, time)
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.06)
        osc.connect(g)
        osc.start(time)
        osc.stop(time + 0.07)
        break
      }
      case "wood": {
        const osc = this.ctx.createOscillator()
        osc.type = "triangle"
        osc.frequency.setValueAtTime(accent ? 1800 : 1400, time)
        osc.frequency.exponentialRampToValueAtTime(200, time + 0.02)
        g.gain.setValueAtTime(vol, time)
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.035)
        osc.connect(g)
        osc.start(time)
        osc.stop(time + 0.04)
        break
      }
      case "beep": {
        const osc = this.ctx.createOscillator()
        osc.type = "square"
        osc.frequency.value = accent ? 880 : 660
        g.gain.setValueAtTime(vol * 0.4, time)
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.05)
        osc.connect(g)
        osc.start(time)
        osc.stop(time + 0.06)
        break
      }
      case "hihat": {
        // Noise-like using multiple detuned high oscillators
        const freqs = accent ? [4000, 6500, 9000] : [5000, 7500]
        g.gain.setValueAtTime(vol * 0.35, time)
        g.gain.exponentialRampToValueAtTime(0.001, time + (accent ? 0.08 : 0.04))
        freqs.forEach((f) => {
          const osc = this.ctx.createOscillator()
          osc.type = "square"
          osc.frequency.value = f
          osc.connect(g)
          osc.start(time)
          osc.stop(time + 0.09)
        })
        break
      }
    }
  }

  private scheduleRecordingMetronome() {
    const now = this.ctx.currentTime
    const beatSec = this.beatDurationSec()
    const totalBeats = this.gridBars * this.beatsPerBar
    for (let i = 0; i < totalBeats; i++) this.playClick(now + i * beatSec, i % this.beatsPerBar === 0)
  }

  // --- Recording ---
  recordFrame(data: Omit<LoopFrame, "t">): boolean {
    if (this.globalState !== "recording") return false
    const t = performance.now() - this.recordStart
    if (t >= this.loopDuration) { this.finishRecording(); return true }
    const stepIdx = Math.min(this.getTotalSteps() - 1, Math.floor(t / this.stepDurationMs()))
    this.tracks[this.activeTrack].addFrame({ ...data, t }, stepIdx)
    return false
  }

  private async finishRecording() {
    const track = this.tracks[this.activeTrack]
    this.globalState = "idle"
    this.countInBeat = -1
    console.log("[Loop] finishRecording — hasContent:", track.hasContent, "frames:", track.frames.length, "activeSteps:", track.stepMask.filter(Boolean).length)
    if (track.hasContent) {
      track.playing = true
      const loopSec = this.loopDurationSec()
      const stepMs = this.stepDurationMs()
      const total = this.getTotalSteps()

      // Calculate sync offset if other tracks are already playing
      let offset = 0
      const anyOtherPlaying = this.tracks.some((t, i) => i !== this.activeTrack && t.playing)
      if (anyOtherPlaying) {
        offset = (this.ctx.currentTime - this.audioPlayStart) % loopSec
      } else {
        this.audioPlayStart = this.ctx.currentTime
      }

      this.updateAllTrackGains()
      await track.startPlayback(loopSec, stepMs, total, offset)

      // Auto-advance
      for (let i = 1; i <= MAX_TRACKS; i++) {
        const nextIdx = (this.activeTrack + i) % MAX_TRACKS
        if (!this.tracks[nextIdx].hasContent) { this.activeTrack = nextIdx; break }
      }
    }
  }

  stopRecording(): LoopState {
    if (this.globalState === "countIn") { this.globalState = "idle"; this.countInBeat = -1; return "idle" }
    if (this.globalState === "recording") this.finishRecording()
    return this.globalState
  }

  // --- Playback display (UI only — audio is handled by buffer sources) ---
  tick(_now: number) {
    if (this.practiceMetro) this.schedulePracticeMetronomeAhead()

    const anyPlaying = this.tracks.some((t) => t.playing)
    if (!anyPlaying) return
    if (this.loopDuration === 0) this.loopDuration = this.gridDurationMs()

    const audioNow = this.ctx.currentTime
    const loopSec = this.loopDurationSec()
    if (loopSec <= 0) return

    const elapsedInLoop = ((audioNow - this.audioPlayStart) % loopSec + loopSec) % loopSec
    const elapsedMs = elapsedInLoop * 1000
    const stepIdx = Math.min(this.getTotalSteps() - 1, Math.floor(elapsedMs / this.stepDurationMs()))

    this._didRestart = stepIdx < this.lastDisplayedStep && this.lastDisplayedStep > 0
    this.lastDisplayedStep = stepIdx
    this._currentStep = stepIdx
  }

  // --- Editing (rebuild buffer after changes) ---
  private scheduleRebuild(trackIdx: number) {
    if (this.rebuildTimer) clearTimeout(this.rebuildTimer)
    this.rebuildTimer = setTimeout(() => {
      const track = this.tracks[trackIdx]
      if (track.playing && track.hasContent) {
        const loopSec = this.loopDurationSec()
        const offset = (this.ctx.currentTime - this.audioPlayStart) % loopSec
        track.startPlayback(loopSec, this.stepDurationMs(), this.getTotalSteps(), offset)
        this.updateAllTrackGains()
      }
    }, 50) // debounce 50ms
  }

  toggleStep(trackIdx: number, stepIdx: number) {
    const track = this.tracks[trackIdx]
    if (!track || stepIdx < 0 || stepIdx >= track.stepMask.length) return
    if (track.stepHasAudio[stepIdx] && track.stepMask[stepIdx]) {
      track.removeStep(stepIdx)
    } else if (track.stepHasAudio[stepIdx]) {
      track.stepMask[stepIdx] = true
    } else {
      track.addStepFromNearest(stepIdx, this.stepDurationMs())
    }
    this.scheduleRebuild(trackIdx)
  }

  placeChord(trackIdx: number, stepIdx: number, chord: string, freqs: number[], volume = 0.7, filterTilt = 0) {
    const track = this.tracks[trackIdx]
    if (!track) return
    if (track.stepMask.length === 0) track.init(this.getTotalSteps())
    track.placeChord(stepIdx, chord, freqs, volume, filterTilt, this.stepDurationMs())
    if (!track.playing && track.hasContent) {
      track.playing = true
      if (this.loopDuration === 0) this.loopDuration = this.gridDurationMs()
      this.audioPlayStart = this.ctx.currentTime
    }
    this.scheduleRebuild(trackIdx)
  }

  // --- Pause / Resume ---
  private pausedTracks: boolean[] = []

  pauseAll() {
    this.pausedTracks = this.tracks.map((t) => t.playing)
    for (const track of this.tracks) { track.stopPlayback(); track.playing = false }
    this._currentStep = -1
  }

  async resumeAll() {
    const loopSec = this.loopDurationSec()
    const stepMs = this.stepDurationMs()
    const total = this.getTotalSteps()
    this.audioPlayStart = this.ctx.currentTime

    for (let i = 0; i < this.tracks.length; i++) {
      if (this.pausedTracks[i] && this.tracks[i].hasContent) {
        this.tracks[i].playing = true
        await this.tracks[i].startPlayback(loopSec, stepMs, total)
      }
    }
    this.updateAllTrackGains()
    this.pausedTracks = []
  }

  isPaused() { return this.pausedTracks.length > 0 && this.pausedTracks.some((p) => p) }

  clearTrack(trackIdx: number) {
    const track = this.tracks[trackIdx]
    if (!track) return
    track.silence()
    track.playing = false
    track.hasContent = false
    track.init(this.getTotalSteps())
  }

  clearAll() {
    for (let i = 0; i < MAX_TRACKS; i++) this.clearTrack(i)
    this.globalState = "idle"
    this._currentStep = -1
    this.lastDisplayedStep = -1
    this.countInBeat = -1
  }

  stopAll() {
    for (const track of this.tracks) { track.stopPlayback(); track.playing = false }
    this._currentStep = -1
    this.lastDisplayedStep = -1
  }

  // --- Getters ---
  getState() { return this.globalState }
  isAnyTrackPlaying() { return this.tracks.some((t) => t.playing) }
  getDuration() { return this.loopDuration }
  getCurrentStep() { return this._currentStep }
  didRestart() { return this._didRestart }

  getProgress(): number {
    if (this.globalState === "countIn") {
      return this.countInDuration === 0 ? 0 : Math.min(1, (performance.now() - this.countInStart) / this.countInDuration)
    }
    if (this.globalState === "recording") {
      return this.loopDuration === 0 ? 0 : Math.min(1, (performance.now() - this.recordStart) / this.loopDuration)
    }
    if (!this.isAnyTrackPlaying() || this.loopDuration === 0) return 0
    const loopSec = this.loopDurationSec()
    if (loopSec <= 0) return 0
    const elapsed = ((this.ctx.currentTime - this.audioPlayStart) % loopSec + loopSec) % loopSec
    return elapsed / loopSec
  }
}
