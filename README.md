# Gesture Synth

Hand-tracking web instrument. Use your webcam to play chords (Gesture mode) or a classic theremin (Theremin mode).

## Features

- **Gesture mode** (default) — left hand selects Roman chords; right hand controls volume, quality, filter tone, and octave
- **Theremin mode** — left hand volume, right hand pitch
- First-visit tutorial (Help to replay)
- Runs entirely in the browser (MediaPipe + Web Audio)

## Requirements

- Modern browser (Chrome or Edge recommended)
- Webcam + microphone permission not required (camera only)
- HTTPS or `localhost` for `getUserMedia`

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

Deploy the `dist/` folder to any static host (Vercel, Netlify, etc.).

## Controls (Gesture)

| Hand | Action | Effect |
|------|--------|--------|
| Left | Raise 1–5 fingers | Chords I–V |
| Left | Index + pinky | VI |
| Left | Index + pinky + thumb | VII |
| Left | Wrist tilt | Major / minor |
| Right | Height | Volume |
| Right | 1–4 fingers up | Triad / inversion / 7ths |
| Right | Wrist tilt | Tone (filter) |
| Right | Thumb extended | Octave down |
