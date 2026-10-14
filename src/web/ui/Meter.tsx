import { useEffect, useRef, useState } from 'react';
import { engine } from '../audio/engine';
import { drawView, UserPoint } from '../draw';
import { store, useStore } from '../store';
import { CurveCanvas } from './CurveCanvas';

/** Live loudness meter: normalized 0–1 level, scrolling trace of the last 8 seconds. */
export function MeterScreen() {
  const settings = useStore((s) => s.settings);
  const cal = useStore((s) => s.calibration);
  const [error, setError] = useState<string | null>(null);
  const [on, setOn] = useState(false);
  const [level, setLevel] = useState(0);
  const trace = useRef<UserPoint[]>([]);

  useEffect(() => {
    if (!on) return;
    const unsub = engine.onLevel((s) => {
      trace.current.push({ t: s.t, level: s.level });
      const cutoff = s.t - 9000;
      while (trace.current.length && trace.current[0].t < cutoff) trace.current.shift();
    });
    const id = setInterval(() => {
      const last = trace.current[trace.current.length - 1];
      setLevel(last ? last.level : 0);
    }, 50);
    return () => { unsub(); clearInterval(id); };
  }, [on]);

  async function start() {
    try {
      await engine.start(settings.inputMode);
      setOn(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the microphone.');
    }
  }

  return (
    <section className="card">
      <h2>Live loudness</h2>
      {!cal && <p className="notice">Calibrate first so the meter knows your noise floor and normal level.</p>}
      <div className="row">
        <button className="btn primary" onClick={start} disabled={on || !cal}>{on ? 'Listening…' : 'Start listening'}</button>
        <button className="btn" onClick={() => { engine.stop(); setOn(false); }} disabled={!on}>Stop</button>
        <button className="btn" onClick={() => store.updateSettings({ inputMode: settings.inputMode === 'mic' ? 'simulated' : 'mic' })}>
          Input: {settings.inputMode === 'mic' ? 'Microphone' : 'Simulated voice'}
        </button>
      </div>
      {error && <p className="warn" role="alert">{error}</p>}
      <div className="levelbar" aria-label={`Level ${Math.round(level * 100)} percent`}>
        <div style={{ width: `${level * 100}%` }} />
        <span>{level.toFixed(2)}</span>
      </div>
      <CurveCanvas
        animate={on}
        height={180}
        label="Your loudness over the last eight seconds"
        render={(ctx, w, h, dpr) => {
          const now = performance.now();
          drawView(ctx, w, h, { from: now - 8000, to: now, curve: null, showTarget: false, bandHalfWidth: 0, user: trace.current, dpr });
        }}
      />
      <p className="muted small">Hum softly and watch the line: 1.0 is your calibrated comfortable level.</p>
    </section>
  );
}
