export interface DtwResult {
  /** Index pairs (i in a, j in b) along the optimal path. */
  path: [number, number][];
  cost: number;
}

/**
 * Dynamic time warping of two series with a Sakoe–Chiba window around the (length-scaled) diagonal.
 * `window` is in samples. A small penalty on non-diagonal steps discourages degenerate warps.
 */
export function dtw(a: number[], b: number[], window: number, stepPenalty = 0.02): DtwResult {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return { path: [], cost: Infinity };
  const INF = Infinity;
  const D: Float64Array[] = Array.from({ length: n }, () => new Float64Array(m).fill(INF));
  const centre = (i: number) => (n === 1 ? 0 : (i * (m - 1)) / (n - 1));
  const lo = (i: number) => Math.max(0, Math.ceil(centre(i) - window));
  const hi = (i: number) => Math.min(m - 1, Math.floor(centre(i) + window));
  for (let i = 0; i < n; i++) {
    for (let j = lo(i); j <= hi(i); j++) {
      const c = Math.abs(a[i] - b[j]);
      if (i === 0 && j === 0) { D[0][0] = c; continue; }
      const diag = i > 0 && j > 0 ? D[i - 1][j - 1] : INF;
      const up = i > 0 ? D[i - 1][j] + stepPenalty : INF;
      const left = j > 0 ? D[i][j - 1] + stepPenalty : INF;
      D[i][j] = c + Math.min(diag, up, left);
    }
  }
  // Backtrack.
  const path: [number, number][] = [];
  let i = n - 1;
  let j = m - 1;
  if (!isFinite(D[i][j])) return { path: [], cost: INF };
  path.push([i, j]);
  while (i > 0 || j > 0) {
    const diag = i > 0 && j > 0 ? D[i - 1][j - 1] : INF;
    const up = i > 0 ? D[i - 1][j] + stepPenalty : INF;
    const left = j > 0 ? D[i][j - 1] + stepPenalty : INF;
    const best = Math.min(diag, up, left);
    if (best === diag) { i--; j--; } else if (best === up) i--; else j--;
    path.push([i, j]);
  }
  path.reverse();
  return { path, cost: D[n - 1][m - 1] };
}
