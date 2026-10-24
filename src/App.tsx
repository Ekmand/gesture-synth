import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { LoopEngine, type LoopState, type TrackInfo } from "./audio/LoopEngine"
import { MicInput } from "./audio/MicInput"
import { SynthEngine } from "./audio/SynthEngine"
import { BeatGrid, CountInDisplay } from "./components/BeatGrid"
import { GlobalRecorder } from "./components/GlobalRecorder"
import { HandCanvas } from "./components/HandCanvas"
import { Hud, type InstrumentMode } from "./components/Hud"
import { LoopControls } from "./components/LoopControls"
import {
  PracticeOverlay,
  SongLoadBanner,
} from "./components/practice/PracticeOverlay"
import { ScaleGuide } from "./components/ScaleGuide"
import { SongPicker } from "./components/SongPicker"
import { StartGate } from "./components/StartGate"
import { shouldShowTutorial, Tutorial } from "./components/Tutorial"
import { arrangementToPracticeSong } from "./lib/arrangementAdapter"
import { fetchArrangement } from "./lib/fetchArrangement"
import { keyNameToHz } from "./lib/keyHz"
import {
  loadCameraDeviceId,
  loadMicDeviceId,
  loadMicMonitor,
  saveMicMonitor,
  saveCameraDeviceId,
  saveMicDeviceId,
} from "./lib/recordingPrefs"
import { loadStopMode, saveStopMode, type StopMode } from "./recording/stopDetector"
import type { RecorderSources } from "./recording/SessionRecorder"
import { compareLive, isFullMatch } from "./lib/practiceMatch"
import type { GestureTarget, PracticeSong } from "./lib/practiceTypes"
import {
  loadSequencerVisible,
  saveSequencerVisible,
} from "./lib/sequencerPrefs"
import { isSupabaseConfigured } from "./lib/supabase"
import {
  chordTonesFromRoman,
  notesForQuality,
  qualityLabel,
} from "./music/chords"
import {
  loadGestureSettings,
  normalizeChordCase,
  saveGestureSettings,
  type GestureSettings,
} from "./music/gestureSettings"
import {
  chordFromLeftHand,
  createChordStabilizer,
  pitchFromHandY,
  raisedFingerCount,
  isThumbExtended,
  volumeFromHand,
  wristTilt,
  type StabilizedChord,
} from "./music/gestures"
import { useHandTracking } from "./vision/useHandTracking"
import styles from "./App.module.css"

type LiveState = {
  volume: number
  tone: number
  tonePct: number
  chord: string | null
  quality: string
  qualityIndex: number
  pitchHz: number
  octaveDown: boolean
  freqs: number[]
}

const idleLive: LiveState = {
  volume: 0, tone: 0, tonePct: 0, chord: null, quality: "--", qualityIndex: 0, pitchHz: 0, octaveDown: false, freqs: [],
}

