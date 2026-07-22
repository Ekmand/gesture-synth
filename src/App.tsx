import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { SynthEngine } from "./audio/SynthEngine"
import { HandCanvas } from "./components/HandCanvas"
import { Hud, type InstrumentMode } from "./components/Hud"
import { ScaleGuide } from "./components/ScaleGuide"
import { StartGate } from "./components/StartGate"
import { shouldShowTutorial, Tutorial } from "./components/Tutorial"
import {
  chordTonesFromRoman,
  notesForQuality,
  qualityLabel,
} from "./music/chords"
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
}

const idleLive: LiveState = {
  volume: 0,
  tone: 0,
  tonePct: 0,
  chord: null,
  quality: "--",
  qualityIndex: 0,
  pitchHz: 0,
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const synthRef = useRef(new SynthEngine())
  const stabilizeRef = useRef(createChordStabilizer())
  const { status, error, handsRef } = useHandTracking(videoRef)

  const [audioOn, setAudioOn] = useState(false)
  const [mode, setMode] = useState<InstrumentMode>("gesture")
  const [keyHz, setKeyHz] = useState(220)
  const [live, setLive] = useState<LiveState>(idleLive)
  const liveFrameRef = useRef<LiveState>(idleLive)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const tutorialBooted = useRef(false)

  const getResult = useCallback(() => handsRef.current.result, [handsRef])
  const getWaveParams = useCallback(
    () => ({
      volume: liveFrameRef.current.volume,
      qualityIndex:
        mode === "gesture"
          ? liveFrameRef.current.qualityIndex
          : liveFrameRef.current.volume > 0
            ? 2
            : 0,
      tone: liveFrameRef.current.tone,
      chord: liveFrameRef.current.chord,
    }),
    [mode],
  )

  useEffect(() => {
    if (status === "ready" && !tutorialBooted.current) {
      tutorialBooted.current = true
      if (shouldShowTutorial()) setTutorialOpen(true)
    }
  }, [status])

  useEffect(() => {
    synthRef.current.setMode(mode)
    stabilizeRef.current = createChordStabilizer()
    setLive(idleLive)
  }, [mode])

  useEffect(() => {
    let raf = 0
    let lastUi = ""

    const publish = (next: LiveState) => {
      liveFrameRef.current = next
      const key = [
        next.chord,
        next.quality,
        next.qualityIndex,
        next.tonePct,
        Math.round(next.volume * 16),
        Math.round(next.pitchHz),
      ].join("|")
      if (key === lastUi) return
      lastUi = key
      setLive(next)
    }

    const loop = () => {
      const now = performance.now()
      const { left, right } = handsRef.current
      const synth = synthRef.current

      if (mode === "gesture") {
        let candidate: StabilizedChord | null = null
        if (left) {
          const leftTilt = wristTilt(left, "Left")
          const chord = chordFromLeftHand(left, "Left")
          const qualityIndex = right ? raisedFingerCount(right) : 0
          const thumbDown = right ? isThumbExtended(right, "Right") : false
          if (chord) {
            candidate = {
              chord,
              isMajorMode: leftTilt >= 0,
              qualityIndex,
              thumbDown,
            }
          }
        }

        const stable = stabilizeRef.current(candidate, now)
        const chord = stable?.chord ?? null
        const isMajor = stable?.isMajorMode ?? true
        const qualityIndex = stable?.qualityIndex ?? 0
        const thumbDown = stable?.thumbDown ?? false
        const quality = qualityLabel(qualityIndex, isMajor, thumbDown)

        let volume = 0
        let tone = 0
        if (right) {
          volume = volumeFromHand(right)
          tone = wristTilt(right, "Right")
          if (audioOn) {
            synth.updateFilterSweep(tone)
            if (chord && qualityIndex >= 1) {
              let notes = notesForQuality(
                chordTonesFromRoman(chord, isMajor, keyHz),
                qualityIndex,
                isMajor,
              )
              if (thumbDown) notes = notes.map((n) => n / 2)
              synth.playNotes(notes)
              synth.setVolume(volume)
            } else {
              synth.setVolume(0)
            }
          }
        } else if (audioOn) {
          synth.setVolume(0)
        }

        publish({
          volume: right ? volume : 0,
          tone,
          tonePct: Math.round(tone * 100),
          chord,
          quality,
          qualityIndex,
          pitchHz: 0,
        })
      } else {
        const pitchHz = right ? pitchFromHandY(right) : 0
        const volume = left ? volumeFromHand(left) : 0
        if (audioOn) {
          if (right && left && volume > 0.02) {
            synth.playTheremin(pitchHz, volume * 0.55)
          } else {
            synth.stopThereminAudio()
          }
        }
        publish({
          volume,
          tone: 0,
          tonePct: 0,
          chord: null,
          quality: "--",
          qualityIndex: right && left ? 2 : 0,
          pitchHz,
        })
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [audioOn, handsRef, keyHz, mode])

  const handleStart = () => {
    synthRef.current.ensureContext()
    setAudioOn(true)
  }

  const statusText = useMemo(() => {
    if (error) return "Camera blocked — allow access and reload"
    if (status === "requesting") return "Requesting camera…"
    if (status === "loading") return "Loading hand model…"
    if (!audioOn) return "Audio off — click to start"
    if (mode === "gesture") return "Gesture mode · show both hands"
    return "Theremin · left = volume, right = pitch"
  }, [audioOn, error, mode, status])

  return (
    <div className={styles.app}>
      <video ref={videoRef} className={styles.video} playsInline muted autoPlay />
      <HandCanvas
        videoRef={videoRef}
        getResult={getResult}
        getWaveParams={getWaveParams}
        dimmed={!audioOn}
      />

      <Hud
        mode={mode}
        onModeChange={setMode}
        keyHz={keyHz}
        onKeyChange={setKeyHz}
        volume={live.volume}
        tonePct={live.tonePct}
        chord={live.chord}
        quality={live.quality}
        pitchHz={live.pitchHz}
        onHelp={() => setTutorialOpen(true)}
        statusText={statusText}
        audioOn={audioOn}
      />

      <ScaleGuide
        keyHz={keyHz}
        chord={live.chord}
        visible={mode === "gesture" && audioOn}
      />

      {!audioOn && (
        <StartGate
          onStart={handleStart}
          cameraReady={status === "ready"}
          cameraError={error}
        />
      )}

      <Tutorial open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </div>
  )
}
