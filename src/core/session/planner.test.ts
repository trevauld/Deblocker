import { describe, expect, it } from 'vitest';
import { planSession } from './planner';

describe('planSession', () => {
  const drills = (steps: ReturnType<typeof planSession>) => steps.flatMap((s) => (s.kind === 'drill' ? [s.item] : []));

  it('starts with breath warm-up and sustained vowel practice', () => {
    const steps = planSession({ stage: 'words', seed: 1 });
    expect(steps[0]).toMatchObject({ kind: 'breath', inMs: 3000, outMs: 5000 });
    expect(steps[1].kind).toBe('sustained');
  });

  it('orders word drills: vowels → h-words → voiced → stops → yours → phrases', () => {
    const steps = planSession({ stage: 'words', seed: 2, customWords: [{ id: '1', text: 'Starbucks', addedAt: 0 }] });
    const cats = drills(steps).map((d) => d.category);
    const order = ['vowels', 'h-words', 'voiced', 'stops', 'yours', 'phrase'];
    const firstIdx = order.map((c) => cats.indexOf(c as never));
    expect(firstIdx.every((i) => i >= 0)).toBe(true);
    expect([...firstIdx].sort((a, b) => a - b)).toEqual(firstIdx);
    expect(drills(steps).find((d) => d.category === 'yours')!.text).toBe('Starbucks');
  });

  it('is deterministic for a seed', () => {
    expect(planSession({ stage: 'words', seed: 5 })).toEqual(planSession({ stage: 'words', seed: 5 }));
  });

  it('covers every stage; free prompts have no target curve', () => {
    expect(drills(planSession({ stage: 'sentences', seed: 1 })).some((d) => d.category === 'sentence')).toBe(true);
    expect(drills(planSession({ stage: 'passages', seed: 1 })).some((d) => d.category === 'passage')).toBe(true);
    const free = drills(planSession({ stage: 'free', seed: 1 })).filter((d) => d.free);
    expect(free).toHaveLength(4);
  });

  it('has roughly ten minutes of material', () => {
    const steps = planSession({ stage: 'words', seed: 3 });
    expect(drills(steps).length).toBeGreaterThanOrEqual(14);
  });
});
