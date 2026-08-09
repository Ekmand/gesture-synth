# Gesture Synth

Hand-tracking web instrument. Use your webcam to play chords (Gesture mode) or a classic theremin (Theremin mode).

## Features

- **Gesture mode** (default) — left hand selects Roman chords; right hand controls volume, quality, filter tone, and octave
- **Theremin mode** — left hand volume, right hand pitch
- First-visit tutorial (Help to replay)
- Guided practice for community songs (**Learn a song** in the HUD, or deep link from [community.gesturesynth.com](https://community.gesturesynth.com))
- Settings sheet for key, hand controls, sequencer visibility, and About / social links
- Runs entirely in the browser (MediaPipe + Web Audio)

## Requirements

- Modern browser (Chrome or Edge recommended)
- Webcam + microphone permission not required (camera only)
- HTTPS or `localhost` for `getUserMedia`

## Develop

```bash
npm install
cp .env.example .env   # fill in Supabase URL + anon key (same project as community)
npm run dev
```

### Community song deep links

Community arrangement pages use UUIDs like `a4e77d0c-38a7-4662-8bd9-82c839a10f37` (same as `/a/<id>` on community). “Practice in Gesture Synth” buttons should open:

```text
https://gesturesynth.com/?a=a4e77d0c-38a7-4662-8bd9-82c839a10f37
```

Locally: `http://localhost:5173/?a=<arrangement-uuid>` (or your HTTPS LAN URL).

The app loads that public `arrangements` row from the shared Supabase project (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`) and opens guided practice mode (learn.gesturesynth.com-style chord targets). Supports community arrangement **v2** (MIDI `notes`, including learn song imports) and legacy **v1** (`steps`). Only public arrangements are readable via the anon key / RLS.

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
