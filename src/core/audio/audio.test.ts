import { describe, expect, it } from 'vitest';
import { Calibrator, GATE_MARGIN_DB } from './calibration';
import { LevelTracker, normalizeDb, rms, rmsToDb, Smoother } from './loudness';

describe('loudness', () => {
  it('computes rms and dB', () => {
    expect(rms([1, -1, 1, -1])).toBeCloseTo(1);
    expect(rmsToDb(1)).toBeCloseTo(0);
    expect(rmsToDb(0.1)).toBeCloseTo(-20);
    expect(rmsToDb(0)).toBe(-100);
  });

  it('normalizes between floor and normal, clamped to 0–1', () => {
    const cal = { floorDb: -50, normalDb: -20 };
    expect(normalizeDb(-60, cal)).toBe(0);
    expect(normalizeDb(-50, cal)).toBe(0);
    expect(normalizeDb(-35, cal)).toBeCloseTo(0.5);
    expect(normalizeDb(-20, cal)).toBe(1);
    expect(normalizeDb(-5, cal)).toBe(1);
  });

  it('smooths lightly: follows a step but not instantly', () => {
    const s = new Smoother(40);
    s.push(0, 0);
    const y1 = s.push(16, 1);
    expect(y1).toBeGreaterThan(0.2);
    expect(y1).toBeLessThan(0.5);
    let y = y1;
    for (let t = 32; t <= 400; t += 16) y = s.push(t, 1);
    expect(y).toBeGreaterThan(0.99);
  });

  it('tracker produces levels from dB', () => {
    const tr = new LevelTracker({ floorDb: -50, normalDb: -20, createdAt: 0 }, 0);
    expect(tr.update({ t: 0, db: -35 }).level).toBeCloseTo(0.5);
  });
});

describe('Calibrator', () => {
  function run(silenceDb: number, humDb: number) {
    const c = new Calibrator(() => 123);
    c.start(0);
    for (let t = 0; t <= 6000; t += 16) {
      const inSilence = t < 1500;
      c.push({ t, db: inSilence ? silenceDb + (t % 3) * 0.5 : humDb });
    }
    return c;
  }

  it('measures noise floor then the hum level', () => {
    const c = run(-60, -25);
    expect(c.phase).toBe('done');
    expect(c.result!.normalDb).toBeCloseTo(-25);
    expect(c.result!.floorDb).toBeGreaterThanOrEqual(-60 + GATE_MARGIN_DB);
    expect(c.result!.floorDb).toBeLessThanOrEqual(-55);
    expect(c.result!.createdAt).toBe(123);
  });

  it('fails when the hum is not above the noise', () => {
    const c = run(-40, -38);
    expect(c.phase).toBe('failed');
    expect(c.failure).toMatch(/barely hear/);
  });

  it('reports progress through phases', () => {
    const c = new Calibrator();
    c.start(0);
    expect(c.push({ t: 750, db: -60 })).toMatchObject({ phase: 'silence', fraction: 0.5 });
    c.push({ t: 1500, db: -60 });
    expect(c.phase).toBe('hum');
  });
});