const EMPTY_TRACKS: TrackInfo[] = Array.from({ length: 4 }, () => ({
  steps: [], playing: false, hasContent: false, volume: 1, muted: false, solo: false,
}))

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const synthRef = useRef(new SynthEngine())
  const stabilizeRef = useRef(createChordStabilizer())
  const [cameraDeviceId, setCameraDeviceId] = useState(() => loadCameraDeviceId())
  const { status, error, handsRef } = useHandTracking(videoRef, cameraDeviceId)

  const [audioOn, setAudioOn] = useState(false)
  const [mode, setMode] = useState<InstrumentMode>("gesture")
  const [keyHz, setKeyHz] = useState(220)
  const [gestureSettings, setGestureSettings] = useState<GestureSettings>(() =>
    loadGestureSettings(),
  )
  const [micDeviceId, setMicDeviceId] = useState(() => loadMicDeviceId())
  const [micMonitor, setMicMonitor] = useState(() => {
    const on = loadMicMonitor()
    synthRef.current.setMonitor(on)
    return on
  })
  const [stopMode, setStopMode] = useState<StopMode>(() => loadStopMode())
  const micInputRef = useRef(new MicInput())
  const settingsRef = useRef(gestureSettings)
  settingsRef.current = gestureSettings

  const loopRef = useRef<LoopEngine | null>(null)
  const [loopState, setLoopState] = useState<LoopState>("idle")
  const [loopProgress, setLoopProgress] = useState(0)
  const [loopDuration, setLoopDuration] = useState(0)
  const [loopBpm, setLoopBpm] = useState(120)
  const [loopBars, setLoopBars] = useState(4)
  const [loopBeatsPerBar, setLoopBeatsPerBar] = useState(4)
  const [loopDidRestart, setLoopDidRestart] = useState(false)
  const [metronome, setMetronome] = useState(false)
  const [metronomeVolume, setMetronomeVolume] = useState(0.25)
  const [metronomeSound, setMetronomeSound] = useState("click")
  const [practiceMetroOn, setPracticeMetroOn] = useState(false)
  const [practiceMetroVolume, setPracticeMetroVolume] = useState(0.75)
  /** Metronome waits until the learner sounds their first chord. */
  const [practiceFirstNote, setPracticeFirstNote] = useState(false)
  /** Current Learn target — audio only plays when the live gesture fully matches. */
  const practiceTargetRef = useRef<GestureTarget | null>(null)
  const [activeTrack, setActiveTrack] = useState(0)
  const [trackInfos, setTrackInfos] = useState<TrackInfo[]>(EMPTY_TRACKS)
  const [currentStep, setCurrentStep] = useState(-1)
  const [countInBeat, setCountInBeat] = useState(-1)
  const [isExporting, setIsExporting] = useState(false)

  const [live, setLive] = useState<LiveState>(idleLive)
  const liveFrameRef = useRef<LiveState>(idleLive)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const tutorialBooted = useRef(false)

  const [practiceSong, setPracticeSong] = useState<PracticeSong | null>(null)
  const [practiceOpen, setPracticeOpen] = useState(false)
  const [songLoadError, setSongLoadError] = useState<string | null>(null)
  const [songLoading, setSongLoading] = useState(false)
  const [songPickerOpen, setSongPickerOpen] = useState(false)
  const [sequencerVisible, setSequencerVisible] = useState(() => loadSequencerVisible())
  const practiceActiveRef = useRef(false)
  practiceActiveRef.current = practiceOpen
  /** Community arrangement UUID from `?a=<uuid>` (same ids as community.gesturesynth.com/a/…). */
  const deepLinkArrangementId = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      return params.get("a") ?? params.get("song")
    } catch {
      return null
    }
  }, [])

  const loadArrangementById = useCallback(async (id: string) => {
    setSongLoading(true)
    setSongLoadError(null)
    try {
      if (!isSupabaseConfigured()) {
        throw new Error(
          "Song links need VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY configured.",
        )
      }
      const row = await fetchArrangement(id)
      if (!row) {
        setSongLoadError("Song not found or not public.")
        return
      }
      const practice = arrangementToPracticeSong(row)
      setPracticeSong(practice)
      setPracticeOpen(true)
      setPracticeMetroOn(false)
      setPracticeFirstNote(false)
      practiceTargetRef.current = null
      setMode("gesture")
      setKeyHz(keyNameToHz(practice.key))
      setLoopBpm(practice.bpm)
      try {
        const url = new URL(window.location.href)
        url.searchParams.set("a", id)
        url.searchParams.delete("song")
        window.history.replaceState({}, "", url.pathname + url.search + url.hash)
      } catch {
        /* ignore */
      }
    } catch (err) {
      setSongLoadError(err instanceof Error ? err.message : "Failed to load song.")
    } finally {
      setSongLoading(false)
    }
  }, [])

  const handleSequencerVisibleChange = useCallback((visible: boolean) => {
    setSequencerVisible(visible)
    saveSequencerVisible(visible)
  }, [])

  const getResult = useCallback(() => handsRef.current.result, [handsRef])
  const getHands = useCallback(() => handsRef.current, [handsRef])
  const getWaveParams = useCallback(
    () => ({
      volume: liveFrameRef.current.volume,
      qualityIndex:
        mode === "gesture"
          ? liveFrameRef.current.qualityIndex
          : liveFrameRef.current.volume > 0 ? 2 : 0,
      tone: liveFrameRef.current.tone,
      chord: liveFrameRef.current.chord,
    }),
    [mode],
  )

  const handleMicChange = useCallback((id: string) => {
    setMicDeviceId(id)
    saveMicDeviceId(id)
  }, [])

  const handleMicMonitorChange = useCallback((on: boolean) => {
    setMicMonitor(on)
    saveMicMonitor(on)
    synthRef.current.setMonitor(on)
  }, [])

  const handleStopModeChange = useCallback((m: StopMode) => {
    setStopMode(m)
    saveStopMode(m)
  }, [])

  const handleCameraChange = useCallback((id: string) => {
    setCameraDeviceId(id)
    saveCameraDeviceId(id)
  }, [])

  const getRecorderSources = useCallback((): RecorderSources | null => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null
    const synth = synthRef.current
    return {
      video,
      audioCtx: synth.getContext(),
      bus: synth.getMixBus(),
      synthBus: synth.getOutputBus(),
      micOutput: micInputRef.current.output,
      getResult,
      getWave: getWaveParams,
      getOverlay: () => ({
        mode,
        chord: liveFrameRef.current.chord,
        quality: liveFrameRef.current.quality,
        octaveDown: liveFrameRef.current.octaveDown,
        freqs: liveFrameRef.current.freqs,
      }),
    }
  }, [getResult, getWaveParams, mode])

  const updateGestureSettings = (next: GestureSettings) => {
    setGestureSettings(next)
    saveGestureSettings(next)
  }

  const syncTrackInfos = useCallback(() => {
    const loop = loopRef.current
    if (!loop) return
    const infos: TrackInfo[] = []
    for (let i = 0; i < loop.getTrackCount(); i++) infos.push(loop.getTrackInfo(i))
    setTrackInfos(infos)
  }, [])

  // Deep link: /?a=<arrangement-uuid> → fetch from shared community Supabase → learn/practice mode
  useEffect(() => {
    if (!deepLinkArrangementId) return
    void loadArrangementById(deepLinkArrangementId)
  }, [deepLinkArrangementId, loadArrangementById])

  useEffect(() => {
    if (status === "ready" && !tutorialBooted.current) {
      tutorialBooted.current = true
      // Skip first-run help when opening a community arrangement deep link
      if (deepLinkArrangementId) return
      if (shouldShowTutorial()) setTutorialOpen(true)
    }
  }, [deepLinkArrangementId, status])

  useEffect(() => {
    synthRef.current.setMode(mode)
    stabilizeRef.current = createChordStabilizer()
    setLive(idleLive)
  }, [mode])

  // --- Main rAF loop ---
  useEffect(() => {
    let raf = 0
    let lastUi = ""
    let loopUiTick = 0

    const publish = (next: LiveState) => {
      liveFrameRef.current = next
      const key = [next.chord, next.quality, next.qualityIndex, next.tonePct,
        Math.round(next.volume * 16), Math.round(next.pitchHz)].join("|")
      if (key === lastUi) return
      lastUi = key
      setLive(next)
    }

    const loop = () => {
      const now = performance.now()
      const { left, right } = handsRef.current
      const synth = synthRef.current
      const settings = settingsRef.current

      if (mode === "gesture") {
        const practice = practiceActiveRef.current
        let candidate: StabilizedChord | null = null
        if (left) {
          const leftTilt = wristTilt(left, "Left")
          const rawChord = chordFromLeftHand(left, "Left")
          const isMajorMode = !practice && settings.modeControl === "fixed"
            ? settings.fixedMode === "major" : leftTilt >= 0
          const qualityIndex = !practice && settings.qualityControl === "fixed"
            ? settings.fixedQuality : right ? raisedFingerCount(right) : 0
          const thumbDown = right ? isThumbExtended(right, "Right") : false
          if (rawChord) {
            candidate = {
              chord: normalizeChordCase(rawChord, isMajorMode),
              isMajorMode, qualityIndex, thumbDown,
            }
          }
        }

        const stable = stabilizeRef.current(candidate, now)
        const chord = stable?.chord ?? null
        const isMajor = stable?.isMajorMode ?? settings.fixedMode === "major"
        const qualityIndex = !practice && settings.qualityControl === "fixed"
          ? settings.fixedQuality : (stable?.qualityIndex ?? 0)
        const thumbDown = stable?.thumbDown ?? false
        const quality = qualityLabel(qualityIndex, isMajor, thumbDown)

        let volume = 0, tone = 0
        let playedFreqs: number[] = []
        if (right) {
          volume = volumeFromHand(right)
          tone = wristTilt(right, "Right")
          if (audioOn) {
            synth.updateFilterSweep(tone)
            if (chord && qualityIndex >= 1) {
              const target = practice ? practiceTargetRef.current : null
              const allowed = !practice || !target || isFullMatch(
                compareLive(stable, target),
              )
              if (allowed) {
                let notes = notesForQuality(
                  chordTonesFromRoman(chord, isMajor, keyHz), qualityIndex, isMajor)
                if (thumbDown) notes = notes.map((n) => n / 2)
                playedFreqs = notes
                synth.playNotes(notes)
                synth.setVolume(volume)
              } else {
                playedFreqs = []
                synth.setVolume(0)
              }
            } else { synth.setVolume(0) }
          }
        } else if (audioOn) { synth.setVolume(0) }

        const loopEng = loopRef.current
        if (loopEng && loopEng.getState() === "recording") {
          const autoStopped = loopEng.recordFrame({
            freqs: playedFreqs,
            volume: playedFreqs.length > 0 ? volume : 0,
            filterTilt: tone,
            chord: playedFreqs.length > 0 ? chord : null,
            mode: "gesture", pitchHz: 0, thereminVol: 0,
          })
          if (autoStopped) {
            setLoopState(loopEng.getState())
            setLoopDuration(loopEng.getDuration())
            syncTrackInfos()
          }
        }

        publish({
          volume: right ? volume : 0, tone,
          tonePct: Math.round(tone * 100), chord, quality, qualityIndex, pitchHz: 0,
          octaveDown: thumbDown, freqs: playedFreqs,
        })
      } else {
        const pitchHz = right ? pitchFromHandY(right) : 0
        const volume = left ? volumeFromHand(left) : 0
        const thereminActive = right && left && volume > 0.02
        if (audioOn) {
          if (thereminActive) synth.playTheremin(pitchHz, volume * 0.55)
          else synth.stopThereminAudio()
        }

        const loopEng = loopRef.current
        if (loopEng && loopEng.getState() === "recording") {
          const autoStopped = loopEng.recordFrame({
            freqs: [], volume: 0, filterTilt: 0, chord: null,
            mode: "theremin",
            pitchHz: thereminActive ? pitchHz : 0,
            thereminVol: thereminActive ? volume * 0.55 : 0,
          })
          if (autoStopped) {
            setLoopState(loopEng.getState())
            setLoopDuration(loopEng.getDuration())
            syncTrackInfos()
          }
        }

        publish({
          volume, tone: 0, tonePct: 0, chord: null, quality: "--",
          qualityIndex: right && left ? 2 : 0, pitchHz, octaveDown: false,
          freqs: thereminActive ? [pitchHz] : [],
        })
      }

      // Loop engine UI sync (tick is driven by Worker for background support)
      const loopEng = loopRef.current
      if (loopEng) {
        if (loopEng.getState() === "countIn") {
          const transitioned = loopEng.tickCountIn()
          setCountInBeat(loopEng.getCountInBeat())
          if (transitioned) { setLoopState("recording"); setCountInBeat(-1) }
        }
        const anyPlaying = loopEng.isAnyTrackPlaying()
        if (anyPlaying || loopEng.getState() === "recording") {
          const restarted = loopEng.didRestart()
          if (restarted) setLoopDidRestart(true)
          if (++loopUiTick % 4 === 0 || restarted) {
            setLoopProgress(loopEng.getProgress())
            setCurrentStep(loopEng.getCurrentStep())
            if (!restarted) setLoopDidRestart(false)
          }
        }
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [audioOn, handsRef, keyHz, mode, syncTrackInfos])

  // Live mic → output bus (monitoring + recording). Restarts when the device changes.
  useEffect(() => {
    if (!audioOn) return
    const mic = micInputRef.current
    void mic.start(
      synthRef.current.getContext(),
      synthRef.current.getMixBus(),
      synthRef.current.getMicMonitorNode(),
      micDeviceId,
      (amount) => synthRef.current.setDuck(amount),
    )
    return () => {
      mic.stop()
      synthRef.current.setDuck(1)
    }
  }, [audioOn, micDeviceId])

  // --- Worker-driven loop tick (runs in background tabs) ---
  useEffect(() => {
    const code = `let t=null;self.onmessage=e=>{if(e.data==="start"){if(t)clearInterval(t);t=setInterval(()=>self.postMessage(0),20)}else{if(t){clearInterval(t);t=null}}}`
    const blob = new Blob([code], { type: "application/javascript" })
    const worker = new Worker(URL.createObjectURL(blob))

    worker.onmessage = () => {
      loopRef.current?.tick(performance.now())
    }

    worker.postMessage("start")
    return () => { worker.postMessage("stop"); worker.terminate() }
  }, [])

  // --- Keyboard shortcuts ---
  useEffect(() => {
    if (!audioOn) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault()
          // Spacebar: stop recording > play/pause > (tap tempo handled by LoopControls)
          if (loopRef.current?.getState() !== "idle") handleLoopStop()
          else if (loopRef.current?.isAnyTrackPlaying() || loopRef.current?.isPaused()) handlePlayPause()
          // else: no content — spacebar is tap tempo (handled in LoopControls)
          break
        case "1": case "2": case "3": case "4":
          handleSelectTrack(Number(e.key) - 1)
          break
        case "m":
          handleTrackMute(activeTrack)
          break
        case "s":
          if (!e.ctrlKey && !e.metaKey) handleTrackSolo(activeTrack)
          break
        case "delete": case "backspace":
          if (e.shiftKey) handleClearAll()
          else handleClearTrack()
          break
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  })

  // --- Handlers ---
  const handleStart = () => {
    const ctx = synthRef.current.getContext()
    const bus = synthRef.current.getOutputBus()
    loopRef.current = new LoopEngine(ctx, bus)
    const bpm = practiceSong?.bpm ?? loopBpm
    loopRef.current.setGrid(bpm, loopBars)
    loopRef.current.setBeatsPerBar(loopBeatsPerBar)
    if (practiceSong) setLoopBpm(practiceSong.bpm)
    setAudioOn(true)
  }

  const handlePracticeTargetChange = useCallback((target: GestureTarget | null) => {
    practiceTargetRef.current = target
  }, [])

  const handleExitPractice = useCallback(() => {
    loopRef.current?.stopPracticeMetronome()
    setPracticeFirstNote(false)
    practiceTargetRef.current = null
    setPracticeOpen(false)
    try {
      const url = new URL(window.location.href)
      let changed = false
      for (const key of ["a", "song"] as const) {
        if (url.searchParams.has(key)) {
          url.searchParams.delete(key)
          changed = true
        }
      }
      if (changed) {
        window.history.replaceState({}, "", url.pathname + url.search + url.hash)
      }
    } catch {
      /* ignore */
    }
  }, [])

  // Arm metronome after the learner plays their first chord in Learn mode
  useEffect(() => {
    if (!practiceOpen || practiceFirstNote) return
    if (live.chord && live.volume > 0.02) setPracticeFirstNote(true)
  }, [practiceOpen, practiceFirstNote, live.chord, live.volume])

  // Guided practice: metronome at song BPM once the first note has been played
  useEffect(() => {
    const loop = loopRef.current
    if (!loop) return
    if (practiceOpen && audioOn && practiceSong) {
      loop.setBpm(practiceSong.bpm)
      setLoopBpm(practiceSong.bpm)
      loop.setPracticeMetronomeVolume(practiceMetroVolume)
      if (practiceMetroOn && practiceFirstNote) loop.startPracticeMetronome()
      else loop.stopPracticeMetronome()
      return () => loop.stopPracticeMetronome()
    }
    loop.stopPracticeMetronome()
  }, [practiceOpen, audioOn, practiceSong, practiceMetroOn, practiceFirstNote])

  useEffect(() => {
    loopRef.current?.setPracticeMetronomeVolume(practiceMetroVolume)
  }, [practiceMetroVolume])

  const handleLoopBpmChange = useCallback((bpm: number) => {
    setLoopBpm(bpm)
    loopRef.current?.setBpm(bpm)
  }, [])

  const handleLoopBarsChange = useCallback((bars: number) => {
    setLoopBars(bars)
    loopRef.current?.setBars(bars)
  }, [])

  const handleLoopBeatsPerBarChange = useCallback((beats: number) => {
    setLoopBeatsPerBar(beats)
    loopRef.current?.setBeatsPerBar(beats)
  }, [])

  const handleMetronomeToggle = useCallback(() => {
    setMetronome((prev) => {
      const next = !prev
      loopRef.current?.setMetronome(next)
      return next
    })
  }, [])

  const handleMetronomeVolume = useCallback((v: number) => {
    setMetronomeVolume(v)
    loopRef.current?.setMetronomeVolume(v)
  }, [])

  const handleMetronomeSound = useCallback((s: string) => {
    setMetronomeSound(s)
    loopRef.current?.setMetronomeSound(s as "click" | "wood" | "beep" | "hihat")
  }, [])

  const handleSelectTrack = useCallback((idx: number) => {
    setActiveTrack(idx)
    loopRef.current?.setActiveTrack(idx)
  }, [])

  const handleLoopRecord = useCallback(() => {
    loopRef.current?.startCountIn()
    setLoopState("countIn")
    setLoopProgress(0)
  }, [])

  const handleLoopStop = useCallback(() => {
    const loop = loopRef.current
    if (!loop) return
    loop.stopRecording()
    setLoopState("idle")
    setLoopDuration(loop.getDuration())
    setCountInBeat(-1)
    // Sync active track (may have auto-advanced)
    setActiveTrack(loop.getActiveTrack())
    syncTrackInfos()
  }, [syncTrackInfos])

  const handlePlayPause = useCallback(() => {
    const loop = loopRef.current
    if (!loop) return
    if (loop.isAnyTrackPlaying()) {
      loop.pauseAll()
    } else if (loop.isPaused()) {
      loop.resumeAll()
    }
    syncTrackInfos()
  }, [syncTrackInfos])

  const handleClearTrack = useCallback(() => {
    loopRef.current?.clearTrack(activeTrack)
    syncTrackInfos()
  }, [activeTrack, syncTrackInfos])

  const handleClearAll = useCallback(() => {
    loopRef.current?.clearAll()
    setLoopState("idle")
    setLoopProgress(0)
    setLoopDuration(0)
    setCurrentStep(-1)
    syncTrackInfos()
  }, [syncTrackInfos])

  const handleStopAll = useCallback(() => {
    loopRef.current?.stopAll()
    setCurrentStep(-1)
    syncTrackInfos()
  }, [syncTrackInfos])

  const handleToggleStep = useCallback((trackIdx: number, stepIdx: number) => {
    loopRef.current?.toggleStep(trackIdx, stepIdx)
    syncTrackInfos()
  }, [syncTrackInfos])

  const handlePlaceChord = useCallback((trackIdx: number, stepIdx: number, chord: string) => {
    const loop = loopRef.current
    if (!loop) return
    // Compute frequencies for this chord using current key settings
    const isMajor = chord === chord.toUpperCase()
    const tones = chordTonesFromRoman(chord, isMajor, keyHz)
    if (!tones) return
    const freqs = notesForQuality(tones, 1, isMajor) // default triad
    loop.placeChord(trackIdx, stepIdx, chord, freqs)
    syncTrackInfos()
  }, [keyHz, syncTrackInfos])

  const handleTrackVolume = useCallback((trackIdx: number, vol: number) => {
    loopRef.current?.setTrackVolume(trackIdx, vol)
    syncTrackInfos()
  }, [syncTrackInfos])

  const handleTrackMute = useCallback((trackIdx: number) => {
    const loop = loopRef.current
    if (!loop) return
    const info = loop.getTrackInfo(trackIdx)
    loop.setTrackMuted(trackIdx, !info.muted)
    syncTrackInfos()
  }, [syncTrackInfos])

  const handleTrackSolo = useCallback((trackIdx: number) => {
    const loop = loopRef.current
    if (!loop) return
    const info = loop.getTrackInfo(trackIdx)
    loop.setTrackSolo(trackIdx, !info.solo)
    syncTrackInfos()
  }, [syncTrackInfos])

  // --- WAV export ---
  const handleExport = useCallback(async () => {
    if (!loopRef.current || isExporting) return
    setIsExporting(true)
    try {
      const ctx = synthRef.current.getContext()
      const dest = ctx.createMediaStreamDestination()
      // Temporarily route master + loop to MediaRecorder
      const master = (synthRef.current as unknown as { masterGain: GainNode }).masterGain
      if (master) master.connect(dest)

      const recorder = new MediaRecorder(dest.stream, { mimeType: "audio/webm" })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

      const duration = loopRef.current.getDuration()
      recorder.start()
      await new Promise((r) => setTimeout(r, duration + 200))
      recorder.stop()
      await new Promise((r) => { recorder.onstop = r })

      if (master) master.disconnect(dest)

      const blob = new Blob(chunks, { type: "audio/webm" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `gesture-synth-loop.webm`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      /* export not supported */
    }
    setIsExporting(false)
  }, [isExporting])

  const anyTrackPlaying = trackInfos.some((t) => t.playing)
  const loopIsPaused = loopRef.current?.isPaused() ?? false

  const statusText = useMemo(() => {
    if (error) return "Camera blocked — allow access and reload"
    if (status === "requesting") return "Requesting camera..."
    if (status === "loading") return "Loading hand model..."
    if (!audioOn) return "Audio off — click to start"
    if (mode === "gesture") {
      const l = gestureSettings.modeControl === "fixed" ? "left = scale" : "left = scale + tilt"
      const r = gestureSettings.qualityControl === "fixed" ? "right = vol/tone" : "right = style + vol"
      return `Gesture · ${l} · ${r}`
    }
    return "Theremin · left = volume, right = pitch"
  }, [audioOn, error, gestureSettings, mode, status])

  return (
    <div className={styles.app}>
      <video ref={videoRef} className={styles.video} playsInline muted autoPlay />
      <HandCanvas
        videoRef={videoRef} getResult={getResult}
        getWaveParams={getWaveParams} dimmed={!audioOn}
      />

      <Hud
        mode={mode} onModeChange={setMode}
        keyHz={keyHz} onKeyChange={setKeyHz}
        gestureSettings={gestureSettings}
        onGestureSettingsChange={updateGestureSettings}
        sequencerVisible={sequencerVisible}
        onSequencerVisibleChange={handleSequencerVisibleChange}
        micDeviceId={micDeviceId} onMicDeviceIdChange={handleMicChange}
        cameraDeviceId={cameraDeviceId} onCameraDeviceIdChange={handleCameraChange}
        stopMode={stopMode} onStopModeChange={handleStopModeChange}
        micMonitor={micMonitor} onMicMonitorChange={handleMicMonitorChange}
        volume={live.volume} tonePct={live.tonePct}
        chord={live.chord} quality={live.quality}
        pitchHz={live.pitchHz}
        octaveDown={live.octaveDown}
        onHelp={() => setTutorialOpen(true)}
        onLearnSong={() => setSongPickerOpen(true)}
        statusText={statusText} audioOn={audioOn}
      />

      <GlobalRecorder
        visible={audioOn} stopMode={stopMode}
        getHands={getHands} getSources={getRecorderSources} />

      <ScaleGuide
        keyHz={keyHz} chord={live.chord}
        visible={mode === "gesture" && audioOn && !practiceOpen}
        scaleOnly={gestureSettings.modeControl === "fixed"}
      />

      <BeatGrid
        tracks={trackInfos}
        activeTrack={activeTrack}
        currentStep={currentStep}
        beatsPerBar={loopBeatsPerBar}
        subsPerBeat={4}
        onToggleStep={handleToggleStep}
        onPlaceChord={handlePlaceChord}
        onSelectTrack={handleSelectTrack}
        onTrackVolume={handleTrackVolume}
        onTrackMute={handleTrackMute}
        onTrackSolo={handleTrackSolo}
        visible={audioOn && sequencerVisible && !practiceOpen}
      />

      <CountInDisplay
        beat={countInBeat} beatsPerBar={loopBeatsPerBar}
        visible={loopState === "countIn" && sequencerVisible}
      />

      <LoopControls
        loopState={loopState} progress={loopProgress}
        duration={loopDuration} bpm={loopBpm}
        bars={loopBars} beatsPerBar={loopBeatsPerBar}
        activeTrack={activeTrack}
        anyTrackPlaying={anyTrackPlaying}
        isPaused={loopIsPaused}
        isExporting={isExporting}
        metronome={metronome}
        metronomeVolume={metronomeVolume}
        metronomeSound={metronomeSound}
        onMetronomeToggle={handleMetronomeToggle}
        onMetronomeVolume={handleMetronomeVolume}
        onMetronomeSound={handleMetronomeSound}
        onBpmChange={handleLoopBpmChange}
        onBarsChange={handleLoopBarsChange}
        onBeatsPerBarChange={handleLoopBeatsPerBarChange}
        onRecord={handleLoopRecord} onStop={handleLoopStop}
        onPlayPause={handlePlayPause}
        onClearTrack={handleClearTrack}
        onClearAll={handleClearAll} onStopAll={handleStopAll}
        onExport={handleExport}
        didRestart={loopDidRestart}
        visible={audioOn && sequencerVisible && !practiceOpen}
      />

      <SongPicker
        open={songPickerOpen}
        onClose={() => setSongPickerOpen(false)}
        onSelect={(id) => {
          setSongPickerOpen(false)
          void loadArrangementById(id)
        }}
      />

      {practiceSong && (
        <PracticeOverlay
          song={practiceSong}
          open={practiceOpen}
          live={{
            chord: live.chord,
            qualityIndex: live.qualityIndex,
            octaveDown: live.octaveDown,
          }}
          onExit={handleExitPractice}
          metronomeOn={practiceMetroOn}
          metronomeArmed={practiceFirstNote}
          metronomeVolume={practiceMetroVolume}
          onMetronomeOnChange={setPracticeMetroOn}
          onMetronomeVolumeChange={setPracticeMetroVolume}
          onPracticeTargetChange={handlePracticeTargetChange}
        />
      )}

      {(songLoadError || songLoading) && (
        <SongLoadBanner
          message={songLoading ? "Loading song…" : songLoadError!}
          onDismiss={() => {
            setSongLoadError(null)
            setSongLoading(false)
          }}
        />
      )}

      {!audioOn && (
        <StartGate onStart={handleStart}
          cameraReady={status === "ready"} cameraError={error}
        />
      )}

      <Tutorial open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </div>
  )
}
