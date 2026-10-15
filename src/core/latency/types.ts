import type { GuidanceLevel } from '../guidance/fading';
import type { Stage } from '../tracking/types';

export interface LatencyOptions {
  /** Silences at least this long, where the target expects voicing, count as gaps. */
  gapMs: number;
  /** A start is "long" when it exceeds the personal reference by at least this much. */
  longStartMarginMs: number;
}

export const DEFAULT_LATENCY_OPTIONS: LatencyOptions = { gapMs: 250, longStartMarginMs: 600 };

export interface LatencyGap {
  /** Start of the silence on the attempt clock (ms after the start cue). */
  startMs: number;
  durationMs: number;
  /** Word the target expected at that point, when it can be worked out. */
  word?: string;
}

export interface LatencyResult {
  /** Start cue to first sustained voicing; null when nothing was heard. */
  startLatencyMs: number | null;
  gaps: LatencyGap[];
  hardOnset: boolean;
  /** The onset after a long wait was also sudden. */
  hardOnsetAfterWait: boolean;
  longStart: boolean;
  /** Long start or at least one gap. */
  flagged: boolean;
}

/** One stored attempt: numbers only, never audio. */
export interface LatencyRecord {
  id: string;
  sessionId: string;
  /** Epoch ms. */
  timestamp: number;
  /** Local calendar day. */
  date: string;
  item: string;
  category: string;
  stage: Stage;
  pace: number;
  guidanceLevel: GuidanceLevel;
  startLatencyMs: number | null;
  gaps: LatencyGap[];
  hardOnset: boolean;
  hardOnsetAfterWait: boolean;
  longStart: boolean;
  flagged: boolean;
  /** Reference used when the flag was computed (null while the baseline was still too thin). */
  referenceMs: number | null;
  selfReportBlocked?: boolean;
  /** Observer-mode taps (ms after the start cue); undefined when observer mode was off. */
  observerTaps?: number[];
}
