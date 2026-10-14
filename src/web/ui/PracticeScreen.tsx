import { useMemo, useState } from 'react';
import { generateCurve } from '../../core/curve/generate';
import { settingsForPace } from '../../core/curve/levelSettings';
import { GUIDANCE, GuidanceLevel } from '../../core/guidance/fading';
import { useLexicon } from '../lexicon';
import { useStore } from '../store';
import { LiveMatch } from './LiveMatch';

/** Free practice: type any word or phrase, pick pace and guidance level, and try it. */
export function PracticeScreen() {
  const lookup = useLexicon();
  const settings = useStore((s) => s.settings);
  const progress = useStore((s) => s.progress);
  const customWords = useStore((s) => s.customWords);
  const [text, setText] = useState('hello');
  const [applied, setApplied] = useState('hello');
  const [pace, setPace] = useState(progress.pace);
  const [level, setLevel] = useState<GuidanceLevel>(1);

  const curve = useMemo(
    () => (lookup && applied.trim() ? generateCurve(applied, { lookup, settings: settingsForPace(pace) }) : null),
    [lookup, applied, pace],
  );
  const cs = settingsForPace(pace);

  return (
    <>
      <section className="card">
        <h2>Practice</h2>
        <form className="row" onSubmit={(e) => { e.preventDefault(); setApplied(text); }}>
          <label style={{ flex: 1, minWidth: 220 }}>
            <span className="muted small">Word or phrase</span>
            <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. hello, my name is…" />
          </label>
          <button className="btn" type="submit">Make curve</button>
        </form>
        {customWords.length > 0 && (
          <div className="row">
            <span className="muted small">Your words:</span>
            {customWords.map((w) => <button key={w.id} className="btn" onClick={() => { setText(w.text); setApplied(w.text); }}>{w.text}</button>)}
          </div>
        )}
        <div className="grid">
          <label>
            <span className="muted small">Pace: {cs.msPerSyllable} ms per syllable, {cs.onsetMs} ms onset ramp</span>
            <input type="range" min={0} max={1} step={0.05} value={pace} onChange={(e) => setPace(Number(e.target.value))} />
          </label>
          <label>
            <span className="muted small">Guidance level</span>
            <select value={level} onChange={(e) => setLevel(Number(e.target.value) as GuidanceLevel)}>
              {([1, 2, 3, 4] as GuidanceLevel[]).map((l) => <option key={l} value={l}>{l}. {GUIDANCE[l].name}: {GUIDANCE[l].description}</option>)}
            </select>
          </label>
        </div>
      </section>
      {!lookup && <p className="muted">Loading pronunciations…</p>}
      {curve && (
        <LiveMatch
          key={`${applied}|${pace}|${level}`}
          curve={curve}
          text={applied}
          guidance={GUIDANCE[level]}
          strictness={settings.strictness}
          inputMode={settings.inputMode}
          autoplay={settings.simAutoplay}
        />
      )}
    </>
  );
}
