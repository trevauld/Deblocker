export type PhonemeClass =
  | 'vowel'
  | 'sonorant' // nasals, liquids, glides: m n ng l r w y
  | 'voicedFricative' // v z zh dh
  | 'voicelessFricative' // f s sh th
  | 'h'
  | 'stop'; // p b t d k g (+ affricates ch jh)

export interface Phoneme {
  /** ARPAbet symbol without stress digit, e.g. "AH". */
  sym: string;
  cls: PhonemeClass;
  /** 0 = unstressed, 1 = primary, 2 = secondary. Only meaningful for vowels. */
  stress: number;
}

const VOWELS = new Set('AA AE AH AO AW AY EH ER EY IH IY OW OY UH UW'.split(' '));
const SONORANTS = new Set('M N NG L R W Y'.split(' '));
const VOICED_FRIC = new Set('V Z ZH DH'.split(' '));
const VOICELESS_FRIC = new Set('F S SH TH'.split(' '));
const STOPS = new Set('P B T D K G CH JH'.split(' '));

export function classify(sym: string): PhonemeClass {
  if (VOWELS.has(sym)) return 'vowel';
  if (SONORANTS.has(sym)) return 'sonorant';
  if (VOICED_FRIC.has(sym)) return 'voicedFricative';
  if (VOICELESS_FRIC.has(sym)) return 'voicelessFricative';
  if (sym === 'HH') return 'h';
  if (STOPS.has(sym)) return 'stop';
  return 'sonorant';
}

/** Parse a CMU entry such as "B AW1 T" into phonemes. */
export function parseArpabet(entry: string): Phoneme[] {
  return entry
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => {
      const m = tok.match(/^([A-Z]+)([012])?$/);
      const sym = m ? m[1] : tok;
      const stress = m && m[2] ? Number(m[2]) : 0;
      return { sym, cls: classify(sym), stress };
    });
}

export const isVowel = (p: Phoneme) => p.cls === 'vowel';
