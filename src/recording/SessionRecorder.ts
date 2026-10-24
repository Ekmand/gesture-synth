import { paintScene, type WaveParams } from "../components/HandCanvas"
import { chordColorVar } from "../music/chords"
import { noteNameForHz } from "../lib/noteNames"
import type { HandLandmarkerResult } from "@mediapipe/tasks-vision"

export type OverlayState = {
  mode: "gesture" | "theremin"
  chord: string | null
  quality: string
  octaveDown: boolean
  /** Frequencies currently sounding. */
  freqs: number[]
}

export type RecorderSources = {
  video: HTMLVideoElement
  audioCtx: AudioContext
  /** Final mix (synth + loops + mic). */
  bus: AudioNode
  /** Synth + loops only (before the mic joins). */
  synthBus: AudioNode
  /** Processed mic signal, or null when no mic is active. */
  micOutput: AudioNode | null
  getResult: () => HandLandmarkerResult | null
  getWave: () => WaveParams
  getOverlay: () => OverlayState
}

const WIDTH = 1920
const HEIGHT = 1080
const FPS = 30

function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ]
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? ""
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Bottom-center card: chord / quality on the left, note pills on the right. */
function drawNotesOverlay(ctx: CanvasRenderingContext2D, o: OverlayState) {
  const notes = [...new Set(o.freqs.map(noteNameForHz))]
  const sounding = notes.length > 0
  const title = o.mode === "gesture" ? (o.chord ?? "--") : (notes[0] ?? "--")
  const sub = o.mode === "gesture" ? o.quality : sounding ? `${Math.round(o.freqs[0])} Hz` : "Theremin"
  const rgb = chordColorVar(o.mode === "gesture" ? o.chord : null)
  const font = "system-ui, -apple-system, 'Segoe UI', sans-serif"

  const pillFont = `600 44px ${font}`
  ctx.font = pillFont
  const pills = o.mode === "gesture" ? notes : []
  const pillW = pills.map((n) => ctx.measureText(n).width + 44)
  const pillsTotal = pillW.reduce((a, b) => a + b, 0) + Math.max(0, pills.length - 1) * 14

  ctx.font = `700 96px ${font}`
  const titleW = ctx.measureText(title).width
  const gap = pills.length ? 48 : 0
  const w = Math.max(360, 56 + Math.max(titleW, 200) + gap + pillsTotal + 56)
  const h = 190
  const x = (WIDTH - w) / 2
  const y = HEIGHT - h - 56

  ctx.save()
  ctx.fillStyle = "rgba(11, 16, 20, 0.62)"
  roundRect(ctx, x, y, w, h, 36)
  ctx.fill()
  ctx.strokeStyle = `rgba(${rgb}, ${sounding ? 0.9 : 0.25})`
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = sounding ? "#fff" : "rgba(255,255,255,0.5)"
  ctx.font = `700 96px ${font}`
  ctx.fillText(title, x + 56, y + 108)
  ctx.fillStyle = "rgba(255,255,255,0.7)"
  ctx.font = `500 34px ${font}`
  ctx.fillText(o.octaveDown ? `${sub} · -8ve` : sub, x + 56, y + 156)

  let px = x + 56 + Math.max(titleW, 200) + gap
  ctx.font = pillFont
  pills.forEach((n, i) => {
    ctx.fillStyle = `rgba(${rgb}, 0.9)`
    roundRect(ctx, px, y + 62, pillW[i], 66, 33)
    ctx.fill()
    ctx.fillStyle = "#0b1014"
    ctx.textAlign = "center"
    ctx.fillText(n, px + pillW[i] / 2, y + 108)
    ctx.textAlign = "left"
    px += pillW[i] + 14
  })
  ctx.restore()
}

export type RecordedFile = { name: string; blob: Blob }

/** One MediaRecorder + its chunks. */
class Take {
  private recorder: MediaRecorder
  private chunks: { blob: Blob; at: number }[] = []
  readonly mime: string

