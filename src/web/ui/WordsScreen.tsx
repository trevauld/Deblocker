import { useState } from 'react';
import { pronounceWord } from '../../core/phonetics/pronounce';
import { useLexicon } from '../lexicon';
import { store, useStore } from '../store';

export function WordsScreen() {
  const words = useStore((s) => s.customWords);
  const lookup = useLexicon();
  const [text, setText] = useState('');
  return (
    <section className="card">
      <h2>My words</h2>
      <p className="muted">Add the words, names or sounds you find hard. They get their own curves and show up in your drills.</p>
      <form className="row" onSubmit={(e) => { e.preventDefault(); store.addWord(text); setText(''); }}>
        <label style={{ flex: 1, minWidth: 200 }}>
          <span className="muted small">New word or short phrase</span>
          <input type="text" value={text} onChange={(e) => setText(e.target.value)} maxLength={60} />
        </label>
        <button className="btn primary" type="submit" disabled={!text.trim()}>Add</button>
      </form>
      {words.length === 0 ? <p className="muted">No words yet.</p> : (
        <ul className="chips">
          {words.map((w) => {
            const info = lookup && w.text.split(/\s+/).length === 1 ? pronounceWord(w.text, lookup) : null;
            return (
              <li key={w.id}>
                <span>{w.text}</span>
                {info && <span className="muted small">{info.syllables.map((s) => s.text).join('·')}{!info.fromDictionary ? ' (guessed)' : ''}</span>}
                <button aria-label={`Remove ${w.text}`} onClick={() => store.removeWord(w.id)}>×</button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
