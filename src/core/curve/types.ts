import type { CurveSettings } from './levelSettings';

export interface CurvePoint {
  t: number;
  level: number;
}

export type MarkerType = 'breath' | 'pause' | 'word' | 'syllable';

export interface Marker {
  t: number;
  type: MarkerType;
  label?: string;
  wordIndex?: number;
  syllableIndex?: number;
}

export interface CurveSyllable {
  index: number;
  wordIndex: number;
  text: string;
  startMs: number;
  endMs: number;
  stressed: boolean;
}

export interface CurveWord {
  index: number;
  text: string;
  syllableIndices: number[];
  /** False when the word was not in the dictionary and a spelling-based guess was used. */
  known: boolean;
}

export interface CurveChunk {
  index: number;
  /** Start of the gentle onset ramp. */
  startMs: number;
  /** End of the soft final fade. */
  endMs: number;
  wordFrom: number;
  wordTo: number;
}

export interface GeneratedCurve {
  text: string;
  settings: CurveSettings;
  /** Dense (10 ms) loudness envelope, level 0–1. Starts at t=0 with a short "air" lead-in. */
  envelope: CurvePoint[];
  markers: Marker[];
  words: CurveWord[];
  syllables: CurveSyllable[];
  chunks: CurveChunk[];
  /** Time at which the first onset ramp begins (end of the lead-in). */
  voicedStartMs: number;
  durationMs: number;
}
