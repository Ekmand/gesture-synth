import styles from "./StartGate.module.css"

type Props = {
  onStart: () => void
  cameraReady: boolean
  cameraError: string | null
}

export function StartGate({ onStart, cameraReady, cameraError }: Props) {
  return (
    <button
      type="button"
      className={styles.gate}
      onClick={onStart}
      disabled={!!cameraError}
      aria-label="Enable audio and start"
    >
      <h1 className={styles.brand}>Gesture Synth</h1>
      <p className={styles.tag}>
        Play chords with your hands. Webcam in, speakers on — no hardware required.
      </p>
      {cameraError ? (
        <p className={styles.cta} style={{ color: "var(--coral)" }}>
          {cameraError}
        </p>
      ) : (
        <>
          <div className={styles.play} aria-hidden>
            ▶
          </div>
          <span className={styles.cta}>
            {cameraReady ? "Click to enable audio" : "Starting camera…"}
          </span>
        </>
      )}
    </button>
  )
}
