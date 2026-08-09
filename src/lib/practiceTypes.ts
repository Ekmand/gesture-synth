export type World = "major" | "minor"

/** Target gesture for one practice chord (learn-compatible). */
export type GestureTarget = {
  /** 1–5 finger count, 6 = index+pinky, 7 = index+pinky+thumb */
  degree: number
  world: World
  /** Right-hand finger count 1–4 → chord quality */
  quality: number
  /** 0 = thumb folded (base), -1 = thumb extended (octave down) */
  octave: number
}

export type PracticeEvent = {
  bar: number
  beat: number
  chordName: string
  target: GestureTarget
  /** Original step index in the flat arrangement (for chart) */
  stepIndex: number
  /** How many beats this chord lasts (arrangement step duration). */
  beats: number
}

export type PracticeSong = {
  id: string
  title: string
  artist: string
  key: string
  mode: World
  bpm: number
  stepsPerBar: number
  events: PracticeEvent[]
}

export type MatchReport = {
  degree: boolean
  world: boolean
  quality: boolean
  octave: boolean
  score: number
}
