import { describe, expect, it } from 'vitest';
import { showcaseKingdom } from '../src/core/showcaseKingdom';
import { readGameState } from '../src/core/Persistence';
import { footprint } from '../src/core/world';
import { APPEAL_KINDS } from '../src/data/buildings';

describe('menu showcase kingdom', () => {
  const state = showcaseKingdom();

  it('is a large, finished city with the completed temple', () => {
    const temple = state.buildings.find((b) => b.kind === 'temple');
    expect(temple?.level).toBe(3);
    expect(state.buildings.every((b) => !b.construction)).toBe(true);
    const city = state.buildings.filter(
      (b) => !['road', 'canal', 'bridge', 'moat'].includes(b.kind),
    );
    expect(city.length).toBeGreaterThanOrEqual(60);
    expect(state.buildings.filter((b) => b.kind === 'house').length).toBeGreaterThanOrEqual(10);
    expect(state.buildings.filter((b) => b.kind === 'paddy').length).toBeGreaterThanOrEqual(10);
    for (const kind of APPEAL_KINDS)
      expect(state.buildings.some((b) => b.kind === kind)).toBe(true);
  });

  it('never stacks two buildings on one tile', () => {
    const seen = new Set<string>();
    for (const b of state.buildings)
      for (const c of footprint(b)) {
        const key = `${c.x},${c.y}`;
        expect(seen.has(key), `${b.kind} overlaps at ${key}`).toBe(false);
        seen.add(key);
      }
  });

  it('is a valid game state and is generated the same way every time', () => {
    expect(readGameState(JSON.parse(JSON.stringify(state)))).not.toBeNull();
    expect(showcaseKingdom().buildings.map((b) => `${b.kind}@${b.x},${b.y}`)).toEqual(
      state.buildings.map((b) => `${b.kind}@${b.x},${b.y}`),
    );
  });
});
