import { Phoneme } from './phonemeClasses';

export interface PhoneSyllable {
  onset: Phoneme[];
  nucleus: Phoneme;
  coda: Phoneme[];
  /** Primary or secondary stress. */
  stressed: boolean;
}

const STOP_LIKE_FIRST = new Set('P B T D K G F'.split(' '));
const S_CLUSTER_SECOND = new Set('P T K M N L W F'.split(' '));

/** Is this consonant cluster a legal English syllable onset? (Maximal-onset principle.) */
export function isLegalOnset(syms: string[]): boolean {
  if (syms.length === 0) return true;
  if (syms.length === 1) return syms[0] !== 'NG' && syms[0] !== 'ZH';
  if (syms.length === 2) {
    const [a, b] = syms;
    if (a === 'S') return S_CLUSTER_SECOND.has(b);
    if (STOP_LIKE_FIRST.has(a)) return b === 'L' || b === 'R' || (b === 'W' && a !== 'F') || (b === 'Y' && a !== 'F');
    if (a === 'TH' || a === 'SH') return b === 'R' || b === 'W' || (a === 'TH' && b === 'Y');
    if (a === 'V') return b === 'R' || b === 'Y';
    if (a === 'M' || a === 'N' || a === 'HH' || a === 'L' || a === 'S') return b === 'Y';
    return false;
  }
  if (syms.length === 3) {
    return syms[0] === 'S' && (syms[1] === 'P' || syms[1] === 'T' || syms[1] === 'K') && ['L', 'R', 'W', 'Y'].includes(syms[2]);
  }
  return false;
}

/**
 * Split a word's phonemes into syllables. Every vowel is a nucleus; consonants between
 * two nuclei are divided by giving the next syllable the longest legal onset.
 * Words with no vowel (rare in CMU, e.g. "hmm") become one syllable around the first sonorant.
 */
export function syllabify(phones: Phoneme[]): PhoneSyllable[] {
  const nuclei: number[] = [];
  phones.forEach((p, i) => {
    if (p.cls === 'vowel') nuclei.push(i);
  });
  if (nuclei.length === 0) {
    if (phones.length === 0) return [];
    const idx = Math.max(0, phones.findIndex((p) => p.cls === 'sonorant'));
    return [
      { onset: phones.slice(0, idx), nucleus: phones[idx], coda: phones.slice(idx + 1), stressed: true },
    ];
  }
  const sylls: PhoneSyllable[] = nuclei.map((ni) => ({
    onset: [],
    nucleus: phones[ni],
    coda: [],
    stressed: phones[ni].stress > 0,
  }));
  // Leading consonants → first onset; trailing consonants → last coda.
  sylls[0].onset = phones.slice(0, nuclei[0]);
  sylls[sylls.length - 1].coda = phones.slice(nuclei[nuclei.length - 1] + 1);
  for (let k = 0; k < nuclei.length - 1; k++) {
    const cluster = phones.slice(nuclei[k] + 1, nuclei[k + 1]);
    let split = cluster.length; // index where the next onset starts
    for (let take = Math.min(3, cluster.length); take >= 0; take--) {
      const cand = cluster.slice(cluster.length - take);
      if (isLegalOnset(cand.map((p) => p.sym))) {
        split = cluster.length - take;
        break;
      }
    }
    sylls[k].coda = cluster.slice(0, split);
    sylls[k + 1].onset = cluster.slice(split);
  }
  return sylls;
}
