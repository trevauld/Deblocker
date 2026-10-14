import { describe, expect, it } from 'vitest';
import { FadingState, GUIDANCE, initialFading, recordAttempt } from './fading';

function run(state: FadingState, flags: boolean[]) {
  const changes: string[] = [];
  for (const f of flags) {
    const r = recordAttempt(state, f);
    state = r.state;
    if (r.change !== 'none') changes.push(r.change);
  }
  return { state, changes };
}

describe('fading guidance', () => {
  it('defines four levels with progressively less guidance', () => {
    expect(GUIDANCE[1].showWhileSpeaking && GUIDANCE[2].showWhileSpeaking).toBe(true);
    expect(GUIDANCE[2].bandHalfWidth).toBeGreaterThan(GUIDANCE[1].bandHalfWidth);
    expect(GUIDANCE[3]).toMatchObject({ previewBefore: true, showWhileSpeaking: false });
    expect(GUIDANCE[4]).toMatchObject({ previewBefore: false, showWhileSpeaking: false, overlayAfter: true });
  });

  it('advances after enough attempts at >= 80% easy onset', () => {
    const { state, changes } = run(initialFading(1), Array(8).fill(true));
    expect(state.level).toBe(2);
    expect(changes).toEqual(['advance']);
    expect(state.recent).toEqual([]);
  });

  it('does not advance too early or with a low rate', () => {
    expect(run(initialFading(1), Array(7).fill(true)).state.level).toBe(1);
    const mixed = [true, true, false, true, false, true, true, false, true, true]; // 70%
    expect(run(initialFading(1), mixed).state.level).toBe(1);
  });

  it('steps back when easy-onset rate drops', () => {
    const { state, changes } = run(initialFading(3), [false, false, false, true, false, false]);
    expect(state.level).toBe(2);
    expect(changes).toEqual(['back']);
  });

  it('never goes below 1 or above 4', () => {
    expect(run(initialFading(1), Array(12).fill(false)).state.level).toBe(1);
    expect(run(initialFading(4), Array(20).fill(true)).state.level).toBe(4);
  });
});
