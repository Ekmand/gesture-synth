import { useEffect, useMemo, useState } from "react"
import {
  listArrangements,
  type ArrangementListItem,
} from "../lib/fetchArrangement"
import { COMMUNITY_BUILDER } from "../lib/siteLinks"
import { isSupabaseConfigured } from "../lib/supabase"
import styles from "./SongPicker.module.css"

type Props = {
  open: boolean
  onClose: () => void
  onSelect: (id: string) => void
}

const PAGE_SIZE = 16 // 4×4 grid

function formatTag(tag: string) {
  return `#${tag}`
}

export function SongPicker({ open, onClose, onSelect }: Props) {
  const [items, setItems] = useState<ArrangementListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setActiveTag(null)
    setPage(0)

    void (async () => {
      try {
        if (!isSupabaseConfigured()) {
          throw new Error("Supabase is not configured.")
        }
        const rows = await listArrangements()
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
  }, [open])

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
      .map(([tag, count]) => ({ tag, count }))
  }, [items])

  const filtered = useMemo(() => {
    if (!activeTag) return items
    return items.filter((item) => item.tags.includes(activeTag))
  }, [items, activeTag])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  )

  const selectTag = (tag: string | null) => {
    setActiveTag(tag)
    setPage(0)
  }

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
          <h2 className={styles.title}>Learn a song</h2>
          <button type="button" className={styles.close} onClick={onClose}>
            Close
          </button>
        </header>

        <a
          className={styles.createLink}
          href={COMMUNITY_BUILDER}
          target="_blank"
          rel="noreferrer"
        >
          <span className={styles.createTitle}>Create or share a song</span>
          <span className={styles.createMeta}>
            Open the community builder to arrange and publish your own
          </span>
        </a>

        {loading && <p className={styles.status}>Loading songs…</p>}
        {!loading && error && (
          <p className={`${styles.status} ${styles.error}`}>{error}</p>
        )}
        {!loading && !error && items.length === 0 && (
          <p className={styles.status}>No public songs yet.</p>
        )}
        {!loading && !error && items.length > 0 && (
          <>
            {tagChips.length > 0 && (
              <div className={styles.chips} role="toolbar" aria-label="Filter by tag">
                <button
                  type="button"
                  className={styles.chip}
                  data-active={activeTag === null}
                  onClick={() => selectTag(null)}
                >
                  All
                  <span className={styles.chipCount}>{items.length}</span>
                </button>
                {tagChips.map(({ tag, count }) => (
                  <button
                    key={tag}
                    type="button"
                    className={styles.chip}
                    data-active={activeTag === tag}
                    onClick={() => selectTag(activeTag === tag ? null : tag)}
                  >
                    {formatTag(tag)}
                    <span className={styles.chipCount}>{count}</span>
                  </button>
                ))}
              </div>
            )}

            {filtered.length === 0 ? (
              <p className={styles.status}>No songs with {formatTag(activeTag!)}.</p>
            ) : (
              <>
                <div className={styles.grid}>
                  {pageItems.map((item) => {
                    const author =
                      item.profiles?.display_name
                      || (item.profiles?.username
                        ? `@${item.profiles.username}`
                        : "Community")
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={styles.card}
                        onClick={() => onSelect(item.id)}
                      >
                        <span className={styles.cardTitle}>{item.title}</span>
                        <span className={styles.cardMeta}>
                          {item.key_name} {item.mode} · {item.bpm} BPM
                        </span>
                        <span className={styles.cardAuthor}>{author}</span>
                        {item.tags.length > 0 && (
                          <span className={styles.cardTags}>
                            {item.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className={styles.cardTag}>
                                {formatTag(tag)}
                              </span>
                            ))}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {pageCount > 1 && (
                  <div className={styles.pager}>
                    <button
                      type="button"
                      className={styles.pageBtn}
                      disabled={safePage <= 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      Prev
                    </button>
                    <span className={styles.pageLabel}>
                      {safePage + 1} / {pageCount}
                    </span>
                    <button
                      type="button"
                      className={styles.pageBtn}
                      disabled={safePage >= pageCount - 1}
                      onClick={() =>
                        setPage((p) => Math.min(pageCount - 1, p + 1))
                      }
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
