import { useState } from "react"
import styles from "./Tutorial.module.css"

export const TUTORIAL_KEY = "music-synth-tutorial-done"

const STEPS = [
  {
    kicker: "Step 1 of 7",
    title: "Camera & sound",
    body: "Allow webcam access, then click the play control to unlock audio. Stand an arm’s length from the camera with good lighting.",
    diagram: null as null | "hands" | "mode" | "loop" | "keys",
  },
  {
    kicker: "Step 2 of 7",
    title: "Left hand = scale notes",
    body: "Raise fingers to pick a scale degree (I\u2013V). Index + pinky makes VI; add the thumb for VII. By default, tilt flips major \u2194 minor \u2014 or lock major/minor in the left-hand settings.",
    diagram: "hands" as const,
  },
  {
    kicker: "Step 3 of 7",
    title: "Right hand = expression",
    body: "Move up/down for volume. By default, 1\u20134 fingers pick triad / inversion / 7ths, and the thumb drops one octave. Wrist tilt sweeps the tone filter \u2014 try a slow tilt for crescendo effects.",
    diagram: "hands" as const,
  },
  {
    kicker: "Step 4 of 7",
    title: "Customize the controls",
    body: "Use the Left hand, Right hand, and Octave menus under the key selector to simplify gestures \u2014 scale-only left hand, a fixed chord style, or a locked octave instead of the thumb.",
    diagram: "mode" as const,
  },
  {
    kicker: "Step 5 of 7",
    title: "Loop Pedal \u2014 Record & layer",
    body: "Set BPM, time signature, and bar count in the bottom-right controls. Hit the red record button \u2014 a metronome count-in plays, then your gestures are captured. The loop auto-plays when recording ends. Stack up to 4 loop tracks!",
    diagram: "loop" as const,
  },
  {
    kicker: "Step 6 of 7",
    title: "Edit & mix your loops",
    body: "The beat grid shows your recorded loops as 16th-note cells. Click any cell to mute/unmute a beat. Use M (mute) and S (solo) per track, plus the volume slider to mix. Smooth filter sweeps and crescendos are preserved in the loop.",
    diagram: "loop" as const,
  },
  {
    kicker: "Step 7 of 7",
    title: "Keyboard shortcuts",
    body: "Space = stop all / play-pause, 1\u20134 = select track, M = mute track, S = solo track, Delete = clear track, Shift+Delete = clear all. Try Theremin mode for melodic solos over your chord loops!",
    diagram: "keys" as const,
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

        {current.diagram === "loop" && (
          <div className={styles.diagram}>
            <div className={styles.hand}>
              <h4>Record</h4>
              <p>Set BPM + bars, hit record. Count-in plays, then perform your part.</p>
            </div>
            <div className={styles.hand}>
              <h4>Layer</h4>
              <p>Select tracks 1–4 and record again. All tracks play together.</p>
            </div>
          </div>
        )}

        {current.diagram === "keys" && (
          <div className={styles.diagram}>
            <div className={styles.hand}>
              <h4>Performance</h4>
              <p>Space = stop / play, 1–4 = tracks</p>
            </div>
            <div className={styles.hand}>
              <h4>Mixing</h4>
              <p>M = mute, S = solo, Del = clear track</p>
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
