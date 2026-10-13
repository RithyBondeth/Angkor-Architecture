import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../src/core/Game';
import { Persistence, validateState } from '../src/core/Persistence';
import { SeasonManager } from '../src/core/SeasonManager';
import { createWorld, random, tileAt } from '../src/core/world';
import { findPath } from '../src/simulation/Pathfinding';
import { WaterSimulation } from '../src/simulation/WaterSimulation';
import { deliveryRoute, Logistics } from '../src/simulation/Logistics';

function flatWorld() {
  const s = createWorld();
  s.buildings = [];
  s.couriers = [];
  s.tiles.forEach((t) => {
    t.terrain = 'grass';
    t.water = 0;
    t.elevation = 0;
  });
  return s;
}

describe('hydraulic cellular automaton', () => {
  it('conserves volume and never creates negative water over hundreds of steps', () => {
    const s = flatWorld();
    const rand = random(17);
    s.tiles.forEach((t) => {
      t.water = rand() * 8;
      t.elevation = rand() * 3;
    });
    const initial = s.tiles.reduce((n, t) => n + t.water, 0);
    const water = new WaterSimulation();
    for (let i = 0; i < 300; i++) water.step(s, false);
    expect(s.tiles.every((t) => Number.isFinite(t.water) && t.water >= 0)).toBe(true);
    expect(s.tiles.reduce((n, t) => n + t.water, 0)).toBeCloseTo(initial, 8);
  });
  it('moves water downhill using surface pressure rather than terrain alone', () => {
    const s = flatWorld();
    const water = new WaterSimulation();
    const source = tileAt(s, 10, 10)!;
    source.water = 4;
    source.elevation = 2;
    water.step(s, false);
    expect(tileAt(s, 11, 10)!.water).toBeGreaterThan(0);
    expect(source.water).toBeLessThan(4);
  });
  it('closed gates reduce flow and block barges', () => {
    const open = flatWorld();
    const closed = flatWorld();
    for (const s of [open, closed]) {
      for (let x = 0; x < s.width; x++) {
        const t = tileAt(s, x, 10)!;
        t.terrain = 'canal';
        t.elevation = -2;
        t.water = 1;
      }
      tileAt(s, 10, 10)!.water = 4;
      s.buildings.push({
        id: 'b1',
        kind: 'gate',
        x: 11,
        y: 10,
        level: 1,
        enabled: s === open,
        stock: 0,
      });
    }
    const water = new WaterSimulation();
    water.step(open, false);
    water.step(closed, false);
    expect(tileAt(closed, 11, 10)!.water).toBeLessThan(tileAt(open, 11, 10)!.water);
    expect(findPath(open, { x: 10, y: 10 }, { x: 12, y: 10 }, 'barge')).not.toBeNull();
    expect(findPath(closed, { x: 10, y: 10 }, { x: 12, y: 10 }, 'barge')).toBeNull();
  });
  it('changes wet/dry seasons and advances the calendar without boundary drift', () => {
    expect(SeasonManager.at(90).wet).toBe(true);
    expect(SeasonManager.at(91).wet).toBe(false);
    expect(SeasonManager.at(180).wet).toBe(false);
    expect(SeasonManager.at(181)).toMatchObject({ wet: true, year: 803, remaining: 90 });
  });
});

describe('worker and barge A*', () => {
  it('finds a shortest four-neighbor route on open land', () => {
    const s = flatWorld();
    const path = findPath(s, { x: 0, y: 0 }, { x: 8, y: 5 }, 'worker');
    expect(path).toHaveLength(14);
    expect(path?.[0]).toEqual({ x: 0, y: 0 });
    expect(path?.at(-1)).toEqual({ x: 8, y: 5 });
  });
  it('routes around obstacles and returns null for a disconnected channel', () => {
    const s = flatWorld();
    for (let y = 0; y < 10; y++) tileAt(s, 3, y)!.terrain = 'water';
    const path = findPath(s, { x: 1, y: 2 }, { x: 5, y: 2 }, 'worker');
    expect(path?.some((p) => p.y === 10)).toBe(true);
    expect(findPath(s, { x: 1, y: 2 }, { x: 5, y: 2 }, 'barge')).toBeNull();
  });
  it('supports worker bridges and has working starting delivery routes', () => {
    const s = createWorld();
    for (const kind of ['paddy', 'lumber', 'quarry'] as const) {
      const building = s.buildings.find((b) => b.kind === kind)!;
      expect(deliveryRoute(s, building), `${kind} should reach the settlement`).not.toBeNull();
    }
    expect(findPath(s, { x: 12, y: 18 }, { x: 14, y: 18 }, 'worker')).toHaveLength(3);
  });
});

