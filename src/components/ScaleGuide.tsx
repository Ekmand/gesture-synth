import { useMemo } from "react"
import { activeRoman, scaleGuideForKey } from "../music/scale"
import styles from "./ScaleGuide.module.css"

type Props = {
  keyHz: number
  chord: string | null
  visible: boolean
}

export function ScaleGuide({ keyHz, chord, visible }: Props) {
  const degrees = useMemo(() => scaleGuideForKey(keyHz), [keyHz])
  const active = activeRoman(chord)

  if (!visible) return null

  const keyLabel =
    degrees[0]?.note != null ? `${degrees[0].note} major` : "Scale"

  return (
    <div className={styles.guide} aria-label={`${keyLabel} scale guide`}>
      <p className={styles.caption}>
        Left hand · {keyLabel} — fingers choose the note
      </p>
      <div className={styles.row}>
        {degrees.map((d, i) => {
          const isActive = !d.isOctave && active === d.roman
          return (
            <div
              key={`${d.roman}-${d.note}-${i}`}
              className={styles.pad}
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
