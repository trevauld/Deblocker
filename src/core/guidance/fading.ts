import { BAND_NARROW, BAND_WIDE } from '../curve/levelSettings';

export type GuidanceLevel = 1 | 2 | 3 | 4;

export interface GuidanceConfig {
  level: GuidanceLevel;
  name: string;
  description: string;
  /** Show the whole curve for a moment before speaking. */
  previewBefore: boolean;
  /** Show the scrolling target while speaking. */
  showWhileSpeaking: boolean;
  /** Half-width of the tolerance band (used for drawing and for scoring). */
  bandHalfWidth: number;
  /** After the attempt, overlay the user's curve on the target. */
  overlayAfter: boolean;
}

/**
 * Fading guidance: constant on-screen guidance makes people depend on it, so the curve is withdrawn step by step.
 */
export const GUIDANCE: Record<GuidanceLevel, GuidanceConfig> = {
  1: { level: 1, name: 'Full guide', description: 'Curve visible while you speak, narrow band.', previewBefore: false, showWhileSpeaking: true, bandHalfWidth: BAND_NARROW, overlayAfter: true },
  2: { level: 2, name: 'Wider band', description: 'Curve visible while you speak, with more room.', previewBefore: false, showWhileSpeaking: true, bandHalfWidth: BAND_WIDE, overlayAfter: true },
  3: { level: 3, name: 'Preview only', description: 'See the curve first, then speak without it.', previewBefore: true, showWhileSpeaking: false, bandHalfWidth: BAND_WIDE, overlayAfter: true },
  4: { level: 4, name: 'Hidden', description: 'No curve while you speak; compare afterwards.', previewBefore: false, showWhileSpeaking: false, bandHalfWidth: BAND_WIDE, overlayAfter: true },
};

export const ADVANCE_RATE = 0.8;
export const ADVANCE_MIN_ATTEMPTS = 8;
export const WINDOW = 10;
export const BACK_RATE = 0.5;
export const BACK_MIN_ATTEMPTS = 6;

export interface FadingState {
  level: GuidanceLevel;
  /** Easy-onset flags of the most recent attempts at the current level (oldest first). */
  recent: boolean[];
}

export type FadingChange = 'advance' | 'back' | 'none';

export const initialFading = (level: GuidanceLevel = 1): FadingState => ({ level, recent: [] });

export function easyOnsetRate(flags: boolean[]): number {
  return flags.length ? flags.filter(Boolean).length / flags.length : 0;
}

/**
 * Record one attempt. Advances when the easy-onset rate over the recent window stays at or above 80%
 * (after enough attempts); steps back when it drops below 50% over the latest few attempts.
 * Changing level starts a fresh window.
 */
export function recordAttempt(state: FadingState, easyOnset: boolean): { state: FadingState; change: FadingChange } {
  const recent = [...state.recent, easyOnset].slice(-WINDOW);
  if (state.level < 4 && recent.length >= ADVANCE_MIN_ATTEMPTS && easyOnsetRate(recent) >= ADVANCE_RATE) {
    return { state: { level: (state.level + 1) as GuidanceLevel, recent: [] }, change: 'advance' };
  }
  const latest = recent.slice(-BACK_MIN_ATTEMPTS);
  if (state.level > 1 && latest.length >= BACK_MIN_ATTEMPTS && easyOnsetRate(latest) < BACK_RATE) {
    return { state: { level: (state.level - 1) as GuidanceLevel, recent: [] }, change: 'back' };
  }
  return { state: { level: state.level, recent }, change: 'none' };
}
