import { levelAt } from '../../core/curve/generate';
import type { GeneratedCurve } from '../../core/curve/types';

export type AutoStyle = 'gentle' | 'sudden' | 'fast';

/**
 * Dev-mode auto-voice: follows a target curve like a (slightly imperfect) learner.
 *  - gentle: follows the curve with small wobble
 *  - sudden: jumps straight to the plateau instead of ramping (a hard onset)
 *  - fast: gentle onset but speaks the whole thing at ~1.7x speed
 */
export function makeAutoDriver(curve: GeneratedCurve, style: AutoStyle, startMs: number) {
  const speed = style === 'fast' ? 1.7 : 1;
  // A sudden onset skips the whole rise: voice jumps to the first vowel plateau the moment voicing starts.
  const plateau = curve.envelope.find((p) => p.level >= 0.78);
  const plateauAt = plateau ? plateau.t : curve.voicedStartMs + curve.settings.onsetMs;
  return (nowMs: number): number | null => {
    const t = (nowMs - startMs) * speed;
    if (t < 0) return 0;
    let level = levelAt(curve, t);
    if (style === 'sudden' && t >= curve.voicedStartMs && t < plateauAt) level = 0.8;
    const wobble = 1 + 0.04 * Math.sin(t / 130);
    return Math.max(0, level * wobble);
  };
}
