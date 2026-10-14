import { useEffect, useRef } from 'react';

interface Props {
  /** Draw callback. Called every animation frame when `animate`, otherwise on resize and when `deps` change. */
  render: (ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number) => void;
  animate?: boolean;
  deps?: unknown[];
  height?: number;
  label?: string;
}

export function CurveCanvas({ render, animate = false, deps = [], height = 220, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const renderRef = useRef(render);
  renderRef.current = render;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      draw();
    };
    const draw = () => renderRef.current(ctx, w, h, dpr);
    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    if (animate) raf = requestAnimationFrame(loop);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, ...deps]);

  return <canvas ref={ref} className="curve-canvas" style={{ height }} role="img" aria-label={label ?? 'Loudness graph'} />;
}
