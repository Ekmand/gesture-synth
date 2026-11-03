import { useCallback, useEffect, useRef, useState } from "react"
import { SessionRecorder, type RecorderSources } from "../recording/SessionRecorder"
// import { makeZip } from "../lib/zip"
import { createGestureDetector, GESTURE_RECORDING_ENABLED, HOLD_MS, type StopMode } from "../recording/stopDetector"
import type { Landmark } from "../music/gestures"
import styles from "./GlobalRecorder.module.css"

type Props = {
  visible: boolean
  stopMode: StopMode
  getHands: () => { result: { landmarks: Landmark[][] } | null }
  /** Builds the sources at the moment recording starts (so mic choice is current). */
  getSources: () => RecorderSources | null
}

export function GlobalRecorder({ visible, stopMode, getHands, getSources }: Props) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [stopProgress, setStopProgress] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  const recorderRef = useRef<SessionRecorder | null>(null)
  const startTimeRef = useRef(0)

  const startRecording = useCallback(async () => {
    const sources = getSources()
    if (!sources) return
    const recorder = new SessionRecorder()
    try {
      await recorder.start(sources)
    } catch {
      setNote("Recording isn't supported in this browser")
      return
    }
    recorderRef.current = recorder
    startTimeRef.current = Date.now()
    setNote(null)
    setElapsed(0)
    setRecording(true)
  }, [getSources])

  /** `trimMs` cuts that much off the end, e.g. the time spent holding the stop gesture. */
  const stopRecording = useCallback(async (trimMs = 0) => {
    const recorder = recorderRef.current
    if (!recorder) return
    recorderRef.current = null
    setRecording(false)
    const files = await recorder.stop(trimMs)
    if (files.length === 0) {
      setNote("Recording produced no data — nothing saved")
      return
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-")
    // Stems zip is disabled for now; download just the full video.
    // const zip = await makeZip(files.map((f) => ({ name: `gesture-synth-${stamp}-${f.name}`, blob: f.blob })))
    // download as `gesture-synth-${stamp}.zip`
    const full = files.find((f) => f.name.startsWith("full.")) ?? files[0]
    const url = URL.createObjectURL(full.blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `gesture-synth-${stamp}.${full.name.split(".").pop()}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }, [])

  useEffect(() => {
    if (!recording) return
    const id = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)),
      500,
    )
    return () => window.clearInterval(id)
  }, [recording])

  // Hand-gesture control: hold both fists to start/stop; "no hands" only stops.
  const toggleRef = useRef<() => void>(() => {})
  toggleRef.current = () => {
    if (recorderRef.current) void stopRecording(stopMode === "manual" ? 0 : HOLD_MS[stopMode])
    else void startRecording()
  }
  useEffect(() => {
    if (!GESTURE_RECORDING_ENABLED || !visible || stopMode === "manual") return
    const detect = createGestureDetector(stopMode)
    let raf = 0
    const tick = () => {
      // "No hands" must only ever stop a recording, never start one.
      const active = stopMode === "fists" || recorderRef.current !== null
      const { progress, done } = active
        ? detect(getHands().result?.landmarks ?? [], performance.now())
        : { progress: 0, done: false }
      setStopProgress((p) => (Math.abs(p - progress) > 0.02 || progress === 0 ? progress : p))
      if (done) toggleRef.current()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      setStopProgress(0)
    }
  }, [visible, stopMode, getHands])

  useEffect(() => () => { void recorderRef.current?.stop() }, [])

  if (!visible) return null

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60

  const hasChip = recording || stopProgress > 0 || note !== null

  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.recBtn}
        data-recording={recording}
        onClick={() => void (recording ? stopRecording() : startRecording())}
        aria-label={recording ? "Stop video recording" : "Start video recording"}
        title={recording ? "Stop recording" : "Record video"}
      >
        <span className={styles.recDot} />
      </button>
      {hasChip && (
        <span className={styles.chip}>
          {recording && (
            <span className={styles.timer}>
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </span>
          )}
          {stopProgress > 0 && (
            <span className={styles.label}>{recording ? "Stopping…" : "Starting…"}</span>
          )}
          {note && <span className={styles.label}>{note}</span>}
        </span>
      )}
    </div>
  )
}
