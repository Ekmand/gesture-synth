import type {
  ArrangementRow,
  Mode,
  SongArrangement,
  SongArrangementV1,
  SongArrangementV2,
} from "./arrangementTypes"
import {
  applyArrangementListOverrides,
  applyArrangementOverride,
} from "./songOverrides"
import { getSupabase } from "./supabase"

function isMode(value: unknown): value is Mode {
  return value === "major" || value === "minor"
}

function isV1(value: unknown): value is SongArrangementV1 {
  if (!value || typeof value !== "object") return false
  const v = value as SongArrangementV1
  return v.version === 1 && Array.isArray(v.steps)
}

function isV2(value: unknown): value is SongArrangementV2 {
  if (!value || typeof value !== "object") return false
  const v = value as SongArrangementV2
  return v.version === 2 && Array.isArray(v.notes)
}

function normalizeArrangement(
  raw: unknown,
  fallback: { keyName: string; mode: Mode; bpm: number },
): SongArrangement | null {
  if (isV2(raw)) {
    return {
      version: 2,
      keyName: typeof raw.keyName === "string" ? raw.keyName : fallback.keyName,
      mode: isMode(raw.mode) ? raw.mode : fallback.mode,
      bpm: typeof raw.bpm === "number" ? raw.bpm : fallback.bpm,
      stepsPerBar: typeof raw.stepsPerBar === "number" ? raw.stepsPerBar : 4,
      barCount: typeof raw.barCount === "number" ? raw.barCount : 4,
      notes: raw.notes.map((n, i) => ({
        id: typeof n.id === "string" ? n.id : `n_${i}`,
        midi: Number(n.midi) || 0,
        start: Number(n.start) || 0,
        duration: Math.max(0.05, Number(n.duration) || 1),
      })),
    }
  }

  if (isV1(raw)) {
    return {
      version: 1,
      keyName: typeof raw.keyName === "string" ? raw.keyName : fallback.keyName,
      mode: isMode(raw.mode) ? raw.mode : fallback.mode,
      bpm: typeof raw.bpm === "number" ? raw.bpm : fallback.bpm,
      stepsPerBar: typeof raw.stepsPerBar === "number" ? raw.stepsPerBar : 4,
      barCount: typeof raw.barCount === "number" ? raw.barCount : 4,
      steps: raw.steps,
    }
  }

  return null
}

export type ArrangementListItem = {
  id: string
  title: string
  description: string
  key_name: string
  mode: Mode
  bpm: number
  /** Community hashtags (e.g. learn, official, artist names). */
  tags: string[]
  profiles: ArrangementRow["profiles"]
}

function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const t of raw) {
    if (typeof t !== "string") continue
    const slug = t.trim().toLowerCase().replace(/^#/, "")
    if (slug && !out.includes(slug)) out.push(slug)
  }
  return out
}

export async function listArrangements(limit = 96): Promise<ArrangementListItem[]> {
  const supabase = getSupabase()
  if (!supabase) {
    throw new Error("Supabase is not configured (set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY)")
  }

  const { data, error } = await supabase
    .from("arrangements")
    .select(
      `
      id,
      title,
      description,
      key_name,
      mode,
      bpm,
      tags,
      profiles:user_id ( username, display_name )
    `,
    )
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  const items = (data ?? []).map((row) => {
    const profilesRaw = row.profiles as
      | { username: string | null; display_name: string | null }
      | { username: string | null; display_name: string | null }[]
      | null
    const profiles = Array.isArray(profilesRaw) ? (profilesRaw[0] ?? null) : profilesRaw
    return {
      id: row.id as string,
      title: row.title as string,
      description: (row.description as string) ?? "",
      key_name: row.key_name as string,
      mode: isMode(row.mode) ? row.mode : "major",
      bpm: row.bpm as number,
      tags: normalizeTags(row.tags),
      profiles,
    }
  })
  return applyArrangementListOverrides(items)
}

export async function fetchArrangement(id: string): Promise<ArrangementRow | null> {
  const supabase = getSupabase()
  if (!supabase) {
    throw new Error("Supabase is not configured (set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY)")
  }

  const { data, error } = await supabase
    .from("arrangements")
    .select(
      `
      id,
      title,
      description,
      key_name,
      mode,
      bpm,
      arrangement,
      profiles:user_id ( username, display_name )
    `,
    )
    .eq("id", id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const profilesRaw = data.profiles as
    | { username: string | null; display_name: string | null }
    | { username: string | null; display_name: string | null }[]
    | null
  const profiles = Array.isArray(profilesRaw) ? (profilesRaw[0] ?? null) : profilesRaw

  const patched = applyArrangementOverride({
    id: data.id as string,
    title: data.title as string,
    description: (data.description as string) ?? "",
    key_name: data.key_name as string,
    mode: isMode(data.mode) ? data.mode : "major",
    bpm: data.bpm as number,
    arrangement: data.arrangement as ArrangementRow["arrangement"],
    profiles,
  })

  const mode = isMode(patched.mode) ? patched.mode : "major"
  const arrangement = normalizeArrangement(patched.arrangement, {
    keyName: patched.key_name || "C",
    mode,
    bpm: patched.bpm || 100,
  })
  if (!arrangement) {
    throw new Error("Arrangement payload is not a valid SongArrangement (v1 or v2)")
  }

  return {
    ...patched,
    mode,
    bpm: patched.bpm || 100,
    arrangement,
  }
}
