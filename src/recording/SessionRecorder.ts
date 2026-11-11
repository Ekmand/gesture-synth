import { drawPerformance, type PerformanceFrame } from "./drawPerformance"

const MAX_LONG = 1920
const MAX_SHORT = 1080
const FPS = 30

function pickMimeType(): string {
  const candidates = [
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ]
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
}

export class SessionRecorder {
  private canvas = document.createElement("canvas")
  private ctx2d = this.canvas.getContext("2d")
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private timer = 0
  private mime = ""
  private mic: MediaStream | null = null
  private taps: { from: AudioNode; dest: AudioNode }[] = []

  async start(opts: {
    audioCtx: AudioContext
    bus: AudioNode
    micId: string
    monitor: boolean
    getFrame: () => PerformanceFrame
  }) {
    const live = document.querySelector("canvas.hand-canvas") as HTMLCanvasElement | null
    if (!live || !this.ctx2d) throw new Error("Camera canvas is not ready")

    const winW = Math.max(1, window.innerWidth)
    const winH = Math.max(1, window.innerHeight)
    const landscape = winW >= winH
    const scale = Math.min(
      (landscape ? MAX_LONG : MAX_SHORT) / winW,
      (landscape ? MAX_SHORT : MAX_LONG) / winH,
    )
    this.canvas.width = Math.max(2, Math.round((winW * scale) / 2) * 2)
    this.canvas.height = Math.max(2, Math.round((winH * scale) / 2) * 2)

    if (opts.audioCtx.state !== "running") await opts.audioCtx.resume()

    const recordMix = opts.audioCtx.createGain()
    opts.bus.connect(recordMix)
    this.taps.push({ from: opts.bus, dest: recordMix })

    if (opts.micId !== "none") {
      const audio: MediaTrackConstraints = {
        echoCancellation: !opts.monitor,
        noiseSuppression: !opts.monitor,
        autoGainControl: !opts.monitor,
      }
      if (opts.micId !== "default") audio.deviceId = { exact: opts.micId }
      try {
        this.mic = await navigator.mediaDevices.getUserMedia({ audio })
        const source = opts.audioCtx.createMediaStreamSource(this.mic)
        const micGain = opts.audioCtx.createGain()
        micGain.gain.value = 1.4
        source.connect(micGain)
        micGain.connect(recordMix)
        this.taps.push({ from: source, dest: micGain }, { from: micGain, dest: recordMix })
        if (opts.monitor) {
          micGain.connect(opts.audioCtx.destination)
          this.taps.push({ from: micGain, dest: opts.audioCtx.destination })
        }
      } catch {
        this.mic = null
      }
    }

    const draw = () => {
      if (!this.ctx2d) return
      this.ctx2d.drawImage(live, 0, 0, this.canvas.width, this.canvas.height)
      drawPerformance(this.ctx2d, opts.getFrame())
    }
    draw()
    this.timer = window.setInterval(draw, 1000 / FPS)

    const dest = opts.audioCtx.createMediaStreamDestination()
    recordMix.connect(dest)
    this.taps.push({ from: recordMix, dest })

    const mime = pickMimeType()
    this.mime = mime
    const stream = new MediaStream([
      ...this.canvas.captureStream(FPS).getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ])
    this.chunks = []
    try {
      this.recorder = new MediaRecorder(stream, {
        ...(mime ? { mimeType: mime } : {}),
        videoBitsPerSecond: 8_000_000,
        audioBitsPerSecond: 192_000,
      })
    } catch (error) {
      this.cleanup()
      throw error
    }
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data)
    }
    this.recorder.start(200)
  }

  stop(): Promise<Blob> {
    const mime = this.mime.includes("mp4") ? "video/mp4" : "video/webm"
    const recorder = this.recorder
    return new Promise((resolve) => {
      const finish = () => {
        this.cleanup()
        resolve(new Blob(this.chunks, { type: mime }))
      }
      if (!recorder || recorder.state === "inactive") {
        finish()
        return
      }
      recorder.onstop = finish
      recorder.requestData()
      recorder.stop()
    })
  }

  private cleanup() {
    window.clearInterval(this.timer)
    this.timer = 0
    this.taps.forEach(({ from, dest }) => {
      try { from.disconnect(dest) } catch { /* already disconnected */ }
    })
    this.taps = []
    this.mic?.getTracks().forEach((track) => track.stop())
    this.mic = null
    this.recorder = null
  }

  extension() {
    return this.mime.includes("mp4") ? "mp4" : "webm"
  }
}
