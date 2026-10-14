import { parseArpabet, Phoneme } from './phonemeClasses';
import { guessPhonemes, splitSpelling } from './spelling';
import { PhoneSyllable, syllabify } from './syllabify';

/** Looks a lowercase word up in a pronunciation dictionary (CMU format, e.g. "B AW1 T"). */
export type PronounceFn = (word: string) => string | undefined;

export interface WordSyllable extends PhoneSyllable {
  /** Spelling chunk for display. */
  text: string;
}

export interface PronouncedWord {
  /** Word as written (letters and apostrophes). */
  text: string;
  syllables: WordSyllable[];
  phonemes: Phoneme[];
  /** True when the dictionary had the word; false when the spelling-based fallback was used. */
  fromDictionary: boolean;
}

/** Split free text into words (letters + inner apostrophes), plus the sentence each belongs to. */
export function tokenize(text: string): { words: string[]; sentenceOf: number[] } {
  const words: string[] = [];
  const sentenceOf: number[] = [];
  let sentence = 0;
  const re = /([A-Za-z]+(?:'[A-Za-z]+)*)|([.!?;:\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1]) {
      words.push(m[1]);
      sentenceOf.push(sentence);
    } else if (words.length && sentenceOf[sentenceOf.length - 1] === sentence) {
      sentence++;
    }
  }
  return { words, sentenceOf };
}

export function pronounceWord(word: string, lookup: PronounceFn): PronouncedWord {
  const key = word.toLowerCase();
  const entry = lookup(key);
  const fromDictionary = entry !== undefined;
  const phonemes = fromDictionary ? parseArpabet(entry!) : guessPhonemes(key);
  const phoneSylls = syllabify(phonemes);
  const chunks = splitSpelling(word, phoneSylls.length);
  const syllables: WordSyllable[] = phoneSylls.map((s, i) => ({ ...s, text: chunks[i] ?? '' }));
  return { text: word, syllables, phonemes, fromDictionary };
}

export function syllableCount(text: string, lookup: PronounceFn): number {
  return tokenize(text).words.reduce((n, w) => n + pronounceWord(w, lookup).syllables.length, 0);
}
