import { levelAt } from '../core/curve/generate';
import type { GeneratedCurve } from '../core/curve/types';

export interface UserPoint { t: number; level: number }

export interface ViewOptions {
  /** Visible time window in ms. */
  from: number;
  to: number;
  curve: GeneratedCurve | null;
  showTarget: boolean;
  bandHalfWidth: number;
  user: UserPoint[];
  /** Time of the fixed "now" line (scrolling views). */
  nowT?: number;
  showMarkers?: boolean;
  /** Draw label strip such as "Breathe". */
  dpr: number;
}

const css = (name: string, fallback: string) =>
  (typeof document !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback;

export function drawView(ctx: CanvasRenderingContext2D, w: number, h: number, o: ViewOptions) {
  const accent = css('--accent', '#5ad1b5');
  const user = css('--user', '#ffb454');
  const grid = css('--grid', 'rgba(255,255,255,0.08)');
  const text = css('--muted', '#8ea3b5');
  const padT = 14;
  const padB = 22;
  const innerH = h - padT - padB;
  const span = o.to - o.from;
  const x = (t: number) => ((t - o.from) / span) * w;
  const y = (lvl: number) => padT + (1 - Math.min(1.05, Math.max(0, lvl))) * innerH;

  ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  for (const l of [0, 0.25, 0.5, 0.75, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, y(l));
    ctx.lineTo(w, y(l));
    ctx.stroke();
  }

  const c = o.curve;
  if (c && o.showTarget) {
    // Tolerance band
    const pts = c.envelope.filter((p) => p.t >= o.from - 50 && p.t <= o.to + 50);
    if (pts.length > 1) {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(x(p.t), y(p.level + o.bandHalfWidth)) : ctx.moveTo(x(p.t), y(p.level + o.bandHalfWidth))));
      for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(x(pts[i].t), y(Math.max(0, pts[i].level - o.bandHalfWidth)));
      ctx.closePath();
      ctx.fillStyle = hexA(accent, 0.16);
      ctx.fill();
      // Target line
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(x(p.t), y(p.level)) : ctx.moveTo(x(p.t), y(p.level))));
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    if (o.showMarkers !== false) {
      ctx.font = '11px system-ui, sans-serif';
      ctx.textBaseline = 'alphabetic';
      for (const m of c.markers) {
        if (m.t < o.from || m.t > o.to) continue;
        if (m.type === 'breath') {
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = hexA(text, 0.7);
          ctx.beginPath();
          ctx.moveTo(x(m.t), padT);
          ctx.lineTo(x(m.t), h - padB);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = text;
          ctx.fillText('breathe', Math.min(w - 44, x(m.t) + 4), padT + 10);
        } else if (m.type === 'syllable') {
          ctx.strokeStyle = grid;
          ctx.beginPath();
          ctx.moveTo(x(m.t), h - padB);
          ctx.lineTo(x(m.t), h - padB + 6);
          ctx.stroke();
          ctx.fillStyle = text;
          if (span < 9000) ctx.fillText(m.label ?? '', x(m.t) + 2, h - 6);
        }
      }
    }
  }

  // User's trace
  const up = o.user.filter((p) => p.t >= o.from - 50 && p.t <= o.to + 50);
  if (up.length > 1) {
    ctx.beginPath();
    up.forEach((p, i) => (i ? ctx.lineTo(x(p.t), y(p.level)) : ctx.moveTo(x(p.t), y(p.level))));
    ctx.strokeStyle = user;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.lineTo(x(up[up.length - 1].t), y(0));
    ctx.lineTo(x(up[0].t), y(0));
    ctx.closePath();
    ctx.fillStyle = hexA(user, 0.14);
    ctx.fill();
  }

  // "Now" line
  if (o.nowT !== undefined) {
    ctx.strokeStyle = css('--text', '#e8f0f6');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x(o.nowT), 0);
    ctx.lineTo(x(o.nowT), h - padB);
    ctx.stroke();
    if (c && o.showTarget) {
      ctx.fillStyle = css('--text', '#e8f0f6');
      ctx.beginPath();
      ctx.arc(x(o.nowT), y(levelAt(c, o.nowT)), 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function hexA(color: string, a: number) {
  const m = color.match(/^#([0-9a-f]{6})$/i);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
