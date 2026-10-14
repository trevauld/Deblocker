import type { Calibration, LoudnessSample, LoudnessSource } from '../../core/audio/types';

const SIM_FLOOR_DB = -60;
const SIM_SPAN_DB = 40;

export type PressStyle = 'gentle' | 'sudden';

/**
 * Dev-mode "voice": keyboard / mouse-driven loudness so the whole app can be tested without a microphone.
 *  - hold Space (or the Gentle button): voice rises over ~0.6 s to the hold level
 *  - hold Enter (or the Sudden button): voice jumps instantly (a hard onset)
 *  - ↑ / ↓: change the hold level
 * An optional `driver` can supply the normalized level directly (used by the auto-play dev toggle).
 */
export class SimulatedSource implements LoudnessSource {
  readonly kind = 'simulated' as const;
  private listeners = new Set<(s: LoudnessSample) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private v = 0; // current "voice amount" 0..1 (pre-calibration scale)
  private pressed: PressStyle | null = null;
  private lastT = 0;
  holdLevel = 0.8;
  private driver: ((nowMs: number) => number | null) | null = null;
  private cal: Pick<Calibration, 'floorDb' | 'normalDb'> | null = null;

  /** Expose the current level for the on-screen pad. */
  get voiceAmount() { return this.v; }
  get isPressed() { return this.pressed !== null; }

  setCalibration(cal: Pick<Calibration, 'floorDb' | 'normalDb'> | null) { this.cal = cal; }
  setDriver(fn: ((nowMs: number) => number | null) | null) { this.driver = fn; }
  press(style: PressStyle) { this.pressed = style; if (style === 'sudden') this.v = this.holdLevel; }
  release() { this.pressed = null; }
  adjustHold(delta: number) { this.holdLevel = Math.min(1, Math.max(0.2, this.holdLevel + delta)); }

  async start(): Promise<void> {
    if (this.timer) return;
    this.lastT = performance.now();
    this.timer = setInterval(() => this.step(), 1000 / 60);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.v = 0;
    this.pressed = null;
  }

  subscribe(cb: (s: LoudnessSample) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private step() {
    const now = performance.now();
    const dt = Math.max(0, (now - this.lastT) / 1000);
    this.lastT = now;
    const jitter = (Math.random() - 0.5) * 1.4; // ±0.7 dB
    let db: number;
    const driven = this.driver ? this.driver(now) : null;
    if (driven !== null) {
      const l = Math.min(1.2, Math.max(0, driven));
      db = this.cal ? this.cal.floorDb + l * (this.cal.normalDb - this.cal.floorDb) + (l > 0.02 ? jitter : 0) : SIM_FLOOR_DB + 0.8 * l * SIM_SPAN_DB + jitter;
      this.v = l;
    } else {
      if (this.pressed === 'gentle') this.v = Math.min(this.holdLevel, this.v + 1.4 * dt);
      else if (this.pressed === 'sudden') this.v = this.holdLevel;
      else this.v = Math.max(0, this.v - 3 * dt);
      db = this.v > 0.01 ? SIM_FLOOR_DB + this.v * SIM_SPAN_DB + jitter : SIM_FLOOR_DB - 2 + (Math.random() - 0.5) * 3;
    }
    const s: LoudnessSample = { t: now, db };
    this.listeners.forEach((l) => l(s));
  }
}
