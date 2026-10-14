import { useState } from 'react';
import { localDate } from '../../core/tracking/stats';
import { store, useStore } from '../store';

const FIELDS = [
  { key: 'sleep', label: 'How did you sleep?', lo: 'poorly', hi: 'very well' },
  { key: 'energy', label: 'How is your energy?', lo: 'drained', hi: 'energised' },
  { key: 'stress', label: 'How stressed do you feel?', lo: 'calm', hi: 'very stressed' },
] as const;

export function CheckInScreen({ onDone }: { onDone: () => void }) {
  const today = localDate(Date.now());
  const existing = useStore((s) => s.checkins.find((c) => c.date === today));
  const [vals, setVals] = useState({ sleep: existing?.sleep ?? 0, energy: existing?.energy ?? 0, stress: existing?.stress ?? 0 });
  const ready = vals.sleep && vals.energy && vals.stress;
  return (
    <section className="card">
      <h2>Daily check-in</h2>
      <p className="muted">Optional and private. Over time it can show whether tiredness or stress goes with harder days.</p>
      {FIELDS.map((f) => (
        <fieldset key={f.key} style={{ border: 0, padding: 0, margin: '12px 0' }}>
          <legend>{f.label}</legend>
          <div className="stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} aria-pressed={vals[f.key] === n} aria-label={`${f.label} ${n} of 5`} onClick={() => setVals({ ...vals, [f.key]: n })}>{n}</button>
            ))}
          </div>
          <span className="muted small">1 = {f.lo} · 5 = {f.hi}</span>
        </fieldset>
      ))}
      <div className="row">
        <button className="btn primary" disabled={!ready} onClick={() => { store.saveCheckIn({ date: today, ...vals }); onDone(); }}>Save</button>
        <button className="btn" onClick={onDone}>Skip</button>
      </div>
    </section>
  );
}
