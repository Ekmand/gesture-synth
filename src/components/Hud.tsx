import { KEY_OPTIONS } from "../music/chords"
import {
  FIXED_QUALITY_OPTIONS,
  type FixedMode,
  type FixedQuality,
  type GestureSettings,
  type ModeControl,
  type QualityControl,
} from "../music/gestureSettings"
import styles from "./Hud.module.css"

export type InstrumentMode = "gesture" | "theremin"

type Props = {
  mode: InstrumentMode
  onModeChange: (mode: InstrumentMode) => void
  keyHz: number
  onKeyChange: (hz: number) => void
  gestureSettings: GestureSettings
  onGestureSettingsChange: (next: GestureSettings) => void
  volume: number
  tonePct: number
  chord: string | null
  quality: string
  pitchHz: number
  octaveDown: boolean
  onHelp: () => void
  statusText: string
  audioOn: boolean
}

const BARS = 8

export function Hud({
  mode,
  onModeChange,
  keyHz,
  onKeyChange,
  gestureSettings,
  onGestureSettingsChange,
  volume,
  tonePct,
  chord,
  quality,
  pitchHz,
  octaveDown,
  onHelp,
  statusText,
  audioOn,
}: Props) {
  const litCount = Math.round(volume * BARS)
  const { modeControl, fixedMode, qualityControl, fixedQuality } = gestureSettings

  const patch = (partial: Partial<GestureSettings>) => {
    onGestureSettingsChange({ ...gestureSettings, ...partial })
  }

  const qualityOptionLabel = (value: FixedQuality) => {
    const opt = FIXED_QUALITY_OPTIONS.find((o) => o.value === value)!
    // Preview labels using fixed mode when mode is locked; otherwise show both.
    if (modeControl === "fixed") {
      return fixedMode === "major" ? opt.major : opt.minor
    }
    return `${opt.major} / ${opt.minor}`
  }

  return (
    <div className={styles.hud}>
      <div className={styles.topLeft}>
        <h1 className={styles.brand}>Gesture Synth</h1>
        <div className={styles.row}>
          <div className={styles.panel} role="group" aria-label="Instrument mode">
            <button
              type="button"
              className={styles.modeBtn}
              data-active={mode === "gesture"}
              onClick={() => onModeChange("gesture")}
            >
              Gesture
            </button>
            <button
              type="button"
              className={styles.modeBtn}
              data-active={mode === "theremin"}
              onClick={() => onModeChange("theremin")}
            >
              Theremin
            </button>
          </div>
          <button type="button" className={styles.iconBtn} onClick={onHelp}>
            Help
          </button>
        </div>
        {mode === "gesture" && (
          <>
            <label className={styles.row}>
              <span className="visually-hidden">Key</span>
              <select
                className={styles.select}
                value={keyHz}
                onChange={(e) => onKeyChange(Number(e.target.value))}
                aria-label="Musical key"
              >
                {KEY_OPTIONS.map((k) => (
                  <option key={k.label} value={k.hz}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.config}>
              <div className={styles.configRow}>
                <span className={styles.configLabel}>Left hand</span>
                <select
                  className={styles.selectSm}
                  value={modeControl}
                  onChange={(e) => patch({ modeControl: e.target.value as ModeControl })}
                  aria-label="Left hand mode control"
                >
                  <option value="tilt">Scale notes + tilt major/minor</option>
                  <option value="fixed">Scale notes only (lock mode)</option>
                </select>
                {modeControl === "fixed" && (
                  <select
                    className={styles.selectSm}
                    value={fixedMode}
                    onChange={(e) => patch({ fixedMode: e.target.value as FixedMode })}
                    aria-label="Locked major or minor"
                  >
                    <option value="major">Major</option>
                    <option value="minor">Minor</option>
                  </select>
                )}
                <p className={styles.configHint}>
                  {modeControl === "tilt"
                    ? "Fingers pick the scale degree; wrist tilt flips major ↔ minor."
                    : "Fingers pick the scale degree only. Major/minor is set above."}
                </p>
              </div>

              <div className={styles.configRow}>
                <span className={styles.configLabel}>Right hand</span>
                <select
                  className={styles.selectSm}
                  value={qualityControl}
                  onChange={(e) => patch({ qualityControl: e.target.value as QualityControl })}
                  aria-label="Right hand quality control"
                >
                  <option value="fingers">Finger layout = chord style</option>
                  <option value="fixed">Fixed chord style</option>
                </select>
                {qualityControl === "fixed" && (
                  <select
                    className={styles.selectSm}
                    value={fixedQuality}
                    onChange={(e) =>
                      patch({ fixedQuality: Number(e.target.value) as FixedQuality })
                    }
                    aria-label="Fixed chord style"
                  >
                    {FIXED_QUALITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {qualityOptionLabel(o.value)}
                      </option>
                    ))}
                  </select>
                )}
                <p className={styles.configHint}>
                  {qualityControl === "fingers"
                    ? "1–4 fingers set triad / inversion / 7ths. Height = volume, tilt = tone."
                    : "Chord style is locked. Right hand still controls volume, tone, and octave."}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={styles.topRight}>
        <div className={styles.meter} aria-label="Volume meter">
          {Array.from({ length: BARS }, (_, i) => (
            <div key={i} className={styles.bar} data-lit={i >= BARS - litCount} />
          ))}
        </div>
        {mode === "gesture" && (
          <div className={styles.tone}>
            Tone: {tonePct > 0 ? "+" : ""}
            {tonePct}%
          </div>
        )}
      </div>

      {mode === "gesture" ? (
        <div className={styles.chordBlock}>
          <p className={styles.chord}>{chord ?? "--"}</p>
          <p className={styles.quality}>{quality}</p>
          {octaveDown && (
            <span className={styles.octaveBadge}>-8ve</span>
          )}
        </div>
      ) : (
        <div className={styles.thereminReadout}>
          <p className={styles.hz}>{audioOn && pitchHz > 0 ? `${Math.round(pitchHz)} Hz` : "--"}</p>
          <p className={styles.volLabel}>Vol {Math.round(volume * 100)}%</p>
        </div>
      )}

      <div className={styles.status}>{statusText}</div>

      <div className={styles.cornerLinks}>
        <a
          className={styles.github}
          href="https://github.com/Ekmand/music-synth"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg
            className={styles.githubIcon}
            viewBox="0 0 16 16"
            width="14"
            height="14"
            aria-hidden
          >
            <path
              fill="currentColor"
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"
            />
          </svg>
          GitHub
        </a>
        <div className={styles.credit}>
          Developed by{' '}
          <a href="https://thegreatest.dev" target="_blank" rel="noopener noreferrer">
            Ethan
          </a>{' '}
          and{' '}
          <a
            href="https://www.instagram.com/indecisive.eric"
            target="_blank"
            rel="noopener noreferrer"
          >
            Eric
          </a>
        </div>
      </div>
    </div>
  )
}
