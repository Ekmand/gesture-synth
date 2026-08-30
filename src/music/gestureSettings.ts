import {
  CHORD_PALETTES,
  DEFAULT_PALETTE,
  paletteById,
  type PaletteId,
} from "./chords"
import { DEFAULT_ARP, type ArpSettings } from "../audio/arp"

export type ModeControl = "palm" | "fixed"
export type QualityControl = "fingers" | "fixed"
export type FixedMode = "major" | "minor"

/** Matches notesForQuality / qualityLabel indices 1–4. */
export type FixedQuality = 1 | 2 | 3 | 4

export type GestureSettings = {
  modeControl: ModeControl
  fixedMode: FixedMode
  qualityControl: QualityControl
  fixedQuality: FixedQuality
  /** Swap which face of the hand means major, for feeds that mirror before detection. */
  invertPalmMode: boolean
  /** Which four chord voicings the right hand's 1–4 fingers select. */
  chordPalette: PaletteId
  arp: ArpSettings
}

export const DEFAULT_GESTURE_SETTINGS: GestureSettings = {
  modeControl: "palm",
  fixedMode: "major",
  qualityControl: "fingers",
  fixedQuality: 1,
  invertPalmMode: false,
  chordPalette: DEFAULT_PALETTE,
  arp: { ...DEFAULT_ARP },
}

/** Quality choices for the "fixed chord style" picker, named by the active palette. */
export function fixedQualityOptions(
  paletteId: PaletteId,
): { value: FixedQuality; major: string; minor: string }[] {
  return paletteById(paletteId).slots.map((q, i) => ({
    value: (i + 1) as FixedQuality,
    major: q.major,
    minor: q.minor,
  }))
}

const STORAGE_KEY = "music-synth-gesture-settings"

export function loadGestureSettings(): GestureSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_GESTURE_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<GestureSettings>
    return {
      // Legacy "tilt" settings migrate to the palm/back-of-hand control.
      modeControl: parsed.modeControl === "fixed" ? "fixed" : "palm",
      fixedMode: parsed.fixedMode === "minor" ? "minor" : "major",
      qualityControl: parsed.qualityControl === "fixed" ? "fixed" : "fingers",
      fixedQuality: ([1, 2, 3, 4] as const).includes(parsed.fixedQuality as FixedQuality)
        ? (parsed.fixedQuality as FixedQuality)
        : 1,
      invertPalmMode: parsed.invertPalmMode === true,
      chordPalette: CHORD_PALETTES.some((p) => p.id === parsed.chordPalette)
        ? (parsed.chordPalette as PaletteId)
        : DEFAULT_PALETTE,
      arp: { ...DEFAULT_ARP, ...(parsed.arp ?? {}) },
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
