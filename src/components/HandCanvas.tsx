import { useEffect, useRef } from "react"
import type { HandLandmarkerResult } from "@mediapipe/tasks-vision"
import { chordColorVar } from "../music/chords"

type WaveParams = {
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

export function HandCanvas({ videoRef, getResult, getWaveParams, dimmed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = Math.max(1, Math.floor(w * dpr))
      canvas.height = Math.max(1, Math.floor(h * dpr))
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      const ctx = canvas.getContext("2d")
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener("resize", resize)
    window.visualViewport?.addEventListener("resize", resize)

    let raf = 0
    const paint = () => {
      const video = videoRef.current
      const ctx = canvas.getContext("2d")
      const cssW = window.innerWidth
      const cssH = window.innerHeight
      if (!ctx) {
        raf = requestAnimationFrame(paint)
        return
      }

      ctx.clearRect(0, 0, cssW, cssH)

      // Soft vignette over the live <video> background
      const g = ctx.createRadialGradient(
        cssW / 2,
        cssH / 2,
        cssH * 0.2,
        cssW / 2,
        cssH / 2,
        cssH * 0.75,
      )
      g.addColorStop(0, "rgba(11, 16, 20, 0)")
      g.addColorStop(1, dimmed ? "rgba(11, 16, 20, 0.72)" : "rgba(11, 16, 20, 0.45)")
      ctx.fillStyle = g
      ctx.fillRect(0, 0, cssW, cssH)

      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        const { sx, sy, sWidth, sHeight } = coverCrop(
          video.videoWidth,
          video.videoHeight,
          cssW,
          cssH,
        )
        const result = getResult()
        if (result) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.7)"
          for (const hand of result.landmarks) {
            for (const pt of hand) {
              // Match CSS-mirrored video: flip X in source space
              const lx = (1 - pt.x) * video.videoWidth
              const ly = pt.y * video.videoHeight
              const dx = ((lx - sx) / sWidth) * cssW
              const dy = ((ly - sy) / sHeight) * cssH
              ctx.beginPath()
              ctx.arc(dx, dy, 4, 0, Math.PI * 2)
              ctx.fill()
            }
          }
        }
      }

      const wave = getWaveParams()
      drawWaves(ctx, wave.volume, wave.qualityIndex, wave.tone, wave.chord)
      raf = requestAnimationFrame(paint)
    }
    raf = requestAnimationFrame(paint)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
      window.visualViewport?.removeEventListener("resize", resize)
    }
  }, [videoRef, getResult, getWaveParams, dimmed])

  return <canvas ref={canvasRef} className="hand-canvas" aria-hidden />
}
