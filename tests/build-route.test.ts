import { describe, expect, it, vi } from 'vitest';
import { Game } from '../src/core/Game';
import { orthogonalRoute } from '../src/core/buildRoute';
import { createWorld, tileAt } from '../src/core/world';
import { validateState } from '../src/core/Persistence';
import { workforce } from '../src/simulation/Workforce';

function emptyGame() {
  const state = createWorld();
  state.buildings = [];
  state.couriers = [];
  state.tiles.forEach((t) => {
    t.terrain = 'grass';
    t.water = 0;
    t.elevation = 2.6;
  });
  return new Game(state);
}

describe('route construction', () => {
  it('draws connected, duplicate-free routes in every direction, including taps', () => {
    for (const end of [
      { x: 12, y: 11 },
      { x: 8, y: 11 },
      { x: 12, y: 8 },
      { x: 8, y: 8 },
      { x: 10, y: 10 },
      { x: 10, y: 14 },
    ]) {
      const points = orthogonalRoute({ x: 10, y: 10 }, end);
      expect(points[0]).toEqual({ x: 10, y: 10 });
      expect(points.at(-1)).toEqual(end);
      expect(points).toHaveLength(Math.abs(end.x - 10) + Math.abs(end.y - 10) + 1);
      expect(new Set(points.map((p) => `${p.x},${p.y}`)).size).toBe(points.length);
      points
        .slice(1)
        .forEach((p, i) =>
          expect(Math.abs(p.x - points[i]!.x) + Math.abs(p.y - points[i]!.y)).toBe(1),
        );
    }
    expect(orthogonalRoute({ x: 0, y: 0 }, { x: 2, y: 1 })[1]).toEqual({ x: 1, y: 0 });
    expect(orthogonalRoute({ x: 0, y: 0 }, { x: 1, y: 2 })[1]).toEqual({ x: 0, y: 1 });
    expect(orthogonalRoute({ x: 0, y: 0 }, { x: Infinity, y: 2 })).toEqual([]);
    expect(orthogonalRoute({ x: 0, y: 0 }, { x: 1e9, y: 2 })).toEqual([]);
  });

  it.each(['road', 'canal'] as const)(
    'previews and starts %s projects with exact total cost and one notification',
    (kind) => {
      const game = emptyGame();
      const start = { x: 5, y: 5 },
        end = { x: 8, y: 6 };
      const before = structuredClone(game.state);
      const preview = game.previewRoute(kind, start, end);
      expect(preview).toMatchObject({
        ok: true,
        newTiles: 5,
        existingTiles: 0,
        cost: kind === 'road' ? { wood: 20, laterite: 5 } : { wood: 40, laterite: 20 },
      });
      expect(game.state).toEqual(before);
      const notified = vi.fn();
      game.subscribe(notified);
      expect(game.placeRoute(kind, start, end).ok).toBe(true);
      expect(notified).toHaveBeenCalledTimes(1);
      expect(game.state.buildings).toHaveLength(5);
      expect(game.state.buildings.every((b) => b.construction?.type === 'build')).toBe(true);
      for (const [r, n] of Object.entries(preview.cost))
        expect(game.state.resources[r as keyof typeof preview.cost]).toBe(
          before.resources[r as keyof typeof preview.cost] - n,
        );
      expect(workforce(game.state).assigned).toBeLessThanOrEqual(workforce(game.state).total);
      expect(validateState(game.state)).toBe(true);
    },
  );

  it('retains matching completed tiles and projects without charging twice', () => {
    const game = emptyGame();
    game.place('road', { x: 6, y: 5 });
    game.place('road', { x: 7, y: 5 });
    const complete = game.state.buildings[0]!;
    complete.construction = null;
    tileAt(game.state, 6, 5)!.terrain = 'road';
    const preview = game.previewRoute('road', { x: 5, y: 5 }, { x: 8, y: 5 });
    expect(preview).toMatchObject({
      ok: true,
      existingTiles: 2,
      newTiles: 2,
      cost: { wood: 8, laterite: 2 },
    });
    const old = structuredClone(game.state.buildings);
    game.placeRoute('road', { x: 5, y: 5 }, { x: 8, y: 5 });
    expect(game.state.buildings.slice(0, 2)).toEqual(old);
    expect(game.state.buildings).toHaveLength(4);
    const before = structuredClone(game.state);
    expect(game.placeRoute('road', { x: 5, y: 5 }, { x: 8, y: 5 }).ok).toBe(false);
    expect(game.state).toEqual(before);
  });

  it('rejects a route as a whole when any tile is blocked, flooded, or out of bounds', () => {
    for (const block of ['building', 'water', 'flood', 'bounds']) {
      const game = emptyGame();
      if (block === 'building') game.place('house', { x: 7, y: 5 });
      if (block === 'water') tileAt(game.state, 7, 5)!.terrain = 'water';
      if (block === 'flood') tileAt(game.state, 7, 5)!.water = 1;
      const before = structuredClone(game.state);
      expect(
        game.placeRoute('road', { x: 5, y: 5 }, { x: block === 'bounds' ? 32 : 10, y: 5 }).ok,
      ).toBe(false);
      expect(game.state).toEqual(before);
    }
  });

  it('rechecks total affordability and changing terrain on release without partial spending', () => {
    const game = emptyGame();
    game.state.resources.wood = 16;
    const start = { x: 5, y: 5 },
      end = { x: 8, y: 5 };
    expect(game.previewRoute('road', start, end).ok).toBe(true);
    game.state.resources.wood = 15;
    const before = structuredClone(game.state);
    expect(game.placeRoute('road', start, end).ok).toBe(false);
    expect(game.state).toEqual(before);
    game.state.resources.wood = 16;
    tileAt(game.state, 7, 5)!.water = 1;
    expect(game.placeRoute('road', start, end).ok).toBe(false);
    expect(game.state.buildings).toHaveLength(0);
  });

  it('reserves a long route while keeping crew assignments within the shared workforce', () => {
    const game = emptyGame();
    expect(game.placeRoute('road', { x: 0, y: 0 }, { x: 31, y: 31 }).ok).toBe(true);
    expect(game.state.buildings).toHaveLength(63);
    expect(game.state.buildings.some((b) => b.construction!.builders === 0)).toBe(true);
    expect(workforce(game.state).assigned).toBe(workforce(game.state).total);
    expect(validateState(game.state)).toBe(true);
  });

  it('constructs canals over time and retains tutorial tracking and valid saves', () => {
    const game = emptyGame();
    game.state.tutorial!.step = 1;
    game.placeRoute('canal', { x: 5, y: 5 }, { x: 7, y: 5 });
    expect(game.state.tutorial!.canalId).toBe(game.state.buildings[0]!.id);
    expect(tileAt(game.state, 5, 5)!.terrain).toBe('grass');
    for (let i = 0; i < 12; i++) game.step();
    expect(game.state.buildings.every((b) => b.construction === null)).toBe(true);
    expect(tileAt(game.state, 5, 5)!.terrain).toBe('canal');
    expect(validateState(game.state)).toBe(true);
  });
});
