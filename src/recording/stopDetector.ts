import type { Landmark } from "../music/gestures"

/** Master switch: gesture start/stop is off because it fired by accident. Flip to re-enable. */
export const GESTURE_RECORDING_ENABLED = false

/** How the recording is controlled by hand gestures. */
export type StopMode = "fists" | "nohands" | "manual"

export const STOP_MODE_OPTIONS: { value: StopMode; label: string; hint: string }[] = [
  {
    value: "fists",
    label: "Hold both fists for 1s (start & stop)",
    hint: "Close both hands into fists and hold until the bar fills. Works to start and to stop; open your hands to re-arm.",
  },
  {
    value: "nohands",
    label: "Stop when no hands in view for 5s",
    hint: "Recording stops once both hands leave the camera. Start with the Record button.",
  },
  { value: "manual", label: "Manual only", hint: "Start and stop with the Record button." },
]

export const HOLD_MS: Record<Exclude<StopMode, "manual">, number> = { fists: 1000, nohands: 5000 }

const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y)

/** Fist regardless of hand orientation: fingertips pulled in closer to the wrist than their knuckles. */
function isFist(h: Landmark[]): boolean {
  const wrist = h[0]
  const curled = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ].filter(([tip, pip]) => dist(h[tip], wrist) < dist(h[pip], wrist) * 1.1).length
  return curled >= 3
}

/**
 * Tracks how long the gesture condition has held. progress is 0..1; done fires once, then the
 * detector stays quiet until the condition is released (so a started recording isn't stopped by
 * the same held fists).
 */
export function createGestureDetector(mode: StopMode) {
  let since: number | null = null
  let latched = false
  return (hands: Landmark[][], now: number): { progress: number; done: boolean } => {
    if (mode === "manual") return { progress: 0, done: false }
    const met =
      mode === "fists" ? hands.length >= 2 && hands.filter(isFist).length >= 2 : hands.length === 0
    if (!met) {
      since = null
      latched = false
      return { progress: 0, done: false }
    }
    if (latched) return { progress: 0, done: false }
    since ??= now
    const progress = Math.min(1, (now - since) / HOLD_MS[mode])
    if (progress >= 1) {
      latched = true
      return { progress: 0, done: true }
    }
    return { progress, done: false }
  }
}

const KEY = "music-synth-stop-mode"

export function loadStopMode(): StopMode {
  try {
    const v = localStorage.getItem(KEY)
    return v === "manual" || v === "nohands" ? v : "fists"
  } catch {
    return "fists"
  }
}

export function saveStopMode(mode: StopMode) {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    /* ignore */
  }
}
