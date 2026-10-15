import { describe, expect, it } from 'vitest';
import { generateCurve } from '../curve/generate';
import { settingsForPace } from '../curve/levelSettings';
import { analyzeOnset } from '../scoring/onset';
import { blocks, maxOf, synthVoice, testLookup } from '../testing';
import { analyzeLatency } from './analyze';
import { attemptsToCsv } from './csv';
import { BASELINE_DAYS, baselineBand, computeReference, weeklySummaries } from './reference';
import type { LatencyRecord } from './types';
import { observerAgreement } from './validation';
import { revisitCandidates, wordStats } from './words';

const curve = (text: string) => generateCurve(text, { lookup: testLookup, settings: settingsForPace(0) });
const analyze = (user: ReturnType<typeof synthVoice>, text: string, ref: number | null = 500) => {
  const target = curve(text);
  const onset = analyzeOnset(user, target.settings.onsetMs);
  return analyzeLatency({ user, target, onset, referenceMs: ref });
};

describe('start latency', () => {
  it('short wait then gentle onset: no flag', () => {
    const r = analyze(synthVoice({ startMs: 400, riseMs: 380, holdMs: 1200 }), 'banana');
    expect(r.startLatencyMs).toBeGreaterThan(400);
    expect(r.startLatencyMs).toBeLessThan(600);
    expect(r.longStart).toBe(false);
    expect(r.hardOnset).toBe(false);
    expect(r.gaps).toEqual([]);
    expect(r.flagged).toBe(false);
  });

  it('2 s wait then sudden onset: long start and hard onset', () => {
    const r = analyze(synthVoice({ startMs: 2000, riseMs: 20, holdMs: 1200 }), 'banana');
    expect(r.startLatencyMs).toBeGreaterThanOrEqual(2000);
    expect(r.longStart).toBe(true);
    expect(r.hardOnset).toBe(true);
    expect(r.hardOnsetAfterWait).toBe(true);
    expect(r.flagged).toBe(true);
  });

  it('uses the personal reference and margin (600 ms by default, configurable)', () => {
    const user = synthVoice({ startMs: 1000, riseMs: 380, holdMs: 1200 });
    const target = curve('banana');
    const onset = analyzeOnset(user, 400);
    expect(analyzeLatency({ user, target, onset, referenceMs: 500 }).longStart).toBe(false); // 1.0 s vs 0.5 s + 0.6 s
    expect(analyzeLatency({ user, target, onset, referenceMs: 300 }).longStart).toBe(true);
    expect(analyzeLatency({ user, target, onset, referenceMs: 500, options: { longStartMarginMs: 400 } }).longStart).toBe(true);
  });

  it('cannot call a long start without a reference yet', () => {
    expect(analyze(synthVoice({ startMs: 3000, riseMs: 380, holdMs: 1000 }), 'banana', null).longStart).toBe(false);
  });

  it('reports no latency when nothing was heard', () => {
    const r = analyze(blocks([], 3000), 'banana');
    expect(r.startLatencyMs).toBeNull();
    expect(r.flagged).toBe(false);
  });

  it('ignores noise-floor flicker and single-frame blips before the real start', () => {
    // Noise-floor flicker stays below the voicing threshold; one 16 ms blip above it is too short to count.
    const flicker = Array.from({ length: 201 }, (_, i) => ({ t: i * 16, level: 0.02 + (0.06 * ((i * 7919) % 13)) / 13 }));
    const blip = blocks([[320, 336, 0.6]], 3200);
    const real = synthVoice({ startMs: 1500, riseMs: 380, holdMs: 1000, totalMs: 3200 });
    const user = maxOf(flicker, blip, real);
    const r = analyze(user, 'banana', 1000);
    expect(r.startLatencyMs!).toBeGreaterThan(1500);
    expect(r.gaps).toEqual([]);
  });
});

