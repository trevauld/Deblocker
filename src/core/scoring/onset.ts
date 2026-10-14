import { resample, VOICE_ON } from './series';
import type { OnsetResult, Strictness, UserSample } from './types';

/** Fraction of the "ideal" 80%-rise time below which an onset counts as hard. */
const RISE_FACTOR: Record<Strictness, number> = { lenient: 0.45, normal: 0.6, strict: 0.8 };
/** Multiple of the ideal steepest slope above which an onset counts as hard. */
const SLOPE_FACTOR: Record<Strictness, number> = { lenient: 3.2, normal: 2.4, strict: 1.7 };
/** smoothstep 0→peak reaches 80% of the peak at ~69% of its length. */
const IDEAL_RISE_FRACTION = 0.69;
const QUIET_PEAK = 0.3;
const STEP = 10;
const SLOPE_WINDOW = 50;

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
const lerp = (a: number, b: number, x: number) => a + (b - a) * x;

export function hardRiseThresholdMs(onsetMs: number, strictness: Strictness): number {
  return Math.max(60, RISE_FACTOR[strictness] * IDEAL_RISE_FRACTION * onsetMs);
}

/**
 * Analyse the first moments of voicing. A gentle onset takes a while to reach its peak and never
 * climbs steeply; a hard onset reaches 80% of its peak almost at once.
 * `targetOnsetMs` is the ramp length of the target curve (the ideal rise at this level).
 */
export function analyzeOnset(samples: UserSample[], targetOnsetMs: number, strictness: Strictness = 'normal'): OnsetResult {
  const none: OnsetResult = { detected: false, hard: false, tooQuiet: false, score: 0 };
  if (samples.length < 3) return none;

  // Voicing start: level above threshold for at least ~80 ms.
  let tv = -1;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].level < VOICE_ON) continue;
    let j = i;
    while (j < samples.length && samples[j].level >= VOICE_ON * 0.8 && samples[j].t - samples[i].t < 80) j++;
    if (j < samples.length && samples[j].t - samples[i].t >= 80) { tv = i; break; }
    if (j >= samples.length) break;
  }
  if (tv < 0) return none;

  // Walk back to where the rise began (last time near the floor).
  let i0 = tv;
  while (i0 > 0 && samples[i0 - 1].level > 0.04) i0--;
  const t0 = samples[i0].t;

  const grid = resample(samples, STEP, t0, t0 + 1000);
  let peak = 0;
  for (const v of grid) peak = Math.max(peak, v);
  const tooQuiet = peak < QUIET_PEAK;

  // Rise time to 80% of peak.
  let riseMs = 1000;
  for (let k = 0; k < grid.length; k++) {
    if (grid[k] >= 0.8 * peak) {
      const prev = k > 0 ? grid[k - 1] : 0;
      const frac = grid[k] > prev ? (0.8 * peak - prev) / (grid[k] - prev) : 1;
      riseMs = Math.max(0, (k - 1 + frac) * STEP);
      break;
    }
  }

  // Steepest slope inside the first 300 ms, measured over ~50 ms to ignore jitter.
  const win = SLOPE_WINDOW / STEP;
  let maxSlope = 0;
  for (let k = 0; k + win < grid.length && k * STEP <= 300; k++) {
    maxSlope = Math.max(maxSlope, ((grid[k + win] - grid[k]) / SLOPE_WINDOW) * 1000);
  }

  const ideal = IDEAL_RISE_FRACTION * targetOnsetMs;
  const hardRise = hardRiseThresholdMs(targetOnsetMs, strictness);
  const expectedSlope = (1.5 * Math.max(peak, 0.2)) / (targetOnsetMs / 1000);
  const slopeLimit = SLOPE_FACTOR[strictness] * expectedSlope;

  if (tooQuiet) {
    return { detected: true, startMs: t0, riseMs, maxSlope, peak, idealRiseMs: ideal, hard: false, tooQuiet: true, score: 40 };
  }

  const hard = riseMs < hardRise || maxSlope > slopeLimit;

  // Score from rise time: 0 at half the hard threshold, 50 at the threshold, 60→100 between threshold and 85% of ideal.
  const q = riseMs;
  const goodAt = 0.85 * ideal;
  let riseScore: number;
  if (q >= goodAt) riseScore = 100;
  else if (q >= hardRise) riseScore = lerp(60, 100, (q - hardRise) / Math.max(1, goodAt - hardRise));
  else riseScore = lerp(0, 50, clamp((q - hardRise * 0.5) / Math.max(1, hardRise * 0.5), 0, 1) * 1);

  // Score from slope.
  const z = maxSlope / expectedSlope;
  const sf = SLOPE_FACTOR[strictness];
  let slopeScore: number;
  if (z <= 1.3) slopeScore = 100;
  else if (z <= sf) slopeScore = lerp(100, 60, (z - 1.3) / Math.max(0.01, sf - 1.3));
  else slopeScore = lerp(50, 0, clamp((z - sf) / sf, 0, 1));

  let score = Math.min(riseScore, slopeScore);
  if (hard) score = Math.min(score, 55);
  return { detected: true, startMs: t0, riseMs, maxSlope, peak, idealRiseMs: ideal, hard, tooQuiet: false, score: Math.round(score) };
}
