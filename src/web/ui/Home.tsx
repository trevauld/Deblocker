import { GUIDANCE } from '../../core/guidance/fading';
import { useStore } from '../store';
import type { Screen } from '../App';

export function Home({ go }: { go: (s: Screen) => void }) {
  const cal = useStore((s) => s.calibration);
  const progress = useStore((s) => s.progress);
  const fading = useStore((s) => s.fading);
  const sessions = useStore((s) => s.sessions);
  const last = sessions[sessions.length - 1];
  const stageName = { words: 'Words', sentences: 'Sentences', passages: 'Reading passages', free: 'Free speech' }[progress.stage];

  return (
    <>
      <section className="card">
        <h2>Today's practice</h2>
        <p className="muted">
          About 10 minutes: breathing, a soft "ahhh", then {stageName.toLowerCase()} at guidance level {fading.level} ({GUIDANCE[fading.level].name}).
          {last && <> Last time: {last.easyOnsetPct}% easy starts.</>}
        </p>
        {!cal && <p className="notice">First, a 5-second microphone calibration.</p>}
        <div className="row">
          {cal ? <button className="btn primary big" onClick={() => go('session')}>Start today's session</button> : <button className="btn primary big" onClick={() => go('calibrate')}>Calibrate microphone</button>}
        </div>
      </section>
      <div className="grid">
        <button className="tile" onClick={() => go('practice')}><strong>Practice a word or phrase</strong><span className="muted small">Type anything, choose pace and guidance.</span></button>
        <button className="tile" onClick={() => go('words')}><strong>My words</strong><span className="muted small">Add the words you find hardest.</span></button>
        <button className="tile" onClick={() => go('progress')}><strong>Progress</strong><span className="muted small">{sessions.length} session{sessions.length === 1 ? '' : 's'} so far.</span></button>
        <button className="tile" onClick={() => go('checkin')}><strong>Daily check-in</strong><span className="muted small">Sleep, energy, stress (optional).</span></button>
        <button className="tile" onClick={() => go('curves')}><strong>Curve lab</strong><span className="muted small">See how target curves are built.</span></button>
        <button className="tile" onClick={() => go('meter')}><strong>Live loudness</strong><span className="muted small">Test your calibration.</span></button>
      </div>
    </>
  );
}
