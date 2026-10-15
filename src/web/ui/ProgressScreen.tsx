import { useMemo } from 'react';
import { attemptsToCsv, baselineBand, BASELINE_DAYS, computeReference, observerAgreement, weeklySummaries, wordStats } from '../../core/latency';
import { triggerInsights } from '../../core/tracking/stats';
import { store, useStore } from '../store';
import { useState } from 'react';
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
      <StartTimeSection />
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

const sec = (ms: number | null) => (ms === null ? '–' : `${(ms / 1000).toFixed(1)} s`);

/** Start-time trends: weekly medians against a fixed baseline band, hardest words, exports and observer agreement. */
function StartTimeSection() {
  const records = useStore((s) => s.latency);
  const baseline = useStore((s) => s.latencyBaseline);
  const [confirm, setConfirm] = useState(false);
  const now = Date.now();
  const ref = computeReference(records, baseline, now);
  const weeks = weeklySummaries(records, baseline);
  const band = baselineBand(records, baseline);
  const words = wordStats(records, now).slice(0, 8);
  const agreement = observerAgreement(records);

  if (!records.length) {
    return (
      <section className="card">
        <h2>Start times</h2>
        <p className="muted">
          After a few sessions you'll see how long words take to start, per word and by week. The first {BASELINE_DAYS / 7} weeks set your personal baseline.
        </p>
      </section>
    );
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([attemptsToCsv(records)], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `deblocker-attempts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxSec = Math.max(2, ...weeks.map((w) => (w.medianLatencyMs ?? 0) / 1000), band ? band[1] / 1000 : 0) * 1.15;
  return (
    <section className="card">
      <h2>Start times</h2>
      <p>
        {ref.referenceMs !== null ? (
          <>Your reference (median start on easy words in the baseline): <strong>{sec(ref.referenceMs)}</strong> {ref.locked ? '(fixed)' : `(provisional until ${new Date(ref.endsAt as number).toLocaleDateString()})`}.</>
        ) : (
          <>Building your baseline: {Math.max(0, 8 - ref.easyCount)} more easy-word attempts needed for a reference.</>
        )}
      </p>
      {weeks.length > 0 && (
        <LineChart
          yLabel="Weekly median start time (s)"
          yMax={maxSec}
          labels={weeks.map((w) => `Wk ${w.week + 1}`)}
          format={(v) => v.toFixed(1)}
          band={band ? [band[0] / 1000, band[1] / 1000] : null}
          bandLabel="Baseline range (middle half of weeks 1–2)"
          series={[{ name: 'Weekly median', cls: 'a', values: weeks.map((w) => (w.medianLatencyMs === null ? null : w.medianLatencyMs / 1000)) }]}
        />
      )}
      <p className="muted small">
        Judge change over several weeks, not single sessions. Early gains often fade, so a good start to the programme doesn't yet say much.
        These are practice markers, not a clinical measure.
      </p>

      {words.length > 0 && (
        <>
          <h3>Words, hardest first</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="sessions">
              <thead><tr><th>Word</th><th>Tries</th><th>Median start</th><th>Long starts</th><th>Last 4 weeks</th></tr></thead>
              <tbody>
                {words.map((w) => (
                  <tr key={w.text}>
                    <td>{w.text}</td><td>{w.attempts}</td><td>{sec(w.medianLatencyMs)}</td><td>{w.longStartPct}%</td>
                    <td>
                      {w.weekMedians.map((m) => sec(m)).join(' → ')}
                      {w.trend && <span className="badge" style={{ marginLeft: 6 }}>{w.trend === 'better' ? 'getting quicker' : w.trend === 'worse' ? 'slower lately' : 'steady'}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">Words with the most long starts come up more often in your drills as "Words to revisit".</p>
        </>
      )}

      {agreement && (
        <>
          <h3>Observer check</h3>
          <p>
            Across {agreement.n} observed attempts the app's flags and the observer agreed {agreement.agreementPct}% of the time
            (Cohen's κ {agreement.kappa === null ? 'not defined' : agreement.kappa.toFixed(2)}).
          </p>
          <p className="muted small">Both flagged {agreement.both} · app only {agreement.appOnly} · observer only {agreement.observerOnly} · neither {agreement.neither}.</p>
        </>
      )}

      <div className="row">
        <button className="btn" onClick={download}>Export attempts (CSV)</button>
        {!confirm ? (
          <button className="btn" onClick={() => setConfirm(true)}>Recalibrate baseline…</button>
        ) : (
          <>
            <span className="warn small">Starts a new {BASELINE_DAYS / 7}-week baseline and a new reference. Old attempts stay in your history.</span>
            <button className="btn" onClick={() => { store.recalibrateLatencyBaseline(); setConfirm(false); }}>Yes, recalibrate</button>
            <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
          </>
        )}
      </div>
    </section>
  );
}
