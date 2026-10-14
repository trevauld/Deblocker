import { classify, Phoneme } from './phonemeClasses';

const VOWEL_LETTERS = 'aeiouy';
const isVowelLetter = (ch: string) => VOWEL_LETTERS.includes(ch);

/**
 * Rule-based guess at a word's phonemes from its spelling, for words missing from the dictionary
 * (names, the user's own feared words, typos). Deliberately rough: only the phoneme *class*
 * and stress matter to the curve generator, not exact vowel quality.
 */
export function guessPhonemes(word: string): Phoneme[] {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  const out: string[] = [];
  const push = (...syms: string[]) => out.push(...syms);
  let i = 0;
  // Silent final "e" after a consonant ("make", "stone").
  const end = w.length > 2 && w.endsWith('e') && !isVowelLetter(w[w.length - 2]) ? w.length - 1 : w.length;
  while (i < end) {
    const c = w[i];
    const two = w.slice(i, i + 2);
    const three = w.slice(i, i + 3);
    if (three === 'tch') { push('CH'); i += 3; continue; }
    if (two === 'th') { push('TH'); i += 2; continue; }
    if (two === 'sh') { push('SH'); i += 2; continue; }
    if (two === 'ch') { push('CH'); i += 2; continue; }
    if (two === 'ph') { push('F'); i += 2; continue; }
    if (two === 'ck') { push('K'); i += 2; continue; }
    if (two === 'ng') { push('NG'); i += 2; continue; }
    if (two === 'wh') { push('W'); i += 2; continue; }
    if (two === 'qu') { push('K', 'W'); i += 2; continue; }
    if (two === 'kn' && i === 0) { push('N'); i += 2; continue; }
    if (two === 'wr' && i === 0) { push('R'); i += 2; continue; }
    if (two === 'gh') { i += 2; continue; }
    if (isVowelLetter(c)) {
      // y at the start of a word acts as a consonant glide.
      if (c === 'y' && i === 0) { push('Y'); i++; continue; }
      // Vowel group → one vowel (diphthong/long vowels collapse into a single nucleus).
      let j = i;
      while (j < end && isVowelLetter(w[j])) j++;
      push('AH');
      i = j;
      continue;
    }
    const map: Record<string, string[]> = {
      b: ['B'], c: ['K'], d: ['D'], f: ['F'], g: ['G'], h: ['HH'], j: ['JH'], k: ['K'], l: ['L'],
      m: ['M'], n: ['N'], p: ['P'], q: ['K'], r: ['R'], s: ['S'], t: ['T'], v: ['V'], w: ['W'],
      x: ['K', 'S'], z: ['Z'],
    };
    push(...(map[c] ?? []));
    i++;
  }
  if (!out.some((s) => classify(s) === 'vowel')) out.push('AH');
  // Stress: first vowel primary.
  let stressed = false;
  return out.map((sym) => {
    const cls = classify(sym);
    let stress = 0;
    if (cls === 'vowel' && !stressed) { stress = 1; stressed = true; }
    return { sym, cls, stress };
  });
}

/**
 * Split the spelling of a word into `n` display chunks (for syllable highlighting).
 * Cuts fall between vowel groups using the usual V|CV and VC|CV habits; if the spelling
 * disagrees with the phonetic syllable count, cuts are spread proportionally.
 */
export function splitSpelling(word: string, n: number): string[] {
  if (n <= 1 || word.length <= 1) return [word];
  const lower = word.toLowerCase();
  const end = lower.length > 2 && lower.endsWith('e') && !isVowelLetter(lower[lower.length - 2]) ? lower.length - 1 : lower.length;
  // Find vowel groups within [0,end).
  const groups: [number, number][] = [];
  for (let i = 0; i < end; ) {
    if (isVowelLetter(lower[i]) && !(lower[i] === 'y' && i === 0)) {
      let j = i;
      while (j < end && isVowelLetter(lower[j])) j++;
      groups.push([i, j]);
      i = j;
    } else i++;
  }
  const cuts: number[] = [];
  for (let g = 0; g < groups.length - 1; g++) {
    const gapStart = groups[g][1];
    const gapEnd = groups[g + 1][0];
    const gap = gapEnd - gapStart;
    cuts.push(gap <= 1 ? gapStart : gapStart + Math.floor(gap / 2));
  }
  let chosen = cuts;
  if (cuts.length > n - 1) {
    chosen = [];
    for (let k = 1; k < n; k++) chosen.push(cuts[Math.round((k * cuts.length) / n) - 1] ?? cuts[cuts.length - 1]);
  } else if (cuts.length < n - 1) {
    chosen = [...cuts];
    for (let k = 1; chosen.length < n - 1; k++) {
      const pos = Math.round((k * word.length) / n);
      if (!chosen.includes(pos) && pos > 0 && pos < word.length) chosen.push(pos);
      if (k > word.length) break;
    }
    chosen.sort((a, b) => a - b);
  }
  const uniq = [...new Set(chosen)].filter((c) => c > 0 && c < word.length).sort((a, b) => a - b);
  const parts: string[] = [];
  let prev = 0;
  for (const c of uniq) {
    parts.push(word.slice(prev, c));
    prev = c;
  }
  parts.push(word.slice(prev));
  return parts;
}
