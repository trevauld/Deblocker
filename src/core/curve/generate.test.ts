import { describe, expect, it } from 'vitest';
import { testLookup } from '../testing';
import { FINAL_FADE_MS, generateCurve, generateSustained, LEAD_IN_MS, LEVELS, levelAt } from './generate';
import { settingsForPace } from './levelSettings';
import { chunkWords } from './phrasing';

const beginner = settingsForPace(0);
const advanced = settingsForPace(1);
const gen = (text: string, pace = 0) => generateCurve(text, { lookup: testLookup, settings: settingsForPace(pace) });

function firstTimeAtOrAbove(c: { envelope: { t: number; level: number }[] }, level: number, from = 0) {
  return c.envelope.find((p) => p.t >= from && p.level >= level)?.t;
}
function maxStep(env: { t: number; level: number }[], fromT: number, toT: number) {
  let m = 0;
  for (let i = 1; i < env.length; i++) {
    if (env[i].t >= fromT && env[i].t <= toT) m = Math.max(m, Math.abs(env[i].level - env[i - 1].level));
  }
  return m;
}

describe('settings', () => {
  it('goes from beginner to advanced', () => {
    expect(beginner).toMatchObject({ msPerSyllable: 600, onsetMs: 400 });
    expect(advanced).toMatchObject({ msPerSyllable: 300, onsetMs: 200 });
    expect(advanced.pauseMs).toBeLessThan(beginner.pauseMs);
  });
});

describe('generateCurve – onset', () => {
  it('begins with a silent air lead-in, a breath marker, then a gradual ramp (never a step)', () => {
    const c = gen('ago');
    expect(c.markers[0]).toMatchObject({ t: 0, type: 'breath' });
    expect(c.envelope[0].level).toBe(0);
    expect(levelAt(c, LEAD_IN_MS)).toBe(0);
    // Largest 10 ms jump anywhere in the onset ramp is tiny: a smooth ramp, not a step.
    expect(maxStep(c.envelope, LEAD_IN_MS, LEAD_IN_MS + beginner.onsetMs)).toBeLessThan(0.05);
  });

  it('ramps over ~400 ms at beginner level and ~200 ms at advanced level', () => {
    const b = gen('ah', 0);
    const a = gen('ah', 1);
    const rise = (c: typeof b) => firstTimeAtOrAbove(c, LEVELS.vowel - 0.01)! - LEAD_IN_MS;
    expect(rise(b)).toBeGreaterThanOrEqual(380);
    expect(rise(b)).toBeLessThanOrEqual(430);
    expect(rise(a)).toBeGreaterThanOrEqual(180);
    expect(rise(a)).toBeLessThanOrEqual(230);
  });

  it('gives h-initial words an extra-gentle rise', () => {
    const hello = gen('hello');
    const ago = gen('ago');
    const timeTo = (c: typeof hello, lvl: number) => firstTimeAtOrAbove(c, lvl)! - LEAD_IN_MS;
    expect(timeTo(hello, 0.7)).toBeGreaterThan(timeTo(ago, 0.7) * 1.2);
    // The breathy h stage stays low.
    const early = hello.envelope.filter((p) => p.t > LEAD_IN_MS && p.t < LEAD_IN_MS + 150);
    expect(Math.max(...early.map((p) => p.level))).toBeLessThanOrEqual(0.25);
  });

  it('starts consonant-initial words smoothly too', () => {
    for (const w of ['man', 'sun', 'zoo', 'top', 'pot']) {
      const c = gen(w);
      expect(maxStep(c.envelope, LEAD_IN_MS, LEAD_IN_MS + beginner.onsetMs)).toBeLessThan(0.06);
    }
  });
});

