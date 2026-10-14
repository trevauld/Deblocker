import type { PronounceFn } from './phonetics/pronounce';

/** Tiny CMU-format dictionary so tests don't need the 4 MB real one. */
const WORDS: Record<string, string> = {
  ah: 'AA1',
  a: 'AH0',
  ago: 'AH0 G OW1',
  hello: 'HH AH0 L OW1',
  home: 'HH OW1 M',
  man: 'M AE1 N',
  sun: 'S AH1 N',
  banana: 'B AH0 N AE1 N AH0',
  napkin: 'N AE1 P K IH0 N',
  extra: 'EH1 K S T R AH0',
  happy: 'HH AE1 P IY0',
  top: 'T AA1 P',
  pot: 'P AA1 T',
  zoo: 'Z UW1',
  van: 'V AE1 N',
  go: 'G OW1',
  to: 'T UW1',
  the: 'DH AH0',
  my: 'M AY1',
  name: 'N EY1 M',
  is: 'IH1 Z',
  i: 'AY1',
  would: 'W UH1 D',
  like: 'L AY1 K',
  coffee: 'K AO1 F IY0',
  please: 'P L IY1 Z',
  and: 'AE1 N D',
  we: 'W IY1',
  can: 'K AE1 N',
  see: 'S IY1',
  you: 'Y UW1',
  later: 'L EY1 T ER0',
  today: 'T AH0 D EY1',
  how: 'HH AW1',
  are: 'AA1 R',
  on: 'AA1 N',
  one: 'W AH1 N',
  breath: 'B R EH1 TH',
  easy: 'IY1 Z IY0',
};

export const testLookup: PronounceFn = (w) => WORDS[w];

export interface Sample {
  t: number;
  level: number;
}

/**
 * Synthetic user loudness for tests: silent until `startMs`, rises over `riseMs` to `peak`
 * (smoothstep-free linear ramp: riseMs≈0 means a sudden onset), holds, then falls over `fadeMs`.
 */
export function synthVoice(opts: {
  startMs?: number;
  riseMs: number;
  holdMs: number;
  peak?: number;
  fadeMs?: number;
  totalMs?: number;
  stepMs?: number;
}): Sample[] {
  const { startMs = 500, riseMs, holdMs, peak = 0.8, fadeMs = 250, stepMs = 16 } = opts;
  const endMs = startMs + riseMs + holdMs + fadeMs;
  const total = opts.totalMs ?? endMs + 600;
  const out: Sample[] = [];
  for (let t = 0; t <= total; t += stepMs) {
    let level = 0;
    if (t >= startMs && t < startMs + riseMs) level = (peak * (t - startMs)) / Math.max(1, riseMs);
    else if (t >= startMs + riseMs && t < startMs + riseMs + holdMs) level = peak;
    else if (t >= startMs + riseMs + holdMs && t < endMs) level = peak * (1 - (t - (startMs + riseMs + holdMs)) / fadeMs);
    if (riseMs <= 1 && t >= startMs && t < startMs + 1 + stepMs) level = Math.max(level, peak);
    out.push({ t, level });
  }
  return out;
}
