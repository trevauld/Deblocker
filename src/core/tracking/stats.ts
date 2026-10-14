import type { GuidanceLevel } from '../guidance/fading';
import { AttemptRecord, CheckIn, Progress, SessionRecord, Stage, STAGES } from './types';

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function localDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function summarizeSession(args: {
  id: string;
  startedAt: number;
  stage: Stage;
  guidanceLevel: GuidanceLevel;
  pace: number;
  attempts: AttemptRecord[];
}): SessionRecord {
  const heard = args.attempts.filter((a) => a.heard);
  const spans = heard.flatMap((a) => a.spansMs);
  return {
    id: args.id,
    startedAt: args.startedAt,
    date: localDate(args.startedAt),
    stage: args.stage,
    guidanceLevel: args.guidanceLevel,
    pace: args.pace,
    attempts: args.attempts.length,
    easyOnsetPct: args.attempts.length ? Math.round((100 * args.attempts.filter((a) => a.easyOnset).length) / args.attempts.length) : 0,
    avgTempoRatio: Math.round(mean(heard.map((a) => a.tempoRatio).filter((r) => r > 0)) * 100) / 100,
    avgPhraseMs: Math.round(mean(spans)),
    avgScore: Math.round(mean(args.attempts.map((a) => a.total))),
  };
}

export const SESSIONS_TO_ADVANCE_STAGE = 3;
export const STAGE_ADVANCE_EASY_PCT = 75;

/**
 * Update day-to-day progression after a finished session:
 * tempo/onset pace drifts toward advanced when the learner is succeeding without rushing, and backs off when struggling;
 * the stage (words → sentences → reading passages → free speech) advances after a few consistently good sessions.
 */
export function advanceProgress(progress: Progress, finished: SessionRecord, history: SessionRecord[]): Progress {
  let pace = progress.pace;
  if (finished.attempts >= 4) {
    if (finished.easyOnsetPct >= 80 && finished.avgTempoRatio >= 0.9) pace += 0.05;
    else if (finished.easyOnsetPct < 50) pace -= 0.05;
  }
  pace = Math.round(Math.min(1, Math.max(0, pace)) * 100) / 100;

  let { stage, sessionsInStage } = progress;
  sessionsInStage += 1;
  const lastN = [...history.filter((s) => s.stage === stage), finished].slice(-SESSIONS_TO_ADVANCE_STAGE);
  const idx = STAGES.indexOf(stage);
  if (
    sessionsInStage >= SESSIONS_TO_ADVANCE_STAGE &&
    lastN.length >= SESSIONS_TO_ADVANCE_STAGE &&
    mean(lastN.map((s) => s.easyOnsetPct)) >= STAGE_ADVANCE_EASY_PCT &&
    idx < STAGES.length - 1
  ) {
    stage = STAGES[idx + 1];
    sessionsInStage = 0;
  }
  return { stage, pace, sessionsInStage };
}

export interface Insight {
  factor: 'sleep' | 'energy' | 'stress';
  text: string;
}

/** Compare easy-onset rates on low vs high days for each check-in factor (needs a few sessions on each side). */
export function triggerInsights(sessions: SessionRecord[], checkins: CheckIn[], minPerGroup = 2, minDiff = 10): Insight[] {
  const byDate = new Map(checkins.map((c) => [c.date, c]));
  const joined = sessions.flatMap((s) => {
    const c = byDate.get(s.date);
    return c ? [{ s, c }] : [];
  });
  const out: Insight[] = [];
  const factors: { f: Insight['factor']; low: (v: number) => boolean; high: (v: number) => boolean; lowLabel: string; highLabel: string }[] = [
    { f: 'sleep', low: (v) => v <= 2, high: (v) => v >= 4, lowLabel: 'after poor sleep', highLabel: 'after good sleep' },
    { f: 'energy', low: (v) => v <= 2, high: (v) => v >= 4, lowLabel: 'on low-energy days', highLabel: 'on high-energy days' },
    { f: 'stress', low: (v) => v >= 4, high: (v) => v <= 2, lowLabel: 'on high-stress days', highLabel: 'on calm days' },
  ];
  for (const { f, low, high, lowLabel, highLabel } of factors) {
    const lo = joined.filter((j) => low(j.c[f])).map((j) => j.s.easyOnsetPct);
    const hi = joined.filter((j) => high(j.c[f])).map((j) => j.s.easyOnsetPct);
    if (lo.length >= minPerGroup && hi.length >= minPerGroup) {
      const diff = Math.round(mean(hi) - mean(lo));
      if (Math.abs(diff) >= minDiff) {
        out.push({
          factor: f,
          text:
            diff > 0
              ? `Your easy-onset rate averaged ${Math.round(mean(lo))}% ${lowLabel} vs ${Math.round(mean(hi))}% ${highLabel}.`
              : `Your easy-onset rate was actually higher ${lowLabel} (${Math.round(mean(lo))}%) than ${highLabel} (${Math.round(mean(hi))}%).`,
        });
      }
    }
  }
  return out;
}
