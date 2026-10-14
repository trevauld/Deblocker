import type { Calibration, LoudnessSample } from './types';

export const SILENCE_MS = 1500;
export const HUM_MS = 3000;
/** dB added above the measured noise floor so room noise never reads as voice. */
export const GATE_MARGIN_DB = 3;
/** Minimum distance between noise floor and "mmm" for the calibration to be usable. */
export const MIN_SPAN_DB = 8;
/** Skip the first part of the hum (people ramp up) when taking the typical level. */
const HUM_SETTLE_MS = 600;

export type CalibrationPhase = 'idle' | 'silence' | 'hum' | 'done' | 'failed';

export interface CalibrationProgress {
  phase: CalibrationPhase;
  /** 0–1 progress through the current phase. */
  fraction: number;
  failure?: string;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Time-driven state machine: 1.5 s of silence (noise floor), then 3 s of a comfortable sustained "mmm".
 * Feed it every raw sample; it uses the samples' own timestamps, so it is deterministic in tests.
 */
export class Calibrator {
  phase: CalibrationPhase = 'idle';
  result: Calibration | null = null;
  failure: string | null = null;
  private phaseStart = 0;
  private silence: number[] = [];
  private hum: { t: number; db: number }[] = [];
  private floorDb = -100;

  constructor(private readonly now: () => number = () => Date.now()) {}

  start(t: number) {
    this.phase = 'silence';
    this.phaseStart = t;
    this.silence = [];
    this.hum = [];
    this.result = null;
    this.failure = null;
  }

  push(s: LoudnessSample): CalibrationProgress {
    if (this.phase === 'silence') {
      this.silence.push(s.db);
      if (s.t - this.phaseStart >= SILENCE_MS) {
        // Use a high percentile so brief room noises still end up under the gate.
        const sorted = [...this.silence].sort((a, b) => a - b);
        this.floorDb = sorted[Math.floor(sorted.length * 0.9)] ?? sorted[sorted.length - 1] ?? -100;
        this.phase = 'hum';
        this.phaseStart = s.t;
      }
    } else if (this.phase === 'hum') {
      this.hum.push({ t: s.t - this.phaseStart, db: s.db });
      if (s.t - this.phaseStart >= HUM_MS) this.finishHum();
    }
    return this.progress(s.t);
  }

  private finishHum() {
    const settled = this.hum.filter((h) => h.t >= HUM_SETTLE_MS).map((h) => h.db);
    const normalDb = settled.length ? median(settled) : -100;
    const floorDb = this.floorDb + GATE_MARGIN_DB;
    if (normalDb - floorDb < MIN_SPAN_DB) {
      this.phase = 'failed';
      this.failure =
        'I could barely hear the hum above the background noise. Try a quieter room, hold the device closer, or hum a bit louder.';
      return;
    }
    this.result = { floorDb, normalDb, createdAt: this.now() };
    this.phase = 'done';
  }

  progress(t: number): CalibrationProgress {
    switch (this.phase) {
      case 'silence':
        return { phase: 'silence', fraction: Math.min(1, (t - this.phaseStart) / SILENCE_MS) };
      case 'hum':
        return { phase: 'hum', fraction: Math.min(1, (t - this.phaseStart) / HUM_MS) };
      case 'done':
        return { phase: 'done', fraction: 1 };
      case 'failed':
        return { phase: 'failed', fraction: 1, failure: this.failure ?? undefined };
      default:
        return { phase: 'idle', fraction: 0 };
    }
  }
}
