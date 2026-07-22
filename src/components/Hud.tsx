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
        <h1 className={styles.brand}>Music Synth</h1>
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
        </div>
      ) : (
        <div className={styles.thereminReadout}>
          <p className={styles.hz}>{audioOn && pitchHz > 0 ? `${Math.round(pitchHz)} Hz` : "--"}</p>
          <p className={styles.volLabel}>Vol {Math.round(volume * 100)}%</p>
        </div>
      )}

      <div className={styles.status}>{statusText}</div>
    </div>
  )
}
