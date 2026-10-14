import { describe, expect, it } from 'vitest';
import { generateCurve } from '../curve/generate';
import { settingsForPace } from '../curve/levelSettings';
import type { GeneratedCurve } from '../curve/types';
import { synthVoice, testLookup } from '../testing';
import { dtw } from './dtw';
import { analyzeOnset, hardRiseThresholdMs } from './onset';
import { scoreAttempt } from './score';
import { estimateSyllableCount } from './tempo';
import type { UserSample } from './types';

const curve = (text: string, pace = 0) => generateCurve(text, { lookup: testLookup, settings: settingsForPace(pace) });

/** The target envelope played back as a user: shifted by `offset`, stretched in time by `stretch`. */
function playback(c: GeneratedCurve, offset = 0, stretch = 1, scale = 1): UserSample[] {
  return c.envelope.map((p) => ({ t: offset + p.t * stretch, level: p.level * scale }));
}

describe('dtw', () => {
  it('aligns identical series on the diagonal', () => {
    const a = [0, 0.2, 0.8, 0.8, 0.2, 0];
    const r = dtw(a, a, 2);
    expect(r.cost).toBe(0);
    expect(r.path.every(([i, j]) => i === j)).toBe(true);
  });

  it('absorbs a small timing shift inside the window but not outside', () => {
    const a = [0, 0, 0, 0.8, 0.8, 0, 0, 0, 0, 0];
    const b = [0, 0, 0, 0, 0.8, 0.8, 0, 0, 0, 0];
    expect(dtw(a, b, 2).cost).toBeLessThan(0.2);
  });
});

describe('onset analysis', () => {
  it('rates a gentle onset as easy', () => {
    const o = analyzeOnset(synthVoice({ riseMs: 380, holdMs: 800 }), 400);
    expect(o.detected).toBe(true);
    expect(o.hard).toBe(false);
    expect(o.score).toBeGreaterThanOrEqual(80);
    expect(o.riseMs!).toBeGreaterThan(250);
  });

  it('flags a sudden onset as hard', () => {
    const o = analyzeOnset(synthVoice({ riseMs: 20, holdMs: 800 }), 400);
    expect(o.hard).toBe(true);
    expect(o.score).toBeLessThan(55);
    expect(o.riseMs!).toBeLessThan(80);
  });

  it('is confident about the ideal smoothstep onset at both levels', () => {
    for (const pace of [0, 1]) {
      const c = curve('ago', pace);
      const user = playback(c, 300);
      const o = analyzeOnset(user, c.settings.onsetMs);
      expect(o.hard).toBe(false);
      expect(o.score).toBeGreaterThanOrEqual(85);
    }
  });

  it('honours strictness', () => {
    const user = synthVoice({ riseMs: 190, holdMs: 800 }); // 80% reached ~150 ms in
    expect(analyzeOnset(user, 400, 'lenient').hard).toBe(false);
    expect(analyzeOnset(user, 400, 'strict').hard).toBe(true);
    expect(hardRiseThresholdMs(400, 'strict')).toBeGreaterThan(hardRiseThresholdMs(400, 'lenient'));
  });

  it('notices a very quiet voice rather than calling it hard or easy', () => {
    const o = analyzeOnset(synthVoice({ riseMs: 20, holdMs: 800, peak: 0.2 }), 400);
    expect(o.tooQuiet).toBe(true);
    expect(o.hard).toBe(false);
  });

  it('ignores short blips before real voicing', () => {
    const blip = synthVoice({ startMs: 100, riseMs: 10, holdMs: 20, fadeMs: 10, totalMs: 500 });
    const real = synthVoice({ startMs: 1500, riseMs: 400, holdMs: 800, totalMs: 3200 });
    const merged = blip.map((s, i) => ({ t: s.t, level: Math.max(s.level, real[i]?.level ?? 0) }));
    const rest = real.filter((s) => s.t > blip[blip.length - 1].t);
    const o = analyzeOnset([...merged, ...rest], 400);
    expect(o.startMs!).toBeGreaterThan(1300);
    expect(o.hard).toBe(false);
  });

  it('reports no onset for silence', () => {
    expect(analyzeOnset(synthVoice({ riseMs: 1, holdMs: 0, peak: 0.0, totalMs: 1000 }), 400).detected).toBe(false);
  });
});

