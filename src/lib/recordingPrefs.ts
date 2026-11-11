const KEY = "music-synth-recording"

export type RecordingPrefs = {
  /** "default", "none", or a microphone device id. */
  micId: string
  /** Play the mic through the speakers. Meant for headphones. */
  monitor: boolean
  /** Camera picture only, without the chord and scale notes. */
  clean: boolean
}

export const DEFAULT_RECORDING_PREFS: RecordingPrefs = {
  micId: "default",
  monitor: false,
  clean: false,
}

export function loadRecordingPrefs(): RecordingPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_RECORDING_PREFS }
    const parsed = JSON.parse(raw) as Partial<RecordingPrefs>
    return {
      micId: typeof parsed.micId === "string" && parsed.micId ? parsed.micId : "default",
      monitor: parsed.monitor === true,
      clean: parsed.clean === true,
    }
  } catch {
    return { ...DEFAULT_RECORDING_PREFS }
  }
}

export function saveRecordingPrefs(prefs: RecordingPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

const VOICE_HINT_KEY = "music-synth-voice-hint"

export function voiceHintDismissed(): boolean {
  try {
    return localStorage.getItem(VOICE_HINT_KEY) === "1"
  } catch {
    return false
  }
}

export function dismissVoiceHint() {
  try {
    localStorage.setItem(VOICE_HINT_KEY, "1")
  } catch {
    /* ignore */
  }
}
