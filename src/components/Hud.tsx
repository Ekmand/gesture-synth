import { useEffect, useState } from "react"
import { KEY_OPTIONS } from "../music/chords"
import { ARP_PATTERNS, ARP_RATES, type ArpPattern, type ArpRate } from "../audio/arp"
import { CHORD_PALETTES, paletteById, type PaletteId } from "../music/chords"
import {
  fixedQualityOptions,
  type FixedMode,
  type FixedQuality,
  type GestureSettings,
  type ModeControl,
  type QualityControl,
} from "../music/gestureSettings"
import {
  COMMUNITY_HOME,
  ETHAN,
  ERIC,
  GITHUB_CONTRIBUTORS,
  GITHUB_REPO,
  activeSocialLinks,
} from "../lib/siteLinks"
import styles from "./Hud.module.css"

export type InstrumentMode = "gesture" | "theremin"

type Props = {
  mode: InstrumentMode
  onModeChange: (mode: InstrumentMode) => void
  keyHz: number
  onKeyChange: (hz: number) => void
  gestureSettings: GestureSettings
  onGestureSettingsChange: (next: GestureSettings) => void
  sequencerVisible: boolean
  onSequencerVisibleChange: (visible: boolean) => void
  volume: number
  tonePct: number
  chord: string | null
  quality: string
  pitchHz: number
  octaveDown: boolean
  palmSide: "palm" | "back" | null
  onHelp: () => void
  onLearnSong: () => void
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
  sequencerVisible,
  onSequencerVisibleChange,
  volume,
  tonePct,
  chord,
  quality,
  pitchHz,
  octaveDown,
  palmSide,
  onHelp,
  onLearnSong,
  statusText,
  audioOn,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const litCount = Math.round(volume * BARS)
  const { modeControl, fixedMode, qualityControl, fixedQuality, invertPalmMode } =
    gestureSettings
  const palette = paletteById(gestureSettings.chordPalette)
  const arp = gestureSettings.arp
  const qualityOptions = fixedQualityOptions(gestureSettings.chordPalette)
  const socials = activeSocialLinks()

  const patch = (partial: Partial<GestureSettings>) => {
    onGestureSettingsChange({ ...gestureSettings, ...partial })
  }

  const qualityOptionLabel = (value: FixedQuality) => {
    const opt = qualityOptions.find((o) => o.value === value)!
    if (modeControl === "fixed") {
      return fixedMode === "major" ? opt.major : opt.minor
    }
    return `${opt.major} / ${opt.minor}`
  }

  useEffect(() => {
    if (!settingsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [settingsOpen])

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
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setSettingsOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
          >
            Settings
          </button>
          <button type="button" className={styles.iconBtn} onClick={onLearnSong}>
            Learn a song
          </button>
          <a
            className={styles.iconBtn}
            href={COMMUNITY_HOME}
            target="_blank"
            rel="noreferrer"
          >
            Community
          </a>
        </div>
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
          {modeControl === "palm" && palmSide && (
            <span className={styles.palmBadge}>
              {palmSide === "palm" ? "palm · major" : "back · minor"}
            </span>
          )}
          {mode === "gesture" && arp.enabled && (
            <span className={styles.palmBadge}>arp · {arp.rate}</span>
          )}
          {octaveDown && <span className={styles.octaveBadge}>-8ve</span>}
        </div>
      ) : (
        <div className={styles.thereminReadout}>
          <p className={styles.hz}>
            {audioOn && pitchHz > 0 ? `${Math.round(pitchHz)} Hz` : "--"}
          </p>
          <p className={styles.volLabel}>Vol {Math.round(volume * 100)}%</p>
        </div>
      )}

      <div className={styles.bottomLeft}>
        {socials.length > 0 && (
          <div className={styles.socialRow} aria-label="Follow Gesture Synth">
            {socials.map((link) => (
              <a
                key={link.label}
                className={styles.socialLink}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
        <div className={styles.status}>{statusText}</div>
      </div>

      <div className={styles.cornerLinks}>
        <a
          className={styles.github}
          href={GITHUB_REPO}
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
          Developed by{" "}
          <a href={ETHAN.href} target="_blank" rel="noopener noreferrer">
            {ETHAN.name}
          </a>
        </div>
      </div>

      {settingsOpen && (
        <>
          <button
            type="button"
            className={styles.settingsBackdrop}
            aria-label="Close settings"
            onClick={() => setSettingsOpen(false)}
          />
          <div className={styles.settingsSheet} role="dialog" aria-label="Settings">
            <div className={styles.settingsHeader}>
              <span className={styles.settingsTitle}>Settings</span>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setSettingsOpen(false)}
              >
                Done
              </button>
            </div>

            <div className={styles.configRow}>
              <span className={styles.configLabel}>Key</span>
              <select
                className={styles.selectSm}
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
            </div>

            {mode === "gesture" && (
              <>
                <div className={styles.configRow}>
                  <span className={styles.configLabel}>Left hand</span>
                  <select
                    className={styles.selectSm}
                    value={modeControl}
                    onChange={(e) => patch({ modeControl: e.target.value as ModeControl })}
                    aria-label="Left hand mode control"
                  >
                    <option value="palm">Scale notes + palm/back major-minor</option>
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
                    {modeControl === "palm"
                      ? "Fingers pick the scale degree. Show the camera your palm for major, the back of your hand for minor."
                      : "Fingers pick the scale degree only. Major/minor is set above."}
                  </p>
                  {modeControl === "palm" && (
                    <label className={styles.toggleRow}>
                      <input
                        type="checkbox"
                        checked={invertPalmMode}
                        onChange={(e) => patch({ invertPalmMode: e.target.checked })}
                      />
                      <span>Swap: back of hand = major</span>
                    </label>
                  )}
                </div>

                <div className={styles.configRow}>
                  <span className={styles.configLabel}>Right hand</span>
                  <select
                    className={styles.selectSm}
                    value={qualityControl}
                    onChange={(e) =>
                      patch({ qualityControl: e.target.value as QualityControl })
                    }
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
                      {qualityOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {qualityOptionLabel(o.value)}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className={styles.configHint}>
                    {qualityControl === "fingers"
                      ? "1–4 fingers set the chord style from the palette below. Height = volume, wrist tilt = tone."
                      : "Chord style is locked. Right hand still controls volume, tone, and octave."}
                  </p>
                </div>

                <div className={styles.configRow}>
                  <span className={styles.configLabel}>Chord palette</span>
                  <select
                    className={styles.selectSm}
                    value={palette.id}
                    onChange={(e) => patch({ chordPalette: e.target.value as PaletteId })}
                    aria-label="Chord palette"
                  >
                    {CHORD_PALETTES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <p className={styles.configHint}>
                    {palette.hint}{" "}
                    {palette.slots
                      .map((q, i) => `${i + 1}: ${fixedMode === "minor" && modeControl === "fixed" ? q.minor : q.major}`)
                      .join(" · ")}
                  </p>
                </div>

                <div className={styles.configRow}>
                  <span className={styles.configLabel}>Arpeggiator</span>
                  <label className={styles.toggleRow}>
                    <input
                      type="checkbox"
                      checked={arp.enabled}
                      onChange={(e) => patch({ arp: { ...arp, enabled: e.target.checked } })}
                    />
                    <span>Break chords into notes</span>
                  </label>
                  {arp.enabled && (
                    <>
                      <select
                        className={styles.selectSm}
                        value={arp.pattern}
                        onChange={(e) =>
                          patch({ arp: { ...arp, pattern: e.target.value as ArpPattern } })
                        }
                        aria-label="Arpeggiator pattern"
                      >
                        {ARP_PATTERNS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className={styles.selectSm}
                        value={arp.rate}
                        onChange={(e) =>
                          patch({ arp: { ...arp, rate: e.target.value as ArpRate } })
                        }
                        aria-label="Arpeggiator rate"
                      >
                        {ARP_RATES.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className={styles.selectSm}
                        value={arp.octaves}
                        onChange={(e) =>
                          patch({
                            arp: { ...arp, octaves: Number(e.target.value) as 1 | 2 | 3 },
                          })
                        }
                        aria-label="Arpeggiator octave range"
                      >
                        <option value={1}>1 octave</option>
                        <option value={2}>2 octaves</option>
                        <option value={3}>3 octaves</option>
                      </select>
                    </>
                  )}
                  <p className={styles.configHint}>
                    {arp.enabled
                      ? "Runs at the sequencer BPM, so it stays locked to your loops. Recording captures the arpeggio, not the block chord."
                      : "Off — chords sound as held blocks."}
                  </p>
                </div>
              </>
            )}

            <div className={styles.configRow}>
              <span className={styles.configLabel}>Sequencer</span>
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={sequencerVisible}
                  onChange={(e) => onSequencerVisibleChange(e.target.checked)}
                />
                <span>Show loop sequencer</span>
              </label>
              <p className={styles.configHint}>
                Beat grid and loop transport stay hidden until you turn this on.
              </p>
            </div>

            <div className={styles.about}>
              <span className={styles.configLabel}>About</span>
              <p className={styles.aboutLine}>
                Built by{" "}
                <a href={ETHAN.href} target="_blank" rel="noopener noreferrer">
                  {ETHAN.name}
                </a>
              </p>
              <p className={styles.aboutLine}>
                Inspired by{" "}
                <a href={ERIC.href} target="_blank" rel="noopener noreferrer">
                  {ERIC.name}
                </a>
              </p>
              <p className={styles.aboutLine}>
                <a href={GITHUB_CONTRIBUTORS} target="_blank" rel="noopener noreferrer">
                  GitHub contributors
                </a>
              </p>

              {socials.length > 0 && (
                <div className={styles.socialBlock}>
                  <span className={styles.configLabel}>Follow Gesture Synth</span>
                  <div className={styles.socialRow}>
                    {socials.map((link) => (
                      <a
                        key={link.label}
                        className={styles.socialLink}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
