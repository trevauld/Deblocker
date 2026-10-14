/** Everything about a target curve that the learner's progress can change. */
export interface CurveSettings {
  /** Nominal duration of one syllable. Slowest 600 ms, progressing toward ~300 ms. */
  msPerSyllable: number;
  /** Length of the gentle onset ramp at the start of each phrase. 400 ms (beginner) → ~200 ms. */
  onsetMs: number;
  /** Silence between phrase chunks, long enough for a real breath. */
  pauseMs: number;
}

export const BEGINNER_PACE = 0;
export const ADVANCED_PACE = 1;

/** pace 0 = beginner (slowest) … 1 = advanced. */
export function settingsForPace(pace: number): CurveSettings {
  const p = Math.min(1, Math.max(0, pace));
  return {
    msPerSyllable: Math.round(600 - 300 * p),
    onsetMs: Math.round(400 - 200 * p),
    pauseMs: Math.round(1600 - 600 * p),
  };
}

/** Half-width of the tolerance band around the target curve, per guidance level (see guidance/fading.ts). */
export const BAND_NARROW = 0.12;
export const BAND_WIDE = 0.22;