describe('generateCurve – phoneme classes', () => {
  it('holds a long vowel plateau around 0.8', () => {
    const c = gen('ah');
    const plateau = c.envelope.filter((p) => p.level >= 0.79);
    expect(plateau.length * 10).toBeGreaterThanOrEqual(200);
    expect(Math.max(...c.envelope.map((p) => p.level))).toBeCloseTo(LEVELS.vowel, 2);
  });

  it('dips to ~0.55 for sonorants and ~0.45 for voiced fricatives between vowels', () => {
    const lows = (w: string, lvl: number) => gen(w).envelope.some((p) => p.t > LEAD_IN_MS + 600 && Math.abs(p.level - lvl) < 0.01);
    expect(lows('banana', LEVELS.sonorant)).toBe(true); // n
    // voiced fricative: "a zoo" → z between vowels
    const c = gen('go zoo');
    const z = c.syllables[1];
    const mid = c.envelope.filter((p) => p.t >= z.startMs && p.t <= z.startMs + 300).map((p) => p.level);
    expect(mid.some((l) => Math.abs(l - LEVELS.voicedFricative) < 0.01)).toBe(true);
  });

  it('keeps voiceless fricatives and h low and breathy', () => {
    const c = gen('go sun');
    const s = c.syllables[1];
    const seg = c.envelope.filter((p) => p.t >= s.startMs && p.t <= s.startMs + 200).map((p) => p.level);
    expect(Math.min(...seg)).toBeGreaterThanOrEqual(0.15);
    expect(Math.min(...seg)).toBeLessThanOrEqual(0.25);
  });

  it('puts a short soft gap near 0.05 at a stop, then a soft re-rise of ~150 ms', () => {
    const c = gen('happy'); // p between vowels
    const env = c.envelope;
    const inGap = env.filter((p) => p.t > LEAD_IN_MS + 700 && p.t < c.chunks[0].endMs - FINAL_FADE_MS && p.level <= 0.055);
    expect(inGap.length).toBeGreaterThan(0);
    const gapMs = inGap.length * 10;
    expect(gapMs).toBeGreaterThanOrEqual(40);
    expect(gapMs).toBeLessThanOrEqual(130);
    // Re-rise from the gap to the vowel plateau takes about 150 ms and is smooth.
    const gapEnd = inGap[inGap.length - 1].t;
    const reach = env.find((p) => p.t > gapEnd && p.level >= 0.79)!.t;
    expect(reach - gapEnd).toBeGreaterThan(100);
    expect(reach - gapEnd).toBeLessThan(220);
  });

  it('does not add a gap for stops at the very start or end of a breath group', () => {
    const c = gen('top');
    const voiced = c.envelope.filter((p) => p.t > LEAD_IN_MS && p.t < c.durationMs - FINAL_FADE_MS - 20);
    // Between onset and the start of the fade the curve never dips down to stop level.
    const afterRamp = voiced.filter((p) => p.t > LEAD_IN_MS + 450);
    expect(Math.min(...afterRamp.map((p) => p.level))).toBeGreaterThan(0.5);
  });

  it('connects syllables smoothly without big jumps (outside stop gaps)', () => {
    const c = gen('banana');
    expect(maxStep(c.envelope, LEAD_IN_MS, c.durationMs)).toBeLessThan(0.1);
  });

  it('lengthens stressed syllables slightly', () => {
    const c = gen('banana');
    const dur = c.syllables.map((s) => s.endMs - s.startMs);
    expect(dur[1]).toBeGreaterThan(dur[0]);
  });
});

describe('generateCurve – ending', () => {
  it('ends with a soft ~250 ms fade to silence with no clipped end', () => {
    const c = gen('banana');
    const end = c.durationMs;
    expect(levelAt(c, end)).toBe(0);
    const tail = c.envelope.filter((p) => p.t >= end - FINAL_FADE_MS);
    for (let i = 1; i < tail.length; i++) expect(tail[i].level).toBeLessThanOrEqual(tail[i - 1].level + 1e-9);
    expect(tail[0].level).toBeGreaterThan(0.5);
    expect(maxStep(tail, 0, end)).toBeLessThan(0.06);
  });
});

