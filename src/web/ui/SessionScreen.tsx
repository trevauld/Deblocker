import { useMemo, useRef, useState } from 'react';
import { generateCurve, generateSustained } from '../../core/curve/generate';
import { settingsForPace } from '../../core/curve/levelSettings';
import { GUIDANCE, recordAttempt } from '../../core/guidance/fading';
import type { FadingChange } from '../../core/guidance/fading';
import { CATEGORY_LABEL, DrillItem, planSession } from '../../core/session/planner';
import { advanceProgress, summarizeSession } from '../../core/tracking/stats';
import type { AttemptRecord, SessionRecord, Stage } from '../../core/tracking/types';
import { useLexicon } from '../lexicon';
import { store, useStore } from '../store';
import { BreathPacer } from './BreathPacer';
import { AttemptOutcome, LiveMatch } from './LiveMatch';

const STAGE_LABEL: Record<Stage, string> = { words: 'Words', sentences: 'Sentences', passages: 'Reading passages', free: 'Free speech' };

export function SessionScreen({ onExit, onCheckIn }: { onExit: () => void; onCheckIn: () => void }) {
  const lookup = useLexicon();
  const settings = useStore((s) => s.settings);
  const fading = useStore((s) => s.fading);
  // Capture the plan once at the start of the session.
  const start = useRef(store.get());
  const startedAt = useRef(Date.now());
  const steps = useMemo(
    () => planSession({ stage: start.current.progress.stage, customWords: start.current.customWords, seed: startedAt.current }),
    [],
  );
  const pace = start.current.progress.pace;
  const curveSettings = useMemo(() => settingsForPace(pace), [pace]);
  const [idx, setIdx] = useState(0);
  const attempts = useRef<AttemptRecord[]>([]);
  const [banner, setBanner] = useState<{ change: FadingChange; text: string } | null>(null);
  const [summary, setSummary] = useState<{ record: SessionRecord; stageChange: string | null } | null>(null);
  const finalized = useRef(false);
  const startLevel = useRef(start.current.fading.level);

  const finalize = () => {
    if (finalized.current) return;
    finalized.current = true;
    if (attempts.current.length === 0) { setSummary(null); return; }
    const record = summarizeSession({
      id: crypto.randomUUID?.() ?? String(startedAt.current),
      startedAt: startedAt.current,
      stage: start.current.progress.stage,
      guidanceLevel: store.get().fading.level,
      pace,
      attempts: attempts.current,
    });
    const before = store.get().progress;
    const next = advanceProgress(before, record, store.get().sessions);
    store.addSession(record);
    store.setProgress(next);
    setSummary({ record, stageChange: next.stage !== before.stage ? `You've moved on to: ${STAGE_LABEL[next.stage]}!` : null });
  };

  if (idx >= steps.length) return <Summary summary={summary} startLevel={startLevel.current} onExit={onExit} onCheckIn={onCheckIn} />;

  const step = steps[idx];
  const endSession = () => { finalize(); setIdx(steps.length); };
  const next = () => {
    setBanner(null);
    if (idx + 1 >= steps.length) endSession();
    else setIdx(idx + 1);
  };
  const header = (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <span className="muted small">Step {idx + 1} of {steps.length} · {STAGE_LABEL[start.current.progress.stage]} · Guidance level {fading.level}: {GUIDANCE[fading.level].name}</span>
      <button className="btn" onClick={endSession}>End session</button>
    </div>
  );
  const progressBar = <div className="bar" aria-hidden><div style={{ width: `${(idx / steps.length) * 100}%` }} /></div>;

  if (step.kind === 'breath') {
    return <>{header}{progressBar}<BreathPacer key={step.id} cycles={step.cycles} inMs={step.inMs} outMs={step.outMs} onDone={next} /></>;
  }

  if (step.kind === 'sustained') {
    const curve = generateSustained(step.holdMs, curveSettings);
    return (
      <>
        {header}{progressBar}
        <LiveMatch
          key={step.id}
          curve={curve}
          text="ahhh"
          heading={<><span className="badge">Air before voice</span><p className="muted">Let a little air flow first, then let a soft "ahhh" fade in and hold it steady.</p></>}
          guidance={GUIDANCE[Math.min(fading.level, 2) as 1 | 2]}
          strictness={settings.strictness}
          inputMode={settings.inputMode}
          autoplay={settings.simAutoplay}
          nextLabel="Continue"
          onNext={next}
        />
      </>
    );
  }

  const item = step.item;
  const guidance = item.free ? GUIDANCE[4] : GUIDANCE[fading.level];
  const onFinished = (o: AttemptOutcome, n: number) => {
    if (n !== 0) return;
    const r = o.result;
    attempts.current.push({ text: item.text, total: r.total, easyOnset: r.easyOnset, tempoRatio: r.tempo.ratio, spansMs: r.userSpansMs, heard: r.onset.detected });
    const { state, change } = recordAttempt(store.get().fading, r.easyOnset);
    store.setFading(state);
    if (change === 'advance') setBanner({ change, text: `Your easy starts are steady. Moving to guidance level ${state.level} (${GUIDANCE[state.level].name}): ${GUIDANCE[state.level].description}` });
    else if (change === 'back') setBanner({ change, text: `Let's go back to level ${state.level} (${GUIDANCE[state.level].name}) for a while. That's a normal part of learning.` });
  };

  return (
    <>
      {header}{progressBar}
      <DrillView
        key={step.id}
        item={item}
        guidanceKey={guidance.level}
        lookupReady={!!lookup}
        render={(curve) => (
          <LiveMatch
            curve={curve}
            text={item.text}
            free={item.free}
            guidance={guidance}
            strictness={settings.strictness}
            inputMode={settings.inputMode}
            autoplay={settings.simAutoplay}
            autoCurve={item.free && lookup ? generateCurve('tell me about my morning so far today', { lookup, settings: curveSettings }) : null}
            freeSpeech={{ msPerSyllable: curveSettings.msPerSyllable, onsetMs: curveSettings.onsetMs }}
            heading={
              <>
                <span className="badge">{CATEGORY_LABEL[item.category]}</span>
                {item.free && <p className="muted">No curve this time. Start softly, speak slowly, and breathe between thoughts. Press Done when you finish.</p>}
              </>
            }
            onFinished={onFinished}
            resultExtra={banner ? <p className="notice" role="status">{banner.text}</p> : null}
            nextLabel={idx + 1 >= steps.length ? 'Finish' : 'Next'}
            onNext={next}
            onSkip={next}
          />
        )}
        makeCurve={(lk) => (item.free ? null : generateCurve(item.text, { lookup: lk, settings: curveSettings }))}
      />
    </>
  );
}

