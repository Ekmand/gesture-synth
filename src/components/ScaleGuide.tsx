import { useEffect, useMemo, useRef } from "react"
import { publishHold } from "../recording/holdSync"
import { activeRoman, scaleGuideForKey } from "../music/scale"
import styles from "./ScaleGuide.module.css"

type Props = {
  keyHz: number
  chord: string | null
  visible: boolean
  scaleOnly?: boolean
}

export function ScaleGuide({ keyHz, chord, visible, scaleOnly = false }: Props) {
  const degrees = useMemo(() => scaleGuideForKey(keyHz), [keyHz])
  const active = activeRoman(chord)
  const rowRef = useRef<HTMLDivElement>(null)
  const holdRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (!visible) return
    const row = rowRef.current
    const label = holdRef.current
    if (!row || !label) return
    const pads = () => row.querySelectorAll<HTMLElement>("[data-pad]")
    const clear = () => {
      pads().forEach((pad) => {
        pad.style.setProperty("--hold", "0")
        delete pad.dataset.held
      })
    }
    if (!chord) {
      label.hidden = true
      publishHold({ chord: null, progress: 0, seconds: 0 })
      clear()
      return
    }

    label.hidden = false
    label.textContent = "HOLDING 0.0s"
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const seconds = (now - start) / 1000
      const progress = reduced ? 1 : Math.min(seconds / 2, 1)
      pads().forEach((pad) => {
        const on = pad.dataset.active === "true"
        pad.style.setProperty("--hold", on ? String(progress) : "0")
        if (on && progress >= 1) pad.dataset.held = "full"
        else delete pad.dataset.held
      })
      label.textContent = `HOLDING ${seconds.toFixed(1)}s`
      publishHold({ chord, progress, seconds })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      publishHold({ chord: null, progress: 0, seconds: 0 })
      clear()
    }
  }, [chord, visible])

  if (!visible) return null

  const keyLabel =
    degrees[0]?.note != null ? `${degrees[0].note} major` : "Scale"

  return (
    <div className={styles.guide} aria-label={`${keyLabel} scale guide`}>
      <div className={styles.header}>
        <p className={styles.caption}>
          Left hand · {keyLabel}
          {scaleOnly
            ? " — fingers choose the note (mode locked in settings)"
            : " — fingers choose the note; tilt for major/minor"}
        </p>
        <p ref={holdRef} className={styles.holding} hidden>
          HOLDING 0.0s
        </p>
      </div>
      <div className={styles.row} ref={rowRef}>
        {degrees.map((d, i) => {
          const isActive = !d.isOctave && active === d.roman
          return (
            <div
              key={`${d.roman}-${d.note}-${i}`}
              className={styles.pad}
              data-pad=""
              data-active={isActive}
              data-octave={d.isOctave || undefined}
            >
              <span className={styles.note}>{d.note}</span>
              <span className={styles.roman}>{d.isOctave ? "I′" : d.roman}</span>
              <span className={styles.hint}>{d.gesture}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
