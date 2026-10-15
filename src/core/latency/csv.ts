import type { LatencyRecord } from './types';

export const CSV_COLUMNS = [
  'timestamp', 'date', 'item', 'category', 'stage', 'pace', 'guidance_level', 'start_latency_ms', 'reference_ms',
  'gap_count', 'gap_total_ms', 'long_start', 'hard_onset', 'hard_onset_after_wait', 'flagged', 'self_report_blocked', 'observer_taps',
] as const;

/** Quote a field; a leading = + - @ is neutralised so spreadsheets never run it as a formula. */
function field(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && typeof v === 'string') s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const bool = (b: boolean | undefined) => (b === undefined ? '' : b ? 1 : 0);

/** One row per attempt, numbers and text only (no audio exists to export). */
export function attemptsToCsv(records: LatencyRecord[]): string {
  const rows = records.map((r) => [
    new Date(r.timestamp).toISOString(), r.date, r.item, r.category, r.stage, r.pace, r.guidanceLevel, r.startLatencyMs, r.referenceMs,
    r.gaps.length, r.gaps.reduce((n, g) => n + g.durationMs, 0), bool(r.longStart), bool(r.hardOnset), bool(r.hardOnsetAfterWait), bool(r.flagged),
    bool(r.selfReportBlocked), r.observerTaps ? r.observerTaps.length : '',
  ]);
  return [CSV_COLUMNS.join(','), ...rows.map((row) => row.map(field).join(','))].join('\n') + '\n';
}
