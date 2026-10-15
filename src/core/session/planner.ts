import type { CustomWord, Stage } from '../tracking/types';
import { FREE_PROMPTS, H_WORDS, PASSAGES, PHRASES, SENTENCES, STOP_WORDS, VOICED_WORDS, VOWEL_WORDS } from './content';

export type DrillCategory = 'vowels' | 'h-words' | 'voiced' | 'stops' | 'yours' | 'revisit' | 'phrase' | 'sentence' | 'passage' | 'free';

export interface DrillItem {
  id: string;
  text: string;
  category: DrillCategory;
  /** Free-speech prompt: no target curve, only onset and tempo are scored. */
  free: boolean;
}

export type SessionStep =
  | { id: string; kind: 'breath'; cycles: number; inMs: number; outMs: number }
  | { id: string; kind: 'sustained'; holdMs: number }
  | { id: string; kind: 'drill'; item: DrillItem };

export const CATEGORY_LABEL: Record<DrillCategory, string> = {
  vowels: 'Vowel words',
  'h-words': 'Words with h',
  voiced: 'Voiced consonants',
  stops: 'Stop consonants',
  yours: 'Your words',
  revisit: 'Words to revisit',
  phrase: 'Phrases',
  sentence: 'Sentences',
  passage: 'Reading passage',
  free: 'Free speech',
};

/** Small deterministic PRNG so a day's session is stable (and testable). */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(list: T[], n: number, rng: () => number): T[] {
  const pool = [...list];
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

export interface PlanOptions {
  stage: Stage;
  customWords?: CustomWord[];
  /** Words that have had the most long starts; picked with probability proportional to their weight. */
  revisit?: { text: string; weight: number }[];
  seed?: number;
}

/** Weighted sample without replacement. */
export function pickWeighted<T extends { weight: number }>(list: T[], n: number, rng: () => number): T[] {
  const pool = list.filter((x) => x.weight > 0);
  const out: T[] = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((a, b) => a + b.weight, 0);
    let r = rng() * total;
    let i = 0;
    while (i < pool.length - 1 && r >= pool[i].weight) r -= pool[i++].weight;
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/**
 * Plan a ~10 minute session: breath warm-up, "air before voice" on a sustained vowel, then drills for the learner's stage.
 * Word stage: vowels → h-words → voiced consonants → stop consonants → the learner's own words → short phrases.
 */
export function planSession({ stage, customWords = [], revisit = [], seed = Date.now() }: PlanOptions): SessionStep[] {
  const rng = mulberry32(seed);
  let n = 0;
  const id = () => `step-${++n}`;
  const drill = (text: string, category: DrillCategory, free = false): SessionStep => ({
    id: id(),
    kind: 'drill',
    item: { id: `item-${n}`, text, category, free },
  });
  const steps: SessionStep[] = [
    { id: id(), kind: 'breath', cycles: 3, inMs: 3000, outMs: 5000 },
    { id: id(), kind: 'sustained', holdMs: 3000 },
    { id: id(), kind: 'sustained', holdMs: 4000 },
  ];
  const mine = pick(customWords.map((w) => w.text), 3, rng);
  const again = pickWeighted(revisit, 2, rng).map((r) => r.text);

  switch (stage) {
    case 'words':
      pick(VOWEL_WORDS, 3, rng).forEach((w) => steps.push(drill(w, 'vowels')));
      pick(H_WORDS, 3, rng).forEach((w) => steps.push(drill(w, 'h-words')));
      pick(VOICED_WORDS, 3, rng).forEach((w) => steps.push(drill(w, 'voiced')));
      pick(STOP_WORDS, 3, rng).forEach((w) => steps.push(drill(w, 'stops')));
      mine.forEach((w) => steps.push(drill(w, 'yours')));
      again.forEach((w) => steps.push(drill(w, 'revisit')));
      pick(PHRASES, 3, rng).forEach((p) => steps.push(drill(p, 'phrase')));
      break;
    case 'sentences':
      [...pick(H_WORDS, 1, rng), ...pick(STOP_WORDS, 1, rng)].forEach((w) => steps.push(drill(w, 'stops')));
      mine.slice(0, 2).forEach((w) => steps.push(drill(w, 'yours')));
      again.slice(0, 1).forEach((w) => steps.push(drill(w, 'revisit')));
      pick(PHRASES, 2, rng).forEach((p) => steps.push(drill(p, 'phrase')));
      pick(SENTENCES, 5, rng).forEach((s) => steps.push(drill(s, 'sentence')));
      break;
    case 'passages':
      mine.slice(0, 2).forEach((w) => steps.push(drill(w, 'yours')));
      again.slice(0, 1).forEach((w) => steps.push(drill(w, 'revisit')));
      pick(SENTENCES, 2, rng).forEach((s) => steps.push(drill(s, 'sentence')));
      pick(PASSAGES, 2, rng).forEach((p) => steps.push(drill(p, 'passage')));
      break;
    case 'free':
      mine.slice(0, 2).forEach((w) => steps.push(drill(w, 'yours')));
      again.slice(0, 1).forEach((w) => steps.push(drill(w, 'revisit')));
      pick(SENTENCES, 2, rng).forEach((s) => steps.push(drill(s, 'sentence')));
      pick(FREE_PROMPTS, 4, rng).forEach((p) => steps.push(drill(p, 'free', true)));
      break;
  }
  return steps;
}
