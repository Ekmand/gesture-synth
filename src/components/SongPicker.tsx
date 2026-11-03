import { useEffect, useMemo, useState } from "react"
import {
  listArrangements,
  type ArrangementListItem,
  type ArrangementSort,
} from "../lib/fetchArrangement"
import { COMMUNITY_BUILDER, communityBuilderHref } from "../lib/siteLinks"
import { isSupabaseConfigured } from "../lib/supabase"
import styles from "./SongPicker.module.css"

type Props = {
  open: boolean
  onClose: () => void
  onSelect: (id: string) => void
}

function formatTag(tag: string) {
  return `#${tag}`
}

function formatPlays(count: number) {
  return `${count} ${count === 1 ? "play" : "plays"}`
}

function authorOf(item: ArrangementListItem) {
  return (
    item.profiles?.display_name
    || (item.profiles?.username ? `@${item.profiles.username}` : "Community")
  )
}

export function SongPicker({ open, onClose, onSelect }: Props) {
  const [items, setItems] = useState<ArrangementListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [sort, setSort] = useState<ArrangementSort>("played")
  const [draft, setDraft] = useState("")
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (open) return
    setSort("played")
    setActiveTag(null)
    setDraft("")
    setQuery("")
  }, [open])

  useEffect(() => {
    const id = window.setTimeout(() => setQuery(draft.trim()), 300)
    return () => window.clearTimeout(id)
  }, [draft])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setItems([])

    void (async () => {
      try {
        if (!isSupabaseConfigured()) {
          throw new Error("Supabase is not configured.")
        }
        const rows = await listArrangements(48, sort, query)
        if (!cancelled) setItems(rows)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load songs.")
          setItems([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, sort, query])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const tagChips = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      for (const tag of item.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([tag]) => tag)
  }, [items])

  const filtered = useMemo(() => {
    if (!activeTag) return items
    return items.filter((item) => item.tags.includes(activeTag))
  }, [items, activeTag])

  const showFeatured = sort === "played" && !activeTag && !query && filtered.length > 1
  const featured = showFeatured ? filtered.slice(0, 3) : []
  const rest = showFeatured ? filtered.slice(3) : filtered

  if (!open) return null

  return (
    <>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Close song picker"
        onClick={onClose}
      />
      <div className={styles.modal} role="dialog" aria-label="Learn a song">
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>Learn a song</h2>
            <p className={styles.subtitle}>
              {query
                ? `Songs matching “${query}”`
                : sort === "played"
                  ? "Songs people open most on Gesture Synth"
                  : "Newest public songs"}
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose}>
            Close
          </button>
        </header>

        <div className={styles.searchWrap}>
          <input
            className={styles.search}
            value={draft}
            placeholder="Search songs"
            aria-label="Search songs"
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>

        <div className={styles.toolbar}>
          <div className={styles.sort} role="group" aria-label="Sort songs">
            <button
              type="button"
              className={styles.sortBtn}
              data-active={sort === "played"}
              onClick={() => setSort("played")}
            >
              Most played
            </button>
            <button
              type="button"
              className={styles.sortBtn}
              data-active={sort === "recent"}
              onClick={() => setSort("recent")}
            >
              Newest
            </button>
          </div>
          <a
            className={styles.share}
            href={COMMUNITY_BUILDER}
            target="_blank"
            rel="noreferrer"
          >
            Share a song
          </a>
        </div>

        {tagChips.length > 0 && (
          <div className={styles.chips} role="toolbar" aria-label="Filter by tag">
            <button
              type="button"
              className={styles.chip}
              data-active={activeTag === null}
              onClick={() => setActiveTag(null)}
            >
              All
            </button>
            {tagChips.map((tag) => (
              <button
                key={tag}
                type="button"
                className={styles.chip}
                data-active={activeTag === tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              >
                {formatTag(tag)}
              </button>
            ))}
          </div>
        )}

        <div className={styles.body}>
          {loading && <p className={styles.status}>Loading songs…</p>}
          {!loading && error && (
            <p className={`${styles.status} ${styles.error}`}>{error}</p>
          )}
          {!loading && !error && items.length === 0 && !query && (
            <p className={styles.status}>No public songs yet.</p>
          )}
          {!loading && !error && items.length === 0 && query && (
            <div className={styles.empty}>
              <p className={styles.status}>No playable songs match “{query}”.</p>
              <a
                className={styles.add}
                href={communityBuilderHref(query)}
                target="_blank"
                rel="noreferrer"
              >
                Add this song
              </a>
            </div>
          )}
          {!loading && !error && items.length > 0 && filtered.length === 0 && (
            <p className={styles.status}>No songs with {formatTag(activeTag!)}.</p>
          )}
          {!loading && !error && filtered.length > 0 && (
            <>
              {featured.length > 0 && (
                <section className={styles.section} aria-label="Most played">
                  <h3 className={styles.sectionLabel}>Most played</h3>
                  <div className={styles.featured}>
                    {featured.map((item, index) => (
                      <SongCard
                        key={item.id}
                        item={item}
                        rank={index + 1}
                        featured
                        onSelect={onSelect}
                      />
                    ))}
                  </div>
                </section>
              )}
              {rest.length > 0 && (
                <section className={styles.section} aria-label="Songs">
                  {featured.length > 0 && (
                    <h3 className={styles.sectionLabel}>More songs</h3>
                  )}
                  <div className={styles.list}>
                    {rest.map((item) => (
                      <SongCard key={item.id} item={item} onSelect={onSelect} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function SongCard({
  item,
  rank,
  featured = false,
  onSelect,
}: {
  item: ArrangementListItem
  rank?: number
  featured?: boolean
  onSelect: (id: string) => void
}) {
  const artist = item.original_artist.trim()
  return (
    <button
      type="button"
      className={featured ? styles.feature : styles.row}
      onClick={() => onSelect(item.id)}
    >
      {rank != null && <span className={styles.rank}>{rank}</span>}
      <span className={styles.copy}>
        <span className={styles.cardTitle}>{item.title}</span>
        <span className={styles.cardMeta}>
          {item.key_name} {item.mode} · {item.bpm} BPM
          {artist ? ` · ${artist}` : ""}
        </span>
        <span className={styles.cardAuthor}>{authorOf(item)}</span>
      </span>
      <span className={styles.plays}>{formatPlays(item.play_count)}</span>
    </button>
  )
}
