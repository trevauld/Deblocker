import { describe, expect, it } from 'vitest';
import { mulberry32, pickWeighted, planSession } from './planner';

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

  it('brings back words with long starts, favouring the worst', () => {
    const revisit = [{ text: 'ticket', weight: 9 }, { text: 'coffee', weight: 1 }];
    const steps = planSession({ stage: 'words', seed: 4, revisit });
    const texts = drills(steps).filter((d) => d.category === 'revisit').map((d) => d.text);
    expect(texts.sort()).toEqual(['coffee', 'ticket']);
    for (const stage of ['sentences', 'passages', 'free'] as const) {
      expect(drills(planSession({ stage, seed: 4, revisit })).some((d) => d.category === 'revisit')).toBe(true);
    }
    let ticketFirst = 0;
    for (let i = 0; i < 200; i++) if (pickWeighted(revisit, 1, mulberry32(i))[0].text === 'ticket') ticketFirst++;
    expect(ticketFirst).toBeGreaterThan(150);
  });
});
