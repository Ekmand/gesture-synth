import { useCallback, useEffect, useRef, useState } from "react"
import type { TrackInfo } from "../audio/LoopEngine"
import styles from "./BeatGrid.module.css"

const CHORD_COLORS: Record<string, string> = {
  I: "61, 255, 224",
  II: "255, 107, 90",
  III: "240, 198, 90",
  IV: "120, 210, 255",
  V: "255, 150, 70",
  VI: "255, 90, 140",
  VII: "160, 200, 255",
}
const CHORDS = ["I", "II", "III", "IV", "V", "VI", "VII"] as const

function chordRgb(chord: string | null): string {
  if (!chord) return "150, 150, 150"
  return CHORD_COLORS[chord.toUpperCase()] ?? "150, 150, 150"
}

type Props = {
  tracks: TrackInfo[]
  activeTrack: number
  currentStep: number
  beatsPerBar: number
  subsPerBeat: number
  onToggleStep: (trackIdx: number, stepIdx: number) => void
  onPlaceChord: (trackIdx: number, stepIdx: number, chord: string) => void
  onSelectTrack: (trackIdx: number) => void
  onTrackVolume: (trackIdx: number, vol: number) => void
  onTrackMute: (trackIdx: number) => void
  onTrackSolo: (trackIdx: number) => void
  visible: boolean
}

type MenuState = {
  x: number
  y: number
  trackIdx: number
  stepIdx: number
} | null

