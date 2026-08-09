import type { StabilizedChord } from "../music/gestures"
import { DEGREE_TO_NUM } from "./noteNames"
import type { GestureTarget, MatchReport, World } from "./practiceTypes"

const DEGREE_MAP = DEGREE_TO_NUM

export function romanToDegree(roman: string | null): number | null {
  if (!roman) return null
  const n = DEGREE_MAP[roman.toUpperCase() as keyof typeof DEGREE_MAP]
  return n ?? null
}

export function qualityLabel(world: World, quality: number): string {
  if (world === "major") {
    return (
      ({ 1: "Major", 2: "Major 1st inv.", 3: "Major 7th", 4: "Dominant 7th" } as Record<
        number,
        string
      >)[quality] ?? `Q${quality}`
    )
  }
  return (
    ({ 1: "Minor", 2: "Minor 1st inv.", 3: "Minor 7th", 4: "Diminished 7th" } as Record<
      number,
      string
    >)[quality] ?? `Q${quality}`
  )
}

/** Compare live stabilized chord (from App) against a practice target. */
export function compareLive(
  live: StabilizedChord | null,
  target: GestureTarget,
): MatchReport | null {
  if (!live || live.qualityIndex < 1) return null
  const degree = romanToDegree(live.chord)
  const degreeOk = degree !== null && degree === target.degree
  const worldOk = (live.isMajorMode ? "major" : "minor") === target.world
  const qualityOk = live.qualityIndex === target.quality
  const wantThumbDown = target.octave === -1
  const octaveOk = live.thumbDown === wantThumbDown
  return {
    degree: degreeOk,
    world: worldOk,
    quality: qualityOk,
    octave: octaveOk,
    score: (Number(degreeOk) + Number(worldOk) + Number(qualityOk) + Number(octaveOk)) / 4,
  }
}

export function isFullMatch(report: MatchReport | null): boolean {
  return Boolean(report && report.score === 1)
}
