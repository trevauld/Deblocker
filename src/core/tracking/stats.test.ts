import { describe, expect, it } from 'vitest';
import { advanceProgress, summarizeSession, triggerInsights } from './stats';
import type { AttemptRecord, CheckIn, Progress, SessionRecord } from './types';

const att = (easy: boolean, ratio = 1.1, spans = [3000]): AttemptRecord => ({ text: 'x', total: easy ? 85 : 50, easyOnset: easy, tempoRatio: ratio, spansMs: spans, heard: true });

const session = (over: Partial<SessionRecord> = {}): SessionRecord => ({
  id: 'a', startedAt: 0, date: '2026-01-01', stage: 'words', guidanceLevel: 1, pace: 0, attempts: 10,
  easyOnsetPct: 80, avgTempoRatio: 1.1, avgPhraseMs: 3000, avgScore: 80, ...over,
});

describe('summarizeSession', () => {
  it('aggregates easy-onset %, tempo, phrase length and score', () => {
    const s = summarizeSession({
      id: 's1', startedAt: new Date(2026, 0, 5, 9).getTime(), stage: 'words', guidanceLevel: 2, pace: 0.2,
      attempts: [att(true, 1.0, [2000, 4000]), att(true, 1.2), att(false, 0.8, [1000]), att(true, 1.0)],
    });
    expect(s.date).toBe('2026-01-05');
    expect(s.easyOnsetPct).toBe(75);
    expect(s.avgTempoRatio).toBeCloseTo(1.0, 1);
    expect(s.avgPhraseMs).toBe(2600);
    expect(s.attempts).toBe(4);
  });
});

describe('advanceProgress', () => {
  const start: Progress = { stage: 'words', pace: 0.1, sessionsInStage: 0 };

  it('moves pace toward advanced on good sessions and back on poor ones', () => {
    expect(advanceProgress(start, session(), []).pace).toBeCloseTo(0.15);
    expect(advanceProgress(start, session({ easyOnsetPct: 30 }), []).pace).toBeCloseTo(0.05);
    expect(advanceProgress(start, session({ avgTempoRatio: 0.7 }), []).pace).toBeCloseTo(0.1);
  });

  it('advances stage after three consistently good sessions', () => {
    let p = start;
    const hist: SessionRecord[] = [];
    for (let i = 0; i < 3; i++) {
      const s = session({ id: String(i) });
      p = advanceProgress(p, s, hist);
      hist.push(s);
    }
    expect(p.stage).toBe('sentences');
    expect(p.sessionsInStage).toBe(0);
  });

  it('stays in the stage if onset is not reliable yet', () => {
    let p = start;
    const hist: SessionRecord[] = [];
    for (let i = 0; i < 4; i++) {
      const s = session({ id: String(i), easyOnsetPct: 60 });
      p = advanceProgress(p, s, hist);
      hist.push(s);
    }
    expect(p.stage).toBe('words');
  });
});

describe('triggerInsights', () => {
  it('reveals when poor sleep goes with harder onsets', () => {
    const sessions = [
      session({ date: '2026-01-01', easyOnsetPct: 55 }),
      session({ date: '2026-01-02', easyOnsetPct: 60 }),
      session({ date: '2026-01-03', easyOnsetPct: 85 }),
      session({ date: '2026-01-04', easyOnsetPct: 90 }),
    ];
    const checkins: CheckIn[] = [
      { date: '2026-01-01', sleep: 1, energy: 3, stress: 3 },
      { date: '2026-01-02', sleep: 2, energy: 3, stress: 3 },
      { date: '2026-01-03', sleep: 5, energy: 3, stress: 3 },
      { date: '2026-01-04', sleep: 4, energy: 3, stress: 3 },
    ];
    const ins = triggerInsights(sessions, checkins);
    expect(ins).toHaveLength(1);
    expect(ins[0].factor).toBe('sleep');
    expect(ins[0].text).toMatch(/poor sleep/);
  });

  it('says nothing without enough data', () => {
    expect(triggerInsights([session()], [{ date: '2026-01-01', sleep: 1, energy: 1, stress: 5 }])).toEqual([]);
  });
});