export function BeatGrid({
  tracks,
  activeTrack,
  currentStep,
  beatsPerBar,
  subsPerBeat,
  onToggleStep,
  onPlaceChord,
  onSelectTrack,
  onTrackVolume,
  onTrackMute,
  onTrackSolo,
  visible,
}: Props) {
  const [minimized, setMinimized] = useState(false)
  const [menu, setMenu] = useState<MenuState>(null)
  const [lastChord, setLastChord] = useState<string>("I")
  const dragRef = useRef<{ painting: boolean; chord: string; trackIdx: number } | null>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener("click", close)
    return () => window.removeEventListener("click", close)
  }, [menu])

  const handleContextMenu = useCallback((e: React.MouseEvent, trackIdx: number, stepIdx: number) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, trackIdx, stepIdx })
  }, [])

  const handleChordPick = useCallback((chord: string) => {
    if (!menu) return
    onPlaceChord(menu.trackIdx, menu.stepIdx, chord)
    setLastChord(chord)
    setMenu(null)
  }, [menu, onPlaceChord])

  // Drag painting
  const handlePointerDown = useCallback((e: React.PointerEvent, trackIdx: number, stepIdx: number) => {
    if (e.button !== 0) return // left click only
    const step = tracks[trackIdx]?.steps[stepIdx]
    if (!step) return

    if (step.hasAudio && !step.muted) {
      // Active cell — toggle off (remove)
      onToggleStep(trackIdx, stepIdx)
      dragRef.current = null
    } else if (step.hasAudio && step.muted) {
      // Muted cell — re-enable
      onToggleStep(trackIdx, stepIdx)
      dragRef.current = null
    } else {
      // Empty cell — paint with last chord
      onPlaceChord(trackIdx, stepIdx, lastChord)
      dragRef.current = { painting: true, chord: lastChord, trackIdx }
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    }
  }, [tracks, lastChord, onToggleStep, onPlaceChord])

  const handlePointerEnter = useCallback((trackIdx: number, stepIdx: number) => {
    if (!dragRef.current?.painting) return
    if (trackIdx !== dragRef.current.trackIdx) return
    const step = tracks[trackIdx]?.steps[stepIdx]
    if (step && !step.hasAudio) {
      onPlaceChord(trackIdx, stepIdx, dragRef.current.chord)
    }
  }, [tracks, onPlaceChord])

  useEffect(() => {
    const up = () => { dragRef.current = null }
    window.addEventListener("pointerup", up)
    return () => window.removeEventListener("pointerup", up)
  }, [])

  if (!visible) return null

  const stepsPerBeat = subsPerBeat
  const stepsPerBar = beatsPerBar * stepsPerBeat
  const totalSteps = tracks[0]?.steps.length ?? 0
  if (totalSteps === 0) return null

  const anyContent = tracks.some((t) => t.hasContent)

  // Minimized view
  if (minimized) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.miniBar}>
          <button
            type="button"
            className={styles.expandBtn}
            onClick={() => setMinimized(false)}
            aria-label="Expand beat grid"
          >
            <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="2,7 5,2 8,7" fill="currentColor"/></svg>
          </button>
          <span className={styles.miniLabel}>
            {anyContent
              ? `${tracks.filter((t) => t.hasContent).length} tracks`
              : "Loop"}
          </span>
          {anyContent && currentStep >= 0 && (
            <div className={styles.miniProgress}>
              <div
                className={styles.miniProgressFill}
                style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  const totalBars = Math.ceil(totalSteps / stepsPerBar)

  const barIndices: number[][][] = []
  for (let bar = 0; bar < totalBars; bar++) {
    const beats: number[][] = []
    for (let beat = 0; beat < beatsPerBar; beat++) {
      const subs: number[] = []
      for (let sub = 0; sub < stepsPerBeat; sub++) {
        const idx = bar * stepsPerBar + beat * stepsPerBeat + sub
        if (idx < totalSteps) subs.push(idx)
      }
      if (subs.length > 0) beats.push(subs)
    }
    if (beats.length > 0) barIndices.push(beats)
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Sequencer</span>
          <button
            type="button"
            className={styles.minimizeBtn}
            onClick={() => setMinimized(true)}
            aria-label="Minimize beat grid"
          >
            <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="4.5" width="8" height="1.5" rx="0.5" fill="currentColor"/></svg>
          </button>
        </div>
        {tracks.map((track, trackIdx) => (
          <div
            key={trackIdx}
            className={styles.trackRow}
            data-active={trackIdx === activeTrack}
            data-has-content={track.hasContent}
          >
            <div className={styles.trackControls}>
              <button
                type="button"
                className={styles.trackNum}
                data-active={trackIdx === activeTrack}
                data-playing={track.playing}
                onClick={() => onSelectTrack(trackIdx)}
              >
                {trackIdx + 1}
              </button>
              <button
                type="button"
                className={styles.muteBtn}
                data-on={track.muted}
                onClick={() => onTrackMute(trackIdx)}
              >
                M
              </button>
              <button
                type="button"
                className={styles.soloBtn}
                data-on={track.solo}
                onClick={() => onTrackSolo(trackIdx)}
              >
                S
              </button>
              <input
                type="range"
                className={styles.volSlider}
                min={0} max={100}
                value={Math.round(track.volume * 100)}
                onChange={(e) => onTrackVolume(trackIdx, Number(e.target.value) / 100)}
              />
            </div>

            <div className={styles.grid}>
              {barIndices.map((bar, barIdx) => (
                <div key={barIdx} className={styles.barGroup}>
                  {bar.map((beat, beatIdx) => (
                    <div key={beatIdx} className={styles.beatGroup}>
                      {beat.map((stepIdx) => {
                        const step = track.steps[stepIdx]
                        if (!step) return null
                        const rgb = chordRgb(step.chord)
                        const isDownbeat = stepIdx % stepsPerBeat === 0
                        return (
                          <button
                            key={stepIdx}
                            type="button"
                            className={styles.cell}
                            data-active={step.hasAudio && !step.muted}
                            data-muted={step.muted && step.hasAudio}
                            data-current={stepIdx === currentStep && track.playing}
                            data-downbeat={isDownbeat}
                            style={{ "--cell-rgb": rgb } as React.CSSProperties}
                            onPointerDown={(e) => handlePointerDown(e, trackIdx, stepIdx)}
                            onPointerEnter={() => handlePointerEnter(trackIdx, stepIdx)}
                            onContextMenu={(e) => handleContextMenu(e, trackIdx, stepIdx)}
                          >
                            {step.hasAudio && !step.muted && step.chord && isDownbeat && (
                              <span className={styles.chordLabel}>{step.chord}</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Chord context menu */}
      {menu && (
        <div
          className={styles.chordMenu}
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {CHORDS.map((c) => (
            <button
              key={c}
              type="button"
              className={styles.chordMenuItem}
              style={{ "--chord-rgb": CHORD_COLORS[c] } as React.CSSProperties}
              onClick={() => handleChordPick(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type CountInProps = { beat: number; beatsPerBar: number; visible: boolean }

export function CountInDisplay({ beat, beatsPerBar, visible }: CountInProps) {
  if (!visible) return null
  return (
    <div className={styles.countIn}>
      <span key={beat} className={styles.countInNum}>{Math.min(beat + 1, beatsPerBar)}</span>
      <span className={styles.countInLabel}>Count in...</span>
    </div>
  )
}
