import { useState } from "react"
import styles from "./Tutorial.module.css"

export const TUTORIAL_KEY = "music-synth-tutorial-done"

const STEPS = [
  {
    kicker: "Step 1 of 5",
    title: "Camera & sound",
    body: "Allow webcam access, then click the play control to unlock audio. Stand an arm’s length from the camera with good lighting.",
    diagram: null as null | "hands" | "mode",
  },
  {
    kicker: "Step 2 of 5",
    title: "Left hand = scale notes",
    body: "Raise fingers to pick a scale degree (I–V). Index + pinky makes VI; add the thumb for VII. By default, tilt flips major ↔ minor — or lock major/minor in the left-hand settings.",
    diagram: "hands" as const,
  },
  {
    kicker: "Step 3 of 5",
    title: "Right hand = expression",
    body: "Move up/down for volume. By default, 1–4 fingers pick triad / inversion / 7ths. Or lock a fixed chord style in settings and just use volume, tone, and octave.",
    diagram: "hands" as const,
  },
  {
    kicker: "Step 4 of 5",
    title: "Customize the controls",
    body: "Use the Left hand / Right hand menus under the key selector to simplify gestures — scale-only left hand, or a fixed chord style on the right.",
    diagram: "mode" as const,
  },
  {
    kicker: "Step 5 of 5",
    title: "Try Theremin mode",
    body: "Switch to Theremin in the top bar for a classic feel — right hand height sets pitch, left hand height sets volume.",
    diagram: "mode" as const,
  },
]

type Props = {
  open: boolean
  onClose: () => void
}

export function Tutorial({ open, onClose }: Props) {
  const [step, setStep] = useState(0)
  if (!open) return null

  const current = STEPS[step]
  const last = step === STEPS.length - 1

  const finish = () => {
    localStorage.setItem(TUTORIAL_KEY, "1")
    onClose()
    setStep(0)
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <div className={styles.card}>
        <p className={styles.kicker}>{current.kicker}</p>
        <h2 id="tutorial-title" className={styles.title}>
          {current.title}
        </h2>
        <p className={styles.body}>{current.body}</p>

        {current.diagram === "hands" && (
          <div className={styles.diagram}>
            <div className={`${styles.hand} ${styles["hand--left"]}`}>
              <h4>Left</h4>
              <p>Finger count → chord. Wrist tilt → major / minor.</p>
            </div>
            <div className={`${styles.hand} ${styles["hand--right"]}`}>
              <h4>Right</h4>
              <p>Height → volume. Fingers → quality. Tilt → tone.</p>
            </div>
          </div>
        )}

        {current.diagram === "mode" && (
          <div className={styles.diagram}>
            <div className={styles.hand}>
              <h4>Gesture</h4>
              <p>Default chord instrument — the main Gesture Synth experience.</p>
            </div>
            <div className={styles.hand}>
              <h4>Theremin</h4>
              <p>Continuous pitch & volume from hand height.</p>
            </div>
          </div>
        )}

        <div className={styles.actions}>
          <div className={styles.dots} aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className={styles.dot} data-on={i === step} />
            ))}
          </div>
          <div className={styles.btns}>
            <button type="button" className={styles.ghost} onClick={finish}>
              Skip
            </button>
            {!last ? (
              <button type="button" className={styles.primary} onClick={() => setStep((s) => s + 1)}>
                Next
              </button>
            ) : (
              <button type="button" className={styles.primary} onClick={finish}>
                Got it
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function shouldShowTutorial(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) !== "1"
  } catch {
    return true
  }
}
