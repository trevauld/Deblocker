import type { LatencyRecord } from './types';

export interface Agreement {
  n: number;
  /** Percent of attempts where the app's flag and the observer's block agree. */
  agreementPct: number;
  /** Cohen's kappa; null when it is undefined (all attempts in one category). */
  kappa: number | null;
  /** 2×2 counts. */
  both: number;
  appOnly: number;
  observerOnly: number;
  neither: number;
}

/**
 * Attempt-level agreement between the app's flags (long start or gap) and an observer who tapped when they heard a block.
 * Only attempts recorded in observer mode count.
 */
export function observerAgreement(records: LatencyRecord[]): Agreement | null {
  const rs = records.filter((r) => r.observerTaps !== undefined);
  if (!rs.length) return null;
  let both = 0, appOnly = 0, observerOnly = 0, neither = 0;
  for (const r of rs) {
    const app = r.flagged;
    const obs = (r.observerTaps?.length ?? 0) > 0;
    if (app && obs) both++;
    else if (app) appOnly++;
    else if (obs) observerOnly++;
    else neither++;
  }
  const n = rs.length;
  const po = (both + neither) / n;
  const pApp = (both + appOnly) / n;
  const pObs = (both + observerOnly) / n;
  const pe = pApp * pObs + (1 - pApp) * (1 - pObs);
  return {
    n,
    agreementPct: Math.round(po * 100),
    kappa: pe >= 1 ? null : Math.round(((po - pe) / (1 - pe)) * 100) / 100,
    both, appOnly, observerOnly, neither,
  };
}
