import type { LatencyRecord } from './types';

export const BASELINE_DAYS = 14;
export const MIN_EASY_FOR_REFERENCE = 8;
/** Easy items: the vowel and h-word drills. */
export const EASY_CATEGORIES = ['vowels', 'h-words'];
const DAY = 86_400_000;

export interface LatencyBaseline {
  /** Epoch ms when the baseline window started (set by the first tracked attempt, or "recalibrate"). */
  startedAt: number;
}

export interface ReferenceInfo {
  /** Median start latency on easy items during the baseline window; null until enough easy items exist. */
  referenceMs: number | null;
  /** True once the baseline window has ended: the reference is fixed from then on. */
  locked: boolean;
  endsAt: number | null;
  easyCount: number;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function quantile(xs: number[], q: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export function inBaselineWindow(r: LatencyRecord, baseline: LatencyBaseline): boolean {
  return r.timestamp >= baseline.startedAt && r.timestamp < baseline.startedAt + BASELINE_DAYS * DAY;
}

/**
 * Personal reference = median start latency on easy items during the baseline weeks. Records outside the window are ignored,
 * so once the window ends the value stays the same (trends stay comparable). Recalibrating = starting a new baseline window.
 */
export function computeReference(records: LatencyRecord[], baseline: LatencyBaseline | null, now: number): ReferenceInfo {
  if (!baseline) return { referenceMs: null, locked: false, endsAt: null, easyCount: 0 };
  const easy = records
    .filter((r) => EASY_CATEGORIES.includes(r.category) && r.startLatencyMs !== null && inBaselineWindow(r, baseline))
    .map((r) => r.startLatencyMs as number);
  const endsAt = baseline.startedAt + BASELINE_DAYS * DAY;
  return {
    referenceMs: easy.length >= MIN_EASY_FOR_REFERENCE ? Math.round(median(easy) as number) : null,
    locked: now >= endsAt,
    endsAt,
    easyCount: easy.length,
  };
}

export interface WeekSummary {
  /** 0 = the baseline's first week. */
  week: number;
  startsAt: number;
  n: number;
  medianLatencyMs: number | null;
  longStartPct: number;
}

/** Weekly medians counted from the baseline start (so weeks 0–1 are the baseline). */
export function weeklySummaries(records: LatencyRecord[], baseline: LatencyBaseline | null): WeekSummary[] {
  if (!baseline) return [];
  const byWeek = new Map<number, LatencyRecord[]>();
  for (const r of records) {
    if (r.startLatencyMs === null || r.timestamp < baseline.startedAt) continue;
    const w = Math.floor((r.timestamp - baseline.startedAt) / (7 * DAY));
    byWeek.set(w, [...(byWeek.get(w) ?? []), r]);
  }
  return [...byWeek.keys()]
    .sort((a, b) => a - b)
    .map((w) => {
      const rs = byWeek.get(w)!;
      return {
        week: w,
        startsAt: baseline.startedAt + w * 7 * DAY,
        n: rs.length,
        medianLatencyMs: median(rs.map((r) => r.startLatencyMs as number)),
        longStartPct: Math.round((100 * rs.filter((r) => r.longStart).length) / rs.length),
      };
    });
}

/** Interquartile range of all start latencies inside the baseline window. */
export function baselineBand(records: LatencyRecord[], baseline: LatencyBaseline | null): [number, number] | null {
  if (!baseline) return null;
  const xs = records.filter((r) => r.startLatencyMs !== null && inBaselineWindow(r, baseline)).map((r) => r.startLatencyMs as number);
  if (xs.length < 4) return null;
  return [quantile(xs, 0.25) as number, quantile(xs, 0.75) as number];
}