describe('gaps', () => {
  const target = curve('banana');
  const speak = (parts: [number, number, number][]) => blocks(parts, 6000);

  it('flags a 600 ms silence inside a vowel', () => {
    const user = speak([[500, 1500, 0.8], [2100, 3400, 0.8]]);
    const onset = analyzeOnset(user, 400);
    const r = analyzeLatency({ user, target, onset, referenceMs: 500 });
    expect(r.gaps).toHaveLength(1);
    expect(r.gaps[0].durationMs).toBeGreaterThanOrEqual(580);
    expect(r.gaps[0].durationMs).toBeLessThanOrEqual(660);
    expect(r.gaps[0].word).toBe('banana');
    expect(r.flagged).toBe(true);
  });

  it('never flags a planned ~100 ms stop gap', () => {
    const user = speak([[500, 1500, 0.8], [1600, 3000, 0.8]]); // 100 ms dip
    expect(analyzeLatency({ user, target, onset: analyzeOnset(user, 400), referenceMs: 500 }).gaps).toEqual([]);
  });

  it('never flags the planned stop gaps of the target itself', () => {
    const t = curve('coffee please');
    const user = t.envelope.map((p) => ({ t: p.t + 300, level: p.level }));
    expect(analyzeLatency({ user, target: t, onset: analyzeOnset(user, 400), referenceMs: 500 }).gaps).toEqual([]);
  });

  it('does not flag the breath pauses between phrases', () => {
    const t = curve('I would like to go to the home and see you later today and we can see how you are');
    expect(t.chunks.length).toBeGreaterThan(2);
    const user = t.envelope.map((p) => ({ t: p.t + 400, level: p.level }));
    const r = analyzeLatency({ user, target: t, onset: analyzeOnset(user, 400), referenceMs: 500 });
    expect(r.gaps).toEqual([]);
  });

  it('does flag an extra silence in the middle of a phrase', () => {
    const t = curve('I would like to go to the home and see you later today and we can see how you are');
    const mid = (t.chunks[0].startMs + t.chunks[0].endMs) / 2;
    const user = t.envelope.map((p) => ({ t: p.t + 400 + (p.t > mid ? 900 : 0), level: p.level }));
    const filled: { t: number; level: number }[] = [];
    for (let i = 0; i < user.length; i++) {
      filled.push(user[i]);
      if (user[i + 1] && user[i + 1].t - user[i].t > 100) {
        filled.push({ t: user[i].t + 10, level: 0 });
        filled.push({ t: user[i + 1].t - 10, level: 0 });
      }
    }
    const r = analyzeLatency({ user: filled, target: t, onset: analyzeOnset(filled, 400), referenceMs: 500 });
    expect(r.gaps.length).toBe(1);
    expect(r.gaps[0].durationMs).toBeGreaterThan(800);
  });

  it('respects a configurable gap length', () => {
    const user = speak([[500, 1500, 0.8], [1800, 3000, 0.8]]); // 300 ms silence
    const onset = analyzeOnset(user, 400);
    expect(analyzeLatency({ user, target, onset, referenceMs: 500 }).gaps).toHaveLength(1);
    expect(analyzeLatency({ user, target, onset, referenceMs: 500, options: { gapMs: 400 } }).gaps).toHaveLength(0);
  });
});

const DAY = 86_400_000;
const rec = (over: Partial<LatencyRecord>): LatencyRecord => ({
  id: String(Math.random()), sessionId: 's', timestamp: 0, date: '2026-01-01', item: 'ago', category: 'vowels', stage: 'words', pace: 0,
  guidanceLevel: 1, startLatencyMs: 500, gaps: [], hardOnset: false, hardOnsetAfterWait: false, longStart: false, flagged: false, referenceMs: null, ...over,
});

describe('personal reference and trends', () => {
  const start = 1_000_000_000_000;
  const easy = (i: number, lat: number, day = 0) => rec({ timestamp: start + day * DAY + i * 1000, startLatencyMs: lat, category: i % 2 ? 'h-words' : 'vowels' });

  it('needs enough easy items, then uses their median', () => {
    const base = { startedAt: start };
    const few = Array.from({ length: 7 }, (_, i) => easy(i, 400 + i * 10));
    expect(computeReference(few, base, start + DAY).referenceMs).toBeNull();
    const enough = [...few, easy(8, 700)];
    const info = computeReference(enough, base, start + DAY);
    expect(info.referenceMs).toBe(Math.round((430 + 440) / 2));
    expect(info.locked).toBe(false);
  });

  it('ignores hard items, and stays fixed after the baseline window', () => {
    const base = { startedAt: start };
    const easyOnes = Array.from({ length: 10 }, (_, i) => easy(i, 500));
    const hard = [rec({ timestamp: start + 1000, category: 'stops', startLatencyMs: 3000 })];
    const later = Array.from({ length: 20 }, (_, i) => easy(i, 100, BASELINE_DAYS + 3));
    const info = computeReference([...easyOnes, ...hard, ...later], base, start + (BASELINE_DAYS + 5) * DAY);
    expect(info.referenceMs).toBe(500);
    expect(info.locked).toBe(true);
  });

  it('recalibrating starts a new window', () => {
    const old = Array.from({ length: 10 }, (_, i) => easy(i, 500));
    const base = { startedAt: start + 30 * DAY };
    expect(computeReference(old, base, start + 31 * DAY).referenceMs).toBeNull();
  });

  it('weekly medians and baseline band', () => {
    const base = { startedAt: start };
    const rs = [
      ...[400, 500, 600, 700].map((l, i) => easy(i, l, 0)),
      ...[500, 500, 600].map((l, i) => easy(i, l, 8)),
      ...[300, 350].map((l, i) => easy(i, l, 15)),
    ];
    const weeks = weeklySummaries(rs, base);
    expect(weeks.map((w) => [w.week, w.medianLatencyMs])).toEqual([[0, 550], [1, 500], [2, 325]]);
    const band = baselineBand(rs, base)!;
    expect(band[0]).toBeLessThan(band[1]);
    expect(band[0]).toBeGreaterThanOrEqual(400);
    expect(band[1]).toBeLessThanOrEqual(700);
    expect(weeklySummaries(rs, null)).toEqual([]);
  });
});

