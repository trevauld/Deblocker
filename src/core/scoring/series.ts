import type { UserSample } from './types';

/** Level at time t by linear interpolation (0 outside the series). */
export function valueAt(samples: UserSample[], t: number, hint = 0): number {
  if (samples.length === 0) return 0;
  if (t <= samples[0].t) return samples[0].level;
  const last = samples[samples.length - 1];
  if (t >= last.t) return last.level;
  let i = Math.min(hint, samples.length - 2);
  while (i > 0 && samples[i].t > t) i--;
  while (i < samples.length - 2 && samples[i + 1].t <= t) i++;
  const a = samples[i];
  const b = samples[i + 1];
  return a.level + ((b.level - a.level) * (t - a.t)) / (b.t - a.t || 1);
}

/** Resample to a uniform grid [from, to] with the given step. */
export function resample(samples: UserSample[], stepMs: number, from: number, to: number): number[] {
  const out: number[] = [];
  let hint = 0;
  for (let t = from; t <= to + 1e-9; t += stepMs) {
    const v = valueAt(samples, t, hint);
    out.push(v);
  }
  return out;
}

export const VOICE_ON = 0.1;

/** Runs of voiced samples, merging gaps shorter than mergeGapMs and dropping blips shorter than minMs. */
export function speechSpans(samples: UserSample[], threshold = VOICE_ON, mergeGapMs = 500, minMs = 120): [number, number][] {
  const raw: [number, number][] = [];
  let start: number | null = null;
  let last = 0;
  for (const s of samples) {
    if (s.level >= threshold) {
      if (start === null) start = s.t;
      last = s.t;
    } else if (start !== null) {
      raw.push([start, last]);
      start = null;
    }
  }
  if (start !== null) raw.push([start, last]);
  const merged: [number, number][] = [];
  for (const r of raw) {
    const prev = merged[merged.length - 1];
    if (prev && r[0] - prev[1] < mergeGapMs) prev[1] = r[1];
    else merged.push([r[0], r[1]]);
  }
  return merged.filter(([a, b]) => b - a >= minMs);
}

export const spanTotal = (spans: [number, number][]) => spans.reduce((n, [a, b]) => n + (b - a), 0);

/**
 * Voiced runs as [firstT, lastT] pairs. A run needs at least `minMs` of voiced frames, so single-frame
 * flicker above the threshold is ignored.
 */
export function voicedRuns(samples: UserSample[], threshold = VOICE_ON, minMs = 80): [number, number][] {
  const runs: [number, number][] = [];
  let start: number | null = null;
  let last = 0;
  const close = () => {
    if (start !== null && last - start >= minMs) runs.push([start, last]);
    start = null;
  };
  for (const s of samples) {
    if (s.level >= threshold) {
      if (start === null) start = s.t;
      last = s.t;
    } else close();
  }
  close();
  return runs;
}
