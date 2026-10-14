import { useState } from 'react';
import { GUIDANCE, GuidanceLevel, initialFading } from '../../core/guidance/fading';
import { STAGES } from '../../core/tracking/types';
import { store, useStore } from '../store';

export function SettingsScreen({ onCalibrate }: { onCalibrate: () => void }) {
  const settings = useStore((s) => s.settings);
  const fading = useStore((s) => s.fading);
  const progress = useStore((s) => s.progress);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <section className="card">
        <h2>Settings</h2>
        <label>
          <span className="muted small">Onset strictness: how quickly a start counts as "sudden"</span>
          <select value={settings.strictness} onChange={(e) => store.updateSettings({ strictness: e.target.value as typeof settings.strictness })}>
            <option value="lenient">Lenient</option>
            <option value="normal">Normal</option>
            <option value="strict">Strict</option>
          </select>
        </label>
        <div className="row"><button className="btn" onClick={onCalibrate}>Recalibrate microphone</button></div>
      </section>

      <section className="card">
        <h2>Where you are</h2>
        <div className="grid">
          <label>
            <span className="muted small">Stage</span>
            <select value={progress.stage} onChange={(e) => store.setProgress({ ...progress, stage: e.target.value as typeof progress.stage, sessionsInStage: 0 })}>
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>
            <span className="muted small">Guidance level</span>
            <select value={fading.level} onChange={(e) => store.setFading(initialFading(Number(e.target.value) as GuidanceLevel))}>
              {([1, 2, 3, 4] as GuidanceLevel[]).map((l) => <option key={l} value={l}>{l}. {GUIDANCE[l].name}</option>)}
            </select>
          </label>
          <label>
            <span className="muted small">Pace {progress.pace.toFixed(2)} (0 = slowest, 1 = faster)</span>
            <input type="range" min={0} max={1} step={0.05} value={progress.pace} onChange={(e) => store.setProgress({ ...progress, pace: Number(e.target.value) })} />
          </label>
        </div>
        <p className="muted small">The app adjusts these for you as you practice; change them here if you prefer.</p>
      </section>

      <section className="card">
        <h2>Developer / testing</h2>
        <label>
          <span className="muted small">Voice input</span>
          <select value={settings.inputMode} onChange={(e) => store.updateSettings({ inputMode: e.target.value as typeof settings.inputMode })}>
            <option value="mic">Microphone</option>
            <option value="simulated">Simulated voice (keyboard / mouse)</option>
          </select>
        </label>
        {settings.inputMode === 'simulated' && (
          <label>
            <span className="muted small">Auto-play the simulated voice while an attempt runs</span>
            <select value={settings.simAutoplay} onChange={(e) => store.updateSettings({ simAutoplay: e.target.value as typeof settings.simAutoplay })}>
              <option value="off">Off: I will hold Space / Enter myself</option>
              <option value="gentle">Gentle onset, follows the curve</option>
              <option value="sudden">Sudden onset</option>
              <option value="fast">Gentle onset but rushed (1.7× speed)</option>
            </select>
          </label>
        )}
      </section>

      <section className="card">
        <h2>Privacy</h2>
        <p>
          Your voice is analysed on this device as a loudness number, about 60 times a second. Audio is never recorded, stored or uploaded.
          Only progress numbers, your word list and check-ins are saved, in this browser.
        </p>
        {!confirm ? (
          <button className="btn" onClick={() => setConfirm(true)}>Delete all my data…</button>
        ) : (
          <div className="row">
            <span className="warn">This removes sessions, words, check-ins and calibration.</span>
            <button className="btn" onClick={async () => { await store.resetAll(); setConfirm(false); }}>Yes, delete everything</button>
            <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        )}
      </section>
    </>
  );
}
