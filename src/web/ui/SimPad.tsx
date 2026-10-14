import { useEffect, useState } from 'react';
import { engine } from '../audio/engine';

/** Dev-mode controls for the simulated voice. Visible only when the input mode is "simulated". */
export function SimPad() {
  const [amount, setAmount] = useState(0);
  const [hold, setHold] = useState(engine.sim.holdLevel);

  useEffect(() => {
    const id = setInterval(() => setAmount(engine.sim.voiceAmount), 50);
    const typing = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) engine.sim.press('gentle'); }
      else if (e.code === 'Enter' && !(e.target as HTMLElement)?.closest('button, a')) { e.preventDefault(); if (!e.repeat) engine.sim.press('sudden'); }
      else if (e.code === 'ArrowUp') { engine.sim.adjustHold(0.05); setHold(engine.sim.holdLevel); }
      else if (e.code === 'ArrowDown') { engine.sim.adjustHold(-0.05); setHold(engine.sim.holdLevel); }
    };
    const up = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.code === 'Enter') && !typing(e)) engine.sim.release();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      clearInterval(id);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const hold1 = (style: 'gentle' | 'sudden') => ({
    onPointerDown: (e: React.PointerEvent) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); engine.sim.press(style); },
    onPointerUp: () => engine.sim.release(),
    onPointerCancel: () => engine.sim.release(),
  });

  return (
    <div className="simpad" role="group" aria-label="Simulated voice (developer mode)">
      <strong>Simulated voice</strong>
      <button className="btn sim-gentle" {...hold1('gentle')}>Hold: gentle (Space)</button>
      <button className="btn sim-sudden" {...hold1('sudden')}>Hold: sudden (Enter)</button>
      <label>
        Level {Math.round(hold * 100)}%
        <input
          type="range" min={0.2} max={1} step={0.05} value={hold}
          onChange={(e) => { engine.sim.holdLevel = Number(e.target.value); setHold(Number(e.target.value)); }}
        />
      </label>
      <span className="simmeter" aria-hidden><span style={{ width: `${Math.min(100, amount * 100)}%` }} /></span>
    </div>
  );
}
