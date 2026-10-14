import { describe, expect, it } from 'vitest';
import { testLookup } from '../testing';
import { pronounceWord, tokenize } from './pronounce';
import { splitSpelling } from './spelling';

describe('syllabification', () => {
  const syl = (w: string) => pronounceWord(w, testLookup).syllables;

  it('counts syllables from the dictionary', () => {
    expect(syl('banana')).toHaveLength(3);
    expect(syl('man')).toHaveLength(1);
    expect(syl('happy')).toHaveLength(2);
  });

  it('assigns onsets by maximal legal onset', () => {
    const [a, b] = syl('napkin');
    expect(a.coda.map((p) => p.sym)).toEqual(['P']);
    expect(b.onset.map((p) => p.sym)).toEqual(['K']);
    const [e, x] = syl('extra');
    expect(e.coda.map((p) => p.sym)).toEqual(['K']);
    expect(x.onset.map((p) => p.sym)).toEqual(['S', 'T', 'R']);
  });

  it('marks stress', () => {
    const s = syl('banana');
    expect(s.map((x) => x.stressed)).toEqual([false, true, false]);
  });

  it('falls back to spelling rules for unknown words', () => {
    const p = pronounceWord('zorblax', () => undefined);
    expect(p.fromDictionary).toBe(false);
    expect(p.syllables.length).toBeGreaterThanOrEqual(2);
    expect(p.syllables.map((s) => s.text).join('')).toBe('zorblax');
    const silentE = pronounceWord('stone', () => undefined);
    expect(silentE.syllables).toHaveLength(1);
  });

  it('splits spelling into display chunks', () => {
    expect(splitSpelling('banana', 3)).toEqual(['ba', 'na', 'na']);
    expect(splitSpelling('napkin', 2).join('')).toBe('napkin');
    expect(splitSpelling('cat', 1)).toEqual(['cat']);
    expect(splitSpelling('rhythm', 2).join('')).toBe('rhythm');
  });

  it('tokenizes words and sentences', () => {
    const { words, sentenceOf } = tokenize("I can't go. See you!");
    expect(words).toEqual(['I', "can't", 'go', 'See', 'you']);
    expect(sentenceOf).toEqual([0, 0, 0, 1, 1]);
  });
});
