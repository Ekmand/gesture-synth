import type { Degree, Mode } from "./arrangementTypes"

export const DEGREES: Degree[] = ["I", "II", "III", "IV", "V", "VI", "VII"]

export const DEGREE_LABELS: Record<number, string> = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
  6: "VI",
  7: "VII",
}

export const DEGREE_TO_NUM: Record<Degree, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
}

const NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const NOTE_NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10]

const KEY_TO_PC: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
}

function prefersFlats(keyName: string, mode: Mode): boolean {
  if (["F", "Bb", "Eb", "Ab", "Db", "Gb"].includes(keyName)) return true
  if (mode === "minor" && ["D", "G", "C", "F", "Bb", "Eb"].includes(keyName)) return true
  return false
}

export function noteNameForDegree(keyName: string, mode: Mode, degree: Degree): string {
  const root = KEY_TO_PC[keyName] ?? 0
  const intervals = mode === "major" ? MAJOR_INTERVALS : MINOR_INTERVALS
  const idx = DEGREES.indexOf(degree)
  const pc = (root + intervals[idx]) % 12
  const names = prefersFlats(keyName, mode) ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP
  return names[pc]
}

export function chordSymbolForDegree(keyName: string, mode: Mode, degree: Degree): string {
  const note = noteNameForDegree(keyName, mode, degree)
  // In major keys, ii/iii/vi are minor; in minor, i/iv/v differ — keep simple:
  // use arrangement mode for the chord quality suffix on the root of that degree.
  // Triad quality follows diatonic major/natural-minor for display.
  const diatonicMinorDegrees =
    mode === "major" ? new Set([2, 3, 6]) : new Set([1, 4, 5])
  const n = DEGREE_TO_NUM[degree]
  const minor = diatonicMinorDegrees.has(n)
  // vii in major / ii in minor → diminished-ish; show as note + ° lightly
  if (mode === "major" && n === 7) return `${note}dim`
  if (mode === "minor" && n === 2) return `${note}dim`
  return minor ? `${note}m` : note
}
