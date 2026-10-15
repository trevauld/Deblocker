import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { GuidanceConfig } from '../../core/guidance/fading';
import type { GeneratedCurve } from '../../core/curve/types';
import { scoreAttempt } from '../../core/scoring/score';
import type { ScoreResult, Strictness } from '../../core/scoring/types';
import type { Settings } from '../../core/tracking/types';
import { AutoFaults, makeAutoDriver } from '../audio/autoDriver';
import { engine } from '../audio/engine';
import { drawView, UserPoint } from '../draw';
import { CurveCanvas } from './CurveCanvas';
import { ResultCard } from './ResultCard';

export type MatchPhase = 'idle' | 'preview' | 'countdown' | 'speaking' | 'result';

export interface AttemptOutcome {
  result: ScoreResult;
  user: UserPoint[];
  /** Observer-mode taps (ms after the start cue); undefined when observer mode is off. */
  observerTaps?: number[];
}

const PAST_MS = 2500;
const FUTURE_MS = 6000;
const PREVIEW_MS = 3500;
const FREE_MAX_MS = 45000;
const SPEAKING_THRESHOLD = 0.1;

interface Props {
  /** Target curve; null for a free-speech prompt (no curve, only onset and tempo are scored). */
  curve: GeneratedCurve | null;
  text: string;
  free?: boolean;
  guidance: GuidanceConfig;
  strictness: Strictness;
  inputMode: Settings['inputMode'];
  autoplay: Settings['simAutoplay'];
  /** Curve that the dev auto-voice follows when `curve` is null. */
  autoCurve?: GeneratedCurve | null;
  freeSpeech?: { msPerSyllable: number; onsetMs: number };
  /** Dev mode: delay / mid-word silence injected into the auto-voice. */
  simFaults?: AutoFaults;
  /** A helper taps B (or the button) when they hear a block. Never shown to the speaker as feedback. */
  observer?: boolean;
  heading?: ReactNode;
  /** Called after every scored attempt. attemptNo is 0 for the first try. */
  onFinished?: (o: AttemptOutcome, attemptNo: number) => void;
  /** Extra content shown in the result card (e.g. a level-change banner). */
  resultExtra?: ReactNode;
  nextLabel?: string;
  onNext?: () => void;
  onSkip?: () => void;
}

