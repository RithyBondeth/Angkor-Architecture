import { describe, expect, it } from 'vitest';
import { completedBuilding } from '../src/core/buildingState';
import { Game } from '../src/core/Game';
import { createWorld, tileAt } from '../src/core/world';
import { readGameState } from '../src/core/Persistence';
import { Construction } from '../src/simulation/Construction';
import { floodUnsafe, housingCapacity } from '../src/simulation/survivalRules';
import { CONFIG } from '../src/data/config';
import type { GameState } from '../src/core/types';

/** Dry land with a river along x ≥ 12. */
function riverside(): GameState {
  const s = createWorld();
  s.buildings = [];
  s.couriers = [];
  s.tutorial = undefined;
  s.resources = { rice: 500, wood: 500, sandstone: 500, laterite: 500, merit: 2000 };
  s.progression.meritPeak = 2000;
  s.tiles.forEach((t) => {
    const wet = t.x >= 12;
    Object.assign(t, {
      terrain: wet ? 'water' : 'grass',
      water: wet ? 2 : 0,
      elevation: wet ? -1 : 2.6,
    });
  });
  return s;
}

describe('pieces on the water', () => {
  it('float only on open river or lake water', () => {
    const game = new Game(riverside());
    expect(game.canPlace('lotusraft', { x: 15, y: 10 }).ok).toBe(true);
    expect(game.canPlace('royalbarge', { x: 14, y: 10 }).ok).toBe(true);
    expect(game.canPlace('lotusraft', { x: 5, y: 10 }).message).toMatch(/open river or lake water/);
    expect(game.canPlace('royalbarge', { x: 11, y: 10 }).ok).toBe(false);
  });

  it('raise stilt houses only beside the bank', () => {
    const game = new Game(riverside());
    expect(game.canPlace('stilthouse', { x: 12, y: 10 }).ok).toBe(true);
    expect(game.canPlace('stilthouse', { x: 16, y: 10 }).message).toMatch(/riverbank/);
  });

  it('put fishing piers on land next to the water', () => {
    const game = new Game(riverside());
    expect(game.canPlace('fishery', { x: 10, y: 10 }).ok).toBe(true);
    expect(game.canPlace('fishery', { x: 4, y: 10 }).message).toMatch(/beside open river/);
    expect(game.canPlace('fishery', { x: 12, y: 10 }).ok).toBe(false);
  });

  it('house four residents, never flood, and keep the river under them', () => {
    const s = riverside();
    const base = housingCapacity(s);
    const game = new Game(s);
    expect(game.place('stilthouse', { x: 12, y: 10 }).ok).toBe(true);
    const house = s.buildings.at(-1)!;
    house.construction!.workDone = house.construction!.workRequired;
    house.construction!.builders = 1;
    const population = s.population;
    new Construction().step(s);
    expect(house.construction).toBeNull();
    expect(tileAt(s, 12, 10)!.terrain).toBe('water');
    expect(s.population).toBe(population + 4);
    expect(housingCapacity(s)).toBe(base + 4);
    expect(floodUnsafe(s, house)).toBe(false);
    s.buildings.push(completedBuilding(s, 'royalbarge', 14, 12));
    expect(floodUnsafe(s, s.buildings.at(-1)!)).toBe(false);
    expect(CONFIG.survival.baseHousing).toBeGreaterThan(0);
    expect(readGameState(JSON.parse(JSON.stringify(s)))).not.toBeNull();
  });
});
