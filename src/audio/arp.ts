/** Arpeggiator note ordering and timing — pure, so it can be reasoned about
 *  and tested without an AudioContext. */

export type ArpPattern = "up" | "down" | "updown" | "random"
/** Note length as a division of the beat. */
export type ArpRate = "1/4" | "1/8" | "1/8T" | "1/16"

export type ArpSettings = {
  enabled: boolean
  pattern: ArpPattern
  rate: ArpRate
  /** How many octaves the sequence climbs before repeating. */
  octaves: 1 | 2 | 3
  /** Fraction of each step the note actually sounds, 0.1–1. */
  gate: number
}

export const DEFAULT_ARP: ArpSettings = {
  enabled: false,
  pattern: "up",
  rate: "1/8",
  octaves: 1,
  gate: 0.6,
}

export const ARP_PATTERNS: { value: ArpPattern; label: string }[] = [
  { value: "up", label: "Up" },
  { value: "down", label: "Down" },
  { value: "updown", label: "Up / down" },
  { value: "random", label: "Random" },
]

export const ARP_RATES: { value: ArpRate; label: string }[] = [
  { value: "1/4", label: "1/4 — quarter" },
  { value: "1/8", label: "1/8 — eighth" },
  { value: "1/8T", label: "1/8T — triplet" },
  { value: "1/16", label: "1/16 — sixteenth" },
]

const STEPS_PER_BEAT: Record<ArpRate, number> = {
  "1/4": 1,
  "1/8": 2,
  "1/8T": 3,
  "1/16": 4,
}

/** Seconds between arp steps at a given tempo. */
export function stepSeconds(bpm: number, rate: ArpRate): number {
  const safeBpm = Math.max(20, Math.min(300, bpm || 120))
  return 60 / safeBpm / STEPS_PER_BEAT[rate]
}

/**
 * Fold a block voicing into close position: one instance of each chord tone,
 * within an octave of the lowest note.
 *
 * Block voicings spread and double notes for richness — the default triad is
 * root / fifth / octave / third-an-octave-up. Sounded together that is full
 * and clear, but walked one note at a time it reads as a power chord with a
 * stray note on top: three of its four steps are mode-neutral, so major and
 * minor become nearly indistinguishable. Folding puts the third right next to
 * the root, which is what makes the mode audible in an arpeggio.
 */
export function closeVoicing(freqs: number[]): number[] {
  if (freqs.length === 0) return []
  const root = Math.min(...freqs)
  const seen = new Set<number>()
  const out: number[] = []
  for (const f of freqs) {
    const semis = Math.round(12 * Math.log2(f / root))
    const pitchClass = ((semis % 12) + 12) % 12
    if (seen.has(pitchClass)) continue
    seen.add(pitchClass)
    out.push(root * 2 ** (pitchClass / 12))
  }
  return out.sort((a, b) => a - b)
}

/**
 * Expand a chord into the sequence the arp walks through.
 *
 * The voicing is folded to close position first (see closeVoicing), then
 * stacked over the octave range and sorted as one set rather than
 * concatenated — otherwise an "up" run doubles back on itself. Overlapping
 * pitches between octaves are dropped so a note is not repeated on
 * consecutive steps. "updown" omits the turnaround
 * notes so the top and bottom are not struck twice in a row. Random is
 * resolved per step by the caller, so each step is a fresh choice rather than
 * a fixed shuffled loop.
 */
export function arpSequence(
  freqs: number[],
  octaves: number,
  pattern: ArpPattern,
): number[] {
  if (freqs.length === 0) return []
  const tones = closeVoicing(freqs)
  const stacked: number[] = []
  for (let o = 0; o < Math.max(1, octaves); o++) {
    for (const f of tones) stacked.push(f * 2 ** o)
  }
  stacked.sort((a, b) => a - b)
  // Treat pitches within ~2 cents of each other as the same note.
  const seq = stacked.filter((f, i) => i === 0 || f / stacked[i - 1] > 1.001)

  if (pattern === "down") return [...seq].reverse()
  if (pattern === "updown" && seq.length > 2) {
    return seq.concat([...seq].reverse().slice(1, -1))
  }
  return seq
}

/** Index of the next step, given the pattern. */
export function nextIndex(current: number, length: number, pattern: ArpPattern): number {
  if (length <= 0) return 0
  if (pattern === "random") return Math.floor(Math.random() * length)
  return (current + 1) % length
}
