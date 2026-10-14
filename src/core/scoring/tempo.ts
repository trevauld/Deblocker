import type { GeneratedCurve } from '../curve/types';
import { resample, speechSpans, spanTotal, VOICE_ON } from './series';
import type { TempoResult, UserSample } from './types';

/** Slower than the target by this much is still fine for slow-speech practice. */
export const SLOW_OK_RATIO = 1.5;

export function tempoScore(ratio: number): number {
  if (!isFinite(ratio) || ratio <= 0) return 0;
  if (ratio >= 1) return Math.round(ratio <= SLOW_OK_RATIO ? 100 : Math.max(40, 100 - (ratio - SLOW_OK_RATIO) * 60));
  // Faster than the target: 0.9 → 80, 0.5 → 0.
  return Math.round(Math.max(0, Math.min(100, 100 * (1 - (1 - ratio) / 0.5))));
}

export function targetSpeechSpans(target: GeneratedCurve): [number, number][] {
  return speechSpans(target.envelope, VOICE_ON, 500, 100);
}

/** Compare time spent speaking (pauses between breath groups excluded) with the target's. */
export function analyzeTempo(user: UserSample[], target: GeneratedCurve): TempoResult & { userSpans: [number, number][]; targetSpans: [number, number][] } {
  const userSpans = speechSpans(user, VOICE_ON, 500, 120);
  const targetSpans = targetSpeechSpans(target);
  const userMs = spanTotal(userSpans);
  const targetMs = spanTotal(targetSpans);
  const ratio = targetMs > 0 ? userMs / targetMs : 0;
  return { ratio, userMs, targetMs, score: userMs > 0 ? tempoScore(ratio) : 0, estimated: false, userSpans, targetSpans };
}

/**
 * Rough syllable rate from loudness peaks (no speech recognition): counts rises and falls of at least `prominence`.
 * Used for free-speech prompts where there is no target curve.
 */
export function estimateSyllableCount(user: UserSample[], prominence = 0.08): number {
  const spans = speechSpans(user, VOICE_ON, 500, 120);
  if (!spans.length) return 0;
  let count = 0;
  for (const [a, b] of spans) {
    const g = resample(user, 20, a, b);
    let up = true;
    let max = g[0];
    let min = 0;
    for (const x of g) {
      if (up) {
        if (x > max) max = x;
        else if (max - x >= prominence && max - min >= prominence) {
          count++;
          up = false;
          min = x;
        }
      } else if (x < min) min = x;
      else if (x - min >= prominence) {
        up = true;
        max = x;
      }
    }
    if (up && max - min >= prominence) count++; // trailing syllable that never fell
  }
  return count;
}

export function analyzeFreeSpeechTempo(user: UserSample[], targetMsPerSyllable: number): TempoResult {
  const spans = speechSpans(user, VOICE_ON, 500, 120);
  const userMs = spanTotal(spans);
  const syl = estimateSyllableCount(user);
  if (userMs <= 0 || syl === 0) return { ratio: 0, userMs, targetMs: 0, score: 0, estimated: true };
  const userMsPerSyllable = userMs / syl;
  const ratio = userMsPerSyllable / targetMsPerSyllable;
  return { ratio, userMs, targetMs: syl * targetMsPerSyllable, score: tempoScore(ratio), estimated: true };
}

/** Did the voice fade away inside a long breath group (running out of air)? */
export function detectRanOutOfAir(user: UserSample[], spans: [number, number][], targetLongestMs: number): boolean {
  for (const [a, b] of spans) {
    const len = b - a;
    if (len < 3500 || len < 1.2 * targetLongestMs) continue;
    const end = b - 300; // ignore the normal final fade
    const split = a + (end - a) * 0.7;
    const early = resample(user, 50, a + 300, split).filter((v) => v >= VOICE_ON);
    const late = resample(user, 50, split, end).filter((v) => v >= 0.03);
    if (!early.length || !late.length) continue;
    const mean = (xs: number[]) => xs.reduce((p, c) => p + c, 0) / xs.length;
    if (mean(late) < 0.5 * mean(early)) return true;
  }
  return false;
}
