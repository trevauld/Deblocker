import { PhonemeClass } from '../phonetics/phonemeClasses';
import { PronounceFn, pronounceWord, tokenize } from '../phonetics/pronounce';
import { BEGINNER_PACE, CurveSettings, settingsForPace } from './levelSettings';
import { chunkWords } from './phrasing';
import type { CurveChunk, CurvePoint, CurveSyllable, CurveWord, GeneratedCurve, Marker } from './types';

/** Target loudness (0–1) for each phoneme class. */
export const LEVELS = {
  vowel: 0.8,
  sonorant: 0.55,
  voicedFricative: 0.45,
  voicelessFricative: 0.2,
  h: 0.18,
  stop: 0.05,
} as const satisfies Record<PhonemeClass, number>;

/** Quiet "air flows first" stretch before the first onset ramp. */
export const LEAD_IN_MS = 300;
/** Soft fade at the end of every breath group. */
export const FINAL_FADE_MS = 250;
/** Soft re-rise after a stop gap. */
export const STOP_RERISE_MS = 150;
export const STOP_GAP_VOICELESS_MS = 110;
export const STOP_GAP_VOICED_MS = 90;
export const STRESS_STRETCH = 1.15;
/** H-initial words rise this much slower than other words. */
export const H_RISE_FACTOR = 1.35;
export const ENVELOPE_STEP_MS = 10;
/** Minimum transition time per unit of level change (keeps slopes gentle). */
const MS_PER_LEVEL_STEP = 300;

const smoothstep = (x: number) => {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
};

const VOICELESS_STOPS = new Set(['P', 'T', 'K', 'CH']);

interface Seg {
  cls: PhonemeClass;
  level: number;
  start: number;
  dur: number;
  attack: number;
}

function baseConsonantMs(cls: PhonemeClass, sym: string): number {
  switch (cls) {
    case 'sonorant': return 90;
    case 'voicedFricative': return 100;
    case 'voicelessFricative': return 110;
    case 'h': return 120;
    case 'stop': return VOICELESS_STOPS.has(sym) ? STOP_GAP_VOICELESS_MS : STOP_GAP_VOICED_MS;
    default: return 90;
  }
}

function defaultAttack(cls: PhonemeClass): number {
  switch (cls) {
    case 'vowel': return 110;
    case 'sonorant': return 80;
    case 'voicedFricative': return 80;
    case 'voicelessFricative': return 70;
    case 'h': return 90;
    case 'stop': return 40;
  }
}

/** Value of a keypoint polyline at time t, joining keypoints with smoothstep curves. */
function evalKeypoints(kp: CurvePoint[], t: number, cursor: { i: number }): number {
  if (t <= kp[0].t) return kp[0].level;
  const last = kp[kp.length - 1];
  if (t >= last.t) return last.level;
  while (cursor.i < kp.length - 2 && kp[cursor.i + 1].t <= t) cursor.i++;
  const a = kp[cursor.i];
  const b = kp[cursor.i + 1];
  if (b.t === a.t) return b.level;
  return a.level + (b.level - a.level) * smoothstep((t - a.t) / (b.t - a.t));
}

