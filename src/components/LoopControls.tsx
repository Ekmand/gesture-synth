import { useCallback, useEffect, useRef, useState } from "react"
import type { LoopState } from "../audio/LoopEngine"
import styles from "./LoopControls.module.css"

const BAR_OPTIONS = [1, 2, 4, 8, 16] as const
const TAP_RESET_MS = 2000 // reset taps after 2s of inactivity
const TIME_SIG_OPTIONS = [
  { label: "3/4", beats: 3 },
  { label: "4/4", beats: 4 },
  { label: "5/4", beats: 5 },
  { label: "6/8", beats: 6 },
  { label: "7/8", beats: 7 },
] as const

type Props = {
  loopState: LoopState
  progress: number
  duration: number
  bpm: number
  bars: number
  beatsPerBar: number
  activeTrack: number
  anyTrackPlaying: boolean
  isPaused: boolean
  isExporting: boolean
  metronome: boolean
  metronomeVolume: number
  metronomeSound: string
  onMetronomeToggle: () => void
  onMetronomeVolume: (v: number) => void
  onMetronomeSound: (s: string) => void
  onBpmChange: (bpm: number) => void
  onBarsChange: (bars: number) => void
  onBeatsPerBarChange: (beats: number) => void
  onRecord: () => void
  onStop: () => void
  onPlayPause: () => void
  onClearTrack: () => void
  onClearAll: () => void
  onStopAll: () => void
  onExport: () => void
  didRestart: boolean
  visible: boolean
}

