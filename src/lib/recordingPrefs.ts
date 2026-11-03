const KEY = "music-synth-mic-device"

/** "default" = system default input, "none" = no microphone, otherwise a deviceId. */
export const MIC_DEFAULT = "default"
export const MIC_NONE = "none"

export function loadMicDeviceId(): string {
  try {
    return localStorage.getItem(KEY) || MIC_DEFAULT
  } catch {
    return MIC_DEFAULT
  }
}

export function saveMicDeviceId(id: string) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* ignore */
  }
}

const CAM_KEY = "music-synth-camera-device"

/** "default" = browser default camera, otherwise a deviceId. */
export function loadCameraDeviceId(): string {
  try {
    return localStorage.getItem(CAM_KEY) || MIC_DEFAULT
  } catch {
    return MIC_DEFAULT
  }
}

export function saveCameraDeviceId(id: string) {
  try {
    localStorage.setItem(CAM_KEY, id)
  } catch {
    /* ignore */
  }
}

const MONITOR_KEY = "music-synth-mic-monitor"

/** Whether the mic is heard on the output. Defaults to off. */
export function loadMicMonitor(): boolean {
  try {
    return localStorage.getItem(MONITOR_KEY) === "1"
  } catch {
    return false
  }
}

export function saveMicMonitor(on: boolean) {
  try {
    localStorage.setItem(MONITOR_KEY, on ? "1" : "0")
  } catch {
    /* ignore */
  }
}

const CLEAN_KEY = "music-synth-clean-recording"

/** Record just the webcam picture, with no overlays. Defaults to off. */
export function loadCleanRecording(): boolean {
  try {
    return localStorage.getItem(CLEAN_KEY) === "1"
  } catch {
    return false
  }
}

export function saveCleanRecording(on: boolean) {
  try {
    localStorage.setItem(CLEAN_KEY, on ? "1" : "0")
  } catch {
    /* ignore */
  }
}
