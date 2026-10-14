import type { Feedback, OnsetResult, TempoResult } from './types';

interface Inputs {
  onset: OnsetResult;
  tempo: TempoResult;
  envelopeScore: number | null;
  ranOutOfAir: boolean;
  skippedPause: boolean;
}

/** Plain-language feedback, most important first (at most three items). */
export function buildFeedback({ onset, tempo, envelopeScore, ranOutOfAir, skippedPause }: Inputs): Feedback[] {
  const out: Feedback[] = [];
  if (!onset.detected) {
    return [{ tone: 'tip', code: 'no-voice', text: "I couldn't hear your voice. Check the mic (or try again a little louder)." }];
  }
  if (onset.hard) {
    out.push({ tone: 'tip', code: 'hard-onset', text: 'Sudden start. Let the air flow first, then let your voice come in softly.' });
  } else if (onset.tooQuiet) {
    out.push({ tone: 'tip', code: 'too-quiet', text: 'Your voice was very quiet. Let it build a little more after the soft start.' });
  } else {
    out.push({ tone: 'good', code: 'easy-onset', text: 'Good gentle start.' });
  }
  if (ranOutOfAir) {
    out.push({ tone: 'tip', code: 'ran-out-of-air', text: 'You ran out of air. Breathe before the next phrase and use a shorter phrase.' });
  } else if (skippedPause) {
    out.push({ tone: 'tip', code: 'no-pause', text: 'Take a real pause and breathe between phrases.' });
  }
  if (tempo.userMs > 0) {
    if (tempo.ratio < 0.85) {
      out.push({ tone: 'tip', code: 'too-fast', text: 'A bit fast. Stretch the vowels.' });
    } else if (tempo.ratio > 1.8) {
      out.push({ tone: 'tip', code: 'too-slow', text: 'Very slow. You can speed up a little and keep the vowels smooth.' });
    } else if (out.length < 3 && !onset.hard) {
      out.push({ tone: 'good', code: 'good-tempo', text: 'Nice slow pace.' });
    }
  }
  if (envelopeScore !== null && out.length < 3) {
    if (envelopeScore < 60) out.push({ tone: 'tip', code: 'uneven', text: 'Try to keep your voice steady and connected through the vowels.' });
    else if (envelopeScore >= 85 && !onset.hard) out.push({ tone: 'good', code: 'good-match', text: 'Your voice followed the curve well.' });
  }
  return out.slice(0, 3);
}
