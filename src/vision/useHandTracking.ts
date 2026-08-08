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

function waitForVideoDimensions(video: HTMLVideoElement, timeoutMs = 8000): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error("Camera started but no video frames arrived. Reload and try again."))
    }, timeoutMs)

    const onReady = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        cleanup()
        resolve()
      }
    }

    const cleanup = () => {
      window.clearTimeout(timer)
      video.removeEventListener("loadedmetadata", onReady)
      video.removeEventListener("loadeddata", onReady)
      video.removeEventListener("playing", onReady)
    }

    video.addEventListener("loadedmetadata", onReady)
    video.addEventListener("loadeddata", onReady)
    video.addEventListener("playing", onReady)
  })
}

export function useHandTracking(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [status, setStatus] = useState<HandTrackingStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const handsRef = useRef<TrackedHands>({ left: null, right: null, result: null })
  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const rafRef = useRef(0)
  const lastVideoTimeRef = useRef(-1)

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null

    async function start() {
      setStatus("requesting")
      setError(null)
      try {
        if (!window.isSecureContext) {
          throw new Error(
            "Camera needs HTTPS. Open the https:// address (not http://), then accept the certificate warning.",
          )
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "Camera API unavailable in this browser. Try Chrome/Safari over HTTPS.",
          )
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "user" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        const video = videoRef.current
        if (!video) throw new Error("Video element missing")

        video.setAttribute("playsinline", "true")
        video.setAttribute("webkit-playsinline", "true")
        video.muted = true
        video.playsInline = true
        video.srcObject = stream

        try {
          await video.play()
        } catch {
          // Autoplay can fail briefly; metadata/playing listeners still unblock us.
        }

        await waitForVideoDimensions(video)
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
            try {
              const result = lm.detectForVideo(v, now)
              let left: Landmark[] | null = null
              let right: Landmark[] | null = null
              result.landmarks.forEach((marks, i) => {
                const name = result.handedness[i]?.[0]?.categoryName as Handedness | undefined
                if (name === "Left") left = marks as Landmark[]
                if (name === "Right") right = marks as Landmark[]
              })
              handsRef.current = { left, right, result }
            } catch {
              // Skip a bad frame rather than killing the loop
            }
          }
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      } catch (e) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : "Camera or model failed to start"
        setError(message)
        setStatus("error")
        stream?.getTracks().forEach((t) => t.stop())
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
      const active = (v?.srcObject as MediaStream | null) ?? stream
      active?.getTracks().forEach((t) => t.stop())
      if (v) v.srcObject = null
    }
  }, [videoRef])

  return { status, error, handsRef }
}
