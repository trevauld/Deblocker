import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { ProgressDb } from './db';

describe('ProgressDb', () => {
  it('persists kv, sessions, words and check-ins', async () => {
    const db = new ProgressDb('test-' + Math.random());
    await db.setKv('progress', { stage: 'words', pace: 0.1, sessionsInStage: 1 });
    expect(await db.getKv('progress')).toEqual({ stage: 'words', pace: 0.1, sessionsInStage: 1 });
    await db.addWord({ id: 'w1', text: 'Starbucks', addedAt: 2 });
    await db.addWord({ id: 'w0', text: 'Peter', addedAt: 1 });
    expect((await db.listWords()).map((w) => w.text)).toEqual(['Peter', 'Starbucks']);
    await db.removeWord('w0');
    expect(await db.listWords()).toHaveLength(1);
    await db.putCheckin({ date: '2026-01-01', sleep: 3, energy: 3, stress: 2 });
    await db.putCheckin({ date: '2026-01-01', sleep: 4, energy: 3, stress: 2 });
    expect(await db.listCheckins()).toHaveLength(1);
    await db.addSession({ id: 'b', startedAt: 20, date: '2026-01-02', stage: 'words', guidanceLevel: 1, pace: 0, attempts: 1, easyOnsetPct: 100, avgTempoRatio: 1, avgPhraseMs: 1000, avgScore: 90 });
    await db.addSession({ id: 'a', startedAt: 10, date: '2026-01-01', stage: 'words', guidanceLevel: 1, pace: 0, attempts: 1, easyOnsetPct: 0, avgTempoRatio: 1, avgPhraseMs: 1000, avgScore: 10 });
    expect((await db.listSessions()).map((s) => s.id)).toEqual(['a', 'b']);
    await db.clearAll();
    expect(await db.listSessions()).toHaveLength(0);
  });
});
