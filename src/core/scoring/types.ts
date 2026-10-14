import type { LevelSample } from '../audio/types';

export type Strictness = 'lenient' | 'normal' | 'strict';
export type UserSample = LevelSample;

export interface OnsetResult {
  /** Did we hear any voicing at all? */
  detected: boolean;
  /** When voicing began (ms, on the attempt clock). */
  startMs?: number;
  /** Time from voicing start to 80% of the peak. */
  riseMs?: number;
  /** Steepest loudness rise in the first 300 ms, in level units per second. */
  maxSlope?: number;
  /** Peak level in the first second of voicing. */
  peak?: number;
  /** Rise time that counts as "ideal" for this level (ms). */
  idealRiseMs?: number;
  hard: boolean;
  tooQuiet: boolean;
  score: number;
}

export interface EnvelopeResult {
  score: number;
  /** Mean error beyond the tolerance band along the warped path (level units). */
  meanExcess: number;
}

export interface TempoResult {
  /** User speaking time / target speaking time. >1 = slower than the target. */
  ratio: number;
  userMs: number;
  targetMs: number;
  score: number;
  /** True when the target time came from a syllable-rate estimate, not a known curve. */
  estimated: boolean;
}

export interface Feedback {
  tone: 'good' | 'tip';
  text: string;
  code:
    | 'no-voice'
    | 'hard-onset'
    | 'easy-onset'
    | 'too-quiet'
    | 'too-fast'
    | 'too-slow'
    | 'good-tempo'
    | 'ran-out-of-air'
    | 'no-pause'
    | 'uneven'
    | 'good-match';
}

export interface ScoreResult {
  /** 0–100. */
  total: number;
  onset: OnsetResult;
  envelope: EnvelopeResult | null;
  tempo: TempoResult;
  /** Gentle start with enough voice to judge — the signal fading guidance is based on. */
  easyOnset: boolean;
  ranOutOfAir: boolean;
  skippedPause: boolean;
  /** Length of each uninterrupted stretch of speech (one per breath group). */
  userSpansMs: number[];
  feedback: Feedback[];
}
