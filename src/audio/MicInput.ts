import { MIC_NONE } from "../lib/recordingPrefs"

const TARGET_RMS = 0.18 // about -15 dBFS: sits well against the synth
const NOISE_FLOOR = 0.006 // below this we assume silence and hold the gain
const MIN_AUTO = 1.7 // never turn the voice down below this, however loud the room gets
const MAX_AUTO = 9
const VOICE_LEVEL = 0.03 // post-gain RMS above which we treat it as singing and duck the synth
const DUCK_AMOUNT = 0.25 // synth gain while singing (about -12 dB)

/** Live microphone routed into the shared output bus (heard through the speakers and captured by recordings). */
export class MicInput {
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private gain: GainNode | null = null
  private token = 0
  private analyser: AnalyserNode | null = null
  private buf: Float32Array<ArrayBuffer> | null = null
  /** Slowly adapting gain that brings the mic to TARGET_RMS. */
  private auto = 1
  private timer = 0
  error: string | null = null

  /** Processed mic signal (after leveling) for taps such as per-stem recording. */
  get output(): AudioNode | null {
    return this.gain
  }

  /**
   * Voice-forward mix: the mic is normalised slowly (so a scream isn't levelled flat and synth
   * bleeding into the mic can't pull the gain down), and the synth is ducked while the voice is
   * active so the synth always sits behind the singing.
   */
  async start(
    ctx: AudioContext,
    bus: AudioNode,
    monitor: AudioNode,
    deviceId: string,
    duckSynth: (amount: number) => void,
  ) {
    const token = ++this.token
    this.stop(false)
    this.error = null
    if (deviceId === MIC_NONE) return
    try {
      const audio: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      }
      if (deviceId !== "default") audio.deviceId = { ideal: deviceId }
      const stream = await navigator.mediaDevices.getUserMedia({ audio })
      if (token !== this.token) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      this.stream = stream
      this.source = ctx.createMediaStreamSource(stream)
      this.gain = ctx.createGain()
      this.auto = 3.2
      this.gain.gain.value = this.auto
      this.analyser = ctx.createAnalyser()
      this.analyser.fftSize = 1024
      this.buf = new Float32Array(this.analyser.fftSize)
      this.source.connect(this.analyser)
      this.source.connect(this.gain)
      this.gain.connect(bus)
      this.gain.connect(monitor)
      this.timer = window.setInterval(() => {
        if (!this.gain || !this.analyser || !this.buf) return
        this.analyser.getFloatTimeDomainData(this.buf)
        let sum = 0
        for (const v of this.buf) sum += v * v
        const rms = Math.sqrt(sum / this.buf.length)
        if (rms > NOISE_FLOOR) {
          const want = Math.min(MAX_AUTO, Math.max(MIN_AUTO, TARGET_RMS / rms))
          this.auto += (want - this.auto) * 0.01
        }
        this.gain.gain.setTargetAtTime(this.auto, ctx.currentTime, 0.1)
        duckSynth(rms * this.auto > VOICE_LEVEL ? DUCK_AMOUNT : 1)
      }, 50)
    } catch (e) {
      this.error = e instanceof Error ? e.message : "Microphone unavailable"
    }
  }

  stop(invalidate = true) {
    if (invalidate) this.token++
    window.clearInterval(this.timer)
    this.source?.disconnect()
    this.gain?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    this.analyser?.disconnect()
    this.source = this.gain = this.stream = this.analyser = this.buf = null
  }
}
