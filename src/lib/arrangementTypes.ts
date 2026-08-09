/** Mirrors community Gesture-Synth-Community arrangement types (v1 + v2). */

export type Degree = "I" | "II" | "III" | "IV" | "V" | "VI" | "VII"
export type Mode = "major" | "minor"
export type Quality = 1 | 2 | 3 | 4

export type SongStep = {
  degree: Degree | null
  octaveUp?: boolean
  /** Present in some learn→community conversions (thumb / -8ve). */
  octaveDown?: boolean
  quality: Quality
  rest?: boolean
}

/** Legacy step-grid arrangement. */
export type SongArrangementV1 = {
  version: 1
  keyName: string
  mode: Mode
  bpm: number
  stepsPerBar: number
  barCount: number
  steps: SongStep[]
}

export type NoteEvent = {
  id: string
  midi: number
  start: number
  duration: number
}

/** Current piano-roll arrangement (community + learn imports). */
export type SongArrangementV2 = {
  version: 2
  keyName: string
  mode: Mode
  bpm: number
  stepsPerBar: number
  barCount: number
  notes: NoteEvent[]
}

export type SongArrangement = SongArrangementV1 | SongArrangementV2

export type ArrangementAuthor = {
  username: string | null
  display_name: string | null
}

export type ArrangementRow = {
  id: string
  title: string
  description: string
  key_name: string
  mode: Mode
  bpm: number
  arrangement: SongArrangement
  profiles: ArrangementAuthor | null
}
