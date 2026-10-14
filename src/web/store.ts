import { useSyncExternalStore } from 'react';
import type { Calibration } from '../core/audio/types';
import { FadingState, initialFading } from '../core/guidance/fading';
import { CheckIn, CustomWord, defaultProgress, defaultSettings, Progress, SessionRecord, Settings } from '../core/tracking/types';
import { engine } from './audio/engine';
import { ProgressDb } from './storage/db';

export interface AppState {
  loaded: boolean;
  settings: Settings;
  calibration: Calibration | null;
  fading: FadingState;
  progress: Progress;
  sessions: SessionRecord[];
  customWords: CustomWord[];
  checkins: CheckIn[];
  disclaimerAccepted: boolean;
}

const initial: AppState = {
  loaded: false,
  settings: defaultSettings,
  calibration: null,
  fading: initialFading(1),
  progress: defaultProgress,
  sessions: [],
  customWords: [],
  checkins: [],
  disclaimerAccepted: false,
};

let state = initial;
const listeners = new Set<() => void>();
let db: ProgressDb | null = null;
const getDb = () => (db ??= new ProgressDb());

function set(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

/** Persist to IndexedDB; the app keeps working (in memory) if storage is unavailable. */
function persist(fn: () => Promise<unknown>) {
  fn().catch((e) => console.warn('Could not save progress locally:', e));
}

export const store = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },

  async init() {
    if (state.loaded) return;
    try {
      const d = getDb();
      const [settings, calibration, fading, progress, sessions, customWords, checkins, disclaimer] = await Promise.all([
        d.getKv<Settings>('settings'),
        d.getKv<Calibration>('calibration'),
        d.getKv<FadingState>('fading'),
        d.getKv<Progress>('progress'),
        d.listSessions(),
        d.listWords(),
        d.listCheckins(),
        d.getKv<boolean>('disclaimerAccepted'),
      ]);
      const merged = { ...defaultSettings, ...settings };
      if (calibration) engine.setCalibration(calibration);
      set({
        loaded: true,
        settings: merged,
        calibration: calibration ?? null,
        fading: fading ?? initialFading(1),
        progress: { ...defaultProgress, ...progress },
        sessions,
        customWords,
        checkins,
        disclaimerAccepted: !!disclaimer,
      });
    } catch (e) {
      console.warn('Local storage unavailable; progress will not be saved.', e);
      set({ loaded: true });
    }
  },

  updateSettings(patch: Partial<Settings>) {
    const settings = { ...state.settings, ...patch };
    set({ settings });
    persist(() => getDb().setKv('settings', settings));
  },
  setCalibration(calibration: Calibration) {
    engine.setCalibration(calibration);
    set({ calibration });
    persist(() => getDb().setKv('calibration', calibration));
  },
  setFading(fading: FadingState) {
    set({ fading });
    persist(() => getDb().setKv('fading', fading));
  },
  setProgress(progress: Progress) {
    set({ progress });
    persist(() => getDb().setKv('progress', progress));
  },
  addSession(s: SessionRecord) {
    set({ sessions: [...state.sessions, s] });
    persist(() => getDb().addSession(s));
  },
  addWord(text: string) {
    const clean = text.trim();
    if (!clean || state.customWords.some((w) => w.text.toLowerCase() === clean.toLowerCase())) return;
    const w: CustomWord = { id: crypto.randomUUID?.() ?? String(Date.now()), text: clean, addedAt: Date.now() };
    set({ customWords: [...state.customWords, w] });
    persist(() => getDb().addWord(w));
  },
  removeWord(id: string) {
    set({ customWords: state.customWords.filter((w) => w.id !== id) });
    persist(() => getDb().removeWord(id));
  },
  saveCheckIn(c: CheckIn) {
    set({ checkins: [...state.checkins.filter((x) => x.date !== c.date), c] });
    persist(() => getDb().putCheckin(c));
  },
  acceptDisclaimer() {
    set({ disclaimerAccepted: true });
    persist(() => getDb().setKv('disclaimerAccepted', true));
  },
  async resetAll() {
    await getDb().clearAll();
    engine.setCalibration(null);
    set({ ...initial, loaded: true });
  },
};

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}
