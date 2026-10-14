import { useEffect, useState } from 'react';
import type { PronounceFn } from '../core/phonetics/pronounce';

let cached: Promise<PronounceFn> | null = null;

/** Lazy-loads the trimmed CMU dictionary (public/lexicon.json). Falls back to spelling rules if it can't be fetched. */
export function loadLexicon(): Promise<PronounceFn> {
  cached ??= fetch(`${import.meta.env.BASE_URL}lexicon.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`lexicon ${r.status}`);
      return r.json() as Promise<Record<string, string>>;
    })
    .then((dict) => ((w: string) => dict[w]) as PronounceFn)
    .catch((e) => {
      console.warn('Pronunciation dictionary unavailable, using spelling rules only.', e);
      return (() => undefined) as PronounceFn;
    });
  return cached;
}

export function useLexicon(): PronounceFn | null {
  const [lookup, setLookup] = useState<PronounceFn | null>(null);
  useEffect(() => {
    let alive = true;
    loadLexicon().then((l) => alive && setLookup(() => l));
    return () => { alive = false; };
  }, []);
  return lookup;
}
