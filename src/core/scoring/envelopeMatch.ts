import type { GeneratedCurve } from '../curve/types';
import { dtw } from './dtw';
import { resample, VOICE_ON } from './series';
import type { EnvelopeResult, UserSample } from './types';

const HOP = 50;
/** Mean excess error (beyond the band) at which the score reaches 0. */
const EXCESS_AT_ZERO = 0.3;

/**
 * Compare the user's loudness with the target envelope. Both are aligned at the start of voicing and warped
 * by DTW inside a constrained window, so small timing shifts don't cost points. Error only counts where the user
 * is farther from the target than the tolerance band.
 */
export function envelopeMatch(user: UserSample[], target: GeneratedCurve, bandHalfWidth: number): EnvelopeResult {
  const firstUser = user.find((s) => s.level >= VOICE_ON);
  if (!firstUser) return { score: 0, meanExcess: 1 };
  let lastUserT = firstUser.t;
  for (const s of user) if (s.level >= VOICE_ON) lastUserT = s.t;
  const firstTarget = target.envelope.find((p) => p.level >= 0.08)?.t ?? target.voicedStartMs;

  const uStart = firstUser.t - 100;
  const uEnd = lastUserT + 400;
  const tStart = firstTarget - 100;
  const tEnd = target.durationMs;

  const u = resample(user, HOP, uStart, uEnd);
  const tSeries = target.envelope.map((p) => ({ t: p.t, level: p.level }));
  const t = resample(tSeries, HOP, tStart, tEnd);
  if (u.length < 2 || t.length < 2) return { score: 0, meanExcess: 1 };

  const window = Math.max(6, Math.ceil(0.12 * Math.max(u.length, t.length)));
  const { path } = dtw(u, t, window);
  if (path.length === 0) return { score: 0, meanExcess: 1 };
  let excess = 0;
  for (const [i, j] of path) excess += Math.max(0, Math.abs(u[i] - t[j]) - bandHalfWidth);
  const meanExcess = excess / path.length;
  const score = Math.round(Math.max(0, Math.min(100, 100 * (1 - meanExcess / EXCESS_AT_ZERO))));
  return { score, meanExcess };
}
