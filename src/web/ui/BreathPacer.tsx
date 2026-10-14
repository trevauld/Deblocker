import { useEffect, useRef, useState } from 'react';

/** Visual breathing pacer: in ~3 s, out ~5 s. Timing is driven by timeouts; the orb animates with CSS. */
export function BreathPacer({ cycles, inMs, outMs, onDone }: { cycles: number; inMs: number; outMs: number; onDone: () => void }) {
  const [state, setState] = useState<{ phase: 'ready' | 'in' | 'out' | 'done'; cycle: number }>({ phase: 'ready', cycle: 0 });
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function run(cycle: number) {
    setState({ phase: 'in', cycle });
    timer.current = window.setTimeout(() => {
      setState({ phase: 'out', cycle });
      timer.current = window.setTimeout(() => {
        if (cycle + 1 >= cycles) setState({ phase: 'done', cycle });
        else run(cycle + 1);
      }, outMs);
    }, inMs);
  }

  const scale = state.phase === 'in' ? 2.4 : 1;
  const dur = state.phase === 'in' ? inMs : state.phase === 'out' ? outMs : 300;
  const label =
    state.phase === 'in' ? 'Breathe in gently…' : state.phase === 'out' ? 'Let it out slowly, like a long sigh…' : state.phase === 'done' ? 'Nicely done.' : '';

  return (
    <section className="card">
      <h2>Breath warm-up</h2>
      <p className="muted">Relax your shoulders. In through the nose for about {Math.round(inMs / 1000)} s, out slowly for about {Math.round(outMs / 1000)} s. {cycles} breaths.</p>
      <div className="pacer" aria-hidden>
        <div className="orb" style={{ transform: `scale(${scale})`, transitionDuration: `${dur}ms` }} />
      </div>
      <div className="pacer-label" role="status">{label}{state.phase === 'in' || state.phase === 'out' ? ` (${state.cycle + 1}/${cycles})` : ''}</div>
      <div className="row">
        {state.phase === 'ready' && <button className="btn primary big" onClick={() => run(0)}>Begin breathing</button>}
        {state.phase === 'done' && <button className="btn primary" onClick={onDone}>Continue</button>}
        {state.phase !== 'done' && <button className="btn" onClick={onDone}>Skip</button>}
      </div>
    </section>
  );
}
