import { useEffect, useRef } from "react"
import type { HandLandmarkerResult } from "@mediapipe/tasks-vision"
import { chordColorVar } from "../music/chords"

export type WaveParams = {
  volume: number
  qualityIndex: number
  tone: number
  chord: string | null
}

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>
  getResult: () => HandLandmarkerResult | null
  getWaveParams: () => WaveParams
  dimmed: boolean
}

function coverCrop(
  vw: number,
  vh: number,
  cw: number,
  ch: number,
): { sx: number; sy: number; sWidth: number; sHeight: number } {
  const videoAspect = vw / vh
  const canvasAspect = cw / ch
  if (videoAspect > canvasAspect) {
    const sHeight = vh
    const sWidth = vh * canvasAspect
    return { sx: (vw - sWidth) / 2, sy: 0, sWidth, sHeight }
  }
  const sWidth = vw
  const sHeight = vw / canvasAspect
  return { sx: 0, sy: (vh - sHeight) / 2, sWidth, sHeight }
}

function drawWaves(
  ctx: CanvasRenderingContext2D,
  volume: number,
  qualityIndex: number,
  tone: number,
  chord: string | null,
) {
  if (qualityIndex === 0) return
  const layers = qualityIndex
  const baseY = ctx.canvas.height - 56
  const width = ctx.canvas.width
  const lineW = 1 + volume * 8
  const noiseAmt = ((tone + 1) / 2) * 25
  const noiseFreq = 0.05 + ((tone + 1) / 2) * 0.15
  const rgb = chordColorVar(chord)
  const isMajor = chord != null && chord === chord.toUpperCase()
  const active = chord && chord !== "--"
  const alpha = active ? (isMajor ? 1 : 0.7) : 0.3
  const t = performance.now() * 0.004

  ctx.save()
  ctx.shadowBlur = 10 + volume * 20
  ctx.shadowColor = `rgba(${rgb}, ${0.5 * alpha})`

  for (let i = 0; i < layers; i++) {
    ctx.beginPath()
    const y0 = baseY + (i - (layers - 1) / 2) * 12
    for (let x = 0; x <= width; x += 10) {
      const wave = Math.sin(x * 0.005 + t + i * 0.5) * 20
      const jitter = (Math.random() - 0.5) * noiseAmt * Math.sin(x * noiseFreq + t)
      const y = y0 + wave + jitter
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = `rgba(${rgb}, ${alpha})`
    ctx.lineWidth = Math.max(1, lineW - i * 0.5)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.stroke()
  }
  ctx.restore()
}

/** Draw one frame (mirrored camera, hand dots, vignette, waves). Shared by the live view and the recorder. */
export function paintScene(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  result: HandLandmarkerResult | null,
  wave: WaveParams,
  /** Camera picture only: no hand dots, vignette or waves. */
  clean = false,
) {
  const { width: cw, height: ch } = ctx.canvas
  const { sx, sy, sWidth, sHeight } = coverCrop(video.videoWidth, video.videoHeight, cw, ch)
  ctx.save()
  ctx.clearRect(0, 0, cw, ch)
  ctx.translate(cw, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, cw, ch)

  if (result && !clean) {
    const dot = Math.max(4, ch / 180)
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)"
    for (const hand of result.landmarks) {
      for (const pt of hand) {
        const lx = pt.x * video.videoWidth
        const ly = pt.y * video.videoHeight
        const dx = ((lx - sx) / sWidth) * cw
        const dy = ((ly - sy) / sHeight) * ch
        ctx.beginPath()
        ctx.arc(dx, dy, dot, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  ctx.restore()
  if (clean) return

  const g = ctx.createRadialGradient(cw / 2, ch / 2, ch * 0.2, cw / 2, ch / 2, ch * 0.75)
  g.addColorStop(0, "rgba(11, 16, 20, 0)")
  g.addColorStop(1, "rgba(11, 16, 20, 0.55)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, cw, ch)

  drawWaves(ctx, wave.volume, wave.qualityIndex, wave.tone, wave.chord)
}

export function HandCanvas({ videoRef, getResult, getWaveParams, dimmed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    let raf = 0
    const paint = () => {
      const video = videoRef.current
      const ctx = canvas.getContext("2d")
      if (ctx && video && video.videoWidth) {
        paintScene(ctx, video, getResult(), getWaveParams())
      }
      raf = requestAnimationFrame(paint)
    }
    raf = requestAnimationFrame(paint)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
    }
  }, [videoRef, getResult, getWaveParams])

  return (
    <canvas
      ref={canvasRef}
      className={`hand-canvas${dimmed ? " hand-canvas--dimmed" : ""}`}
      aria-hidden
    />
  )
}
