import type { Calibration, LevelSample, LoudnessSample } from './types';

export const MIN_DB = -100;

/** RMS amplitude (0–1 full scale) of a block of samples. */
export function rms(block: ArrayLike<number>): number {
  const n = block.length;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += block[i] * block[i];
  return Math.sqrt(sum / n);
}

export function rmsToDb(r: number): number {
  if (!(r > 0)) return MIN_DB;
  return Math.max(MIN_DB, 20 * Math.log10(r));
}

export function dbToRms(db: number): number {
  return Math.pow(10, db / 20);
}

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Map dB to 0–1 between the calibration anchors. */
export function normalizeDb(db: number, cal: Pick<Calibration, 'floorDb' | 'normalDb'>): number {
  const span = cal.normalDb - cal.floorDb;
  if (span <= 0) return 0;
  return clamp01((db - cal.floorDb) / span);
}

/** Time-aware one-pole smoother ("smooth lightly": default time constant 40 ms). */
export class Smoother {
  private y: number | null = null;
  private lastT: number | null = null;
  constructor(private readonly tauMs = 40) {}

  push(t: number, x: number): number {
    if (this.y === null || this.lastT === null) {
      this.y = x;
    } else {
      const dt = Math.max(0, t - this.lastT);
      const a = this.tauMs <= 0 ? 1 : 1 - Math.exp(-dt / this.tauMs);
      this.y += a * (x - this.y);
    }
    this.lastT = t;
    return this.y;
  }

  reset() {
    this.y = null;
    this.lastT = null;
  }
}

/** Turns raw dB samples into normalized, smoothed level samples. */
export class LevelTracker {
  private readonly smoother: Smoother;
  constructor(private cal: Calibration, tauMs = 40) {
    this.smoother = new Smoother(tauMs);
  }

  setCalibration(cal: Calibration) {
    this.cal = cal;
  }

  update(s: LoudnessSample): LevelSample {
    return { t: s.t, level: this.smoother.push(s.t, normalizeDb(s.db, this.cal)) };
  }

  reset() {
    this.smoother.reset();
  }
}
