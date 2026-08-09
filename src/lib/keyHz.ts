import { KEY_OPTIONS } from "../music/chords"

/** Map community key_name (e.g. "C", "F#", "Bb") to synth key Hz. */
export function keyNameToHz(keyName: string): number {
  const raw = keyName.trim()
  const base = raw.replace(/m$/i, "").replace(/maj$/i, "")
  const normalized = base
    .replace("♯", "#")
    .replace("♭", "b")

  const aliases: Record<string, string> = {
    Db: "C#",
    Eb: "D#",
    Gb: "F#",
    Ab: "G#",
    Bb: "A#",
    "C#": "C#",
    "D#": "D#",
    "F#": "F#",
    "G#": "G#",
    "A#": "A#",
  }

  const want = aliases[normalized] ?? normalized

  const hit = KEY_OPTIONS.find((k) => {
    const label = k.label
    if (label === want) return true
    // KEY_OPTIONS uses "A#/Bb" style compounds
    const parts = label.split("/")
    return parts.includes(want) || parts.includes(normalized)
  })

  return hit?.hz ?? 261.63
}
