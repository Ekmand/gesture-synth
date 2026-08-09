const KEY = "music-synth-sequencer-visible"

/** Default hidden so the play surface stays clean. */
export function loadSequencerVisible(): boolean {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return false
    return raw === "1"
  } catch {
    return false
  }
}

export function saveSequencerVisible(visible: boolean) {
  try {
    localStorage.setItem(KEY, visible ? "1" : "0")
  } catch {
    /* ignore */
  }
}
