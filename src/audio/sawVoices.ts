export const SAW_VOICE_IDS = ["classic", "warm", "stack", "bright", "grit"] as const

export type SawVoiceId = (typeof SAW_VOICE_IDS)[number]

export type SawPartial = {
  /** Multiply the note. 0.5 is an octave down, 2 is an octave up. */
  ratio: number
  /** Cents. */
  detune: number
  gain: number
}

export type SawVoice = {
  id: SawVoiceId
  label: string
  hint: string
  partials: SawPartial[]
  /** 0 leaves the waveshaper open, which is the original voice. */
  drive: number
  filterBase: number
  filterQ: number
  curve: Float32Array<ArrayBuffer> | null
}

const KEY = "music-synth-saw-voice"

function makeCurve(drive: number): Float32Array<ArrayBuffer> | null {
  if (drive <= 0) return null
  const n = 256
  const curve = new Float32Array(new ArrayBuffer(n * 4))
  const k = 1 + drive * 18
  const norm = Math.tanh(k)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(k * x) / norm
  }
  return curve
}

function voice(
  id: SawVoiceId,
  label: string,
  hint: string,
  partials: SawPartial[],
  drive: number,
  filterBase: number,
  filterQ: number,
): SawVoice {
  return { id, label, hint, partials, drive, filterBase, filterQ, curve: makeCurve(drive) }
}

export const SAW_VOICES: SawVoice[] = [
  voice("classic", "Classic", "The original single saw.", [
    { ratio: 1, detune: 0, gain: 1 },
  ], 0, 1200, 0.7),
  voice("warm", "Warm", "Two saws, pulled slightly apart.", [
    { ratio: 1, detune: -8, gain: 0.5 },
    { ratio: 1, detune: 8, gain: 0.5 },
  ], 0, 900, 0.6),
  voice("stack", "Stack", "A saw with a quieter octave underneath.", [
    { ratio: 1, detune: 0, gain: 0.68 },
    { ratio: 0.5, detune: 0, gain: 0.32 },
  ], 0, 800, 0.65),
  voice("bright", "Bright", "A saw with a thin octave on top.", [
    { ratio: 1, detune: -4, gain: 0.72 },
    { ratio: 2, detune: 4, gain: 0.22 },
  ], 0, 1600, 0.75),
  voice("grit", "Grit", "A single saw pushed a little harder.", [
    { ratio: 1, detune: 0, gain: 0.62 },
  ], 0.42, 1400, 0.9),
]

const BY_ID = new Map(SAW_VOICES.map((v) => [v.id, v]))

export function sawVoiceById(id: string | null | undefined): SawVoice {
  return BY_ID.get(id as SawVoiceId) ?? SAW_VOICES[0]
}

/** Same tilt law as the original voice. Classic at rest is 1200 Hz, Q 0.7. */
export function filterForTilt(tilt: number, voiceDef: SawVoice): { freq: number; q: number } {
  let freq = voiceDef.filterBase
  let q = voiceDef.filterQ
  if (tilt < 0) {
    const r = Math.abs(tilt)
    freq = voiceDef.filterBase - r * 950
    q = voiceDef.filterQ + r * 1.5
  } else if (tilt > 0) {
    freq = voiceDef.filterBase + tilt * 3800
    q = voiceDef.filterQ + tilt * 4.5
  }
  return { freq: Math.max(40, freq), q }
}

export function loadSawVoice(): SawVoiceId {
  try {
    const raw = localStorage.getItem(KEY)
    return sawVoiceById(raw).id
  } catch {
    return "classic"
  }
}

export function saveSawVoice(id: SawVoiceId) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* ignore quota / private mode */
  }
}
