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
        <h2>Start-time tracking</h2>
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={settings.trackLatency} onChange={(e) => store.updateSettings({ trackLatency: e.target.checked })} />
          <span>Record how long each word takes to start (numbers only; results show up in the session summary and Progress)</span>
        </label>
        <div className="grid">
          <label>
            <span className="muted small">Gap = silence longer than {settings.latencyGapMs} ms inside speech</span>
            <input type="range" min={150} max={800} step={50} value={settings.latencyGapMs} onChange={(e) => store.updateSettings({ latencyGapMs: Number(e.target.value) })} />
          </label>
          <label>
            <span className="muted small">Long start = {settings.latencyMarginMs} ms or more above your reference</span>
            <input type="range" min={300} max={1500} step={100} value={settings.latencyMarginMs} onChange={(e) => store.updateSettings({ latencyMarginMs: Number(e.target.value) })} />
          </label>
        </div>
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={settings.observerMode} onChange={(e) => store.updateSettings({ observerMode: e.target.checked })} />
          <span>Observer mode: a helper presses <kbd>B</kbd> (or the button) when they hear a block, to check the app's flags</span>
        </label>
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
        {settings.inputMode === 'simulated' && (
          <div className="grid">
            <label>
              <span className="muted small">Auto-voice: wait before starting</span>
              <select value={settings.simStartDelayMs} onChange={(e) => store.updateSettings({ simStartDelayMs: Number(e.target.value) })}>
                <option value={0}>No delay</option><option value={1000}>1 s</option><option value={2000}>2 s</option><option value={3000}>3 s</option>
              </select>
            </label>
            <label>
              <span className="muted small">Auto-voice: silence in the middle of the first phrase</span>
              <select value={settings.simMidSilenceMs} onChange={(e) => store.updateSettings({ simMidSilenceMs: Number(e.target.value) })}>
                <option value={0}>None</option><option value={600}>0.6 s</option><option value={1500}>1.5 s</option>
              </select>
            </label>
          </div>
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
