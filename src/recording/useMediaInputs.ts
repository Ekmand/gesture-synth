import { useCallback, useEffect, useState } from "react"

export type MediaInput = { deviceId: string; label: string }

/** Lists microphones or cameras; labels stay blank until permission has been granted once. */
export function useMediaInputs(kind: "audioinput" | "videoinput", active: boolean) {
  const [inputs, setInputs] = useState<MediaInput[]>([])
  const [labelsHidden, setLabelsHidden] = useState(false)

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    const all = await navigator.mediaDevices.enumerateDevices()
    const mics = all.filter(
      (d) => d.kind === kind && d.deviceId !== "default" && d.deviceId !== "communications",
    )
    setLabelsHidden(mics.length > 0 && mics.every((d) => !d.label))
    setInputs(
      mics.map((d, i) => ({ deviceId: d.deviceId, label: d.label || `${kind === "audioinput" ? "Microphone" : "Camera"} ${i + 1}` })),
    )
  }, [kind])

  /** Briefly opens the default device so the browser reveals device names. */
  const requestAccess = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia(kind === "audioinput" ? { audio: true } : { video: true })
      s.getTracks().forEach((t) => t.stop())
    } catch {
      /* denied */
    }
    await refresh()
  }, [kind, refresh])

  useEffect(() => {
    if (!active || !navigator.mediaDevices) return
    void refresh()
    navigator.mediaDevices.addEventListener("devicechange", refresh)
    return () => navigator.mediaDevices.removeEventListener("devicechange", refresh)
  }, [active, refresh])

  return { inputs, labelsHidden, requestAccess }
}
