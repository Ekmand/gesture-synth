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

/**
 * Chord vocabulary.
 *
 * A quality is a list of semitone offsets from the chord root, so new
 * voicings are a one-line addition rather than another field on ChordTones.
 * The third moves with the mode, which is why intervals are a function of it
 * instead of a constant array.
 */
export type ChordQuality = {
  id: string
  major: string
  minor: string
  intervals: (isMajor: boolean) => number[]
}

/** The mode's third, in semitones. */
const third = (isMajor: boolean) => (isMajor ? 4 : 3)

export const QUALITIES = {
  triad: {
    id: "triad", major: "Major", minor: "Minor",
    intervals: (m) => [0, 7, 12, 12 + third(m)],
  },
  inv1: {
    id: "inv1", major: "Major 1st Inv", minor: "Minor 1st Inv",
    intervals: (m) => [third(m), 7, 12, 12 + third(m)],
  },
  seventh: {
    id: "seventh", major: "Major 7th", minor: "Minor 7th",
    intervals: (m) => [0, third(m), 7, m ? 11 : 10],
  },
  dom7: {
    id: "dom7", major: "Dominant 7th", minor: "Diminished 7th",
    intervals: (m) => (m ? [0, 4, 7, 10] : [0, 3, 6, 9]),
  },
  sus2: {
    id: "sus2", major: "Sus2", minor: "Sus2",
    intervals: () => [0, 2, 7, 12],
  },
  sus4: {
    id: "sus4", major: "Sus4", minor: "Sus4",
    intervals: () => [0, 5, 7, 12],
  },
  add9: {
    id: "add9", major: "Add9", minor: "Minor Add9",
    intervals: (m) => [0, third(m), 7, 14],
  },
  sixth: {
    id: "sixth", major: "Major 6th", minor: "Minor 6th",
    intervals: (m) => [0, third(m), 7, 9],
  },
  ninth: {
    id: "ninth", major: "Dominant 9th", minor: "Minor 9th",
    intervals: (m) => [0, third(m), 7, 10, 14],
  },
  maj9: {
    id: "maj9", major: "Major 9th", minor: "Minor 9th",
    intervals: (m) => [0, third(m), 7, m ? 11 : 10, 14],
  },
  power: {
    id: "power", major: "Power 5th", minor: "Power 5th",
    intervals: () => [0, 7, 12, 19],
  },
  eleventh: {
    id: "eleventh", major: "11th", minor: "11th",
    intervals: () => [0, 7, 10, 14, 17],
  },
} satisfies Record<string, ChordQuality>

export type PaletteId = "classic" | "suspended" | "extended" | "open"

/** Each palette maps the right hand's 1–4 raised fingers onto four qualities. */
export const CHORD_PALETTES: {
  id: PaletteId
  label: string
  hint: string
  slots: [ChordQuality, ChordQuality, ChordQuality, ChordQuality]
}[] = [
  {
    id: "classic",
    label: "Classic",
    hint: "Triad, inversion, 7ths — the original set.",
    slots: [QUALITIES.triad, QUALITIES.inv1, QUALITIES.seventh, QUALITIES.dom7],
  },
  {
    id: "suspended",
    label: "Suspended",
    hint: "Open, unresolved voicings that sit well under a melody.",
    slots: [QUALITIES.sus2, QUALITIES.sus4, QUALITIES.triad, QUALITIES.add9],
  },
  {
    id: "extended",
    label: "Extended",
    hint: "Jazz colour — 7ths, 9ths and 6ths.",
    slots: [QUALITIES.seventh, QUALITIES.ninth, QUALITIES.add9, QUALITIES.sixth],
  },
  {
    id: "open",
    label: "Open / rock",
    hint: "Power chords and stacked suspensions.",
    slots: [QUALITIES.power, QUALITIES.triad, QUALITIES.sus4, QUALITIES.eleventh],
  },
]

export const DEFAULT_PALETTE: PaletteId = "classic"

export function paletteById(id: PaletteId | undefined): (typeof CHORD_PALETTES)[number] {
  return CHORD_PALETTES.find((p) => p.id === id) ?? CHORD_PALETTES[0]
}

/** Quality for a raised-finger count of 1–4; anything else falls back to slot 1. */
export function qualityForSlot(paletteId: PaletteId | undefined, slot: number): ChordQuality {
  const palette = paletteById(paletteId)
  return palette.slots[Math.min(4, Math.max(1, slot)) - 1]
}

export function notesForQuality(
  tones: ChordTones | null,
  qualityIndex: number,
  isMajorMode: boolean,
  paletteId: PaletteId = DEFAULT_PALETTE,
): number[] {
  if (!tones || qualityIndex < 1) return []
  const quality = qualityForSlot(paletteId, qualityIndex)
  return quality.intervals(isMajorMode).map((semis) => tones.root * 2 ** (semis / 12))
}

export function qualityLabel(
  qualityIndex: number,
  isMajorMode: boolean,
  octaveDown: boolean,
  paletteId: PaletteId = DEFAULT_PALETTE,
): string {
  if (qualityIndex < 1 || qualityIndex > 4) return "--"
  const quality = qualityForSlot(paletteId, qualityIndex)
  const base = isMajorMode ? quality.major : quality.minor
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
