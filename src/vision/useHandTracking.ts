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

type Wrist = { x: number; y: number }
type LastWrists = { left: Wrist | null; right: Wrist | null }

const dist = (a: Wrist, b: Wrist) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Split the detections into a left and a right hand.
 *
 * MediaPipe's handedness label is inferred partly from which face of the hand
 * it sees, so turning a hand over — which this app now uses for major/minor —
 * can make it label both hands the same. When that happens, keep the more
 * confident label and give the other hand the opposite slot, breaking ties by
 * whichever assignment stays closest to where each hand was last frame.
 */
function assignHands(
  result: HandLandmarkerResult,
  last: LastWrists,
): { left: Landmark[] | null; right: Landmark[] | null } {
  const hands = result.landmarks.map((marks, i) => ({
    marks: marks as Landmark[],
    label: result.handedness[i]?.[0]?.categoryName as Handedness | undefined,
    score: result.handedness[i]?.[0]?.score ?? 0,
  }))

  if (hands.length === 0) return { left: null, right: null }

  if (hands.length === 1) {
    const only = hands[0]
    // A single hand whose label just flipped is far more likely to be the same
    // hand turning over than the other hand appearing where that one was.
    const prevSame = only.label === "Left" ? last.left : last.right
    const prevOther = only.label === "Left" ? last.right : last.left
    const here = { x: only.marks[0].x, y: only.marks[0].y }
    let label = only.label
    if (label && only.score < 0.9 && prevOther && (!prevSame || dist(here, prevOther) + 0.06 < dist(here, prevSame))) {
      label = label === "Left" ? "Right" : "Left"
    }
    return {
      left: label === "Left" ? only.marks : null,
      right: label === "Right" ? only.marks : null,
    }
  }

  const [a, b] = hands
  if (a.label && b.label && a.label !== b.label) {
    return {
      left: a.label === "Left" ? a.marks : b.marks,
      right: a.label === "Right" ? a.marks : b.marks,
    }
  }

  // Same (or missing) labels: trust the more confident one, flip the other.
  const anchor = a.score >= b.score ? a : b
  const other = anchor === a ? b : a
  const anchorLabel: Handedness = anchor.label ?? "Left"
  return {
    left: anchorLabel === "Left" ? anchor.marks : other.marks,
    right: anchorLabel === "Right" ? anchor.marks : other.marks,
  }
}

export function useHandTracking(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [status, setStatus] = useState<HandTrackingStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const handsRef = useRef<TrackedHands>({ left: null, right: null, result: null })
  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const rafRef = useRef(0)
  const lastVideoTimeRef = useRef(-1)
  const lastAssignmentRef = useRef<LastWrists>({ left: null, right: null })

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
            minHandDetectionConfidence: 0.6,
            minHandPresenceConfidence: 0.6,
            // Lower than detection: once a hand is found, keep following it
            // through turns and partial occlusion instead of dropping out.
            minTrackingConfidence: 0.4,
          })
        } catch {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: MODEL_URL,
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numHands: 2,
            minHandDetectionConfidence: 0.6,
            minHandPresenceConfidence: 0.6,
            minTrackingConfidence: 0.4,
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
            const { left, right } = assignHands(result, lastAssignmentRef.current)
            lastAssignmentRef.current = {
              left: left ? { x: left[0].x, y: left[0].y } : null,
              right: right ? { x: right[0].x, y: right[0].y } : null,
            }
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
      lastAssignmentRef.current = { left: null, right: null }
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
