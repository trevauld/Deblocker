import { median } from './reference';
import type { LatencyRecord } from './types';

const DAY = 86_400_000;

export interface WordStat {
  text: string;
  attempts: number;
  medianLatencyMs: number | null;
  longStartPct: number;
  longStarts: number;
  /** Medians for the last four weeks, oldest first (null = no attempts that week). */
  weekMedians: (number | null)[];
  trend: 'better' | 'worse' | 'steady' | null;
}

export const TREND_CHANGE_MS = 300;

const keyOf = (item: string) => item.trim().toLowerCase();

/** Per-word start-time stats, worst first (most long starts, then slowest median). */
export function wordStats(records: LatencyRecord[], now: number): WordStat[] {
  const groups = new Map<string, LatencyRecord[]>();
  for (const r of records) {
    if (r.category === 'free') continue;
    groups.set(keyOf(r.item), [...(groups.get(keyOf(r.item)) ?? []), r]);
  }
  const stats: WordStat[] = [];
  for (const [, rs] of groups) {
    const heard = rs.filter((r) => r.startLatencyMs !== null);
    const weekMedians: (number | null)[] = [];
    for (let w = 3; w >= 0; w--) {
      const from = now - (w + 1) * 7 * DAY;
      const to = now - w * 7 * DAY;
      weekMedians.push(median(heard.filter((r) => r.timestamp >= from && r.timestamp < to).map((r) => r.startLatencyMs as number)));
    }
    const recent = median(heard.filter((r) => r.timestamp >= now - 14 * DAY).map((r) => r.startLatencyMs as number));
    const earlier = median(heard.filter((r) => r.timestamp >= now - 28 * DAY && r.timestamp < now - 14 * DAY).map((r) => r.startLatencyMs as number));
    let trend: WordStat['trend'] = null;
    if (recent !== null && earlier !== null) trend = recent <= earlier - TREND_CHANGE_MS ? 'better' : recent >= earlier + TREND_CHANGE_MS ? 'worse' : 'steady';
    const longStarts = rs.filter((r) => r.longStart).length;
    stats.push({
      text: rs[rs.length - 1].item,
      attempts: rs.length,
      medianLatencyMs: median(heard.map((r) => r.startLatencyMs as number)),
      longStartPct: Math.round((100 * longStarts) / rs.length),
      longStarts,
      weekMedians,
      trend,
    });
  }
  return stats.sort((a, b) => b.longStartPct - a.longStartPct || (b.medianLatencyMs ?? 0) - (a.medianLatencyMs ?? 0));
}

/** Short items (≤ 4 words) with long starts, with their long-start counts: the pool for "revisit" drills. */
export function revisitCandidates(records: LatencyRecord[]): { text: string; weight: number }[] {
  const counts = new Map<string, { text: string; weight: number }>();
  for (const r of records) {
    if (!r.longStart || r.category === 'free' || r.category === 'sentence' || r.category === 'passage') continue;
    if (r.item.trim().split(/\s+/).length > 4) continue;
    const k = keyOf(r.item);
    const cur = counts.get(k);
    counts.set(k, { text: r.item, weight: (cur?.weight ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.weight - a.weight);
}
