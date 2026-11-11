import { octaveShiftLabel } from "../music/gestureSettings"
import { activeRoman, scaleGuideForKey } from "../music/scale"

export type PerformanceFrame = {
  clean: boolean
  showGuide: boolean
  mode: "gesture" | "theremin"
  chord: string | null
  quality: string
  octaveShift: number
  keyHz: number
  pitchHz: number
  holdProgress: number
  holdSeconds: number
}

const MINT = "rgb(61, 255, 224)"
const MINT_DIM = "rgba(61, 255, 224, 0.18)"
const TEXT = "rgb(232, 244, 248)"
const MUTED = "rgba(232, 244, 248, 0.62)"
const CORAL = "rgb(255, 107, 90)"

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawHoldRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  progress: number,
) {
  const inset = 3
  ctx.save()
  ctx.strokeStyle = "rgba(61, 255, 224, 0.28)"
  ctx.lineWidth = 2
  roundRect(ctx, x - inset, y - inset, w + inset * 2, h + inset * 2, 14)
  ctx.stroke()
  if (progress > 0) {
    ctx.beginPath()
    const cx = x + w / 2
    const cy = y + h / 2
    const radius = Math.hypot(w, h) / 2 + 4
    ctx.arc(cx, cy, Math.min(radius, h / 2 + 8), -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2)
    ctx.strokeStyle = MINT
    ctx.lineWidth = 3
    ctx.lineCap = "round"
    ctx.shadowColor = "rgba(61, 255, 224, 0.7)"
    ctx.shadowBlur = progress >= 1 ? 14 : 6
    ctx.stroke()
  }
  ctx.restore()
}

/** Chord, octave, and scale pads. Drawn on top of the camera, not the rest of the page. */
export function drawPerformance(ctx: CanvasRenderingContext2D, frame: PerformanceFrame) {
  if (frame.clean) return
  const { width: w, height: h } = ctx.canvas
  ctx.save()
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  if (frame.mode === "theremin") {
    const label = frame.pitchHz > 0 ? `${Math.round(frame.pitchHz)} Hz` : "--"
    ctx.font = "700 64px Syne, system-ui, sans-serif"
    ctx.fillStyle = CORAL
    ctx.fillText(label, w / 2, h * 0.72)
    ctx.restore()
    return
  }

  if (!frame.showGuide) {
    ctx.restore()
    return
  }

  const chord = frame.chord ?? "--"
  ctx.font = "800 92px Syne, system-ui, sans-serif"
  ctx.fillStyle = MINT
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)"
  ctx.shadowBlur = 24
  ctx.fillText(chord, w / 2, h * 0.4)
  ctx.shadowBlur = 0
  ctx.font = "400 22px Outfit, system-ui, sans-serif"
  ctx.fillStyle = MUTED
  ctx.fillText(frame.quality, w / 2, h * 0.4 + 62)

  const octave = octaveShiftLabel(frame.octaveShift)
  if (octave) {
    ctx.font = "700 16px Outfit, system-ui, sans-serif"
    const bw = ctx.measureText(octave).width + 28
    const bx = w / 2 - bw / 2
    const by = h * 0.4 + 84
    ctx.fillStyle = "rgba(255, 107, 90, 0.2)"
    ctx.strokeStyle = CORAL
    ctx.lineWidth = 1.5
    roundRect(ctx, bx, by, bw, 30, 15)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = CORAL
    ctx.fillText(octave, w / 2, by + 16)
  }

  const degrees = scaleGuideForKey(frame.keyHz)
  const active = activeRoman(frame.chord)
  const gap = 10
  const rowW = Math.min(w - 48, 1100)
  const padW = (rowW - gap * (degrees.length - 1)) / degrees.length
  const padH = 86
  const x0 = (w - rowW) / 2
  const y = h - padH - 36
  const holding = frame.chord != null && frame.holdSeconds > 0

  if (holding) {
    ctx.font = "700 14px Outfit, system-ui, sans-serif"
    ctx.fillStyle = MINT
    ctx.textAlign = "right"
    ctx.fillText(`HOLDING ${frame.holdSeconds.toFixed(1)}s`, x0 + rowW, y - 18)
    ctx.textAlign = "center"
  }

  degrees.forEach((degree, i) => {
    const on = !degree.isOctave && active === degree.roman
    const x = x0 + i * (padW + gap)
    ctx.fillStyle = on ? MINT_DIM : "rgba(12, 18, 24, 0.72)"
    ctx.strokeStyle = on ? "rgba(61, 255, 224, 0.85)" : "rgba(232, 244, 248, 0.12)"
    ctx.lineWidth = 1.5
    roundRect(ctx, x, y, padW, padH, 12)
    ctx.fill()
    ctx.stroke()
    if (on) drawHoldRing(ctx, x, y, padW, padH, frame.holdProgress)
    ctx.fillStyle = on ? MINT : TEXT
    ctx.font = "800 26px Syne, system-ui, sans-serif"
    ctx.fillText(degree.note, x + padW / 2, y + 30)
    ctx.fillStyle = MUTED
    ctx.font = "600 14px Outfit, system-ui, sans-serif"
    ctx.fillText(degree.isOctave ? "I′" : degree.roman, x + padW / 2, y + 54)
    if (padW >= 88) {
      ctx.font = "400 11px Outfit, system-ui, sans-serif"
      ctx.fillText(degree.gesture, x + padW / 2, y + 72)
    }
  })

  ctx.restore()
}
