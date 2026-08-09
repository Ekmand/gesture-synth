/** Stylized hand-shape diagrams for guided practice (mirrored camera / palm view). */

export type FingerSet = {
  thumb: boolean
  index: boolean
  middle: boolean
  ring: boolean
  pinky: boolean
}

export const DEGREE_FINGERS: Record<number, FingerSet> = {
  1: { thumb: false, index: true, middle: false, ring: false, pinky: false },
  2: { thumb: false, index: true, middle: true, ring: false, pinky: false },
  3: { thumb: false, index: true, middle: true, ring: true, pinky: false },
  4: { thumb: false, index: true, middle: true, ring: true, pinky: true },
  5: { thumb: true, index: true, middle: true, ring: true, pinky: true },
  6: { thumb: false, index: true, middle: false, ring: false, pinky: true },
  7: { thumb: true, index: true, middle: false, ring: false, pinky: true },
}

/** Right-hand shape: quality fingers from the index out; thumb out = octave down. */
export function qualityFingers(quality: number, octaveDown: boolean): FingerSet {
  return {
    thumb: octaveDown,
    index: quality >= 1,
    middle: quality >= 2,
    ring: quality >= 3,
    pinky: quality >= 4,
  }
}

type Props = {
  side: "left" | "right"
  fingers: FingerSet
  /** Rotation in degrees as seen in mirrored view (left: −major / +minor). */
  tiltDeg?: number
  color: string
}

const FINGER_X = { index: 38, middle: 56, ring: 74, pinky: 92 } as const
const UP_TOP = 14
const DOWN_TOP = 44
const FINGER_W = 13

function Finger({ x, up, color }: { x: number; up: boolean; color: string }) {
  const top = up ? UP_TOP : DOWN_TOP
  const height = 72 - top
  return (
    <rect
      x={x - FINGER_W / 2}
      y={top}
      width={FINGER_W}
      height={height}
      rx={6.5}
      fill={up ? color : "none"}
      stroke={up ? color : "currentColor"}
      strokeWidth={up ? 0 : 1.5}
      opacity={up ? 1 : 0.45}
    />
  )
}

export function HandShape({ side, fingers, tiltDeg = 0, color }: Props) {
  return (
    <svg
      className="hand-shape"
      viewBox="0 0 120 140"
      role="img"
      aria-label={`${side} hand target shape`}
      width="100%"
      height="100%"
    >
      <g transform={side === "left" ? "translate(120 0) scale(-1 1)" : undefined}>
        <g transform={`rotate(${tiltDeg} 60 85)`}>
          <rect
            x={fingers.thumb ? 2 : 8}
            y={fingers.thumb ? 62 : 74}
            width={13}
            height={34}
            rx={6.5}
            transform="rotate(-38 12 78)"
            fill={fingers.thumb ? color : "none"}
            stroke={fingers.thumb ? color : "currentColor"}
            strokeWidth={fingers.thumb ? 0 : 1.5}
            opacity={fingers.thumb ? 1 : 0.45}
          />
          <rect
            x={28}
            y={68}
            width={72}
            height={56}
            rx={18}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            opacity={0.8}
          />
          <Finger x={FINGER_X.index} up={fingers.index} color={color} />
          <Finger x={FINGER_X.middle} up={fingers.middle} color={color} />
          <Finger x={FINGER_X.ring} up={fingers.ring} color={color} />
          <Finger x={FINGER_X.pinky} up={fingers.pinky} color={color} />
        </g>
      </g>
    </svg>
  )
}
