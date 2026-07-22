import { KEY_OPTIONS } from "../music/chords"
import styles from "./Hud.module.css"

export type InstrumentMode = "gesture" | "theremin"

type Props = {
  mode: InstrumentMode
  onModeChange: (mode: InstrumentMode) => void
  keyHz: number
  onKeyChange: (hz: number) => void
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
        <>
          <p className={styles.chord}>{chord ?? "--"}</p>
          <p className={styles.quality}>{quality}</p>
        </>
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
