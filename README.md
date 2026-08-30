# Gesture Synth

Hand-tracking web instrument. Use your webcam to play chords (Gesture mode) or a classic theremin (Theremin mode).

## Features

- **Gesture mode** (default) — left hand picks the Roman chord and flips major/minor by turning over; right hand controls chord style, volume, filter tone, and octave
- **Chord palettes** — four selectable sets of voicings: classic triads/7ths, suspended, extended (9ths/6ths), or open/rock
- **Arpeggiator** — break held chords into notes in time with the sequencer (up / down / up-down / random, 1/4–1/16, 1–3 octaves)
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
npm run dev
```

The dev server runs over HTTPS (self-signed) so `getUserMedia` also works from a LAN IP; accept the certificate warning on first load.

Supabase is optional and only needed for community song deep links:

```bash
cp .env.example .env   # Supabase URL + anon key (same project as community)
```

Leave it unset and `getSupabase()` returns `null`, which lets `@supabase/supabase-js` (~200 kB) tree-shake out of the bundle entirely.

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
| Left | **Palm to camera / back of hand** | **Major / minor** |
| Right | Height | Volume |
| Right | 1–4 fingers up | Chord style, from the active palette |
| Right | Wrist tilt | Tone (filter) |
| Right | Thumb extended | Octave down |

### Major / minor

Turn the left hand over: **palm toward the camera is major, back of the hand is minor**. Fingers stay in the same shape, so you can flip mode without changing the chord.

This is read from the signed area of the wrist / index-MCP / pinky-MCP triangle, which keeps its winding while the palm faces the camera and reverses once the hand turns over, flattening toward zero edge-on. Dividing by palm length squared makes the reading independent of hand size and distance, so it yields a graded −1…+1 rather than a brittle boolean. The signal is smoothed and only commits past a deadband, so the mode does not chatter when the hand is near its silhouette.

The sign convention is keyed to MediaPipe's handedness label, which flips together with the geometry — so it reads the same whether or not the feed is mirrored before detection. If it still comes out backwards on a given camera, **Settings → Left hand → "Swap: back of hand = major"** inverts it.

A badge under the chord name shows the live reading (`palm · major` / `back · minor`).

### Chord palettes

The right hand's raised-finger count (1–4) picks a slot; the palette decides what each slot plays. Set it in **Settings → Chord palette**. Major-mode voicings shown, as semitones above the root:

| Palette | 1 finger | 2 fingers | 3 fingers | 4 fingers |
|---------|----------|-----------|-----------|-----------|
| **Classic** (default) | Major `0,7,12,16` | 1st inversion `4,7,12,16` | Major 7th `0,4,7,11` | Dominant 7th `0,4,7,10` |
| **Suspended** | Sus2 `0,2,7,12` | Sus4 `0,5,7,12` | Major `0,7,12,16` | Add9 `0,4,7,14` |
| **Extended** | Major 7th `0,4,7,11` | Dominant 9th `0,4,7,10,14` | Add9 `0,4,7,14` | Major 6th `0,4,7,9` |
| **Open / rock** | Power 5th `0,7,12,19` | Major `0,7,12,16` | Sus4 `0,5,7,12` | 11th `0,7,10,14,17` |

Turning the left hand over swaps each slot to its minor equivalent, so one palette covers 56 chords per key (7 degrees × 4 styles × 2 modes). Sus, power and 11th chords contain no third and so sound the same in either mode — that is intended.

Qualities are defined in `src/music/chords.ts` as semitone offsets from the root, with the third a function of the mode, so adding a voicing or a palette is a one-line change.

Guided practice always uses the Classic palette, since community song targets are written against it.

### Arpeggiator

Off by default; enable under **Settings → Arpeggiator**. A held chord is played one note at a time instead of as a block.

- **Patterns** — up, down, up/down, random
- **Rates** — 1/4, 1/8, 1/8 triplet, 1/16
- **Range** — 1–3 octaves

Notes are queued with lookahead scheduling against the Web Audio clock and aligned to an absolute grid at the sequencer BPM, so the arp stays phase-locked to loop playback rather than drifting from wherever the chord happened to start. A chord change restarts the figure but keeps the grid, so it does not stutter mid-bar. Pattern and octave changes reshape the chord already being held.

Loop recording captures the arpeggiated notes rather than the underlying block chord, so playback sounds like what you played.

**Voicing.** Arpeggios walk a close-position fold of the chord (one instance of each tone, within an octave of the lowest note) rather than the block voicing. The block triad is root/fifth/octave/third-an-octave-up — full and clear sounded together, but walked one note at a time three of its four steps are mode-neutral, which made major and minor nearly indistinguishable. Folding puts the third next to the root, so the mode is audible. Block chords (arp off) are unaffected.

Sequencing lives in `src/audio/arp.ts` and is pure — no AudioContext — so note ordering can be tested directly.
