export interface PhraseChunk {
  /** Indices into the word list, [from, to). */
  from: number;
  to: number;
  /** True when this chunk starts a new sentence (gets a slightly longer breath pause). */
  newSentence: boolean;
}

export const MIN_CHUNK_WORDS = 3;
export const MAX_CHUNK_WORDS = 5;

/**
 * Break a word list into breath groups of 3–5 words. Sentence ends always force a break;
 * inside a sentence, words are spread evenly so no chunk is tiny.
 * Sentences shorter than 3 words stay as one (short) chunk.
 */
export function chunkWords(wordCount: number, sentenceOf: number[]): PhraseChunk[] {
  const chunks: PhraseChunk[] = [];
  let i = 0;
  let first = true;
  while (i < wordCount) {
    let j = i;
    while (j < wordCount && sentenceOf[j] === sentenceOf[i]) j++;
    const n = j - i;
    const k = Math.max(1, Math.ceil(n / MAX_CHUNK_WORDS));
    const base = Math.floor(n / k);
    const extra = n % k;
    let pos = i;
    for (let c = 0; c < k; c++) {
      const size = base + (c < extra ? 1 : 0);
      chunks.push({ from: pos, to: pos + size, newSentence: !first && c === 0 });
      pos += size;
      first = false;
    }
    i = j;
  }
  return chunks;
}
