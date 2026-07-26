import { useEffect, useRef, useState } from "react"
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision"
import type { Handedness, Landmark } from "../music/gestures"

export type TrackedHands = {
  left: Landmark[] | null
  right: Landmark[] | null
  result: HandLandmarkerResult | null
}

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"

export type HandTrackingStatus =
  | "idle"
  | "requesting"
  | "loading"
  | "ready"
  | "error"

export function useHandTracking(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [status, setStatus] = useState<HandTrackingStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const handsRef = useRef<TrackedHands>({ left: null, right: null, result: null })
  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const rafRef = useRef(0)
  const lastVideoTimeRef = useRef(-1)

  useEffect(() => {
    let cancelled = false
    let activeStream: MediaStream | null = null

    async function start() {
      setStatus("requesting")
      setError(null)
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera API unavailable in this browser")
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        })
        activeStream = stream
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const video = videoRef.current
        if (!video) throw new Error("Video element missing")
        video.srcObject = stream
        await video.play()
        if (cancelled) return

        setStatus("loading")
        const vision = await FilesetResolver.forVisionTasks(WASM_URL)
        if (cancelled) return
        let landmarker: HandLandmarker
        try {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: MODEL_URL,
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 2,
          })
        } catch {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: MODEL_URL,
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numHands: 2,
          })
        }
        if (cancelled) {
          landmarker.close()
          return
        }
        landmarkerRef.current = landmarker
        setStatus("ready")

        const tick = () => {
          if (cancelled) return
          const v = videoRef.current
          const lm = landmarkerRef.current
          if (!v || !lm || v.readyState < 2) {
            rafRef.current = requestAnimationFrame(tick)
            return
          }
          const now = performance.now()
          if (v.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = v.currentTime
            const result = lm.detectForVideo(v, now)
            let left: Landmark[] | null = null
            let right: Landmark[] | null = null
            result.landmarks.forEach((marks, i) => {
              const name = result.handedness[i]?.[0]?.categoryName as Handedness | undefined
              if (name === "Left") left = marks as Landmark[]
              if (name === "Right") right = marks as Landmark[]
            })
            handsRef.current = { left, right, result }
          }
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      } catch (e) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : "Camera or model failed to start"
        setError(message)
        setStatus("error")
      }
    }

    void start()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      landmarkerRef.current?.close()
      landmarkerRef.current = null
      handsRef.current = { left: null, right: null, result: null }
      lastVideoTimeRef.current = -1
      const v = videoRef.current
      const stream = (v?.srcObject as MediaStream | null) ?? activeStream
      stream?.getTracks().forEach((t) => t.stop())
      if (v) v.srcObject = null
      activeStream = null
    }
  }, [videoRef])

  return { status, error, handsRef }
}
