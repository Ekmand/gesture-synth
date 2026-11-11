export type HoldSnap = {
  chord: string | null
  progress: number
  seconds: number
}

const idle: HoldSnap = { chord: null, progress: 0, seconds: 0 }
let snap: HoldSnap = idle

/** Scale guide publishes the hold ring so the recording can draw the same outline. */
export function publishHold(next: HoldSnap) {
  snap = next
}

export function readHold(): HoldSnap {
  return snap
}
