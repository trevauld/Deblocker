import type { GuidanceLevel } from '../guidance/fading';

export type Stage = 'words' | 'sentences' | 'passages' | 'free';
export const STAGES: Stage[] = ['words', 'sentences', 'passages', 'free'];

/** Per-attempt numbers kept for the session summary (no audio, no envelopes). */
export interface AttemptRecord {
  text: string;
  total: number;
  easyOnset: boolean;
  tempoRatio: number;
  spansMs: number[];
  heard: boolean;
}

export interface SessionRecord {
  id: string;
  /** Epoch ms. */
  startedAt: number;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  stage: Stage;
  guidanceLevel: GuidanceLevel;
  pace: number;
  attempts: number;
  easyOnsetPct: number;
  avgTempoRatio: number;
  avgPhraseMs: number;
  avgScore: number;
}

export interface Progress {
  stage: Stage;
  /** 0 = beginner tempo/onset … 1 = advanced. */
  pace: number;
  sessionsInStage: number;
}

export interface CheckIn {
  /** YYYY-MM-DD */
  date: string;
  sleep: number;
  energy: number;
  stress: number;
}

export interface CustomWord {
  id: string;
  text: string;
  addedAt: number;
}

export interface Settings {
  strictness: 'lenient' | 'normal' | 'strict';
  inputMode: 'mic' | 'simulated';
  /** Dev mode: simulated voice follows the target by itself. */
  simAutoplay: 'off' | 'gentle' | 'sudden' | 'fast';
}

export const defaultSettings: Settings = { strictness: 'normal', inputMode: 'mic', simAutoplay: 'off' };
export const defaultProgress: Progress = { stage: 'words', pace: 0, sessionsInStage: 0 };
