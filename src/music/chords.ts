export const KEY_OPTIONS = [
  { label: "A", hz: 220.0 },
  { label: "A#/Bb", hz: 233.08 },
  { label: "B", hz: 246.94 },
  { label: "C", hz: 261.63 },
  { label: "C#/Db", hz: 277.18 },
  { label: "D", hz: 293.66 },
  { label: "D#/Eb", hz: 311.13 },
  { label: "E", hz: 329.63 },
  { label: "F", hz: 349.23 },
  { label: "F#/Gb", hz: 369.99 },
  { label: "G", hz: 392.0 },
  { label: "G#/Ab", hz: 415.3 },
] as const

const DEGREE_SEMITONES: Record<number, number> = {
  1: 0,
  2: 2,
  3: 4,
  4: 5,
  5: 7,
  6: 9,
  7: -1,
}

const DEGREE_MAP: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
}

export type ChordTones = {
  root: number
  third: number
  fifth: number
  octaveRoot: number
  octaveThird: number
  maj7Tone: number
  dom7Tone: number
  dim7Tone: number
  dim5Tone: number
}

function degreeHz(keyHz: number, degree: number): number {
  const semis = DEGREE_SEMITONES[degree]
  return keyHz * 2 ** (semis / 12)
}

export function chordTonesFromRoman(
  roman: string | null | undefined,
  isMajorMode: boolean,
  keyHz: number,
): ChordTones | null {
  if (!roman || roman === "--") return null
  const degree = DEGREE_MAP[roman.toUpperCase()]
  if (!degree) return null
  const root = degreeHz(keyHz, degree)
  const third = root * 2 ** ((isMajorMode ? 4 : 3) / 12)
  return {
    root,
    third,
    fifth: root * 2 ** (7 / 12),
    octaveRoot: root * 2,
    octaveThird: third * 2,
    maj7Tone: root * 2 ** (11 / 12),
    dom7Tone: root * 2 ** (10 / 12),
    dim7Tone: root * 2 ** (9 / 12),
    dim5Tone: root * 2 ** (6 / 12),
  }
}

export function notesForQuality(
  tones: ChordTones | null,
  qualityIndex: number,
  isMajorMode: boolean,
): number[] {
  if (!tones) return []
  const {
    root,
    third,
    fifth,
    octaveRoot,
    octaveThird,
    maj7Tone,
    dom7Tone,
    dim7Tone,
    dim5Tone,
  } = tones

  if (isMajorMode) {
    switch (qualityIndex) {
      case 1:
        return [root, fifth, octaveRoot, octaveThird]
      case 2:
        return [third, fifth, octaveRoot, octaveThird]
      case 3:
        return [root, third, fifth, maj7Tone]
      case 4:
        return [root, third, fifth, dom7Tone]
      default:
        return [root, fifth, octaveRoot, octaveThird]
    }
  }

  switch (qualityIndex) {
    case 1:
      return [root, fifth, octaveRoot, octaveThird]
    case 2:
      return [third, fifth, octaveRoot, octaveThird]
    case 3:
      return [root, third, fifth, dom7Tone]
    case 4:
      return [root, third, dim5Tone, dim7Tone]
    default:
      return [root, fifth, octaveRoot, octaveThird]
  }
}

export function qualityLabel(
  qualityIndex: number,
  isMajorMode: boolean,
  octaveDown: boolean,
): string {
  const major: Record<number, string> = {
    1: "Major",
    2: "Major 1st Inv",
    3: "Major 7th",
    4: "Dominant 7th",
  }
  const minor: Record<number, string> = {
    1: "Minor",
    2: "Minor 1st Inv",
    3: "Minor 7th",
    4: "Diminished 7th",
  }
  const base = (isMajorMode ? major : minor)[qualityIndex]
  if (!base) return "--"
  return octaveDown ? `${base} (-8ve)` : base
}

export function chordColorVar(roman: string | null): string {
  if (!roman) return "150, 150, 150"
  const key = roman.toUpperCase()
  const rgb: Record<string, string> = {
    I: "61, 255, 224",
    II: "255, 107, 90",
    III: "240, 198, 90",
    IV: "120, 210, 255",
    V: "255, 150, 70",
    VI: "255, 90, 140",
    VII: "160, 200, 255",
  }
  return rgb[key] ?? "61, 255, 224"
}
