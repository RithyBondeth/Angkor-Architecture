import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/core/world';
import { collectMilestones, initializeMilestones } from '../src/core/milestones';
import { readGameState } from '../src/core/Persistence';
import { Game } from '../src/core/Game';
import { commissionsFor } from '../src/data/scenarios';
import { kingdomSummary } from '../src/ui/LegacyUI';
import { obstructsTile } from '../src/rendering/occlusion';

describe('kingdom milestones', () => {
  it('celebrates the first received rice once and remembers it across saves', () => {
    const state = createWorld();
    expect(collectMilestones(state, false)).toEqual([]);
    state.progression.delivered.rice = 12;
    expect(collectMilestones(state, false).map((n) => n.id)).toEqual(['first-harvest']);
    const restored = readGameState(state)!;
    expect(restored).not.toBeNull();
    expect(collectMilestones(restored, false)).toEqual([]);
    delete restored.milestones;
    initializeMilestones(restored);
    expect(collectMilestones(restored, false)).toEqual([]);
  });
  it('requires a living, fed kingdom when the monsoon returns and awards it once', () => {
    const state = createWorld();
    state.survival.hunger = 30;
    expect(collectMilestones(state, true)).toEqual([]);
    state.survival.hunger = 0;
    state.survival.lastFoodCoverage = 1;
    expect(collectMilestones(state, false)).toEqual([]);
    expect(collectMilestones(state, true).map((n) => n.id)).toEqual(['dry-season']);
    expect(collectMilestones(state, true)).toEqual([]);
  });
  it('awards a completed sanctuary and campaign with a reviewable kingdom summary', () => {
    const state = createWorld();
    const temple = state.buildings.find((b) => b.kind === 'temple')!;
    temple.level = 3;
    expect(collectMilestones(state, false).map((n) => n.id)).toEqual(['sanctuary']);
    state.progression.claimed = commissionsFor(state).map((c) => c.id);
    expect(collectMilestones(state, false).map((n) => n.id)).toEqual(['campaign']);
    expect(kingdomSummary(state)).toContain('An enduring legacy.');
    expect(kingdomSummary(state)).toContain('Rice delivered');
    expect(readGameState(state)).not.toBeNull();
  });
  it('rejects corrupt milestone history and silently initializes older completed saves', () => {
    const state = createWorld();
    expect(readGameState({ ...state, milestones: ['<script>'] })).toBeNull();
    expect(readGameState({ ...state, milestones: ['campaign', 'campaign'] })).toBeNull();
    delete state.milestones;
    state.progression.delivered.rice = 100;
    state.progression.claimed = commissionsFor(state).map((c) => c.id);
    const game = new Game(state),
      events: string[] = [];
    game.onEvent((event) => {
      if (event.type === 'milestone') events.push(event.id);
    });
    game.step();
    expect(events).toEqual([]);
  });
  it('emits a first-harvest celebration through the normal delivery simulation', () => {
    const state = createWorld();
    const paddy = state.buildings.find((b) => b.kind === 'paddy')!;
    const house = state.buildings.find((b) => b.kind === 'house')!;
    state.couriers = [
      {
        id: `c${state.nextId++}`,
        sourceId: paddy.id,
        targetId: house.id,
        kind: 'worker',
        path: [{ x: house.x, y: house.y }],
        progress: 0,
        resource: 'rice',
        amount: 4,
      },
    ];
    const game = new Game(state),
      notices: string[] = [];
    game.onEvent((event) => {
      if (event.type === 'milestone') notices.push(event.id);
    });
    game.step();
    expect(notices).toContain('first-harvest');
    game.step();
    expect(notices.filter((id) => id === 'first-harvest')).toHaveLength(1);
  });
});

describe('isometric obstruction fading', () => {
  it('fades a temple for a tile behind it, retaining its own footprint and foreground tiles', () => {
    const state = createWorld();
    const temple = state.buildings.find((b) => b.kind === 'temple')!;
    temple.level = 3;
    expect(obstructsTile(temple, { x: temple.x - 1, y: temple.y - 1 })).toBe(true);
    expect(obstructsTile(temple, { x: temple.x, y: temple.y })).toBe(false);
    expect(obstructsTile(temple, { x: temple.x + 8, y: temple.y + 8 })).toBe(false);
    expect(obstructsTile(temple, null)).toBe(false);
  });
});
