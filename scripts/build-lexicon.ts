// Trims the CMU Pronouncing Dictionary into a compact JSON file that the app lazy-loads.
// Format: { "word": "B AW1 T", ... } — alphabetic words (plus apostrophes) only, lowercase.
import { dictionary } from 'cmu-pronouncing-dictionary';
import { mkdirSync, writeFileSync } from 'node:fs';

const out: Record<string, string> = {};
for (const [word, phones] of Object.entries(dictionary)) {
  if (/^[a-z']+$/.test(word) && !word.startsWith("'")) out[word] = phones;
}
mkdirSync('public', { recursive: true });
writeFileSync('public/lexicon.json', JSON.stringify(out));
console.log(`lexicon.json: ${Object.keys(out).length} words`);
