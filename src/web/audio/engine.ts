import { LevelTracker } from '../../core/audio/loudness';
import type { Calibration, LevelSample, LoudnessSample, LoudnessSource } from '../../core/audio/types';
import { MicSource } from './micSource';
import { SimulatedSource } from './simulatedSource';

export type InputMode = 'mic' | 'simulated';

/**
 * Owns the loudness source and turns raw dB into normalized levels once calibrated.
 * UI code subscribes to `onDb` (calibration) or `onLevel` (everything else).
 */
export class AudioEngine {
  private source: LoudnessSource | null = null;
  private unsub: (() => void) | null = null;
  private dbListeners = new Set<(s: LoudnessSample) => void>();
  private levelListeners = new Set<(s: LevelSample, db: number) => void>();
  private tracker: LevelTracker | null = null;
  private calibration: Calibration | null = null;
  readonly sim = new SimulatedSource();
  private mic: MicSource | null = null;
  mode: InputMode = 'mic';
  error: string | null = null;

  get running() { return this.source !== null; }
  get micProcessingStillOn() { return this.mic?.processingStillOn ?? false; }
  get activeCalibration() { return this.calibration; }

  setCalibration(cal: Calibration | null) {
    this.calibration = cal;
    this.tracker = cal ? new LevelTracker(cal) : null;
    this.sim.setCalibration(cal);
  }

  /** Must be called from a user gesture the first time (microphone permission). */
  async start(mode: InputMode): Promise<void> {
    if (this.source && this.mode === mode) return;
    this.stop();
    this.mode = mode;
    this.error = null;
    try {
      if (mode === 'simulated') {
        this.source = this.sim;
      } else {
        this.mic = new MicSource();
        this.source = this.mic;
      }
      await this.source.start();
      this.tracker?.reset();
      this.unsub = this.source.subscribe((s) => this.handle(s));
    } catch (e) {
      this.source?.stop();
      this.source = null;
      this.error = e instanceof Error ? e.message : String(e);
      throw e;
    }
  }

  stop() {
    this.unsub?.();
    this.unsub = null;
    this.source?.stop();
    this.source = null;
    this.mic = null;
  }

  private handle(s: LoudnessSample) {
    this.dbListeners.forEach((l) => l(s));
    if (this.tracker && this.levelListeners.size) {
      const lv = this.tracker.update(s);
      this.levelListeners.forEach((l) => l(lv, s.db));
    }
  }

  onDb(cb: (s: LoudnessSample) => void) {
    this.dbListeners.add(cb);
    return () => { this.dbListeners.delete(cb); };
  }

  onLevel(cb: (s: LevelSample, db: number) => void) {
    this.levelListeners.add(cb);
    return () => { this.levelListeners.delete(cb); };
  }

  /** Reset smoothing between attempts so a previous level doesn't leak into the next. */
  resetSmoothing() { this.tracker?.reset(); }
}

export const engine = new AudioEngine();
