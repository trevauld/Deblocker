import { levelAt } from '../../core/curve/generate';
import type { GeneratedCurve } from '../../core/curve/types';

export type AutoStyle = 'gentle' | 'sudden' | 'fast';

export interface AutoFaults {
  /** Wait this long (after the start cue) before the voice begins. */
  startDelayMs?: number;
  /** Go silent for this long in the middle of the first breath group. */
  midSilenceMs?: number;
}

/**
 * Dev-mode auto-voice: follows a target curve like a (slightly imperfect) learner.
 *  - gentle: follows the curve with small wobble
 *  - sudden: jumps straight to the plateau instead of ramping (a hard onset)
 *  - fast: gentle onset but speaks the whole thing at ~1.7x speed
 * Faults (dev testing of block detection): a delay before the first sound, and a silence in the middle of the first phrase.
 */
export function makeAutoDriver(curve: GeneratedCurve, style: AutoStyle, startMs: number, faults: AutoFaults = {}) {
  const speed = style === 'fast' ? 1.7 : 1;
  // A sudden onset skips the whole rise: voice jumps to the first vowel plateau the moment voicing starts.
  const plateau = curve.envelope.find((p) => p.level >= 0.78);
  const plateauAt = plateau ? plateau.t : curve.voicedStartMs + curve.settings.onsetMs;
  const delay = faults.startDelayMs ?? 0;
  const silence = faults.midSilenceMs ?? 0;
  const first = curve.chunks[0];
  const silenceAt = first ? (first.startMs + first.endMs) / 2 : curve.durationMs / 2;
  return (nowMs: number): number | null => {
    let t = (nowMs - startMs - delay) * speed;
    if (t < 0) return 0;
    if (silence > 0) {
      if (t >= silenceAt + silence * speed) t -= silence * speed;
      else if (t >= silenceAt) return 0;
    }
    let level = levelAt(curve, t);
    if (style === 'sudden' && t >= curve.voicedStartMs && t < plateauAt) level = 0.8;
    const wobble = 1 + 0.04 * Math.sin(t / 130);
    return Math.max(0, level * wobble);
  };
}
