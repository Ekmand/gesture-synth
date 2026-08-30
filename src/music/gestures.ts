export type Landmark = { x: number; y: number; z: number; visibility?: number }
export type Handedness = "Left" | "Right"

const FINGERS = {
  index: { mcp: 5, pip: 6, tip: 8 },
  middle: { mcp: 9, pip: 10, tip: 12 },
  ring: { mcp: 13, pip: 14, tip: 16 },
  pinky: { mcp: 17, pip: 18, tip: 20 },
} as const

type FingerName = keyof typeof FINGERS

const WRIST = 0
const INDEX_MCP = 5
const MIDDLE_MCP = 9
const PINKY_MCP = 17
const THUMB_MCP = 2
const THUMB_TIP = 4

type Vec2 = { x: number; y: number }

const sub = (a: Landmark | Vec2, b: Landmark | Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y
const len = (a: Vec2) => Math.hypot(a.x, a.y)
const norm = (a: Vec2): Vec2 => {
  const l = len(a) || 1e-6
  return { x: a.x / l, y: a.y / l }
}
/** 2D cross product z-component (image coords: +x right, +y down). */
const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Hand-local reference frame, so gestures stay accurate when the hand is
 * rotated, angled, or showing its back — instead of assuming "fingers up,
 * palm to camera" like a raw screen-axis comparison does.
 *
 * - `up`    wrist → middle MCP, i.e. the direction the fingers extend.
 * - `side`  pinky MCP → index MCP, i.e. the direction the thumb splays toward.
 *           Defined from the hand's own anatomy, so it is correct for either
 *           hand and for either face of the palm.
 * - `scale` palm length, used to make every threshold distance-independent.
 */
export type PalmFrame = {
  wrist: Landmark
  up: Vec2
  side: Vec2
  scale: number
}

export function palmFrame(landmarks: Landmark[]): PalmFrame | null {
  if (!landmarks || landmarks.length < 21) return null
  const wrist = landmarks[WRIST]
  const middleMcp = landmarks[MIDDLE_MCP]
  const indexMcp = landmarks[INDEX_MCP]
  const pinkyMcp = landmarks[PINKY_MCP]
  if (!wrist || !middleMcp || !indexMcp || !pinkyMcp) return null

  const upRaw = sub(middleMcp, wrist)
  const scale = len(upRaw)
  if (scale < 1e-4) return null

  return {
    wrist,
    up: norm(upRaw),
    side: norm(sub(indexMcp, pinkyMcp)),
    scale,
  }
}

/**
 * A finger counts as raised when its tip sits further along the hand's own
 * finger axis than its PIP joint. The margin (a fraction of palm length)
 * keeps a half-curled finger from flickering between states.
 */
export function isFingerRaised(landmarks: Landmark[], finger: FingerName): boolean {
  const frame = palmFrame(landmarks)
  const { mcp, pip, tip } = FINGERS[finger]
  if (!frame) return landmarks[tip].y < landmarks[pip].y

  const along = (lm: Landmark) => dot(sub(lm, frame.wrist), frame.up)
  const tipExt = along(landmarks[tip])
  const pipExt = along(landmarks[pip])
  const mcpExt = along(landmarks[mcp])

  const margin = 0.08 * frame.scale
  // Extended past the PIP *and* meaningfully past the knuckle: a fist curled
  // toward the camera can put a tip past its PIP without the finger being up.
  return tipExt > pipExt + margin && tipExt > mcpExt + margin
}

/**
 * Thumb splayed away from the palm, measured against the hand's own axes
 * rather than screen x — so it holds up when the hand rotates or turns over.
 *
 * The primary test is the angle the thumb makes with the finger axis, which is
 * free of both hand size and camera distance: splayed sits well off that axis,
 * a thumb tucked alongside stays near-parallel, and a thumb folded across the
 * palm points back the other way. The distance term only rejects a degenerate
 * thumb vector from a noisy frame.
 */
export function isThumbExtended(landmarks: Landmark[], _handedness?: Handedness): boolean {
  const frame = palmFrame(landmarks)
  const tip = landmarks[THUMB_TIP]
  const mcp = landmarks[THUMB_MCP]
  if (!frame || !tip || !mcp) return false
  const thumb = sub(tip, mcp)
  const reach = len(thumb)
  if (reach < 0.15 * frame.scale) return false
  // sin of the angle away from the finger axis, signed toward the thumb side.
  return dot(thumb, frame.side) / reach > 0.42
}

/**
 * How squarely the palm faces the camera, in [-1, 1]:
 * `+1` palm toward the camera, `-1` back of the hand toward the camera,
 * `0` edge-on (the hand's silhouette, where the reading is ambiguous).
 *
 * Derived from the signed area of the wrist / index-MCP / pinky-MCP triangle:
 * that triangle keeps its winding order while the palm faces you and reverses
 * once the hand turns over, and it flattens toward zero at edge-on. Dividing
 * by palm length squared makes it independent of hand size and distance.
 *
 * The sign convention is keyed to MediaPipe's handedness label, which flips
 * together with the geometry, so this reads the same whether or not the video
 * feed is mirrored before detection.
 */
export function palmFacing(landmarks: Landmark[], handedness: Handedness): number {
  const frame = palmFrame(landmarks)
  if (!frame) return 0
  const wrist = landmarks[WRIST]
  const v1 = sub(landmarks[INDEX_MCP], wrist)
  const v2 = sub(landmarks[PINKY_MCP], wrist)
  // ~0.8 is the triangle's signed area (x2) over palm length squared for a
  // fully face-on hand, so dividing by it puts "square to camera" near 1.
  const raw = cross(v1, v2) / (0.8 * frame.scale * frame.scale)
  const signed = handedness === "Right" ? -raw : raw
  return clamp(signed, -1, 1)
}

/** Palm toward the camera → major; back of the hand → minor. */
export function palmMode(landmarks: Landmark[], handedness: Handedness): "major" | "minor" {
  return palmFacing(landmarks, handedness) >= 0 ? "major" : "minor"
}

/**
 * Smooths the palm-facing signal and only flips mode once the hand is clearly
 * past edge-on, holding the last decision through the ambiguous band. Without
 * this, noise near the silhouette makes major/minor chatter.
 */
export function createPalmModeDetector(threshold = 0.26, alpha = 0.3) {
  let smoothed = 0
  let major = true
  let seeded = false

  return function detect(signal: number | null): boolean {
    if (signal === null) return major
    smoothed = seeded ? smoothed + alpha * (signal - smoothed) : signal
    seeded = true
    if (smoothed > threshold) major = true
    else if (smoothed < -threshold) major = false
    return major
  }
}

/**
 * Wrist tilt in [-1, 1], still used for the right hand's tone filter.
 * Measured as the lean of the hand's finger axis away from vertical.
 */
export function wristTilt(landmarks: Landmark[], handedness: Handedness): number {
  const frame = palmFrame(landmarks)
  if (!frame) return 0
  // up = (0, -1) when the hand points straight up; its x component is the lean.
  let t = clamp(frame.up.x / 0.5, -1, 1)
  if (handedness === "Right") t = -t
  return t
}

export function volumeFromHand(landmarks: Landmark[]): number {
  const y = landmarks[WRIST].y
  const lo = 0.05
  const hi = 0.95
  return 1 - (clamp(y, lo, hi) - lo) / (hi - lo)
}

export function raisedFingerCount(landmarks: Landmark[]): number {
  return (["index", "middle", "ring", "pinky"] as FingerName[])
    .map((f) => isFingerRaised(landmarks, f))
    .filter(Boolean).length
}

/**
 * Left-hand Roman numeral degree. Always returned upper case — the caller
 * applies major/minor casing from the palm-facing reading.
 */
export function chordFromLeftHand(landmarks: Landmark[], handedness: Handedness): string | null {
  const thumb = isThumbExtended(landmarks, handedness)
  const index = isFingerRaised(landmarks, "index")
  const middle = isFingerRaised(landmarks, "middle")
  const ring = isFingerRaised(landmarks, "ring")
  const pinky = isFingerRaised(landmarks, "pinky")

  if (index && pinky && !middle && !ring && !thumb) return "VI"
  if (index && pinky && !middle && !ring && thumb) return "VII"

  const count = [thumb, index, middle, ring, pinky].filter(Boolean).length
  const map: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V" }
  return map[count] ?? null
}

export type StabilizedChord = {
  chord: string
  isMajorMode: boolean
  qualityIndex: number
  thumbDown: boolean
}

const HOLD_MS = 100
const GRACE_MS = 50

export function createChordStabilizer() {
  let committed: StabilizedChord | null = null
  let pending: StabilizedChord | null = null
  let pendingSince = 0
  let lastSeen = 0

  const same = (a: StabilizedChord | null, b: StabilizedChord | null) => {
    if (a === null && b === null) return true
    if (a === null || b === null) return false
    return (
      a.chord === b.chord &&
      a.isMajorMode === b.isMajorMode &&
      a.qualityIndex === b.qualityIndex &&
      a.thumbDown === b.thumbDown
    )
  }

  return function stabilize(input: StabilizedChord | null, now: number): StabilizedChord | null {
    if (input !== null) lastSeen = now
    let candidate = input
    if (input === null && now - lastSeen < GRACE_MS) candidate = pending

    if (!same(candidate, pending)) {
      pending = candidate
      pendingSince = now
    }
    if (now - pendingSince >= HOLD_MS) committed = pending
    return committed
  }
}

/** Exponential pitch map for theremin mode (~65–1200 Hz). */
export function pitchFromHandY(landmarks: Landmark[]): number {
  const t = volumeFromHand(landmarks)
  const minHz = 65
  const maxHz = 1200
  return minHz * Math.pow(maxHz / minHz, t)
}