  constructor(stream: MediaStream, mime: string, opts: MediaRecorderOptions) {
    this.mime = mime
    this.recorder = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), ...opts })
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push({ blob: e.data, at: Date.now() })
    }
    this.recorder.onerror = (e) => console.error("MediaRecorder error", e)
  }

  start() {
    this.recorder.start(100)
  }

  /** `trimMs` drops that much footage from the end (chunks are ~100 ms). */
  stop(trimMs = 0): Promise<Blob> {
    const cutoff = Date.now() - trimMs
    return new Promise((resolve) => {
      const finish = () => {
        const kept = trimMs > 0 ? this.chunks.filter((c) => c.at <= cutoff) : this.chunks
        resolve(new Blob(kept.map((c) => c.blob), { type: this.mime.split(";")[0] || "video/webm" }))
      }
      if (this.recorder.state === "inactive") return finish()
      this.recorder.onstop = finish
      this.recorder.requestData()
      this.recorder.stop()
    })
  }
}

const extFor = (mime: string) => (mime.includes("mp4") ? "mp4" : "webm")

export class SessionRecorder {
  private canvas = document.createElement("canvas")
  private ctx2d = this.canvas.getContext("2d")!
  private takes: { label: string; take: Take }[] = []
  private timer = 0
  private taps: { from: AudioNode; dest: MediaStreamAudioDestinationNode }[] = []
  private started = false

  constructor() {
    this.canvas.width = WIDTH
    this.canvas.height = HEIGHT
  }

  get recording() {
    return this.started
  }

  private tap(ctx: AudioContext, from: AudioNode) {
    const dest = ctx.createMediaStreamDestination()
    from.connect(dest)
    this.taps.push({ from, dest })
    return dest.stream
  }

  async start(src: RecorderSources) {
    const { audioCtx, bus } = src // synthBus / micOutput are used by the disabled stems below
    // A suspended context emits no audio samples, which can leave the file empty.
    if (audioCtx.state !== "running") await audioCtx.resume()

    const draw = () => {
      const { video, getResult, getWave, getOverlay } = src
      if (!video.videoWidth) return
      paintScene(this.ctx2d, video, getResult(), getWave())
      drawNotesOverlay(this.ctx2d, getOverlay())
    }
    draw()
    this.timer = window.setInterval(draw, 1000 / FPS)

    const videoTracks = () => this.canvas.captureStream(FPS).getVideoTracks()
    const videoMime = pickMimeType()
    // const audioMime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) =>
    //   MediaRecorder.isTypeSupported(t),
    // ) ?? ""
    const videoOpts = { videoBitsPerSecond: 12_000_000, audioBitsPerSecond: 192_000 }

    // Full video with the mixed audio (synth + voice).
    this.takes.push({
      label: "full",
      take: new Take(new MediaStream([...videoTracks(), ...this.tap(audioCtx, bus).getAudioTracks()]), videoMime, videoOpts),
    })
    // Separate stems are disabled for now while levels are tuned (re-enable together with the zip in GlobalRecorder):
    // // Picture only.
    // this.takes.push({
    //   label: "video-only",
    //   take: new Take(new MediaStream(videoTracks()), videoMime, videoOpts),
    // })
    // // Stems.
    // this.takes.push({
    //   label: "synth",
    //   take: new Take(this.tap(audioCtx, synthBus), audioMime, { audioBitsPerSecond: 192_000 }),
    // })
    // if (micOutput) {
    //   this.takes.push({
    //     label: "voice",
    //     take: new Take(this.tap(audioCtx, micOutput), audioMime, { audioBitsPerSecond: 192_000 }),
    //   })
    // }

    this.takes.forEach((t) => t.take.start())
    this.started = true
  }

  /** Stops every take and resolves with the finished files. */
  async stop(trimMs = 0): Promise<RecordedFile[]> {
    const done = await Promise.all(
      this.takes.map(async ({ label, take }) => ({
        label,
        mime: take.mime,
        blob: await take.stop(trimMs),
      })),
    )
    window.clearInterval(this.timer)
    this.taps.forEach(({ from, dest }) => {
      try { from.disconnect(dest) } catch { /* already disconnected */ }
    })
    this.taps = []
    this.takes = []
    this.started = false
    console.info("Recording finished:", done.map((d) => `${d.label} ${d.blob.size}B`).join(", "))
    return done
      .filter((d) => d.blob.size > 0)
      .map((d) => ({ name: `${d.label}.${extFor(d.mime)}`, blob: d.blob }))
  }
}
