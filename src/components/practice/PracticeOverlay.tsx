import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DEGREE_LABELS } from "../../lib/noteNames"
import { compareLive, isFullMatch, qualityLabel } from "../../lib/practiceMatch"
import type {
  GestureTarget,
  MatchReport,
  PracticeEvent,
  PracticeSong,
} from "../../lib/practiceTypes"
import type { StabilizedChord } from "../../music/gestures"
import { chordColorVar } from "../../music/chords"
import { DEGREE_FINGERS, HandShape, qualityFingers } from "./HandShape"
import styles from "./PracticeOverlay.module.css"

const SECTION_BARS = 4
const HOLD_MS = 350
const ADVANCE_MS = 650

type LivePractice = {
  chord: string | null
  qualityIndex: number
  octaveDown: boolean
}

type Props = {
  song: PracticeSong
  open: boolean
  live: LivePractice
  onExit: () => void
  metronomeOn: boolean
  /** True once the learner has sounded a chord this session (metro may start). */
  metronomeArmed: boolean
  metronomeVolume: number
  onMetronomeOnChange: (on: boolean) => void
  onMetronomeVolumeChange: (volume: number) => void
  /** Publish the active target so App can mute wrong gestures. */
  onPracticeTargetChange: (target: GestureTarget | null) => void
}

type GuidedPhase = "stepping" | "section-done" | "done"

type SectionEvent = { ev: PracticeEvent; index: number }

type Section = {
  barStart: number
  barEnd: number
  events: SectionEvent[]
}

type StepRecord = { skipped: boolean }

function buildSections(song: PracticeSong): Section[] {
  const sections: Section[] = []
  song.events.forEach((ev, index) => {
    const s = Math.floor((ev.bar - 1) / SECTION_BARS)
    let section = sections[s]
    if (!section) {
      section = {
        barStart: s * SECTION_BARS + 1,
        barEnd: ev.bar,
        events: [],
      }
      sections[s] = section
    }
    section.barEnd = Math.max(section.barEnd, ev.bar)
    section.events.push({ ev, index })
  })
  return sections.filter(Boolean)
}

function toStable(live: LivePractice): StabilizedChord | null {
  if (!live.chord || live.qualityIndex < 1) return null
  const isMajorMode = live.chord === live.chord.toUpperCase()
  return {
    chord: live.chord,
    isMajorMode,
    qualityIndex: live.qualityIndex,
    thumbDown: live.octaveDown,
  }
}