describe('construction and resource loop', () => {
  it('places a floodgate on a newly excavated canal without overlapping records', () => {
    const game = new Game(createWorld());
    expect(game.place('canal', { x: 6, y: 23 }).ok).toBe(true);
    expect(game.place('gate', { x: 6, y: 23 }).ok).toBe(true);
    expect(game.state.buildings.filter((b) => b.x === 6 && b.y === 23)).toHaveLength(1);
    expect(validateState(game.state)).toBe(true);
  });
  it('awards the first commission only once', () => {
    const game = new Game(flatWorld());
    expect(game.place('canal', { x: 10, y: 10 }).ok).toBe(true);
    expect(game.place('paddy', { x: 12, y: 12 }).ok).toBe(true);
    expect(game.place('baray', { x: 16, y: 16 }).ok).toBe(true);
    const before = game.state.resources.merit;
    game.step();
    game.step();
    expect(game.state.resources.merit).toBe(before + 50);
    expect(game.state.objectivesClaimed).toBe(true);
  });
  it('returns a disconnected shipment to its original producer', () => {
    const s = flatWorld();
    s.tick = 1;
    s.buildings = [
      { id: 'b1', kind: 'paddy', x: 1, y: 1, level: 1, enabled: true, stock: 0 },
      { id: 'b2', kind: 'paddy', x: 5, y: 5, level: 1, enabled: true, stock: 0 },
    ];
    s.couriers = [
      {
        id: 'c3',
        sourceId: 'b2',
        kind: 'worker',
        path: [
          { x: 3, y: 3 },
          { x: 4, y: 3 },
        ],
        progress: 0,
        resource: 'rice',
        amount: 16,
      },
    ];
    tileAt(s, 4, 3)!.water = 2;
    new Logistics().step(s);
    expect(s.couriers).toHaveLength(0);
    expect(s.buildings[0]!.stock).toBe(0);
    expect(s.buildings[1]!.stock).toBe(16);
  });
  it('deducts costs atomically, blocks overlaps, and counts new residents', () => {
    const game = new Game(createWorld());
    const wood = game.state.resources.wood;
    expect(game.place('house', { x: 6, y: 23 }).ok).toBe(true);
    expect(game.state.resources.wood).toBe(wood - 45);
    expect(game.state.population).toBe(92);
    const after = structuredClone(game.state.resources);
    expect(game.place('house', { x: 6, y: 23 }).ok).toBe(false);
    expect(game.state.resources).toEqual(after);
    expect(game.place('baray', { x: 31, y: 31 }).ok).toBe(false);
  });
  it('rejects unaffordable construction without modifying terrain', () => {
    const game = new Game(createWorld());
    game.state.resources.wood = 0;
    const before = structuredClone(tileAt(game.state, 6, 23));
    expect(game.place('canal', { x: 6, y: 23 }).ok).toBe(false);
    expect(tileAt(game.state, 6, 23)).toEqual(before);
  });
  it('delivers harvested resources, earns merit, and stays saveable after a season', () => {
    const game = new Game(createWorld());
    const initial = structuredClone(game.state.resources);
    for (let i = 0; i < 600; i++) game.step();
    expect(game.state.resources.wood).toBeGreaterThan(initial.wood);
    expect(game.state.resources.sandstone).toBeGreaterThan(initial.sandstone);
    expect(game.state.resources.merit).toBeGreaterThan(initial.merit);
    expect(game.state.resources.rice).toBeGreaterThan(initial.rice);
    expect(game.state.chronicle.some((e) => e.title === 'The dry season begins')).toBe(true);
    expect(validateState(game.state)).toBe(true);
  });
});

describe('save validation', () => {
  it('accepts a round trip of the initial state', () =>
    expect(validateState(JSON.parse(JSON.stringify(createWorld())))).toBe(true));
  it('rejects corrupt dimensions, unknown building types, nonfinite water, and prototype keys', () => {
    const badSize = createWorld();
    badSize.width = 999;
    expect(validateState(badSize)).toBe(false);
    const badBuilding = JSON.parse(JSON.stringify(createWorld()));
    badBuilding.buildings[0].kind = 'castle';
    expect(validateState(badBuilding)).toBe(false);
    const badWater = createWorld();
    badWater.tiles[0]!.water = NaN;
    expect(validateState(badWater)).toBe(false);
    const proto = JSON.parse(JSON.stringify(createWorld()));
    proto.buildings[0].kind = '__proto__';
    expect(validateState(proto)).toBe(false);
    expect(validateState(null)).toBe(false);
    expect(validateState({})).toBe(false);
  });
  it('rejects overlapping footprints and reused IDs', () => {
    const s = createWorld();
    s.buildings.push({ ...s.buildings[0]!, id: 'b99' });
    s.nextId = 100;
    expect(validateState(s)).toBe(false);
    const duplicate = createWorld();
    duplicate.buildings[1]!.id = duplicate.buildings[0]!.id;
    expect(validateState(duplicate)).toBe(false);
  });
});

describe('LocalStorage save fallback', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('restores an envelope with a real Unix timestamp when IndexedDB is unavailable', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
    });
    const persistence = new Persistence();
    const state = createWorld();
    state.resources.wood = 1234;
    expect(await persistence.save(state)).toBe('LocalStorage');
    expect(await new Persistence().load()).toEqual(state);
  });
  it('rejects malformed backup JSON without preventing a new game', async () => {
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('localStorage', { getItem: () => '{corrupt' });
    expect(await new Persistence().load()).toBeNull();
  });
});
