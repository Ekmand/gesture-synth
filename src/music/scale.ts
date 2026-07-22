const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const

/** Major-scale intervals in semitones (I–VII). VII is the leading tone (+11). */
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const

const ROMANS = ["I", "II", "III", "IV", "V", "VI", "VII"] as const

export type ScaleDegreeGuide = {
  roman: string
  note: string
  /** High tonic shown after VII for a full octave. */
  isOctave?: boolean
  gesture: string
}

const GESTURES: Record<string, string> = {
  I: "1 finger",
  II: "2 fingers",
  III: "3 fingers",
  IV: "4 fingers",
  V: "5 fingers",
  VI: "index + pinky",
  VII: "index + pinky + thumb",
}

function pitchClassFromKeyHz(keyHz: number): number {
  const midi = 69 + 12 * Math.log2(keyHz / 440)
  return ((Math.round(midi) % 12) + 12) % 12
}

/** Flat-friendly major keys: Db, Eb, F, Ab, Bb. */
function prefersFlats(keyHz: number): boolean {
  const pc = pitchClassFromKeyHz(keyHz)
  return pc === 1 || pc === 3 || pc === 5 || pc === 8 || pc === 10
}

function noteName(pitchClass: number, flats: boolean): string {
  return (flats ? FLAT_NAMES : SHARP_NAMES)[((pitchClass % 12) + 12) % 12]
}

/** Diatonic major scale for the selected key, plus high tonic. */
export function scaleGuideForKey(keyHz: number): ScaleDegreeGuide[] {
  const root = pitchClassFromKeyHz(keyHz)
  const flats = prefersFlats(keyHz)
  const degrees: ScaleDegreeGuide[] = MAJOR_INTERVALS.map((semi, i) => {
    const roman = ROMANS[i]
    return {
      roman,
      note: noteName(root + semi, flats),
      gesture: GESTURES[roman],
    }
  })
  degrees.push({
    roman: "I",
    note: noteName(root, flats),
    isOctave: true,
    gesture: "1 finger (oct)",
  })
  return degrees
}

export function activeRoman(chord: string | null): string | null {
  if (!chord || chord === "--") return null
  return chord.toUpperCase()
}
