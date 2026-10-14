export interface Series { name: string; values: (number | null)[]; cls: 'a' | 'b' }

/** Minimal SVG line chart: x = session number, y = value. */
export function LineChart({ series, labels, yMax, yLabel, height = 180, format = (v: number) => String(Math.round(v)) }: {
  series: Series[];
  labels: string[];
  yMax: number;
  yLabel: string;
  height?: number;
  format?: (v: number) => string;
}) {
  const W = 640;
  const H = height;
  const padL = 36;
  const padR = 10;
  const padT = 10;
  const padB = 24;
  const n = labels.length;
  const x = (i: number) => padL + (n <= 1 ? (W - padL - padR) / 2 : (i / (n - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - Math.min(1, Math.max(0, v / yMax))) * (H - padT - padB);
  return (
    <figure style={{ margin: '8px 0' }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${yLabel} by session`}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line className="axis" x1={padL} x2={W - padR} y1={y(f * yMax)} y2={y(f * yMax)} />
            <text x={padL - 6} y={y(f * yMax) + 4} textAnchor="end">{format(f * yMax)}</text>
          </g>
        ))}
        {labels.map((l, i) => (n <= 8 || i % Math.ceil(n / 8) === 0) && <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{l}</text>)}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(v)] as const));
          const d = pts.reduce((acc, p, i) => (p ? acc + `${acc && pts[i - 1] ? 'L' : 'M'}${p[0]},${p[1]} ` : acc), '');
          return (
            <g key={s.name}>
              <path className={`line-${s.cls}`} d={d} />
              {pts.map((p, i) => p && <circle key={i} className={s.cls} cx={p[0]} cy={p[1]} r={3.5}><title>{`${s.name}: ${format(s.values[i]!)}`}</title></circle>)}
            </g>
          );
        })}
      </svg>
      <figcaption className="legend">
        <span>{yLabel}</span>
        {series.map((s) => <span key={s.name}><i style={{ background: s.cls === 'a' ? 'var(--accent)' : 'var(--user)' }} />{s.name}</span>)}
      </figcaption>
    </figure>
  );
}