export function LoopControls({
  loopState,
  progress,
  duration,
  bpm,
  bars,
  beatsPerBar,
  activeTrack,
  anyTrackPlaying,
  isPaused,
  isExporting,
  metronome,
  metronomeVolume,
  metronomeSound,
  onMetronomeToggle,
  onMetronomeVolume,
  onMetronomeSound,
  onBpmChange,
  onBarsChange,
  onBeatsPerBarChange,
  onRecord,
  onStop,
  onPlayPause,
  onClearTrack,
  onClearAll,
  onStopAll,
  onExport,
  didRestart,
  visible,
}: Props) {
  const [flash, setFlash] = useState(false)
  const [metroOpen, setMetroOpen] = useState(false)
  const bpmRef = useRef<HTMLInputElement>(null)
  const tapsRef = useRef<number[]>([])
  const [tapBpm, setTapBpm] = useState<number | null>(null)

  useEffect(() => {
    if (didRestart && anyTrackPlaying) {
      setFlash(true)
      const id = setTimeout(() => setFlash(false), 150)
      return () => clearTimeout(id)
    }
  }, [didRestart, anyTrackPlaying])

  const handleTap = useCallback(() => {
    const now = performance.now()
    const taps = tapsRef.current
    // Reset if last tap was too long ago
    if (taps.length > 0 && now - taps[taps.length - 1] > TAP_RESET_MS) {
      taps.length = 0
    }
    taps.push(now)
    // Keep last 8 taps
    if (taps.length > 8) taps.shift()

    if (taps.length >= 2) {
      // Average interval between taps
      let totalInterval = 0
      for (let i = 1; i < taps.length; i++) {
        totalInterval += taps[i] - taps[i - 1]
      }
      const avgMs = totalInterval / (taps.length - 1)
      const detected = Math.round(60000 / avgMs)
      const clamped = Math.max(30, Math.min(300, detected))
      setTapBpm(clamped)
      onBpmChange(clamped)
      if (bpmRef.current) bpmRef.current.value = String(clamped)
    }
  }, [onBpmChange])

  // Spacebar = tap tempo when config is visible
  useEffect(() => {
    if (!visible || loopState !== "idle" || anyTrackPlaying || isPaused) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === " ") {
        e.preventDefault()
        handleTap()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [visible, loopState, anyTrackPlaying, isPaused, handleTap])

  if (!visible) return null

  const isCountIn = loopState === "countIn"
  const isRecording = loopState === "recording"
  const isIdle = loopState === "idle"
  const durationSec = (duration / 1000).toFixed(1)
  const hasContent = anyTrackPlaying || isPaused

  const handleBpmBlur = () => {
    const val = Number(bpmRef.current?.value)
    if (val >= 30 && val <= 300) onBpmChange(val)
    else if (bpmRef.current) bpmRef.current.value = String(bpm)
  }

  return (
    <div className={styles.loopBar} data-metro-open={metroOpen || undefined}>
      {/* Grid config */}
      {isIdle && !hasContent && (
        <>
          <input
            ref={bpmRef}
            type="number"
            className={styles.bpmInput}
            defaultValue={bpm}
            min={30}
            max={300}
            onBlur={handleBpmBlur}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
            aria-label="BPM"
          />
          <span className={styles.gridLabel}>bpm</span>
          <button
            type="button"
            className={styles.tapBtn}
            data-active={tapBpm !== null}
            onClick={handleTap}
            aria-label="Tap tempo — tap rhythmically or press spacebar"
          >
            TAP
          </button>
          <select
            className={styles.gridSelect}
            value={beatsPerBar}
            onChange={(e) => onBeatsPerBarChange(Number(e.target.value))}
            aria-label="Time signature"
          >
            {TIME_SIG_OPTIONS.map((ts) => (
              <option key={ts.label} value={ts.beats}>{ts.label}</option>
            ))}
          </select>
          <select
            className={styles.gridSelect}
            value={bars}
            onChange={(e) => onBarsChange(Number(e.target.value))}
            aria-label="Bar count"
          >
            {BAR_OPTIONS.map((b) => (
              <option key={b} value={b}>{b} bar{b > 1 ? "s" : ""}</option>
            ))}
          </select>
          <div className={styles.sep} />
        </>
      )}

      {/* Track badge */}
      <span className={styles.trackBadge}>T{activeTrack + 1}</span>

      {/* Metronome */}
      <div className={styles.metroWrap}>
        <button
          type="button"
          className={styles.metronomeBtn}
          data-on={metronome}
          onClick={onMetronomeToggle}
          onContextMenu={(e) => { e.preventDefault(); setMetroOpen((p) => !p) }}
          aria-label={metronome ? "Metronome on (right-click to configure)" : "Metronome off"}
        >
          <svg width="12" height="12" viewBox="0 0 16 16">
            <path d="M5 14L7 2h2l2 12H5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <line x1="8" y1="4" x2="11" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
        <button
          type="button"
          className={styles.metroExpandBtn}
          onClick={() => setMetroOpen((p) => !p)}
          aria-label="Metronome settings"
        >
          <svg width="6" height="6" viewBox="0 0 6 6"><polygon points="0,0 6,0 3,5" fill="currentColor"/></svg>
        </button>
        {metroOpen && (
          <div className={styles.metroPopover}>
            <div className={styles.metroRow}>
              <span className={styles.metroLabel}>Sound</span>
              <select
                className={styles.metroSelect}
                value={metronomeSound}
                onChange={(e) => onMetronomeSound(e.target.value)}
              >
                <option value="click">Click</option>
                <option value="wood">Wood</option>
                <option value="beep">Beep</option>
                <option value="hihat">Hi-hat</option>
              </select>
            </div>
            <div className={styles.metroRow}>
              <span className={styles.metroLabel}>Volume</span>
              <input
                type="range"
                className={styles.metroSlider}
                min={0} max={100}
                value={Math.round(metronomeVolume * 100)}
                onChange={(e) => onMetronomeVolume(Number(e.target.value) / 100)}
              />
              <span className={styles.metroVal}>{Math.round(metronomeVolume * 100)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* === Transport controls === */}
      <div className={styles.transport}>
        {/* Play / Pause */}
        {hasContent && (
          <button
            type="button"
            className={styles.transportBtn}
            data-type="play"
            data-active={anyTrackPlaying}
            onClick={onPlayPause}
            aria-label={anyTrackPlaying ? "Pause" : "Play"}
          >
            {anyTrackPlaying ? (
              <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="3" height="8" fill="currentColor"/><rect x="6" y="1" width="3" height="8" fill="currentColor"/></svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="2,1 9,5 2,9" fill="currentColor"/></svg>
            )}
          </button>
        )}

        {/* Stop */}
        {hasContent && (
          <button
            type="button"
            className={styles.transportBtn}
            data-type="stop"
            onClick={onStopAll}
            aria-label="Stop all"
          >
            <svg width="10" height="10" viewBox="0 0 10 10"><rect x="2" y="2" width="6" height="6" fill="currentColor"/></svg>
          </button>
        )}

        {/* Record */}
        <button
          type="button"
          className={styles.transportBtn}
          data-type="rec"
          data-active={isRecording || isCountIn}
          onClick={isIdle ? onRecord : onStop}
          aria-label={isCountIn ? "Cancel" : isRecording ? "Stop recording" : "Record"}
        >
          <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>
        </button>
      </div>

      {/* Count-in / Recording progress */}
      {isCountIn && <span className={styles.recLabel}>COUNT IN</span>}

      {isRecording && (
        <>
          <span className={styles.recLabel}>REC</span>
          <div className={styles.progressWrap}>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        </>
      )}

      {/* Playback progress + actions */}
      {isIdle && hasContent && (
        <>
          <div className={styles.progressWrap}>
            <div className={styles.progressTrack} data-flash={flash}>
              <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
            </div>
            <span className={styles.durationLabel}>{durationSec}s</span>
          </div>
          <button type="button" className={styles.actionBtn} onClick={onClearTrack}>Clear T{activeTrack + 1}</button>
          <button type="button" className={styles.actionBtn} onClick={onClearAll}>Reset All</button>
          <div className={styles.sep} />
          <button
            type="button"
            className={styles.actionBtn}
            data-accent="true"
            onClick={onExport}
            disabled={isExporting}
          >
            {isExporting ? "..." : "Export"}
          </button>
        </>
      )}
    </div>
  )
}
