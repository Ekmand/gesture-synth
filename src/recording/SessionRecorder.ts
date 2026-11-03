import { paintScene, type WaveParams } from "../components/HandCanvas"
import { noteNameForHz } from "../lib/noteNames"
import { activeRoman, scaleGuideForKey } from "../music/scale"
import type { HandLandmarkerResult } from "@mediapipe/tasks-vision"

export type OverlayState = {
  mode: "gesture" | "theremin"
  chord: string | null
  /** Tonic of the selected key, to lay out the scale pads. */
  keyHz: number
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
  /** Webcam picture only: no hand dots, waves or notes overlay. */
  clean: boolean
  getResult: () => HandLandmarkerResult | null
  getWave: () => WaveParams
  getOverlay: () => OverlayState
}

/** Output fits inside 1920×1080 (or its portrait equivalent), keeping the window's aspect ratio. */
const MAX_LONG = 1920
const MAX_SHORT = 1080
const FPS = 30

function pickMimeType(): string {
  // MP4 first: it plays natively everywhere (notably iOS, which can't play WebM). WebM is the fallback.
  const candidates = [
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
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

// Colours and type mirror the web app's tokens.css / Hud / ScaleGuide styles.
const MINT = "61, 255, 224"
const CORAL = "255, 107, 90"
const TEXT = "232, 244, 248"
const DISPLAY = `"Syne", system-ui, sans-serif`
const BODY = `"Outfit", system-ui, sans-serif`

const scratch = document.createElement("canvas")

type LetterSpacingCtx = CanvasRenderingContext2D & { letterSpacing: string }

function text(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  font: string,
  fill: string,
  spacingEm = 0,
) {
  ctx.font = font
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? "16")
  ;(ctx as LetterSpacingCtx).letterSpacing = `${spacingEm * size}px`
  ctx.fillStyle = fill
  ctx.fillText(str, x, y)
  ;(ctx as LetterSpacingCtx).letterSpacing = "0px"
}

/** The HUD's chord readout (centre of frame) plus the ScaleGuide row of scale pads along the bottom. */
function drawNotesOverlay(ctx: CanvasRenderingContext2D, o: OverlayState) {
  // Lay out in a 1080-high design space, then scale to the actual canvas.
  const k = ctx.canvas.height / 1080
  const W = ctx.canvas.width / k
  const H = 1080
  const notes = [...new Set(o.freqs.map(noteNameForHz))]

  ctx.save()
  ctx.scale(k, k)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  if (o.mode === "gesture") {
    // Chord block: .chord / .quality / .octaveBadge, centred at 42% height like the app.
    const chordSize = 96
    const blockH = chordSize + 10 + 22 + (o.octaveDown ? 12 + 32 : 0)
    let y = H * 0.42 - blockH / 2
    ctx.save()
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)"
    ctx.shadowBlur = 30
    ctx.shadowOffsetY = 4
    text(ctx, o.chord ?? "--", W / 2, y + chordSize / 2, `800 ${chordSize}px ${DISPLAY}`, `rgb(${MINT})`, -0.04)
    ctx.restore()
    y += chordSize + 10
    text(ctx, o.quality, W / 2, y + 11, `400 19px ${BODY}`, `rgba(${TEXT}, 0.62)`)
    if (o.octaveDown) {
      y += 22 + 12
      const label = "-8ve"
      ctx.font = `700 15px ${BODY}`
      const bw = ctx.measureText(label).width + 28
      ctx.save()
      ctx.shadowColor = `rgba(${CORAL}, 0.5)`
      ctx.shadowBlur = 18
      ctx.fillStyle = `rgba(${CORAL}, 0.2)`
      roundRect(ctx, W / 2 - bw / 2, y, bw, 32, 16)
      ctx.fill()
      ctx.restore()
      ctx.strokeStyle = `rgb(${CORAL})`
      ctx.lineWidth = 1.5
      roundRect(ctx, W / 2 - bw / 2, y, bw, 32, 16)
      ctx.stroke()
      text(ctx, label, W / 2, y + 17, `700 15px ${BODY}`, `rgb(${CORAL})`, 0.04)
    }

    // Scale pads (ScaleGuide): every degree of the key on frosted dark cards; only the current chord is teal.
    const degrees = scaleGuideForKey(o.keyHz)
    const active = activeRoman(o.chord)
    const gap = 10
    const rowW = Math.min(W - 40, 1100)
    const padW = (rowW - gap * (degrees.length - 1)) / degrees.length
    const padH = 96
    const x0 = (W - rowW) / 2
    const yBase = H - 56 - padH

    // Snapshot of the frame so each card can show a blurred copy of what is behind it (backdrop-filter).
    scratch.width = ctx.canvas.width
    scratch.height = ctx.canvas.height
    scratch.getContext("2d")!.drawImage(ctx.canvas, 0, 0)

    degrees.forEach((d, i) => {
      const isActive = !d.isOctave && active === d.roman
      const x = x0 + i * (padW + gap)
      const y = yBase - (isActive ? 3 : 0)

      ctx.save()
      roundRect(ctx, x, y, padW, padH, 14)
      ctx.clip()
      ctx.filter = `blur(${10 * k}px)`
      ctx.drawImage(scratch, 0, 0, W, H)
      ctx.filter = "none"
      ctx.fillStyle = isActive ? `rgba(${MINT}, 0.18)` : "rgba(12, 18, 24, 0.62)"
      ctx.fillRect(x, y, padW, padH)
      ctx.restore()

      if (isActive) {
        ctx.save()
        ctx.shadowColor = `rgba(${MINT}, 0.3)`
        ctx.shadowBlur = 24
        ctx.strokeStyle = `rgba(${MINT}, 0.55)`
        ctx.lineWidth = 1.5
        roundRect(ctx, x, y, padW, padH, 14)
        ctx.stroke()
        ctx.restore()
      } else {
        ctx.strokeStyle = `rgba(${TEXT}, 0.12)`
        ctx.lineWidth = 1.5
        roundRect(ctx, x, y, padW, padH, 14)
        ctx.stroke()
      }

      const cx = x + padW / 2
      ctx.globalAlpha = d.isOctave ? 0.72 : 1
      text(ctx, d.note, cx, y + 34, `800 32px ${DISPLAY}`, isActive ? `rgb(${MINT})` : `rgb(${TEXT})`, -0.03)
      text(ctx, d.isOctave ? "I′" : d.roman, cx, y + 60, `600 15px ${BODY}`, `rgba(${TEXT}, 0.62)`, 0.04)
      if (padW >= 100) text(ctx, d.gesture, cx, y + 80, `400 11px ${BODY}`, `rgba(${TEXT}, 0.62)`)
      ctx.globalAlpha = 1
    })
  } else {
    // Theremin readout: .hz in coral, with the nearest note where the volume label sits in the app.
    const sounding = o.freqs.length > 0
    text(ctx, sounding ? `${Math.round(o.freqs[0])} Hz` : "--", W / 2, H - 170, `700 62px ${DISPLAY}`, `rgb(${CORAL})`)
    if (sounding) text(ctx, notes[0], W / 2, H - 116, `400 22px ${BODY}`, `rgba(${TEXT}, 0.62)`)
  }
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
    // The overlay uses the web app's fonts; make sure they're loaded before the first frame.
    await Promise.all(
      [`800 96px "Syne"`, `700 62px "Syne"`, `400 19px "Outfit"`, `600 15px "Outfit"`, `700 15px "Outfit"`].map((f) =>
        document.fonts.load(f).catch(() => []),
      ),
    )

    // Match the browser window's shape (fixed for the whole take), at up to HD resolution.
    const winW = Math.max(1, window.innerWidth)
    const winH = Math.max(1, window.innerHeight)
    const landscape = winW >= winH
    const scale = Math.min(
      (landscape ? MAX_LONG : MAX_SHORT) / winW,
      (landscape ? MAX_SHORT : MAX_LONG) / winH,
    )
    // Encoders want even dimensions.
    this.canvas.width = Math.max(2, Math.round((winW * scale) / 2) * 2)
    this.canvas.height = Math.max(2, Math.round((winH * scale) / 2) * 2)

    // A suspended context emits no audio samples, which can leave the file empty.
    if (audioCtx.state !== "running") await audioCtx.resume()

    const draw = () => {
      const { video, getResult, getWave, getOverlay } = src
      if (!video.videoWidth) return
      paintScene(this.ctx2d, video, getResult(), getWave(), src.clean)
      if (!src.clean) drawNotesOverlay(this.ctx2d, getOverlay())
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
