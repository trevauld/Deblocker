# Deblocker

A speech-training **practice companion** for adults who stutter, focused on blocks. For every word or phrase the app generates an
ideal loudness curve (easy onset, slow tempo, breath-supported phrasing) and you match it with your voice in real time.

> Deblocker is not a treatment and makes no medical claims. Audio is analysed on-device as a loudness number and is never recorded or uploaded.

## Run it

```bash
npm install
npm run dev        # builds public/lexicon.json from the CMU dictionary, then starts Vite
npm test           # unit tests (core logic + storage)
npm run build      # typecheck + production PWA build
```

No microphone? Open **Settings → Voice input → Simulated voice**. Hold **Space** (gentle onset) or **Enter** (sudden onset), ↑/↓ changes
loudness. "Auto-play" makes the simulated voice follow the target gentle / sudden / rushed by itself. Calibrate by staying quiet for
1.5 s, then holding Space for the 3 s hum.

## Layout

- `src/core/` – plain TypeScript, no DOM/React (portable to mobile)
  - `audio/` RMS→dB, normalization, smoothing, calibration state machine
  - `phonetics/` CMU lookup, ARPAbet classes, syllabifier, spelling-based fallback
  - `curve/` target curve generator, breath-group phrasing, level settings
  - `scoring/` onset (50%), DTW envelope match (30%), tempo (20%), plain-language feedback
  - `guidance/` fading guidance levels 1–4 with advance / step-back rule
  - `session/` drill content and ~10-minute session planner
  - `tracking/` session stats, stage/pace progression, trigger insights
- `src/web/` – browser adapters and React UI (Web Audio mic, simulated voice, IndexedDB, canvas views)
- `scripts/build-lexicon.ts` – trims the CMU dictionary into a lazy-loaded JSON file

## Notes and limits

- Pronunciations come from CMU; unknown words use a rough spelling-based guess (flagged "guessed").
- Syllable highlighting follows the target timeline, not your voice.
- Free-speech prompts have no curve; tempo is estimated from loudness peaks (no speech recognition), so treat it as approximate.
- Only the first try at each drill counts toward session stats and fading; retries are for practice.
- Thresholds (onset strictness, band widths, fading rates) are reasonable starting values, not clinically validated.
