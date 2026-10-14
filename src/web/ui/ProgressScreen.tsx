import { useMemo } from 'react';
import { triggerInsights } from '../../core/tracking/stats';
import { useStore } from '../store';
import { LineChart } from './LineChart';

export function ProgressScreen() {
  const sessions = useStore((s) => s.sessions);
  const checkins = useStore((s) => s.checkins);
  const insights = useMemo(() => triggerInsights(sessions, checkins), [sessions, checkins]);
  const recent = sessions.slice(-30);
  const labels = recent.map((s) => s.date.slice(5));

  if (!recent.length) {
    return (
      <section className="card">
        <h2>Progress</h2>
        <p className="muted">Finish a practice session and your progress will show up here. Everything is stored on this device only.</p>
      </section>
    );
  }
  return (
    <>
      <section className="card">
        <h2>Progress</h2>
        <LineChart
          yLabel="Easy-onset rate (%) and average score"
          yMax={100}
          labels={labels}
          series={[
            { name: 'Easy onset %', cls: 'a', values: recent.map((s) => s.easyOnsetPct) },
            { name: 'Average score', cls: 'b', values: recent.map((s) => s.avgScore) },
          ]}
        />
        <LineChart
          yLabel="Tempo (× target) and breath group (s)"
          yMax={3}
          labels={labels}
          format={(v) => v.toFixed(1)}
          series={[
            { name: 'Tempo ×', cls: 'a', values: recent.map((s) => (s.avgTempoRatio ? s.avgTempoRatio : null)) },
            { name: 'Breath group s', cls: 'b', values: recent.map((s) => (s.avgPhraseMs ? Math.min(3, s.avgPhraseMs / 1000) : null)) },
          ]}
        />
      </section>
      {insights.length > 0 && (
        <section className="card">
          <h2>Possible triggers</h2>
          <ul>{insights.map((i) => <li key={i.factor}>{i.text}</li>)}</ul>
          <p className="muted small">Based on your daily check-ins. These are patterns in your own practice data, not medical findings.</p>
        </section>
      )}
      <section className="card">
        <h2>Sessions</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="sessions">
            <thead><tr><th>Date</th><th>Stage</th><th>Level</th><th>Easy onset</th><th>Tempo</th><th>Breath group</th><th>Score</th></tr></thead>
            <tbody>
              {[...sessions].reverse().map((s) => (
                <tr key={s.id}>
                  <td>{s.date}</td><td>{s.stage}</td><td>{s.guidanceLevel}</td><td>{s.easyOnsetPct}%</td>
                  <td>{s.avgTempoRatio ? `${s.avgTempoRatio.toFixed(2)}×` : '–'}</td>
                  <td>{s.avgPhraseMs ? `${(s.avgPhraseMs / 1000).toFixed(1)} s` : '–'}</td><td>{s.avgScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