function DrillView({ item, lookupReady, render, makeCurve }: {
  item: DrillItem;
  guidanceKey: number;
  lookupReady: boolean;
  render: (curve: ReturnType<typeof generateCurve> | null) => React.ReactNode;
  makeCurve: (lookup: NonNullable<ReturnType<typeof useLexicon>>) => ReturnType<typeof generateCurve> | null;
}) {
  const lookup = useLexicon();
  const curve = useMemo(() => (lookup ? makeCurve(lookup) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookup, item.id]);
  if (!lookupReady || !lookup) return <p className="muted">Loading pronunciations…</p>;
  return <>{render(item.free ? null : curve)}</>;
}

function Summary({ summary, startLevel, onExit, onCheckIn }: {
  summary: { record: SessionRecord; stageChange: string | null } | null;
  startLevel: number;
  onExit: () => void;
  onCheckIn: () => void;
}) {
  const fading = useStore((s) => s.fading);
  const checkins = useStore((s) => s.checkins);
  const today = new Date().toDateString();
  const checkedIn = checkins.some((c) => new Date(c.date + 'T12:00:00').toDateString() === today);
  if (!summary) {
    return (
      <section className="card">
        <h2>Session ended</h2>
        <p className="muted">No attempts were recorded this time, so nothing was saved. That's fine: come back whenever you like.</p>
        <button className="btn primary" onClick={onExit}>Back home</button>
      </section>
    );
  }
  const r = summary.record;
  return (
    <section className="card">
      <h2>Session summary</h2>
      <div className="grid">
        <Stat label="Easy starts" value={`${r.easyOnsetPct}%`} note={`${r.attempts} attempt${r.attempts === 1 ? '' : 's'}`} />
        <Stat label="Average tempo" value={r.avgTempoRatio ? `${r.avgTempoRatio.toFixed(2)}×` : '–'} note="1.0× = target pace (slower is fine)" />
        <Stat label="Average breath group" value={r.avgPhraseMs ? `${(r.avgPhraseMs / 1000).toFixed(1)} s` : '–'} note="speaking time per breath" />
        <Stat label="Guidance level" value={`${fading.level}`} note={fading.level === startLevel ? GUIDANCE[fading.level].name : `${GUIDANCE[fading.level].name} (was ${startLevel})`} />
      </div>
      {summary.stageChange && <p className="notice" role="status">{summary.stageChange}</p>}
      <p>
        {r.easyOnsetPct >= 80 ? 'Lots of gentle starts today. Nice work.' : r.easyOnsetPct >= 50 ? 'A good session. Keep letting the air flow before the voice.' : 'Tough day? That happens, and it is useful information. Short, slow practice still counts.'}
      </p>
      <div className="row">
        {!checkedIn && <button className="btn" onClick={onCheckIn}>Daily check-in</button>}
        <button className="btn primary" onClick={onExit}>Done</button>
      </div>
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="tile" style={{ cursor: 'default' }}>
      <span className="muted small">{label}</span>
      <strong style={{ fontSize: '1.8rem' }}>{value}</strong>
      <span className="muted small">{note}</span>
    </div>
  );
}
