import { useMemo, useState } from 'react';
import { generateCurve } from '../../core/curve/generate';
import { settingsForPace } from '../../core/curve/levelSettings';
import { BAND_NARROW } from '../../core/curve/levelSettings';
import { drawView } from '../draw';
import { useLexicon } from '../lexicon';
import { CurveCanvas } from './CurveCanvas';

/** Inspect generated curves: see the envelope, breath/syllable markers and how each word was pronounced. */
export function CurveLab() {
  const lookup = useLexicon();
  const [text, setText] = useState('Hello, my name is Sam. I would like a cup of coffee, please.');
  const [pace, setPace] = useState(0);
  const curve = useMemo(() => (lookup && text.trim() ? generateCurve(text, { lookup, settings: settingsForPace(pace) }) : null), [lookup, text, pace]);
  const s = settingsForPace(pace);

  return (
    <section className="card">
      <h2>Curve lab</h2>
      <p className="muted">See the ideal loudness curve for any text: easy onset, slow tempo and breath groups of 3–5 words.</p>
      <label><span className="muted small">Text</span><textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} /></label>
      <label>
        <span className="muted small">Pace {pace.toFixed(2)}: {s.msPerSyllable} ms/syllable · onset {s.onsetMs} ms · breath pause {s.pauseMs} ms</span>
        <input type="range" min={0} max={1} step={0.05} value={pace} onChange={(e) => setPace(Number(e.target.value))} />
      </label>
      {!curve ? <p className="muted">{lookup ? 'Enter some text.' : 'Loading pronunciations…'}</p> : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: Math.min(2400, Math.max(320, curve.durationMs / 6)) }}>
              <CurveCanvas
                height={240}
                deps={[curve]}
                label="Generated target loudness curve"
                render={(ctx, w, h, dpr) => drawView(ctx, w, h, { from: 0, to: curve.durationMs, curve, showTarget: true, bandHalfWidth: BAND_NARROW, user: [], dpr })}
              />
            </div>
          </div>
          <p className="muted small">
            Duration {(curve.durationMs / 1000).toFixed(1)} s · {curve.syllables.length} syllables · {curve.chunks.length} breath group{curve.chunks.length === 1 ? '' : 's'}
          </p>
          <ul className="chips" aria-label="Words">
            {curve.words.map((w) => (
              <li key={w.index} title={w.known ? 'In the pronunciation dictionary' : 'Not in the dictionary: pronunciation guessed from spelling'}>
                {curve.syllables.filter((x) => x.wordIndex === w.index).map((x) => x.text).join('·')}
                {!w.known && <span className="badge">guessed</span>}
                <span style={{ width: 6 }} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
