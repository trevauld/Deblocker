import type { GeneratedCurve } from '../curve/types';
import { buildFeedback } from './feedback';
import { envelopeMatch } from './envelopeMatch';
import { analyzeOnset } from './onset';
import { speechSpans } from './series';
import { analyzeFreeSpeechTempo, analyzeTempo, detectRanOutOfAir } from './tempo';
import type { EnvelopeResult, ScoreResult, Strictness, TempoResult, UserSample } from './types';

export const WEIGHTS = { onset: 0.5, envelope: 0.3, tempo: 0.2 } as const;

export interface ScoreInput {
  /** User loudness, times relative to the "go" moment (curve t = 0). */
  user: UserSample[];
  /** Target curve; null for free-speech prompts (only onset and tempo are scored). */
  target: GeneratedCurve | null;
  /** For free speech: reference pace and onset ramp. Ignored when `target` is given. */
  freeSpeech?: { msPerSyllable: number; onsetMs: number };
  strictness?: Strictness;
  bandHalfWidth?: number;
}

export function scoreAttempt(input: ScoreInput): ScoreResult {
  const strictness = input.strictness ?? 'normal';
  const band = input.bandHalfWidth ?? 0.15;
  const target = input.target;
  const onsetMs = target ? target.settings.onsetMs : input.freeSpeech?.onsetMs ?? 400;

  const onset = analyzeOnset(input.user, onsetMs, strictness);

  let envelope: EnvelopeResult | null = null;
  let tempo: TempoResult;
  let ranOutOfAir = false;
  let skippedPause = false;
  let userSpansMs: number[] = [];

  if (target) {
    envelope = onset.detected ? envelopeMatch(input.user, target, band) : { score: 0, meanExcess: 1 };
    const t = analyzeTempo(input.user, target);
    tempo = t;
    userSpansMs = t.userSpans.map(([a, b]) => b - a);
    const targetLongest = Math.max(0, ...t.targetSpans.map(([a, b]) => b - a));
    ranOutOfAir = detectRanOutOfAir(input.user, t.userSpans, targetLongest);
    skippedPause = target.chunks.length > 1 && t.userSpans.length === 1 && t.userMs > 1.3 * targetLongest;
  } else {
    tempo = analyzeFreeSpeechTempo(input.user, input.freeSpeech?.msPerSyllable ?? 450);
    const spans = speechSpans(input.user);
    userSpansMs = spans.map(([a, b]) => b - a);
    ranOutOfAir = detectRanOutOfAir(input.user, spans, 0);
  }

  let total: number;
  if (!onset.detected) total = 0;
  else if (envelope) total = WEIGHTS.onset * onset.score + WEIGHTS.envelope * envelope.score + WEIGHTS.tempo * tempo.score;
  else total = (WEIGHTS.onset * onset.score + WEIGHTS.tempo * tempo.score) / (WEIGHTS.onset + WEIGHTS.tempo);

  const easyOnset = onset.detected && !onset.hard && !onset.tooQuiet;
  return {
    total: Math.round(total),
    onset,
    envelope,
    tempo,
    easyOnset,
    ranOutOfAir,
    skippedPause,
    userSpansMs,
    feedback: buildFeedback({ onset, tempo, envelopeScore: envelope ? envelope.score : null, ranOutOfAir, skippedPause }),
  };
}
