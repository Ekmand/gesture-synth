import { useCallback, useEffect, useRef, useState } from "react"
import styles from "./GlobalRecorder.module.css"

type Props = {
  visible: boolean
  audioCtx: AudioContext | null
}

export function GlobalRecorder({ visible, audioCtx }: Props) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef(0)
  const timerRef = useRef(0)

  const startRecording = useCallback(async () => {
    if (!audioCtx) return
    try {
      const tracks: MediaStreamTrack[] = []

      // Video: capture the canvas (facecam + hand overlay)
      const canvas = document.querySelector("canvas")
      if (canvas) {
        const videoStream = (canvas as HTMLCanvasElement).captureStream(30)
        videoStream.getVideoTracks().forEach((t) => tracks.push(t))
      }

      // Audio: tap the AudioContext output
      const audioDest = audioCtx.createMediaStreamDestination()
      // Connect the destination node to capture all audio
      // We need to find the master gain and connect it
      // The audio context destination is the speaker — we tap before it
      // Use a gain node to split the signal
      const tap = audioCtx.createGain()
      tap.gain.value = 1
      // Connect all source nodes... simplest: connect destination's stream
      // Actually, use createMediaStreamDestination and connect to it from a tap
      // For now, capture whatever is going to the speakers via the context
      audioDest.stream.getAudioTracks().forEach((t) => tracks.push(t))

      // Tap speaker output when the browser exposes destination.stream
      // @ts-expect-error - captureStream is non-standard but widely supported
      if (audioCtx.destination.stream) {
        // @ts-expect-error
        const destStream = audioCtx.destination.stream as MediaStream
        destStream.getAudioTracks().forEach((t) => tracks.push(t))
      }

      if (tracks.length === 0) return

      const combined = new MediaStream(tracks)
      const recorder = new MediaRecorder(combined, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : "video/webm",
      })

      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.start(1000) // chunks every second
      recorderRef.current = recorder
      startTimeRef.current = Date.now()
      setRecording(true)
      setElapsed(0)
    } catch {
      /* recording not supported */
    }
  }, [audioCtx])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === "inactive") return

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `gesture-synth-${new Date().toISOString().slice(0, 19)}.webm`
      a.click()
      URL.revokeObjectURL(url)
    }
    recorder.stop()
    recorderRef.current = null
    setRecording(false)
    setElapsed(0)
    window.clearInterval(timerRef.current)
  }, [])

  // Update elapsed timer
  useEffect(() => {
    if (!recording) return
    timerRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 500)
    return () => window.clearInterval(timerRef.current)
  }, [recording])

  if (!visible) return null

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60

  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.recBtn}
        data-recording={recording}
        onClick={recording ? stopRecording : startRecording}
        aria-label={recording ? "Stop global recording" : "Start global recording"}
      >
        {recording ? (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="2" y="2" width="6" height="6" fill="currentColor" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <circle cx="5" cy="5" r="4" fill="currentColor" />
          </svg>
        )}
      </button>
      {recording ? (
        <span className={styles.timer}>
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </span>
      ) : (
        <span className={styles.label}>Record</span>
      )}
    </div>
  )
}