function sampleKeypoints(kp: CurvePoint[], durationMs: number): CurvePoint[] {
  const out: CurvePoint[] = [];
  const cursor = { i: 0 };
  for (let t = 0; t < durationMs; t += ENVELOPE_STEP_MS) {
    out.push({ t, level: round3(evalKeypoints(kp, t, cursor)) });
  }
  out.push({ t: durationMs, level: round3(evalKeypoints(kp, durationMs, cursor)) });
  return out;
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

export interface GenerateOptions {
  lookup: PronounceFn;
  settings?: CurveSettings;
}

/**
 * Generate the ideal loudness curve for a word or phrase: easy onset, slow tempo,
 * connected voicing and breath-supported phrasing.
 */
export function generateCurve(text: string, opts: GenerateOptions): GeneratedCurve {
  const settings = opts.settings ?? settingsForPace(BEGINNER_PACE);
  const { words: rawWords, sentenceOf } = tokenize(text);
  const pronounced = rawWords.map((w) => pronounceWord(w, opts.lookup));
  const chunkPlan = chunkWords(pronounced.length, sentenceOf);

  const kp: CurvePoint[] = [{ t: 0, level: 0 }, { t: LEAD_IN_MS, level: 0 }];
  const markers: Marker[] = [{ t: 0, type: 'breath', label: 'Breathe in, let air out' }];
  const syllables: CurveSyllable[] = [];
  const words: CurveWord[] = pronounced.map((p, i) => ({ index: i, text: p.text, syllableIndices: [], known: p.fromDictionary }));
  const chunks: CurveChunk[] = [];

  let cursor = LEAD_IN_MS;
  const cScale = Math.min(1.15, Math.max(0.6, settings.msPerSyllable / 500));

  chunkPlan.forEach((plan, ci) => {
    if (ci > 0) {
      const pause = plan.newSentence ? Math.round(settings.pauseMs * 1.3) : settings.pauseMs;
      markers.push({ t: cursor, type: 'pause' });
      markers.push({ t: cursor + Math.round(pause * 0.3), type: 'breath', label: 'Breathe' });
      cursor += pause;
      kp.push({ t: cursor, level: 0 });
    }
    const chunkStart = cursor;

    // Flatten the chunk's phonemes into timed segments.
    const segs: Seg[] = [];
    let t = chunkStart;
    let prevWasStopGap = false;

    // Per syllable: its phonemes (onset, nucleus, coda) and nominal duration.
    interface SylBuild { wordIndex: number; text: string; stressed: boolean; phones: { cls: PhonemeClass; sym: string }[]; nucleusAt: number; T: number }
    const sylBuilds: SylBuild[] = [];
    for (let wi = plan.from; wi < plan.to; wi++) {
      pronounced[wi].syllables.forEach((s) => {
        const phones = [...s.onset, s.nucleus, ...s.coda].map((p) => ({ cls: p.cls, sym: p.sym }));
        sylBuilds.push({
          wordIndex: wi,
          text: s.text,
          stressed: s.stressed,
          phones,
          nucleusAt: s.onset.length,
          T: settings.msPerSyllable * (s.stressed ? STRESS_STRETCH : 1),
        });
      });
    }
    sylBuilds.forEach((sb, si) => {
      const globalIndex = syllables.length;
      const isFirstSyllable = si === 0;
      const isLastSyllable = si === sylBuilds.length - 1;
      const sylStartTime = t;

      // Consonant durations for this syllable, scaled so the vowel keeps at least 40% of the syllable.
      const consonantMs = sb.phones.map((p, k) => (k === sb.nucleusAt ? 0 : baseConsonantMs(p.cls, p.sym) * (p.cls === 'stop' ? 1 : cScale)));
      const sumC = consonantMs.reduce((a, b) => a + b, 0);
      const maxC = sb.T * 0.6;
      const squeeze = sumC > maxC ? maxC / sumC : 1;
      const vowelMs = Math.max(sb.T * 0.4, sb.T - sumC * squeeze);

      sb.phones.forEach((p, k) => {
        const isNucleus = k === sb.nucleusAt;
        const isLastPhone = k === sb.phones.length - 1;
        const firstOfChunk = isFirstSyllable && k === 0;
        const lastOfChunk = isLastSyllable && isLastPhone;
        // A stop at the very start/end of a breath group has no audible gap to train: the onset ramp / final fade cover it.
        if (p.cls === 'stop' && (firstOfChunk || lastOfChunk)) return;
        let dur = isNucleus ? vowelMs : consonantMs[k] * squeeze;
        let attack = prevWasStopGap && p.cls !== 'stop' ? STOP_RERISE_MS : defaultAttack(p.cls);
        const prevSeg = segs[segs.length - 1];
        // Keep every rise gentle: a big level change needs proportionally more time (stop gaps and their ~150 ms re-rise excepted).
        if (prevSeg && p.cls !== 'stop' && !prevWasStopGap) {
          attack = Math.max(attack, MS_PER_LEVEL_STEP * Math.abs(LEVELS[p.cls] - prevSeg.level));
        }
        const isFirstSeg = segs.length === 0;
        if (isFirstSeg) {
          // Gentle onset: ramp from silence over onsetMs (quiet breathy starts need less time to reach their lower level).
          const quiet = p.cls === 'voicelessFricative' || p.cls === 'h';
          attack = quiet ? settings.onsetMs * 0.5 : settings.onsetMs;
        } else if (p.cls === 'vowel' && prevSeg?.cls === 'h' && segs.length === 1) {
          // h-initial word: extra-gentle rise into the vowel.
          attack = settings.onsetMs * H_RISE_FACTOR;
        }
        dur = Math.max(dur, attack + (p.cls === 'vowel' ? 100 : 40));
        segs.push({ cls: p.cls, level: LEVELS[p.cls], start: t, dur, attack });
        t += dur;
        prevWasStopGap = p.cls === 'stop';
      });

      const wordIdx = sb.wordIndex;
      const isFirstOfWord = words[wordIdx].syllableIndices.length === 0;
      if (isFirstOfWord) markers.push({ t: sylStartTime, type: 'word', label: words[wordIdx].text, wordIndex: wordIdx });
      markers.push({ t: sylStartTime, type: 'syllable', label: sb.text, wordIndex: wordIdx, syllableIndex: globalIndex });
      words[wordIdx].syllableIndices.push(globalIndex);
      syllables.push({ index: globalIndex, wordIndex: wordIdx, text: sb.text, startMs: sylStartTime, endMs: t, stressed: sb.stressed });
    });

    // Keypoints for this chunk.
    for (const s of segs) {
      kp.push({ t: s.start + s.attack, level: s.level });
      kp.push({ t: s.start + s.dur, level: s.level });
    }
    const lastLevel = segs.length ? segs[segs.length - 1].level : 0;
    const speechEnd = segs.length ? segs[segs.length - 1].start + segs[segs.length - 1].dur : chunkStart;
    kp.push({ t: speechEnd, level: lastLevel });
    const chunkEnd = speechEnd + FINAL_FADE_MS;
    kp.push({ t: chunkEnd, level: 0 });
    // Syllable end times: last syllable of the chunk reaches the fade end.
    const lastSylIdx = syllables.length - 1;
    if (lastSylIdx >= 0) syllables[lastSylIdx].endMs = chunkEnd;
    chunks.push({ index: ci, startMs: chunkStart, endMs: chunkEnd, wordFrom: plan.from, wordTo: plan.to });
    cursor = chunkEnd;
  });

  const durationMs = cursor;
  if (kp[kp.length - 1].t < durationMs) kp.push({ t: durationMs, level: 0 });
  markers.sort((a, b) => a.t - b.t);

  return {
    text,
    settings,
    envelope: sampleKeypoints(kp, durationMs),
    markers,
    words,
    syllables,
    chunks,
    voicedStartMs: LEAD_IN_MS,
    durationMs,
  };
}

/** A sustained vowel ("aaah") for the "air before voice" exercise: lead-in, gentle onset, steady hold, soft fade. */
export function generateSustained(holdMs: number, settings: CurveSettings = settingsForPace(BEGINNER_PACE), label = 'ahhh'): GeneratedCurve {
  const start = LEAD_IN_MS;
  const rampEnd = start + settings.onsetMs;
  const holdEnd = rampEnd + holdMs;
  const end = holdEnd + FINAL_FADE_MS;
  const kp: CurvePoint[] = [
    { t: 0, level: 0 },
    { t: start, level: 0 },
    { t: rampEnd, level: LEVELS.vowel },
    { t: holdEnd, level: LEVELS.vowel },
    { t: end, level: 0 },
  ];
  return {
    text: label,
    settings,
    envelope: sampleKeypoints(kp, end),
    markers: [
      { t: 0, type: 'breath', label: 'Breathe in, let air out' },
      { t: start, type: 'word', label, wordIndex: 0 },
      { t: start, type: 'syllable', label, wordIndex: 0, syllableIndex: 0 },
    ],
    words: [{ index: 0, text: label, syllableIndices: [0], known: true }],
    syllables: [{ index: 0, wordIndex: 0, text: label, startMs: start, endMs: end, stressed: true }],
    chunks: [{ index: 0, startMs: start, endMs: end, wordFrom: 0, wordTo: 1 }],
    voicedStartMs: start,
    durationMs: end,
  };
}

/** Linear lookup of the target level at time t (ms). */
export function levelAt(curve: Pick<GeneratedCurve, 'envelope'>, t: number): number {
  const env = curve.envelope;
  if (env.length === 0 || t <= env[0].t) return env[0]?.level ?? 0;
  const last = env[env.length - 1];
  if (t >= last.t) return last.level;
  const i = Math.min(env.length - 2, Math.floor((t - env[0].t) / ENVELOPE_STEP_MS));
  const a = env[i];
  const b = env[i + 1];
  return a.level + ((b.level - a.level) * (t - a.t)) / (b.t - a.t || 1);
}