export function PracticeOverlay({
  song,
  open,
  live,
  onExit,
  metronomeOn,
  metronomeArmed,
  metronomeVolume,
  onMetronomeOnChange,
  onMetronomeVolumeChange,
  onPracticeTargetChange,
}: Props) {
  const metroRunning = metronomeOn && metronomeArmed
  const sections = useMemo(() => buildSections(song), [song])
  const [phase, setPhase] = useState<GuidedPhase>("stepping")
  const [sectionIdx, setSectionIdx] = useState(0)
  const [stepIdx, setStepIdx] = useState(0)
  const [report, setReport] = useState<MatchReport | null>(null)
  const [justCompleted, setJustCompleted] = useState(false)
  const [records, setRecords] = useState<StepRecord[][]>([])
  const [metroOpen, setMetroOpen] = useState(false)
  const metroWrapRef = useRef<HTMLDivElement | null>(null)
  const chartListRef = useRef<HTMLDivElement | null>(null)
  const activeRowRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!metroOpen) return
    const onPointer = (e: PointerEvent) => {
      if (!metroWrapRef.current?.contains(e.target as Node)) setMetroOpen(false)
    }
    window.addEventListener("pointerdown", onPointer)
    return () => window.removeEventListener("pointerdown", onPointer)
  }, [metroOpen])

  useEffect(() => {
    if (!open) setMetroOpen(false)
  }, [open])

  // Keep the active chart row (green) centered in the list so upcoming notes stay visible
  useEffect(() => {
    if (!open || phase !== "stepping") return
    const list = chartListRef.current
    const row = activeRowRef.current
    if (!list || !row) return
    const top = Math.max(
      0,
      row.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2,
    )
    list.scrollTo({ top, behavior: "smooth" })
  }, [open, phase, sectionIdx, stepIdx])

  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const sectionIdxRef = useRef(sectionIdx)
  sectionIdxRef.current = sectionIdx
  const stepIdxRef = useRef(stepIdx)
  stepIdxRef.current = stepIdx
  const sectionsRef = useRef(sections)
  sectionsRef.current = sections
  const holdSinceRef = useRef<number | null>(null)
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const section = sections[sectionIdx]
  const current: SectionEvent | null =
    phase === "stepping" ? (section?.events[stepIdx] ?? null) : null
  const target = current?.ev.target ?? null

  useEffect(() => {
    onPracticeTargetChange(open && phase === "stepping" ? target : null)
    return () => onPracticeTargetChange(null)
  }, [open, phase, target, onPracticeTargetChange])

  const recordStep = useCallback((skipped: boolean) => {
    setRecords((prev) => {
      const next = prev.map((r) => r.slice())
      const s = sectionIdxRef.current
      if (!next[s]) next[s] = []
      next[s][stepIdxRef.current] = { skipped }
      return next
    })
  }, [])

  const advance = useCallback(() => {
    const s = sectionIdxRef.current
    const sec = sectionsRef.current[s]
    setJustCompleted(false)
    holdSinceRef.current = null
    if (stepIdxRef.current + 1 < sec.events.length) {
      setStepIdx(stepIdxRef.current + 1)
    } else {
      setPhase(s + 1 < sectionsRef.current.length ? "section-done" : "done")
    }
  }, [])

  const scheduleAdvance = useCallback(() => {
    if (advanceTimerRef.current) return
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null
      advance()
    }, ADVANCE_MS)
  }, [advance])

  const skip = useCallback(() => {
    if (phaseRef.current !== "stepping") return
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
    recordStep(true)
    advance()
  }, [advance, recordStep])

  const repeatSection = useCallback(() => {
    holdSinceRef.current = null
    setStepIdx(0)
    setPhase("stepping")
  }, [])

  const nextSection = useCallback(() => {
    holdSinceRef.current = null
    setSectionIdx((i) => i + 1)
    setStepIdx(0)
    setPhase("stepping")
  }, [])

  const jumpToSection = useCallback((i: number) => {
    holdSinceRef.current = null
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
    setSectionIdx(i)
    setStepIdx(0)
    setPhase("stepping")
  }, [])

  const restart = useCallback(() => {
    holdSinceRef.current = null
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
    setRecords([])
    setSectionIdx(0)
    setStepIdx(0)
    setPhase("stepping")
    setJustCompleted(false)
    setReport(null)
  }, [])

  const liveRef = useRef(live)
  liveRef.current = live
  const targetRef = useRef(target)
  targetRef.current = target

  // Hold-to-advance match loop (rAF so hold time advances even if live UI is stable)
  useEffect(() => {
    if (!open || phase !== "stepping") {
      setReport(null)
      return
    }

    let raf = 0
    let lastSig = ""
    let completedLatched = false
    let armedStepKey = `${sectionIdxRef.current}:${stepIdxRef.current}`

    const tick = () => {
      raf = requestAnimationFrame(tick)

      // New chart step → re-arm matching (needed when consecutive targets are identical)
      const stepKey = `${sectionIdxRef.current}:${stepIdxRef.current}`
      if (stepKey !== armedStepKey) {
        armedStepKey = stepKey
        completedLatched = false
        holdSinceRef.current = null
        setJustCompleted(false)
        lastSig = ""
      }

      const t = targetRef.current
      if (!t) {
        if (lastSig !== "none") {
          lastSig = "none"
          setReport(null)
        }
        return
      }
      const next = compareLive(toStable(liveRef.current), t)
      const sig = next
        ? `${next.degree}${next.world}${next.quality}${next.octave}`
        : "null"
      if (sig !== lastSig) {
        lastSig = sig
        setReport(next)
      }

      const now = performance.now()
      if (isFullMatch(next)) {
        if (holdSinceRef.current === null) holdSinceRef.current = now
        if (
          now - holdSinceRef.current >= HOLD_MS
          && !advanceTimerRef.current
          && !completedLatched
        ) {
          completedLatched = true
          setJustCompleted(true)
          recordStep(false)
          scheduleAdvance()
        }
      } else if (!advanceTimerRef.current) {
        holdSinceRef.current = null
        if (completedLatched) {
          completedLatched = false
          setJustCompleted(false)
        }
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [open, phase, recordStep, scheduleAdvance])

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
    }
  }, [])

  if (!open) return null

  if (song.events.length === 0) {
    return (
      <div className={styles.overlay}>
        <div className={styles.panel}>
          <div className={styles.screen}>
            <h2>No playable chords</h2>
            <p className={styles.lede}>
              This arrangement has no non-rest steps to practice.
            </p>
            <div className={styles.doneActions}>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onExit}>
                Back to free play
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const sectionRecords = records[sectionIdx] ?? []
  const completedCount = records.flat().filter((r) => r && !r.skipped).length
  const skippedCount = records.flat().filter((r) => r?.skipped).length
  const totalEvents = song.events.length
  const degreeColor = current
    ? `rgb(${chordColorVar(DEGREE_LABELS[current.ev.target.degree])})`
    : "var(--mint)"

  const chips: [string, string, boolean | undefined][] = target
    ? [
        ["DEG", DEGREE_LABELS[target.degree] ?? String(target.degree), report?.degree],
        ["MODE", target.world, report?.world],
        ["QUAL", qualityLabel(target.world, target.quality), report?.quality],
        ["OCT", target.octave === 0 ? "base" : "-1", report?.octave],
      ]
    : []

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <p className={styles.kicker}>Guided practice</p>
            <h1 className={styles.title}>{song.title}</h1>
            <p className={styles.meta}>
              {song.artist} · {song.key} {song.mode} · {song.bpm} BPM
            </p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.btn} onClick={onExit}>
              Exit
            </button>
          </div>
        </header>

        {phase === "stepping" && current && target && section && (
          <div className={styles.stage}>
            <section className={styles.guide} data-complete={justCompleted}>
              <div className={styles.guideHead}>
                <span className={styles.chordName}>{current.ev.chordName}</span>
                <span className={styles.pos}>
                  Section {sectionIdx + 1}/{sections.length} · chord {stepIdx + 1}/
                  {section.events.length}
                </span>
              </div>

              <div className={styles.hands}>
                <div className={styles.hand}>
                  <div className={styles.handSvg}>
                    <HandShape
                      side="left"
                      fingers={DEGREE_FINGERS[target.degree] ?? DEGREE_FINGERS[1]}
                      tiltDeg={target.world === "minor" ? 18 : -18}
                      color={degreeColor}
                    />
                  </div>
                  <p className={styles.caption}>
                    <strong>Left</strong> · {DEGREE_LABELS[target.degree]} · tilt{" "}
                    {target.world === "minor" ? "right" : "left"} ({target.world})
                  </p>
                </div>
                <div className={styles.hand}>
                  <div className={styles.handSvg}>
                    <HandShape
                      side="right"
                      fingers={qualityFingers(target.quality, target.octave !== 0)}
                      color="rgb(255, 107, 90)"
                    />
                  </div>
                  <p className={styles.caption}>
                    <strong>Right</strong> · {qualityLabel(target.world, target.quality)} · thumb{" "}
                    {target.octave === 0 ? "in (base)" : "out (-8ve)"}
                  </p>
                </div>
              </div>

              <div className={styles.chips}>
                {chips.map(([label, text, match]) => (
                  <div
                    key={label}
                    className={styles.chip}
                    data-ok={match === undefined ? undefined : match ? "true" : "false"}
                  >
                    <span className={styles.chipLabel}>{label}</span>
                    <span className={styles.chipTarget}>{text}</span>
                  </div>
                ))}
              </div>

              <p className={styles.hint}>Hold the shape until it clicks — take your time.</p>

              <div className={styles.guideActions}>
                <div className={styles.metroWrap} ref={metroWrapRef}>
                  <button
                    type="button"
                    className={styles.metroBtn}
                    data-on={metroRunning}
                    data-armed={metronomeOn && !metroRunning}
                    aria-label={
                      !metronomeOn
                        ? "Metronome off — open settings"
                        : metroRunning
                          ? `Metronome on at ${song.bpm} BPM — open volume`
                          : `Metronome ready at ${song.bpm} BPM — starts on your first note`
                    }
                    aria-expanded={metroOpen}
                    onClick={() => setMetroOpen((p) => !p)}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                      <path
                        d="M5 14L7 2h2l2 12H5z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                      <line
                        x1="8"
                        y1="4"
                        x2="11"
                        y2="2"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className={styles.metroBpm}>{song.bpm}</span>
                  </button>
                  {metroOpen && (
                    <div className={styles.metroPopover} role="dialog" aria-label="Metronome settings">
                      <div className={styles.metroRow}>
                        <button
                          type="button"
                          className={styles.metroToggle}
                          data-on={metronomeOn}
                          onClick={() => onMetronomeOnChange(!metronomeOn)}
                        >
                          {metronomeOn ? "On" : "Off"}
                        </button>
                        <span className={styles.metroHint}>
                          {song.bpm} BPM
                          {!metronomeOn
                            ? " · off"
                            : !metroRunning
                              ? " · waits for first note"
                              : " · on"}
                        </span>
                      </div>
                      <div className={styles.metroRow}>
                        <span className={styles.metroLabel}>Vol</span>
                        <input
                          type="range"
                          className={styles.metroSlider}
                          min={0}
                          max={100}
                          value={Math.round(metronomeVolume * 100)}
                          onChange={(e) => {
                            const v = Number(e.target.value) / 100
                            onMetronomeVolumeChange(v)
                            if (v > 0 && !metronomeOn) onMetronomeOnChange(true)
                          }}
                        />
                        <span className={styles.metroVal}>
                          {Math.round(metronomeVolume * 100)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <button type="button" className={styles.btn} onClick={skip}>
                  Skip this chord →
                </button>
              </div>
            </section>

            <div className={styles.chart}>
              <div className={styles.sectionPills}>
                {sections.map((s, i) => (
                  <button
                    key={s.barStart}
                    type="button"
                    className={styles.pill}
                    data-active={i === sectionIdx}
                    data-done={(records[i]?.length ?? 0) >= s.events.length}
                    onClick={() => jumpToSection(i)}
                  >
                    {s.barStart}–{s.barEnd}
                  </button>
                ))}
              </div>
              <div className={styles.chartList} ref={chartListRef}>
                {section.events.map(({ ev }, i) => {
                  const rec = sectionRecords[i]
                  const state =
                    i === stepIdx ? "active" : rec ? (rec.skipped ? "skipped" : "done") : "future"
                  return (
                    <div
                      className={styles.row}
                      data-state={state}
                      key={`${ev.stepIndex}-${i}`}
                      ref={i === stepIdx ? activeRowRef : undefined}
                    >
                      <span>
                        {ev.bar}.{ev.beat}
                      </span>
                      <span>{ev.chordName}</span>
                      <span className={styles.deg}>{DEGREE_LABELS[ev.target.degree]}</span>
                      <span>{ev.target.world}</span>
                      <span className="qual">{qualityLabel(ev.target.world, ev.target.quality)}</span>
                      <span>{rec ? (rec.skipped ? "·" : "✓") : ""}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {phase === "section-done" && section && (
          <div className={styles.screen}>
            <h2>Section {sectionIdx + 1} complete</h2>
            <p className={styles.lede}>
              Bars {section.barStart}–{section.barEnd} ·{" "}
              {sectionRecords.filter((r) => r && !r.skipped).length}/{section.events.length} matched
              {sectionRecords.some((r) => r?.skipped)
                ? ` · ${sectionRecords.filter((r) => r?.skipped).length} skipped`
                : ""}
            </p>
            <div className={styles.doneActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={nextSection}
              >
                Next section
              </button>
              <button type="button" className={styles.btn} onClick={repeatSection}>
                Repeat this section
              </button>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className={styles.screen}>
            <h2>Guided practice complete</h2>
            <p className={styles.lede}>
              {song.title} — {completedCount}/{totalEvents} chords matched
              {skippedCount > 0 ? ` · ${skippedCount} skipped` : ""}
            </p>
            <div className={styles.doneActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={restart}
              >
                Practice again
              </button>
              <button type="button" className={styles.btn} onClick={onExit}>
                Back to free play
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function SongLoadBanner({
  message,
  onDismiss,
}: {
  message: string
  onDismiss: () => void
}) {
  return (
    <div className={styles.banner} role="alert">
      {message}
      <button type="button" className={styles.bannerDismiss} onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  )
}
