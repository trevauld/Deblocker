/** One raw loudness reading. `t` is in milliseconds on any monotonic clock; `db` is dBFS-like (<= 0). */
export interface LoudnessSample {
  t: number;
  db: number;
}

/**
 * Anything that can produce loudness readings: the microphone, the dev-mode simulated voice,
 * or (later) a native mobile audio module. Only loudness numbers ever leave the source — never audio.
 */
export interface LoudnessSource {
  readonly kind: 'mic' | 'simulated';
  start(): Promise<void>;
  stop(): void;
  subscribe(cb: (s: LoudnessSample) => void): () => void;
}

/** Result of calibration: the two anchor points of the 0–1 scale. */
export interface Calibration {
  /** Gate level in dB: at or below this the normalized level is 0 (noise floor + margin). */
  floorDb: number;
  /** Comfortable sustained-"mmm" level in dB: normalized level 1. */
  normalDb: number;
  /** Epoch ms when calibrated. */
  createdAt: number;
}

/** A normalized (0–1), lightly smoothed loudness reading. */
export interface LevelSample {
  t: number;
  level: number;
}
