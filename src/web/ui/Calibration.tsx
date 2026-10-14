import { useEffect, useRef, useState } from 'react';
import { Calibrator, CalibrationProgress, HUM_MS, SILENCE_MS } from '../../core/audio/calibration';
import { engine } from '../audio/engine';
import { store, useStore } from '../store';

export function CalibrationScreen({ onDone }: { onDone: () => void }) {
  const settings = useStore((s) => s.settings);
  const existing = useStore((s) => s.calibration);
  const [progress, setProgress] = useState<CalibrationProgress>({ phase: 'idle', fraction: 0 });
  const [error, setError] = useState<string | null>(null);
  const calRef = useRef<Calibrator | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => () => unsubRef.current?.(), []);

  async function begin() {
    setError(null);
    unsubRef.current?.();
    try {
      await engine.start(settings.inputMode);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the microphone.');
      return;
    }
    // A moment to settle after the permission prompt, then measure silence.
    engine.setCalibration(null);
    const cal = new Calibrator();
    calRef.current = cal;
    let started = false;
    unsubRef.current = engine.onDb((s) => {
      if (!started) { started = true; cal.start(s.t); }
      const p = cal.push(s);
      setProgress(p);
      if (p.phase === 'done' && cal.result) {
        unsubRef.current?.();
        store.setCalibration(cal.result);
      }
      if (p.phase === 'failed') unsubRef.current?.();
    });
    setProgress({ phase: 'silence', fraction: 0 });
  }

  const p = progress;
  return (
    <section className="card">
      <h2>Calibrate your microphone</h2>
      <p className="muted">
        Two quick steps so the app knows your room and your normal voice. Everything stays on this device: only loudness numbers are
        used and no audio is recorded.
      </p>
      {settings.inputMode === 'simulated' && (
        <p className="notice">Dev mode: stay quiet for the first step, then hold <kbd>Space</kbd> (gentle) while the hum step runs.</p>
      )}

      <ol className="steps">
        <li className={p.phase === 'silence' ? 'active' : p.phase === 'idle' ? '' : 'done'}>
          <strong>1. Stay quiet</strong> <span className="muted">({SILENCE_MS / 1000} s, measures background noise)</span>
          <Bar value={p.phase === 'silence' ? p.fraction : p.phase === 'idle' ? 0 : 1} />
        </li>
        <li className={p.phase === 'hum' ? 'active' : p.phase === 'done' ? 'done' : ''}>
          <strong>2. Hum "mmm" at a comfortable level</strong> <span className="muted">({HUM_MS / 1000} s, steady, like a relaxed hum)</span>
          <Bar value={p.phase === 'hum' ? p.fraction : p.phase === 'done' ? 1 : 0} />
        </li>
      </ol>

      {p.phase === 'done' && <p className="ok" role="status">Calibration saved. You're ready to practice.</p>}
      {p.phase === 'failed' && <p className="warn" role="alert">{p.failure}</p>}
      {error && <p className="warn" role="alert">{error}</p>}
      {engine.micProcessingStillOn && (
        <p className="notice">Your browser kept some voice processing on (echo cancellation / noise suppression / auto gain). Results may be less accurate; try another browser or microphone.</p>
      )}

      <div className="row">
        <button className="btn primary" onClick={begin} disabled={p.phase === 'silence' || p.phase === 'hum'}>
          {p.phase === 'idle' ? (existing ? 'Recalibrate' : 'Start calibration') : p.phase === 'done' || p.phase === 'failed' ? 'Run again' : 'Calibrating…'}
        </button>
        {(p.phase === 'done' || existing) && <button className="btn" onClick={onDone}>Continue</button>}
      </div>
    </section>
  );
}

function Bar({ value }: { value: number }) {
  return <div className="bar" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${value * 100}%` }} /></div>;
}
