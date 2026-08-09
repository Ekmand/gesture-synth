import type { Degree, Mode, Quality, SongStep } from "./arrangementTypes"

const DEGREE_SEMITONES: Record<Degree, number> = {
  I: 0,
  II: 2,
  III: 4,
  IV: 5,
  V: 7,
  VI: 9,
  VII: -1,
}

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

function keyTonicMidi(keyName: string, baseOctave = 4): number {
  return 12 * (baseOctave + 1) + (KEY_TO_PC[keyName] ?? 0)
}

function notesForQuality(rootMidi: number, quality: Quality, isMajor: boolean): number[] {
  const third = rootMidi + (isMajor ? 4 : 3)
  const fifth = rootMidi + 7
  const octaveRoot = rootMidi + 12
  const octaveThird = third + 12
  const maj7Tone = rootMidi + 11
  const dom7Tone = rootMidi + 10
  const dim7Tone = rootMidi + 9
  const dim5Tone = rootMidi + 6

  if (isMajor) {
    switch (quality) {
      case 1:
        return [rootMidi, fifth, octaveRoot, octaveThird]
      case 2:
        return [third, fifth, octaveRoot, octaveThird]
      case 3:
        return [rootMidi, third, fifth, maj7Tone]
      case 4:
        return [rootMidi, third, fifth, dom7Tone]
    }
  }

  switch (quality) {
    case 1:
      return [rootMidi, fifth, octaveRoot, octaveThird]
    case 2:
      return [third, fifth, octaveRoot, octaveThird]
    case 3:
      return [rootMidi, third, fifth, dom7Tone]
    case 4:
      return [rootMidi, third, dim5Tone, dim7Tone]
  }
  return []
}

/** Full chord tones for a gesture step (matches community / learn converter). */
export function midiForStep(
  step: SongStep,
  keyName: string,
  mode: Mode,
  baseOctave = 4,
): number[] {
  if (!step.degree || step.rest) return []
  let root = keyTonicMidi(keyName, baseOctave) + DEGREE_SEMITONES[step.degree]
  if (step.octaveUp) root += 12
  if (step.octaveDown) root -= 12
  return notesForQuality(root, step.quality, mode === "major").map((m) =>
    Math.max(0, Math.min(127, m)),
  )
}

export type GestureMatch = {
  degree: Degree
  quality: Quality
  mode: Mode
  octaveUp: boolean
  octaveDown: boolean
}

const DEGREES: Degree[] = ["I", "II", "III", "IV", "V", "VI", "VII"]
const QUALITIES: Quality[] = [1, 2, 3, 4]
const MODES: Mode[] = ["major", "minor"]

/** Best-effort reverse map from a MIDI chord set → gesture target. */
export function matchGestureFromMidis(
  midis: number[],
  keyName: string,
): GestureMatch | null {
  if (midis.length === 0) return null
  const set = new Set(midis)

  for (const octaveDown of [false, true]) {
    for (const octaveUp of [false, true]) {
      if (octaveUp && octaveDown) continue
      for (const mode of MODES) {
        for (const degree of DEGREES) {
          for (const quality of QUALITIES) {
            const expected = midiForStep(
              { degree, quality, octaveUp, octaveDown, rest: false },
              keyName,
              mode,
            )
            if (expected.length === set.size && expected.every((m) => set.has(m))) {
              return { degree, quality, mode, octaveUp, octaveDown }
            }
          }
        }
      }
    }
  }
  return null
}
