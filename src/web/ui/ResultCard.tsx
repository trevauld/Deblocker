import { ReactNode, useEffect, useRef } from 'react';
import type { ScoreResult } from '../../core/scoring/types';

export function ResultCard({ result, onRetry, onNext, nextLabel, extra, firstTry }: {
  result: ScoreResult;
  onRetry: () => void;
  onNext?: () => void;
  nextLabel?: string;
  extra?: ReactNode;
  firstTry: boolean;
}) {
  const { onset, envelope, tempo } = result;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }, []);
  return (
    <div ref={ref} className="result" role="region" aria-label="Attempt result">
      <div className="score">
        <div className="big" aria-label={`Score ${result.total} out of 100`}>{result.total}</div>
        <div className="minis">
          <Mini label="Easy onset" weight="50%" value={onset.score} />
          {envelope && <Mini label="Curve match" weight="30%" value={envelope.score} />}
          <Mini label="Tempo" weight={envelope ? '20%' : 'estimate'} value={tempo.score} />
        </div>
      </div>
      <ul className="feedback">
        {result.feedback.map((f) => <li key={f.code} className={f.tone}>{f.text}</li>)}
      </ul>
      {onset.detected && onset.riseMs !== undefined && (
        <p className="muted small">
          Your voice reached 80% of its peak in {Math.round(onset.riseMs)} ms (a gentle start here is about {Math.round(onset.idealRiseMs ?? 0)} ms).
          {tempo.userMs > 0 && <> Speaking time {(tempo.userMs / 1000).toFixed(1)} s{tempo.targetMs ? ` vs ${(tempo.targetMs / 1000).toFixed(1)} s target` : ''}.</>}
        </p>
      )}
      {extra}
      <div className="row">
        <button className="btn" onClick={onRetry}>Try again</button>
        {onNext && <button className="btn primary" onClick={onNext}>{nextLabel ?? 'Next'}</button>}
      </div>
      {onNext && <p className="muted small">{firstTry ? 'This first try counts toward your session.' : 'Extra tries are for practice and do not change your session stats.'}</p>}
    </div>
  );
}

function Mini({ label, weight, value }: { label: string; weight: string; value: number }) {
  return (
    <div className="mini">
      <span>{label} <span className="muted small">{weight}</span></span>
      <div className="bar"><div style={{ width: `${value}%` }} /></div>
      <span>{value}</span>
    </div>
  );
}
