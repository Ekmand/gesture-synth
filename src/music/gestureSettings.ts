export type ModeControl = "tilt" | "fixed"
export type QualityControl = "fingers" | "fixed"
export type FixedMode = "major" | "minor"

/** Matches notesForQuality / qualityLabel indices 1–4. */
export type FixedQuality = 1 | 2 | 3 | 4

export type GestureSettings = {
  modeControl: ModeControl
  fixedMode: FixedMode
  qualityControl: QualityControl
  fixedQuality: FixedQuality
}

export const DEFAULT_GESTURE_SETTINGS: GestureSettings = {
  modeControl: "tilt",
  fixedMode: "major",
  qualityControl: "fingers",
  fixedQuality: 1,
}

export const FIXED_QUALITY_OPTIONS: { value: FixedQuality; major: string; minor: string }[] = [
  { value: 1, major: "Major triad", minor: "Minor triad" },
  { value: 2, major: "Major 1st inv", minor: "Minor 1st inv" },
  { value: 3, major: "Major 7th", minor: "Minor 7th" },
  { value: 4, major: "Dominant 7th", minor: "Diminished 7th" },
]

const STORAGE_KEY = "music-synth-gesture-settings"

export function loadGestureSettings(): GestureSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_GESTURE_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<GestureSettings>
    return {
      modeControl: parsed.modeControl === "fixed" ? "fixed" : "tilt",
      fixedMode: parsed.fixedMode === "minor" ? "minor" : "major",
      qualityControl: parsed.qualityControl === "fixed" ? "fixed" : "fingers",
      fixedQuality: ([1, 2, 3, 4] as const).includes(parsed.fixedQuality as FixedQuality)
        ? (parsed.fixedQuality as FixedQuality)
        : 1,
    }
  } catch {
    return { ...DEFAULT_GESTURE_SETTINGS }
  }
}

export function saveGestureSettings(settings: GestureSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* ignore quota / private mode */
  }
}

/** Normalize Roman casing to match the active major/minor mode. */
export function normalizeChordCase(chord: string, isMajorMode: boolean): string {
  return isMajorMode ? chord.toUpperCase() : chord.toLowerCase()
}