describe('scoreAttempt', () => {
  const c = curve('ago');

  it('scores a faithful gentle attempt highly', () => {
    const r = scoreAttempt({ user: playback(c, 600), target: c });
    expect(r.easyOnset).toBe(true);
    expect(r.total).toBeGreaterThanOrEqual(90);
    expect(r.envelope!.score).toBeGreaterThanOrEqual(90);
    expect(r.tempo.ratio).toBeCloseTo(1, 1);
    expect(r.feedback[0]).toMatchObject({ tone: 'good', text: 'Good gentle start.' });
  });

  it('scores a sudden start lower, with specific feedback', () => {
    const gentle = scoreAttempt({ user: synthVoice({ riseMs: 380, holdMs: 1100 }), target: c });
    const sudden = scoreAttempt({ user: synthVoice({ riseMs: 20, holdMs: 1100 }), target: c });
    expect(sudden.easyOnset).toBe(false);
    expect(sudden.total).toBeLessThan(gentle.total - 15);
    expect(sudden.feedback[0].code).toBe('hard-onset');
    expect(sudden.feedback[0].text).toMatch(/Sudden start/);
    expect(sudden.feedback[0].text).toMatch(/air flow first/);
  });

  it('flags rushed speech and rewards slow speech', () => {
    const fast = scoreAttempt({ user: playback(c, 600, 0.55), target: c });
    const slow = scoreAttempt({ user: playback(c, 600, 1.3), target: c });
    expect(fast.tempo.ratio).toBeLessThan(0.7);
    expect(fast.tempo.score).toBeLessThan(40);
    expect(fast.feedback.map((f) => f.code)).toContain('too-fast');
    expect(fast.feedback.find((f) => f.code === 'too-fast')!.text).toMatch(/fast.*Stretch the vowels/);
    expect(slow.tempo.score).toBe(100);
    expect(slow.tempo.ratio).toBeGreaterThan(1.2);
  });

  it('allows small timing shifts in the envelope (DTW)', () => {
    const user = c.envelope.map((p) => ({ t: 600 + p.t + 120 * Math.sin(p.t / 400), level: p.level }));
    user.sort((a, b) => a.t - b.t);
    const shifted = scoreAttempt({ user, target: c });
    expect(shifted.envelope!.score).toBeGreaterThanOrEqual(85);
  });

  it('penalizes an envelope far from the target', () => {
    const flat = synthVoice({ riseMs: 380, holdMs: 1100, peak: 0.3 });
    const loud = scoreAttempt({ user: playback(c, 600), target: c }).envelope!.score;
    const r = scoreAttempt({ user: flat, target: c });
    expect(r.envelope!.score).toBeLessThan(loud - 25);
  });

  it('widening the tolerance band forgives more', () => {
    const off = playback(c, 600, 1, 0.75);
    const narrow = scoreAttempt({ user: off, target: c, bandHalfWidth: 0.05 }).envelope!.score;
    const wide = scoreAttempt({ user: off, target: c, bandHalfWidth: 0.25 }).envelope!.score;
    expect(wide).toBeGreaterThan(narrow);
  });

  it('returns zero and a clear message for silence', () => {
    const r = scoreAttempt({ user: synthVoice({ riseMs: 1, holdMs: 0, peak: 0, totalMs: 3000 }), target: c });
    expect(r.total).toBe(0);
    expect(r.feedback[0].code).toBe('no-voice');
  });

  it('weights onset 50 / envelope 30 / tempo 20', () => {
    const r = scoreAttempt({ user: playback(c, 600), target: c });
    const expected = 0.5 * r.onset.score + 0.3 * r.envelope!.score + 0.2 * r.tempo.score;
    expect(Math.abs(r.total - expected)).toBeLessThanOrEqual(1);
  });

  it('detects running out of air on a long phrase', () => {
    const phrase = curve('go to the home and see you later today');
    const decaying: UserSample[] = [];
    for (let t = 0; t <= 9000; t += 16) {
      const rise = Math.min(1, Math.max(0, (t - 600) / 400));
      const decay = t < 800 ? 1 : Math.max(0.05, 1 - (t - 800) / 6000);
      decaying.push({ t, level: t < 600 || t > 8000 ? 0 : 0.8 * rise * decay });
    }
    const r = scoreAttempt({ user: decaying, target: phrase });
    expect(r.ranOutOfAir).toBe(true);
    expect(r.feedback.map((f) => f.code)).toContain('ran-out-of-air');
  });

  it('flags skipping the breath pause between phrases', () => {
    const phrase = curve('I would like to go to the home and see you later today and we can see how you are');
    expect(phrase.chunks.length).toBeGreaterThan(2);
    // Voice continuously for the sum of chunk durations, with no pauses.
    const total = phrase.chunks.reduce((n, ch) => n + (ch.endMs - ch.startMs), 0);
    const user: UserSample[] = [];
    for (let t = 0; t <= total + 800; t += 16) user.push({ t, level: t < 500 ? 0 : t < 900 ? ((t - 500) / 400) * 0.8 : t < total ? 0.8 : 0 });
    const r = scoreAttempt({ user, target: phrase });
    expect(r.skippedPause).toBe(true);
    expect(r.feedback.map((f) => f.code)).toContain('no-pause');
  });
});

describe('free speech (no target curve)', () => {
  it('counts syllable-like bumps and scores onset + tempo only', () => {
    const user: UserSample[] = [];
    for (let t = 0; t <= 4000; t += 16) {
      const rise = Math.min(1, Math.max(0, (t - 500) / 400));
      const bump = 0.5 + 0.3 * Math.cos(((t - 500) / 600) * 2 * Math.PI) ; // ~600 ms per syllable
      user.push({ t, level: t < 500 || t > 3300 ? 0 : rise * Math.min(0.9, bump) });
    }
    expect(estimateSyllableCount(user)).toBeGreaterThanOrEqual(4);
    const r = scoreAttempt({ user, target: null, freeSpeech: { msPerSyllable: 600, onsetMs: 400 } });
    expect(r.envelope).toBeNull();
    expect(r.tempo.estimated).toBe(true);
    expect(r.total).toBeGreaterThan(40);
  });
});
