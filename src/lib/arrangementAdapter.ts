import type {
  ArrangementRow,
  Degree,
  Quality,
  SongArrangementV1,
  SongArrangementV2,
} from "./arrangementTypes"
import { matchGestureFromMidis } from "./gestureMidi"
import { chordSymbolForDegree, DEGREE_TO_NUM } from "./noteNames"
import type { PracticeEvent, PracticeSong, World } from "./practiceTypes"

function isDegree(value: string | null | undefined): value is Degree {
  return (
    value === "I"
    || value === "II"
    || value === "III"
    || value === "IV"
    || value === "V"
    || value === "VI"
    || value === "VII"
  )
}

function isQuality(value: number): value is Quality {
  return value === 1 || value === 2 || value === 3 || value === 4
}

function authorLabel(row: ArrangementRow): string {
  return (
    row.profiles?.display_name
    || (row.profiles?.username ? `@${row.profiles.username}` : "Community")
  )
}

function fromV1(row: ArrangementRow, arr: SongArrangementV1): PracticeSong {
  const keyName = arr.keyName || row.key_name || "C"
  const mode = (arr.mode || row.mode || "major") as World
  const stepsPerBar = Math.max(1, arr.stepsPerBar || 4)
  const events: PracticeEvent[] = []

  arr.steps.forEach((step, stepIndex) => {
    if (step.rest || !isDegree(step.degree)) return
    const quality = isQuality(step.quality) ? step.quality : 1
    const bar = Math.floor(stepIndex / stepsPerBar) + 1
    const beat = (stepIndex % stepsPerBar) + 1
    const chordName = chordSymbolForDegree(keyName, mode, step.degree)
    events.push({
      bar,
      beat,
      chordName: step.octaveUp ? `${chordName}↑` : chordName,
      stepIndex,
      beats: 1,
      target: {
        degree: DEGREE_TO_NUM[step.degree],
        world: mode,
        quality,
        octave: step.octaveDown ? -1 : 0,
      },
    })
  })

  return {
    id: row.id,
    title: row.title,
    artist: authorLabel(row),
    key: keyName,
    mode,
    bpm: arr.bpm || row.bpm || 100,
    stepsPerBar,
    events,
  }
}

/**
 * Reverse-map v2 MIDI note clusters into learn-style practice targets.
 * Uses arrangement.keyName (instrument tonic — may be relative major for minor songs).
 */
function fromV2(row: ArrangementRow, arr: SongArrangementV2): PracticeSong {
  const keyName = arr.keyName || row.key_name || "C"
  const songMode = (arr.mode || row.mode || "major") as World
  const stepsPerBar = Math.max(1, arr.stepsPerBar || 4)

  // Group notes that start together (= one chord voicing / learn run).
  const byStart = new Map<number, number[]>()
  for (const note of arr.notes) {
    const start = Math.round(note.start)
    const list = byStart.get(start) ?? []
    list.push(note.midi)
    byStart.set(start, list)
  }

  const starts = [...byStart.keys()].sort((a, b) => a - b)
  const events: PracticeEvent[] = []

  for (const start of starts) {
    const midis = [...new Set(byStart.get(start)!)].sort((a, b) => a - b)
    const match = matchGestureFromMidis(midis, keyName)
    if (!match) continue

    // Expand sustained chords across their beat length (learn steps every beat).
    const duration = Math.max(
      1,
      Math.round(
        Math.max(
          ...arr.notes.filter((n) => Math.round(n.start) === start).map((n) => n.duration),
        ),
      ),
    )

    const world = match.mode
    const chordName = chordSymbolForDegree(keyName, world, match.degree)
    const display = match.octaveUp ? `${chordName}↑` : chordName

    // One practice/chart step per beat so the learn UI counts through the bar with the metro
    for (let i = 0; i < duration; i++) {
      const stepIndex = start + i
      const bar = Math.floor(stepIndex / stepsPerBar) + 1
      const beat = (stepIndex % stepsPerBar) + 1
      events.push({
        bar,
        beat,
        chordName: display,
        stepIndex,
        beats: 1,
        target: {
          degree: DEGREE_TO_NUM[match.degree],
          world,
          quality: match.quality,
          octave: match.octaveDown ? -1 : 0,
        },
      })
    }
  }

  return {
    id: row.id,
    title: row.title,
    artist: authorLabel(row),
    key: keyName,
    mode: songMode,
    bpm: arr.bpm || row.bpm || 100,
    stepsPerBar,
    events,
  }
}

export function arrangementToPracticeSong(row: ArrangementRow): PracticeSong {
  const arr = row.arrangement
  if (arr.version === 2) return fromV2(row, arr)
  return fromV1(row, arr)
}
