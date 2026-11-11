import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { dismissVoiceHint, voiceHintDismissed, type RecordingPrefs } from "../lib/recordingPrefs"
import { SessionRecorder } from "../recording/SessionRecorder"
import type { PerformanceFrame } from "../recording/drawPerformance"
import styles from "./GlobalRecorder.module.css"

type Props = {
  visible: boolean
  getAudio: () => { ctx: AudioContext; bus: AudioNode } | null
  getPrefs: () => RecordingPrefs
  getFrame: () => PerformanceFrame
}

export function GlobalRecorder({ visible, getAudio, getPrefs, getFrame }: Props) {
  const [phase, setPhase] = useState<"idle" | "hint" | "count" | "recording">("idle")
  const [count, setCount] = useState(3)
  const [elapsed, setElapsed] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  const [skipHint, setSkipHint] = useState(false)
  const hintGoRef = useRef<HTMLButtonElement>(null)
  const recorderRef = useRef<SessionRecorder | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const countRef = useRef(0)
  const startTimeRef = useRef(0)
  const getFrameRef = useRef(getFrame)
  getFrameRef.current = getFrame

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current
    recorderRef.current = null
    setPhase("idle")
    setElapsed(0)
    if (!recorder) return
    const blob = await recorder.stop()
    if (blob.size === 0) {
      setNote("Recording produced no data")
      return
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-")
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `gesture-synth-${stamp}.${recorder.extension()}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }, [])

  const begin = useCallback(async () => {
    const audio = getAudio()
    if (!audio) {
      setNote("Start audio before recording")
      setPhase("idle")
      return
    }
    const prefs = getPrefs()
    const recorder = new SessionRecorder()
    try {
      await recorder.start({
        audioCtx: audio.ctx,
        bus: audio.bus,
        micId: prefs.micId,
        monitor: prefs.monitor,
        getFrame: () => getFrameRef.current(),
      })
    } catch {
      setNote("Recording isn't supported in this browser")
      setPhase("idle")
      return
    }
    recorderRef.current = recorder
    startTimeRef.current = Date.now()
    setElapsed(0)
    setNote(null)
    setPhase("recording")
  }, [getAudio, getPrefs])

  const arm = useCallback(() => {
    window.clearInterval(countRef.current)
    setNote(null)
    setCount(3)
    setPhase("count")
    let left = 3
    countRef.current = window.setInterval(() => {
      left -= 1
      if (left <= 0) {
        window.clearInterval(countRef.current)
        void begin()
        return
      }
      setCount(left)
    }, 1000)
  }, [begin])

  const requestRecord = useCallback(() => {
    if (getPrefs().micId === "none" || voiceHintDismissed()) {
      arm()
      return
    }
    setSkipHint(false)
    setPhase("hint")
  }, [arm, getPrefs])

  const closeHint = useCallback((record: boolean) => {
    if (skipHint) dismissVoiceHint()
    if (record) arm()
    else setPhase("idle")
  }, [arm, skipHint])

  const cancelCount = useCallback(() => {
    window.clearInterval(countRef.current)
    setPhase("idle")
  }, [])

  useEffect(() => {
    if (phase !== "recording") return
    const id = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)),
      500,
    )
    return () => window.clearInterval(id)
  }, [phase])

  useEffect(() => () => {
    window.clearInterval(countRef.current)
    void recorderRef.current?.stop()
  }, [])

  useEffect(() => {
    if (!note) return
    const id = window.setTimeout(() => setNote(null), 4000)
    return () => window.clearTimeout(id)
  }, [note])

  useEffect(() => {
    if (phase !== "hint") return
    hintGoRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeHint(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [phase, closeHint])

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const header = document.querySelector("[data-app-header]")
    if (!wrap || !header) return
    const meter = document.querySelector("[data-app-meter]")
    const hits = (a: DOMRect, b: DOMRect | undefined) =>
      !!b && a.left < b.right + 8 && a.right > b.left - 8 && a.top < b.bottom + 8 && a.bottom > b.top - 8
    const place = () => {
      wrap.style.top = ""
      const natural = wrap.getBoundingClientRect()
      const head = header.getBoundingClientRect()
      const side = meter?.getBoundingClientRect()
      if (!hits(natural, head) && !hits(natural, side)) return
      const floor = Math.max(head.bottom, side && natural.left < side.right && natural.right > side.left ? side.bottom : 0)
      wrap.style.top = `${Math.round(floor + 12)}px`
    }
    const observer = new ResizeObserver(place)
    observer.observe(header)
    if (meter) observer.observe(meter)
    window.addEventListener("resize", place)
    place()
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", place)
    }
  }, [visible, phase])

  if (!visible) return null

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const recording = phase === "recording"

  return (
    <>
      {phase === "hint" && (
        <div className={styles.hintBackdrop} onClick={() => closeHint(false)}>
          <div
            className={styles.hintCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-hint-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="voice-hint-title" className={styles.hintTitle}>Your voice may not come through clearly</h2>
            <p className={styles.hintBody}>
              This device’s microphone is mixed into the video. Singing often sounds thinner and quieter than it does in the room, especially with the synth playing nearby.
            </p>
            <p className={styles.hintBody}>
              For a clearer vocal, use a headset, a separate microphone, or record your voice on a second phone.
            </p>
            <div className={styles.hintActions}>
              <button
                ref={hintGoRef}
                type="button"
                className={styles.hintGo}
                onClick={() => closeHint(true)}
              >
                Record anyway
              </button>
              <button type="button" className={styles.hintStay} onClick={() => closeHint(false)}>
                Not now
              </button>
            </div>
            <label className={styles.hintCheck}>
              <input
                type="checkbox"
                checked={skipHint}
                onChange={(event) => setSkipHint(event.target.checked)}
              />
              Don’t show this again
            </label>
          </div>
        </div>
      )}
      {phase === "count" && (
        <div className={styles.countdown} aria-live="polite">
          <div className={styles.countDisc}>
            <span className={styles.countNum}>{count}</span>
          </div>
          <p className={styles.countHint}>Tap Cancel to stop</p>
        </div>
      )}
      <div className={styles.wrap} ref={wrapRef}>
        <button
          type="button"
          className={styles.chip}
          data-recording={recording}
          data-counting={phase === "count"}
          onClick={() => {
            if (phase === "count") cancelCount()
            else if (recording) void stopRecording()
            else requestRecord()
          }}
          aria-label={recording ? "Stop recording" : phase === "count" ? "Cancel recording" : "Record video"}
        >
          <span className={styles.mark}>
            <span className={styles.dot} />
          </span>
          <span className={styles.caption}>
            {recording
              ? `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
              : phase === "count"
                ? "Cancel"
                : "Record"}
          </span>
        </button>
        {note && <p className={styles.note}>{note}</p>}
      </div>
    </>
  )
}