describe('per-word stats', () => {
  const now = 2_000_000_000_000;
  it('sorts worst first and reports a trend', () => {
    const rs = [
      rec({ item: 'ticket', timestamp: now - 20 * DAY, startLatencyMs: 2500, longStart: true }),
      rec({ item: 'ticket', timestamp: now - 18 * DAY, startLatencyMs: 2300, longStart: true }),
      rec({ item: 'ticket', timestamp: now - 3 * DAY, startLatencyMs: 1200, longStart: false }),
      rec({ item: 'Ticket', timestamp: now - 2 * DAY, startLatencyMs: 1000, longStart: false }),
      rec({ item: 'ago', timestamp: now - DAY, startLatencyMs: 400 }),
      rec({ item: 'ago', timestamp: now - 2 * DAY, startLatencyMs: 450 }),
    ];
    const s = wordStats(rs, now);
    expect(s.map((w) => w.text)).toEqual(['Ticket', 'ago']);
    expect(s[0].attempts).toBe(4);
    expect(s[0].longStartPct).toBe(50);
    expect(s[0].trend).toBe('better');
    expect(s[0].weekMedians).toHaveLength(4);
    expect(s[1].trend).toBeNull();
  });

  it('offers words with long starts for revisiting, most first', () => {
    const rs = [
      rec({ item: 'ticket', longStart: true }), rec({ item: 'ticket', longStart: true }), rec({ item: 'coffee', longStart: true }),
      rec({ item: 'ago', longStart: false }), rec({ item: 'a very long sentence that has many words in it', category: 'sentence', longStart: true }),
    ];
    expect(revisitCandidates(rs).map((c) => [c.text, c.weight])).toEqual([['ticket', 2], ['coffee', 1]]);
  });
});

describe('observer agreement and CSV', () => {
  it('computes percent agreement and Cohen\'s kappa', () => {
    const mk = (flagged: boolean, taps: number[]) => rec({ flagged, observerTaps: taps });
    const rs = [
      ...Array.from({ length: 4 }, () => mk(true, [1000])),
      ...Array.from({ length: 1 }, () => mk(true, [])),
      ...Array.from({ length: 1 }, () => mk(false, [500])),
      ...Array.from({ length: 4 }, () => mk(false, [])),
    ];
    const a = observerAgreement(rs)!;
    expect(a).toMatchObject({ n: 10, both: 4, appOnly: 1, observerOnly: 1, neither: 4, agreementPct: 80 });
    expect(a.kappa).toBeCloseTo(0.6, 2);
  });

  it('ignores attempts without observer mode and handles degenerate kappa', () => {
    expect(observerAgreement([rec({})])).toBeNull();
    expect(observerAgreement([rec({ flagged: false, observerTaps: [] }), rec({ flagged: false, observerTaps: [] })])!.kappa).toBeNull();
  });

  it('exports numbers as CSV and neutralises formula-like text', () => {
    const csv = attemptsToCsv([
      rec({ item: '=SUM(A1)', startLatencyMs: 812, gaps: [{ startMs: 1, durationMs: 700 }], flagged: true, selfReportBlocked: true }),
      rec({ item: 'say "hi", ok' }),
    ]);
    const lines = csv.trim().split('\n');
    expect(lines[0].startsWith('timestamp,date,item')).toBe(true);
    expect(lines[1]).toContain("'=SUM(A1)");
    expect(lines[1]).toContain(',812,');
    expect(lines[2]).toContain('"say ""hi"", ok"');
    expect(csv).not.toMatch(/audio/i);
  });
});
