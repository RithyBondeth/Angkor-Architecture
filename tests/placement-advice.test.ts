import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/Game';
import { completedBuilding } from '../src/core/buildingState';
import { createWorld, tileAt } from '../src/core/world';

function world() {
  const state = createWorld();
  state.buildings = [];
  state.couriers = [];
  for (const tile of state.tiles) {
    tile.terrain = 'grass';
    tile.elevation = 2.6;
    tile.water = 0;
    tile.timber = 0;
    tile.mineral = null;
  }
  return state;
}

describe('building site advice', () => {
  it('reports irrigation and real receiver connectivity without changing the kingdom', () => {
    const state = world();
    state.buildings.push(completedBuilding(state, 'house', 20, 20));
    const game = new Game(state);
    const before = structuredClone(state);
    const dry = game.previewPlacement('paddy', { x: 8, y: 8 });
    expect(dry.ok).toBe(true);
    expect(dry.advice).toContainEqual(
      expect.objectContaining({ warning: true, message: expect.stringContaining('0% irrigation') }),
    );
    expect(dry.advice).toContainEqual(
      expect.objectContaining({
        warning: false,
        message: expect.stringContaining('Dry delivery route'),
      }),
    );
    expect(state).toEqual(before);
    const canal = tileAt(state, 7, 8)!;
    canal.terrain = 'canal';
    canal.water = 2.5;
    expect(game.previewPlacement('paddy', { x: 8, y: 8 }).advice).toContainEqual(
      expect.objectContaining({
        warning: false,
        message: expect.stringContaining('100% irrigation'),
      }),
    );
  });

  it('warns about missing destinations, flood barriers, and unavailable operating labor', () => {
    const state = world();
    state.population = 0;
    const game = new Game(state);
    expect(game.previewPlacement('paddy', { x: 8, y: 8 }).advice).toContainEqual(
      expect.objectContaining({
        warning: true,
        message: expect.stringContaining('No working destination'),
      }),
    );
    expect(game.previewPlacement('paddy', { x: 8, y: 8 }).advice).toContainEqual(
      expect.objectContaining({
        warning: true,
        message: expect.stringContaining('operating workers'),
      }),
    );
    state.buildings.push(completedBuilding(state, 'house', 20, 20));
    // An edge-to-edge flooded strip separates the site from the receiving home.
    for (let y = 0; y < state.height; y++) tileAt(state, 16, y)!.water = 1;
    expect(game.previewPlacement('paddy', { x: 8, y: 8 }).advice).toContainEqual(
      expect.objectContaining({
        warning: true,
        message: expect.stringContaining('Land route flooded'),
      }),
    );
  });

  it('counts deposits after the building footprint occupies its trees', () => {
    const state = world();
    const tree = tileAt(state, 8, 8)!;
    tree.terrain = 'forest';
    tree.timber = 100;
    const game = new Game(state);
    const preview = game.previewPlacement('lumber', { x: 8, y: 8 });
    expect(preview.ok).toBe(true);
    expect(preview.advice).toContainEqual(
      expect.objectContaining({
        warning: true,
        message: expect.stringContaining('No timber remains'),
      }),
    );
    expect(tree.timber).toBe(100);
    tileAt(state, 10, 8)!.mineral = { resource: 'sandstone', remaining: 80 };
    expect(game.previewPlacement('quarry', { x: 8, y: 8 }).advice).toContainEqual(
      expect.objectContaining({ warning: false, message: expect.stringContaining('80 sandstone') }),
    );
  });

  it('checks sandstone barge routes against actual water depths and gates', () => {
    const state = world();
    tileAt(state, 8, 8)!.mineral = { resource: 'sandstone', remaining: 80 };
    for (let x = 4; x <= 24; x++) {
      const water = tileAt(state, x, 7)!;
      water.terrain = 'canal';
      water.water = 2;
    }
    state.buildings.push(completedBuilding(state, 'dock', 22, 8));
    const game = new Game(state);
    const site = { x: 8, y: 8 };
    expect(game.previewPlacement('quarry', site).advice).toContainEqual(
      expect.objectContaining({ warning: false, message: expect.stringContaining('Barge route') }),
    );
    const gate = completedBuilding(state, 'gate', 16, 7);
    gate.enabled = false;
    state.buildings.push(gate);
    expect(game.previewPlacement('quarry', site).advice).toContainEqual(
      expect.objectContaining({
        warning: true,
        message: expect.stringContaining('Floodgate blocks barges'),
      }),
    );
    gate.enabled = true;
    tileAt(state, 16, 7)!.water = 0.1;
    expect(game.previewPlacement('quarry', site).advice).toContainEqual(
      expect.objectContaining({
        warning: true,
        message: expect.stringContaining('Water too shallow'),
      }),
    );
  });

  it('keeps placement restrictions authoritative and never forecasts invalid sites', () => {
    const state = world();
    const game = new Game(state);
    const before = structuredClone(state);
    expect(game.previewPlacement('paddy', { x: -1, y: 4 })).toMatchObject({
      ok: false,
      advice: [],
    });
    expect(game.previewPlacement('quarry', { x: 8, y: 8 })).toMatchObject({
      ok: false,
      advice: [],
    });
    expect(state).toEqual(before);
  });

  it('distinguishes a filled water connection from a dry excavation', () => {
    const state = world();
    const game = new Game(state);
    expect(game.previewPlacement('canal', { x: 8, y: 8 }).advice).toContainEqual(
      expect.objectContaining({
        warning: true,
        message: expect.stringContaining('No filled waterway'),
      }),
    );
    const river = tileAt(state, 7, 8)!;
    river.terrain = 'water';
    river.water = 3;
    expect(game.previewPlacement('canal', { x: 8, y: 8 }).advice).toContainEqual(
      expect.objectContaining({
        warning: false,
        message: expect.stringContaining('Touches a filled waterway'),
      }),
    );
  });
});