export function LiveMatch(props: Props) {
  const { curve, text, free, guidance, inputMode, autoplay, autoCurve } = props;
  const [phase, setPhase] = useState<MatchPhase>('idle');
  const [cue, setCue] = useState('');
  const [activeSyl, setActiveSyl] = useState(-1);
  const [outcome, setOutcome] = useState<AttemptOutcome | null>(null);
  const [attemptNo, setAttemptNo] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const phaseRef = useRef<MatchPhase>('idle');
  const user = useRef<UserPoint[]>([]);
  const t0 = useRef(0);
  const timers = useRef<number[]>([]);
  const unsub = useRef<(() => void) | null>(null);
  const checker = useRef<number | null>(null);
  const activeRef = useRef(-1);
  const attemptRef = useRef(0);
  const taps = useRef<number[]>([]);
  const propsRef = useRef(props);
  propsRef.current = props;

  const go = (p: MatchPhase) => { phaseRef.current = p; setPhase(p); };
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const stopListening = useCallback(() => {
    unsub.current?.();
    unsub.current = null;
    if (checker.current !== null) clearInterval(checker.current);
    checker.current = null;
    engine.sim.setDriver(null);
  }, []);

  useEffect(() => () => { clearTimers(); stopListening(); }, [stopListening]);

  const tap = useCallback(() => {
    if (phaseRef.current === 'speaking') taps.current.push(Math.round(performance.now() - t0.current));
  }, []);
  useEffect(() => {
    if (!props.observer) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.code === 'KeyB' && !e.repeat && !(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'))) tap();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.observer, tap]);

  const finish = useCallback(() => {
    if (phaseRef.current !== 'speaking') return;
    stopListening();
    const samples = [...user.current];
    const p = propsRef.current;
    const result = scoreAttempt({
      user: samples,
      target: p.curve,
      freeSpeech: p.freeSpeech,
      strictness: p.strictness,
      bandHalfWidth: p.guidance.bandHalfWidth,
    });
    const o: AttemptOutcome = { result, user: samples, observerTaps: p.observer ? [...taps.current] : undefined };
    setOutcome(o);
    setActiveSyl(-1);
    activeRef.current = -1;
    go('result');
    p.onFinished?.(o, attemptRef.current);
    attemptRef.current += 1;
    setAttemptNo(attemptRef.current);
  }, [stopListening]);

  function beginSpeaking() {
    user.current = [];
    taps.current = [];
    activeRef.current = -1;
    engine.resetSmoothing();
    t0.current = performance.now();
    unsub.current = engine.onLevel((s) => { user.current.push({ t: s.t - t0.current, level: s.level }); });
    if (engine.mode === 'simulated' && autoplay !== 'off') {
      const c = curve ?? autoCurve;
      if (c) engine.sim.setDriver(makeAutoDriver(c, autoplay, t0.current, props.simFaults));
    }
    go('speaking');
    setCue('');
    checker.current = window.setInterval(() => {
      const now = performance.now() - t0.current;
      let lastVoiced = -1;
      for (let i = user.current.length - 1; i >= 0; i--) if (user.current[i].level >= SPEAKING_THRESHOLD) { lastVoiced = user.current[i].t; break; }
      if (curve) {
        // Be patient: a block can hold up the start or interrupt the word, and the attempt must not end in the middle of one.
        const dur = curve.durationMs;
        if (lastVoiced < 0) {
          if (now > dur * 2 + 6000) finish(); // never started
        } else if ((now > dur + 1200 && now - lastVoiced > 2500) || now > dur * 2 + 8000) finish();
      } else {
        if ((lastVoiced > 0 && now > 3000 && now - lastVoiced > 2500) || now > FREE_MAX_MS) finish();
      }
    }, 100);
  }

  function countdown() {
    go('countdown');
    setCue('Breathe in…');
    later(() => setCue('…let the air out…'), 1800);
    later(() => setCue('Start'), 3300);
    later(beginSpeaking, 3600);
  }

  async function start() {
    setError(null);
    clearTimers();
    try {
      await engine.start(inputMode);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the microphone.');
      return;
    }
    setOutcome(null);
    user.current = [];
    setActiveSyl(-1);
    if (guidance.previewBefore && curve) {
      go('preview');
      setCue('Preview the curve…');
      later(countdown, PREVIEW_MS);
    } else countdown();
  }

  function cancel() {
    clearTimers();
    stopListening();
    setCue('');
    go('idle');
  }

  // Draw
  const drawFrame = (ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number) => {
    const p = phaseRef.current;
    const showTarget = !!curve && (guidance.showWhileSpeaking || p === 'preview' || (p === 'result' && guidance.overlayAfter));
    if (p === 'speaking') {
      const now = performance.now() - t0.current;
      drawView(ctx, w, h, {
        from: now - PAST_MS, to: now + FUTURE_MS, curve, showTarget: !!curve && guidance.showWhileSpeaking,
        bandHalfWidth: guidance.bandHalfWidth, user: user.current, nowT: now, dpr,
      });
      if (curve) {
        let idx = -1;
        for (const s of curve.syllables) if (s.startMs <= now) idx = s.index;
        if (idx !== activeRef.current) { activeRef.current = idx; setActiveSyl(idx); }
      }
      return;
    }
    if (p === 'result' && outcome) {
      const end = Math.max(curve?.durationMs ?? 0, (outcome.user[outcome.user.length - 1]?.t ?? 0)) + 300;
      drawView(ctx, w, h, { from: -200, to: Math.max(2000, end), curve, showTarget, bandHalfWidth: guidance.bandHalfWidth, user: outcome.user, dpr });
      return;
    }
    if (curve && (p === 'preview' || (p === 'idle' && guidance.showWhileSpeaking) || (p === 'countdown' && guidance.showWhileSpeaking))) {
      drawView(ctx, w, h, { from: -200, to: Math.max(2000, curve.durationMs + 300), curve, showTarget: true, bandHalfWidth: guidance.bandHalfWidth, user: [], dpr });
      return;
    }
    drawView(ctx, w, h, { from: 0, to: 8000, curve: null, showTarget: false, bandHalfWidth: 0, user: p === 'idle' || p === 'countdown' ? [] : [], dpr });
  };

  const hiddenNote =
    phase !== 'result' && !free && !guidance.showWhileSpeaking && (phase === 'speaking' || phase === 'idle')
      ? guidance.previewBefore ? 'Curve hidden while you speak: you will see it first.' : 'Curve hidden: speak from what you remember, then compare.'
      : null;

  return (
    <section className="card" aria-live="polite">
      {props.heading}
      <div className="cue" role="status">{phase === 'result' ? '' : cue}</div>
      <PhraseText text={text} curve={curve} activeSyl={phase === 'speaking' ? activeSyl : -1} />
      <CurveCanvas
        animate={phase === 'speaking'}
        deps={[phase, outcome, curve, guidance.level]}
        render={drawFrame}
        height={phase === 'result' ? 200 : 230}
        label={curve ? 'Target loudness curve and your voice' : 'Your voice loudness'}
      />
      <div className="legend">
        {curve && (phase === 'result' || guidance.showWhileSpeaking || phase === 'preview') && <span><i style={{ background: 'var(--accent)' }} />Target (band = OK zone)</span>}
        <span><i style={{ background: 'var(--user)' }} />You</span>
        {hiddenNote && <span>{hiddenNote}</span>}
      </div>
      {error && <p className="warn" role="alert">{error}</p>}
      <div className="row">
        {phase === 'idle' && <button className="btn primary big" onClick={start}>{attemptNo === 0 ? 'Start' : 'Try again'}</button>}
        {phase === 'preview' && <button className="btn" onClick={() => { clearTimers(); countdown(); }}>Skip preview</button>}
        {(phase === 'countdown' || phase === 'preview') && <button className="btn" onClick={cancel}>Cancel</button>}
        {phase === 'speaking' && <button className="btn primary" onClick={finish}>Done</button>}
        {phase === 'speaking' && props.observer && <button className="btn" onClick={tap} aria-label="Observer: block heard">Block heard (B)</button>}
        {phase === 'idle' && props.onSkip && <button className="btn" onClick={props.onSkip}>Skip</button>}
      </div>
      {phase === 'result' && outcome && (
        <ResultCard
          result={outcome.result}
          extra={props.resultExtra}
          firstTry={attemptNo === 1}
          onRetry={() => { setOutcome(null); go('idle'); setCue(''); }}
          onNext={props.onNext}
          nextLabel={props.nextLabel}
        />
      )}
    </section>
  );
}

function PhraseText({ text, curve, activeSyl }: { text: string; curve: GeneratedCurve | null; activeSyl: number }) {
  if (!curve) return <div className="phrase">{text}</div>;
  return (
    <div className="phrase" aria-label={text}>
      {curve.words.map((w) => (
        <span className="word" key={w.index}>
          {w.syllableIndices.map((si) => {
            const s = curve.syllables[si];
            const cls = si === activeSyl ? 'syl active' : activeSyl > si ? 'syl past' : 'syl';
            return <span key={si} className={cls}>{s.text}</span>;
          })}
        </span>
      ))}
    </div>
  );
}