describe('generateCurve – tempo', () => {
  it('scales syllable duration with the tempo setting', () => {
    const slow = generateCurve('banana', { lookup: testLookup, settings: { ...beginner, msPerSyllable: 600 } });
    const fast = generateCurve('banana', { lookup: testLookup, settings: { ...beginner, msPerSyllable: 300 } });
    expect(slow.durationMs).toBeGreaterThan(fast.durationMs);
    const per = (c: typeof slow) => (c.chunks[0].endMs - FINAL_FADE_MS - c.chunks[0].startMs) / 3;
    expect(per(slow)).toBeGreaterThan(560);
    expect(per(slow)).toBeLessThan(720);
    expect(per(fast)).toBeLessThan(per(slow) * 0.75);
  });
});

describe('generateCurve – phrases and markers', () => {
  const text = 'I would like to go to the home and see you later today and we can see how you are';
  it('chunks into breath groups of 3–5 words with real pauses and breath markers', () => {
    const c = gen(text);
    expect(c.chunks.length).toBeGreaterThan(2);
    for (const ch of c.chunks) {
      expect(ch.wordTo - ch.wordFrom).toBeGreaterThanOrEqual(3);
      expect(ch.wordTo - ch.wordFrom).toBeLessThanOrEqual(5);
    }
    for (let i = 1; i < c.chunks.length; i++) {
      const gap = c.chunks[i].startMs - c.chunks[i - 1].endMs;
      expect(gap).toBeGreaterThanOrEqual(beginner.pauseMs);
      const quiet = c.envelope.filter((p) => p.t >= c.chunks[i - 1].endMs && p.t <= c.chunks[i].startMs);
      expect(Math.max(...quiet.map((p) => p.level))).toBe(0);
    }
    expect(c.markers.filter((m) => m.type === 'breath')).toHaveLength(c.chunks.length);
    expect(c.markers.filter((m) => m.type === 'pause')).toHaveLength(c.chunks.length - 1);
  });

  it('ramps gently at the start of every chunk', () => {
    const c = gen(text);
    for (const ch of c.chunks) expect(maxStep(c.envelope, ch.startMs, ch.startMs + beginner.onsetMs)).toBeLessThan(0.06);
  });

  it('emits word and syllable markers aligned to the syllable list', () => {
    const c = gen('go banana');
    expect(c.markers.filter((m) => m.type === 'word').map((m) => m.label)).toEqual(['go', 'banana']);
    expect(c.markers.filter((m) => m.type === 'syllable')).toHaveLength(c.syllables.length);
    expect(c.syllables).toHaveLength(4);
    expect(c.words[1].syllableIndices).toEqual([1, 2, 3]);
    for (let i = 1; i < c.syllables.length; i++) expect(c.syllables[i].startMs).toBeGreaterThanOrEqual(c.syllables[i - 1].startMs);
  });

  it('forces a break at sentence ends', () => {
    const c = gen('Go home. See you.');
    expect(c.chunks).toHaveLength(2);
    expect(c.chunks[1].startMs - c.chunks[0].endMs).toBeGreaterThan(beginner.pauseMs);
  });

  it('flags unknown words but still produces a curve', () => {
    const c = gen('go zorblax');
    expect(c.words[1].known).toBe(false);
    expect(c.syllables.length).toBeGreaterThan(2);
    expect(Math.max(...c.envelope.map((p) => p.level))).toBeGreaterThan(0.7);
  });
});

describe('chunkWords', () => {
  it('spreads words evenly into 3–5 groups', () => {
    const sizes = (n: number) => chunkWords(n, new Array(n).fill(0)).map((c) => c.to - c.from);
    expect(sizes(5)).toEqual([5]);
    expect(sizes(6)).toEqual([3, 3]);
    expect(sizes(11)).toEqual([4, 4, 3]);
    for (let n = 6; n <= 60; n++) for (const s of sizes(n)) expect(s >= 3 && s <= 5).toBe(true);
  });
});

describe('generateSustained', () => {
  it('ramps gently, holds, and fades', () => {
    const c = generateSustained(3000);
    expect(c.durationMs).toBe(LEAD_IN_MS + beginner.onsetMs + 3000 + FINAL_FADE_MS);
    expect(levelAt(c, LEAD_IN_MS + beginner.onsetMs + 1500)).toBeCloseTo(LEVELS.vowel, 2);
    expect(maxStep(c.envelope, 0, c.durationMs)).toBeLessThan(0.06);
  });
});
