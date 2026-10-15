import type { GeneratedCurve } from '../curve/types';
import { voicedRuns, VOICE_ON } from '../scoring/series';
import type { OnsetResult, UserSample } from '../scoring/types';
import { DEFAULT_LATENCY_OPTIONS, LatencyGap, LatencyOptions, LatencyResult } from './types';

const RUN_MIN_MS = 80;

export interface AnalyzeLatencyInput {
  user: UserSample[];
  target: GeneratedCurve;
  onset: OnsetResult;
  /** Personal reference start latency (ms); null while the baseline is still being built. */
  referenceMs: number | null;
  options?: Partial<LatencyOptions>;
}

interface Pause { start: number; end: number }

/**
 * Block-latency measures for one attempt (a practice metric, not a clinical one):
 *  - start latency: start cue → first sustained voicing
 *  - gaps: silences ≥ gapMs inside speech where the target expects voicing. Planned breath pauses between
 *    phrases and the short stop gaps (80–120 ms, always below gapMs) are never flagged.
 *
 * To tell planned pauses from blocks, both timelines are put on an "active time" axis with their silences removed
 * (the user's long silences, the target's planned pauses); a user silence that lands on a planned pause boundary is expected.
 */
export function analyzeLatency({ user, target, onset, referenceMs, options }: AnalyzeLatencyInput): LatencyResult {
  const opts = { ...DEFAULT_LATENCY_OPTIONS, ...options };
  const runs = voicedRuns(user, VOICE_ON, RUN_MIN_MS);
  if (!runs.length) return { startLatencyMs: null, gaps: [], hardOnset: false, hardOnsetAfterWait: false, longStart: false, flagged: false };

  const startLatencyMs = Math.max(0, Math.round(runs[0][0]));
  const longStart = referenceMs !== null && startLatencyMs - referenceMs >= opts.longStartMarginMs;

  // User silences between voiced runs.
  const rawGaps: { startMs: number; durationMs: number }[] = [];
  for (let i = 0; i + 1 < runs.length; i++) {
    const d = runs[i + 1][0] - runs[i][1];
    if (d >= opts.gapMs) rawGaps.push({ startMs: runs[i][1], durationMs: d });
  }

  const uStart = runs[0][0];
  const uEnd = runs[runs.length - 1][1];
  const userActive = uEnd - uStart - rawGaps.reduce((n, g) => n + g.durationMs, 0);

  // Target planned pauses (between breath groups) and the active-time axis without them.
  const pauses: Pause[] = [];
  for (let i = 0; i + 1 < target.chunks.length; i++) pauses.push({ start: target.chunks[i].endMs, end: target.chunks[i + 1].startMs });
  const tStart = target.chunks[0]?.startMs ?? target.voicedStartMs;
  const tEnd = target.chunks[target.chunks.length - 1]?.endMs ?? target.durationMs;
  const pauseTotal = pauses.reduce((n, p) => n + (p.end - p.start), 0);
  const targetActive = tEnd - tStart - pauseTotal;
  const boundaries: number[] = [];
  {
    let removed = 0;
    for (const p of pauses) {
      boundaries.push(p.start - tStart - removed);
      removed += p.end - p.start;
    }
  }
  const toTargetTime = (x: number) => {
    let t = tStart + x;
    for (const p of pauses) if (t >= p.start) t += p.end - p.start;
    return t;
  };

  const gaps: LatencyGap[] = [];
  if (userActive > 0 && targetActive > 0) {
    const scale = targetActive / userActive;
    const tolerance = Math.max(350, 0.08 * targetActive);
    let removed = 0;
    for (const g of rawGaps) {
      const xUser = g.startMs - uStart - removed;
      removed += g.durationMs;
      const x = xUser * scale;
      if (boundaries.some((b) => Math.abs(b - x) <= tolerance)) continue; // a planned breath pause
      const tMapped = toTargetTime(x);
      const syl = target.syllables.find((s) => tMapped >= s.startMs && tMapped < s.endMs) ?? target.syllables[target.syllables.length - 1];
      gaps.push({ startMs: Math.round(g.startMs), durationMs: Math.round(g.durationMs), word: syl ? target.words[syl.wordIndex]?.text : undefined });
    }
  }

  const hardOnset = onset.detected && onset.hard;
  return {
    startLatencyMs,
    gaps,
    hardOnset,
    hardOnsetAfterWait: hardOnset && longStart,
    longStart,
    flagged: longStart || gaps.length > 0,
  };
}
