import { useEffect, useState } from 'react';
import { engine } from './audio/engine';
import { store, useStore } from './store';
import { CalibrationScreen } from './ui/Calibration';
import { CheckInScreen } from './ui/CheckInScreen';
import { CurveLab } from './ui/CurveLab';
import { Home } from './ui/Home';
import { MeterScreen } from './ui/Meter';
import { PracticeScreen } from './ui/PracticeScreen';
import { ProgressScreen } from './ui/ProgressScreen';
import { SessionScreen } from './ui/SessionScreen';
import { SettingsScreen } from './ui/SettingsScreen';
import { SimPad } from './ui/SimPad';
import { WordsScreen } from './ui/WordsScreen';

export type Screen = 'home' | 'calibrate' | 'meter' | 'curves' | 'practice' | 'session' | 'progress' | 'words' | 'checkin' | 'settings';

const NAV: { id: Screen; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'practice', label: 'Practice' },
  { id: 'progress', label: 'Progress' },
  { id: 'words', label: 'My words' },
  { id: 'settings', label: 'Settings' },
];

export function App() {
  const loaded = useStore((s) => s.loaded);
  const inputMode = useStore((s) => s.settings.inputMode);
  const disclaimer = useStore((s) => s.disclaimerAccepted);
  const [screen, setScreen] = useState<Screen>('home');

  useEffect(() => { void store.init(); }, []);
  // Stop listening to the mic when leaving screens that need it.
  useEffect(() => {
    if (!['calibrate', 'meter', 'practice', 'session'].includes(screen)) engine.stop();
  }, [screen]);
  // Switching input mode restarts the source on next use.
  useEffect(() => { engine.stop(); }, [inputMode]);

  if (!loaded) return <main><p className="muted">Loading…</p></main>;

  return (
    <>
      <header className="top">
        <button className="brand" onClick={() => setScreen('home')} aria-label="Deblocker home">
          <img src="/icon.svg" alt="" width={26} height={26} /> Deblocker
        </button>
        <nav aria-label="Main">
          {NAV.map((n) => (
            <button key={n.id} aria-current={screen === n.id ? 'page' : undefined} onClick={() => setScreen(n.id)}>{n.label}</button>
          ))}
        </nav>
      </header>
      <main>
        {!disclaimer && (
          <div className="disclaimer" role="note">
            <strong>A practice companion, not a treatment.</strong> Deblocker helps you practise easy starts, slower speech and breathing between phrases.
            It does not diagnose or treat stuttering and is no substitute for a speech-language pathologist. Your voice is analysed on this device only and is never recorded or uploaded.
            <div className="row"><button className="btn primary" onClick={() => store.acceptDisclaimer()}>Got it</button></div>
          </div>
        )}
        {screen === 'home' && <Home go={setScreen} />}
        {screen === 'calibrate' && <CalibrationScreen onDone={() => setScreen('home')} />}
        {screen === 'meter' && <MeterScreen />}
        {screen === 'curves' && <CurveLab />}
        {screen === 'practice' && <PracticeScreen />}
        {screen === 'session' && <SessionScreen onExit={() => setScreen('home')} onCheckIn={() => setScreen('checkin')} />}
        {screen === 'progress' && <ProgressScreen />}
        {screen === 'words' && <WordsScreen />}
        {screen === 'checkin' && <CheckInScreen onDone={() => setScreen('home')} />}
        {screen === 'settings' && <SettingsScreen onCalibrate={() => setScreen('calibrate')} />}
        <p className="muted small" style={{ marginTop: 24 }}>Deblocker is a practice companion, not a medical treatment. Audio stays on your device.</p>
      </main>
      {inputMode === 'simulated' && <SimPad />}
    </>
  );
}
