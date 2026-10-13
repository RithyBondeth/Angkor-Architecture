import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../src/core/Game';
import { Persistence, readGameState, validateState } from '../src/core/Persistence';
import { completedBuilding } from '../src/core/buildingState';
import { buildingAt, createWorld, tileAt } from '../src/core/world';
import { Logistics } from '../src/simulation/Logistics';
import { findPath, movementRate, traversable } from '../src/simulation/Pathfinding';
import { WaterSimulation } from '../src/simulation/WaterSimulation';
import { workforce } from '../src/simulation/Workforce';

function flatWorld() {
  const state = createWorld();
  state.buildings = [];
  state.couriers = [];
  state.tiles.forEach((t) => {
    t.terrain = 'grass';
    t.water = 0;
    t.elevation = 2.6;
  });
  return state;
}
function finish(game: Game) {
  for (let i = 0; i < 1000 && game.state.buildings.some((b) => b.construction); i++) game.step();
  expect(game.state.buildings.every((b) => !b.construction)).toBe(true);
}
function legacySave() {
  const state = JSON.parse(JSON.stringify(createWorld()));
  state.version = 1;
  state.buildings = state.buildings.filter(
    (b: { kind: string }) => !['road', 'canal', 'bridge'].includes(b.kind),
  );
  for (const b of state.buildings) {
    delete b.construction;
    delete b.investment;
    delete b.terrainBefore;
    delete b.underlay;
  }
  for (const t of state.tiles) if (t.terrain === 'bridge') t.terrain = 'road';
  state.resources.wood = 1234;
  state.day = 47;
  return state;
}

describe('timed construction', () => {
  it('reserves materials and a footprint without activating housing early', () => {
    const game = new Game(flatWorld());
    expect(game.place('house', { x: 8, y: 8 }).ok).toBe(true);
    const site = buildingAt(game.state, 8, 8)!;
    expect(site.construction).toMatchObject({ workDone: 0, workRequired: 64, builders: 3 });
    expect(game.state.resources.wood).toBe(375);
    expect(game.state.population).toBe(84);
    expect(game.place('road', { x: 9, y: 9 }).ok).toBe(false);
    for (let i = 0; i < 21; i++) game.step();
    expect(site.construction?.workDone).toBe(63);
    expect(game.state.population).toBe(84);
    game.step();
    expect(site.construction).toBeNull();
    expect(game.state.population).toBe(92);
    expect(game.state.built.house).toBe(1);
    expect(site.investment).toEqual({ wood: 45, laterite: 15 });
    game.step();
    expect(game.state.population).toBe(92);
  });
  it('only excavates a waterway when builders finish', () => {
    const game = new Game(flatWorld());
    const tile = tileAt(game.state, 8, 8)!;
    game.place('canal', { x: 8, y: 8 });
    expect(tile.terrain).toBe('grass');
    for (let i = 0; i < 5; i++) game.step();
    expect(tile.terrain).toBe('grass');
    game.step();
    expect(tile.terrain).toBe('canal');
    expect(tile.elevation).toBe(-0.8);
  });
  it('keeps unfinished production out of rates and output', () => {
    const game = new Game(flatWorld());
    tileAt(game.state, 7, 8)!.terrain = 'canal';
    tileAt(game.state, 7, 8)!.elevation = -0.8;
    tileAt(game.state, 7, 8)!.water = 3;
    game.place('paddy', { x: 8, y: 8 });
    expect(Logistics.rate(game.state, 'rice')).toBe(0);
    for (let i = 0; i < 10; i++) game.step();
    expect(buildingAt(game.state, 8, 8)!.stock).toBe(0);
    finish(game);
    expect(Logistics.rate(game.state, 'rice')).toBeGreaterThan(0);
  });
  it('pauses work and releases builders, then resumes with an available crew', () => {
    const game = new Game(flatWorld());
    game.place('house', { x: 8, y: 8 });
    const b = buildingAt(game.state, 8, 8)!;
    game.step();
    const done = b.construction!.workDone;
    expect(game.pauseProject(b.id).ok).toBe(true);
    expect(workforce(game.state).builders).toBe(0);
    for (let i = 0; i < 10; i++) game.step();
    expect(b.construction!.workDone).toBe(done);
    expect(game.assignBuilders(b.id, 2).ok).toBe(false);
    expect(game.pauseProject(b.id).ok).toBe(true);
    game.step();
    expect(b.construction!.workDone).toBeGreaterThan(done);
  });
  it('queues projects without free labor and prevents double assignments', () => {
    const s = flatWorld();
    s.population = 8;
    const game = new Game(s);
    game.place('baray', { x: 2, y: 2 });
    game.place('canal', { x: 8, y: 8 });
    game.place('road', { x: 10, y: 10 });
    const first = buildingAt(s, 2, 2)!,
      last = buildingAt(s, 10, 10)!;
    expect(workforce(s)).toMatchObject({ total: 5, builders: 5, available: 0 });
    expect(last.construction!.builders).toBe(0);
    expect(game.assignBuilders(first.id, 5).ok).toBe(false);
    expect(game.assignBuilders(last.id, -1).ok).toBe(false);
    expect(game.assignBuilders(last.id, 9).ok).toBe(false);
    game.pauseProject(first.id);
    expect(game.assignBuilders(last.id, 2).ok).toBe(true);
    game.pauseProject(first.id);
    expect(workforce(s).assigned).toBeLessThanOrEqual(5);
    expect(validateState(s)).toBe(true);
  });
  it('more assigned builders finish a project sooner', () => {
    const slow = new Game(flatWorld()),
      fast = new Game(flatWorld());
    for (const game of [slow, fast]) game.place('house', { x: 8, y: 8 });
    slow.assignBuilders(buildingAt(slow.state, 8, 8)!.id, 1);
    fast.assignBuilders(buildingAt(fast.state, 8, 8)!.id, 8);
    for (let i = 0; i < 8; i++) {
      slow.step();
      fast.step();
    }
    expect(buildingAt(fast.state, 8, 8)!.construction).toBeNull();
    expect(buildingAt(slow.state, 8, 8)!.construction!.workDone).toBe(8);
  });
  it('uses timed temple upgrades and can cancel an upgrade without destroying the sanctuary', () => {
    const game = new Game(createWorld());
    const temple = game.state.buildings.find((b) => b.kind === 'temple')!;
    const water = tileAt(game.state, 14, 13)!;
    water.terrain = 'canal';
    water.water = 3;
    water.elevation = -0.8;
    const materials = { ...game.state.resources };
    expect(game.upgrade(temple.id).ok).toBe(true);
    expect(temple.level).toBe(2);
    expect(Logistics.rate(game.state, 'merit')).toBe(0);
    expect(game.cancelConstruction(temple.id).ok).toBe(true);
    expect(temple.level).toBe(2);
    expect(game.state.resources.sandstone).toBe(materials.sandstone);
    expect(game.state.buildings).toContain(temple);
    expect(game.upgrade(temple.id).ok).toBe(true);
    finish(game);
    expect(temple.level).toBe(3);
    expect(Logistics.rate(game.state, 'merit')).toBe(6);
  });
});

describe('demolition and resource recovery', () => {
  it('keeps the refund preview within remaining resource storage', () => {
    const state = flatWorld(),
      source = completedBuilding(state, 'lumber', 8, 8);
    source.stock = 100;
    state.buildings.push(source);
    state.resources.wood = 99998;
    const game = new Game(state);
    expect(game.refundFor(source.id).wood).toBe(1);
    game.demolish(source.id);
    expect(state.resources.wood).toBe(99999);
  });
  it('fully refunds an untouched project and cannot refund it twice', () => {
    const game = new Game(flatWorld());
    const materials = { ...game.state.resources };
    game.place('house', { x: 8, y: 8 });
    const b = buildingAt(game.state, 8, 8)!;
    expect(game.refundFor(b.id)).toEqual({ wood: 45, laterite: 15 });
    expect(game.cancelConstruction(b.id).ok).toBe(true);
    expect(game.state.resources).toEqual(materials);
    expect(workforce(game.state).builders).toBe(0);
    expect(game.state.population).toBe(84);
    expect(game.demolish(b.id).ok).toBe(false);
    expect(game.state.resources).toEqual(materials);
  });
  it('reduces cancellation refunds as work is consumed', () => {
    const game = new Game(flatWorld());
    game.place('house', { x: 8, y: 8 });
    const b = buildingAt(game.state, 8, 8)!;
    game.assignBuilders(b.id, 8);
    for (let i = 0; i < 4; i++) game.step();
    expect(game.refundFor(b.id)).toEqual({ wood: 33, laterite: 11 });
    game.cancelConstruction(b.id);
    expect(game.state.resources.wood).toBe(408);
    expect(game.state.resources.laterite).toBe(206);
  });
  it('refunds half of a completed building and removes its residents', () => {
    const game = new Game(flatWorld());
    game.place('house', { x: 8, y: 8 });
    finish(game);
    const b = buildingAt(game.state, 8, 8)!;
    expect(game.refundFor(b.id)).toEqual({ wood: 22, laterite: 7 });
    game.demolish(b.id);
    expect(game.state.population).toBe(84);
    expect(game.state.resources.wood).toBe(397);
    expect(tileAt(game.state, 8, 8)!.terrain).toBe('grass');
    expect(validateState(game.state)).toBe(true);
  });
  it('recovers stored goods and dispatched cargo when removing a producer', () => {
    const s = flatWorld();
    const source = completedBuilding(s, 'paddy', 8, 8);
    source.stock = 7;
    s.buildings.push(source);
    s.couriers.push({
      id: `c${s.nextId++}`,
      sourceId: source.id,
      kind: 'worker',
      path: [
        { x: 6, y: 6 },
        { x: 7, y: 6 },
      ],
      progress: 0,
      resource: 'rice',
      amount: 16,
    });
    const game = new Game(s);
    const rice = s.resources.rice;
    expect(game.refundFor(source.id).rice).toBe(23);
    game.demolish(source.id);
    expect(s.resources.rice).toBe(rice + 23);
    expect(s.couriers).toHaveLength(0);
    expect(validateState(s)).toBe(true);
  });
  it('reconciles builder assignments if housing is demolished', () => {
    const s = flatWorld();
    s.population = 8;
    const game = new Game(s);
    game.place('house', { x: 2, y: 2 });
    finish(game);
    const house = buildingAt(s, 2, 2)!;
    game.place('baray', { x: 8, y: 8 });
    const site = buildingAt(s, 8, 8)!;
    game.assignBuilders(site.id, 8);
    game.demolish(house.id);
    expect(s.population).toBe(8);
    expect(workforce(s).builders).toBe(5);
    expect(validateState(s)).toBe(true);
  });
});

describe('roads and bridges', () => {
  it('builds roads after construction and makes workers prefer the faster route', () => {
    const s = flatWorld();
    const game = new Game(s);
    game.place('road', { x: 8, y: 8 });
    expect(tileAt(s, 8, 8)!.terrain).toBe('grass');
    finish(game);
    expect(tileAt(s, 8, 8)!.terrain).toBe('road');
    for (let x = 0; x <= 6; x++) tileAt(s, x, 1)!.terrain = 'road';
    const path = findPath(s, { x: 0, y: 0 }, { x: 6, y: 0 }, 'worker')!;
    expect(path.some((p) => p.y === 1)).toBe(true);
    const courier = {
      id: 'c0',
      sourceId: 'b0',
      kind: 'worker' as const,
      path: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
      ],
      progress: 0,
      resource: 'rice' as const,
      amount: 1,
    };
    expect(movementRate(s, courier)).toBeGreaterThan(0.42);
    expect(traversable(s, { x: 8, y: 8 }, 'barge')).toBe(false);
  });
  it('does not allow bridge placement on land, reservoirs, or unfinished canals', () => {
    const game = new Game(flatWorld());
    expect(game.place('bridge', { x: 8, y: 8 }).ok).toBe(false);
    game.place('canal', { x: 8, y: 8 });
    expect(game.place('bridge', { x: 8, y: 8 }).ok).toBe(false);
    tileAt(game.state, 10, 10)!.terrain = 'reservoir';
    expect(game.place('bridge', { x: 10, y: 10 }).ok).toBe(false);
  });
  it('allows both workers and barges after completion, preserving the original canal on demolition', () => {
    const s = flatWorld();
    const t = tileAt(s, 8, 8)!;
    t.terrain = 'canal';
    t.elevation = -0.8;
    t.water = 3;
    const canal = completedBuilding(s, 'canal', 8, 8);
    canal.terrainBefore = [{ x: 8, y: 8, terrain: 'grass', elevation: 2.6 }];
    s.buildings.push(canal);
    const game = new Game(s);
    expect(game.place('bridge', { x: 8, y: 8 }).ok).toBe(true);
    const bridge = buildingAt(s, 8, 8)!;
    expect(traversable(s, t, 'worker')).toBe(false);
    expect(traversable(s, t, 'barge')).toBe(true);
    finish(game);
    t.water = 3;
    expect(traversable(s, t, 'worker')).toBe(true);
    expect(traversable(s, t, 'barge')).toBe(true);
    expect(validateState(s)).toBe(true);
    const volume = s.tiles.reduce((n, t) => n + t.water, 0);
    game.demolish(bridge.id);
    expect(t.terrain).toBe('canal');
    expect(buildingAt(s, 8, 8)!.id).toBe(canal.id);
    expect(t.water).toBe(3);
    expect(s.tiles.reduce((n, t) => n + t.water, 0)).toBe(volume);
    expect(validateState(s)).toBe(true);
  });
  it('restores river terrain after removing a bridge and conserves flow through it', () => {
    const s = flatWorld();
    const t = tileAt(s, 8, 8)!;
    t.terrain = 'water';
    t.elevation = -2;
    t.water = 5;
    const game = new Game(s);
    game.place('bridge', { x: 8, y: 8 });
    finish(game);
    const before = s.tiles.reduce((n, t) => n + t.water, 0);
    new WaterSimulation().step(s, false);
    expect(s.tiles.reduce((n, t) => n + t.water, 0)).toBeCloseTo(before, 10);
    game.demolish(buildingAt(s, 8, 8)!.id);
    expect(t.terrain).toBe('water');
    expect(t.elevation).toBe(-2);
  });
  it('restores a canal after cancelling an unfinished floodgate', () => {
    const s = createWorld(),
      game = new Game(s),
      canal = buildingAt(s, 13, 15)!;
    expect(game.place('gate', { x: 13, y: 15 }).ok).toBe(true);
    const gate = buildingAt(s, 13, 15)!;
    game.cancelConstruction(gate.id);
    expect(buildingAt(s, 13, 15)!.id).toBe(canal.id);
    expect(validateState(s)).toBe(true);
  });
});

describe('construction save migration and validation', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('migrates version 1 saves and registers existing infrastructure without changing the economy', () => {
    const legacy = legacySave(),
      state = readGameState(legacy)!;
    expect(state.version).toBe(3);
    expect(state.resources.wood).toBe(1234);
    expect(state.day).toBe(47);
    expect(state.population).toBe(84);
    expect(state.buildings.every((b) => b.construction === null)).toBe(true);
    expect(buildingAt(state, 13, 18)!.kind).toBe('bridge');
    expect(validateState(state)).toBe(true);
    expect(legacy.version).toBe(1);
  });
  it('restores legacy LocalStorage envelopes without resetting the city', async () => {
    const legacy = legacySave();
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('localStorage', {
      getItem: () => JSON.stringify({ schema: 1, savedAt: Date.now(), state: legacy }),
    });
    const restored = await new Persistence().load();
    expect(restored?.version).toBe(3);
    expect(restored?.resources.wood).toBe(1234);
  });
  it('round trips active progress, crew assignments, underlays, and paused projects', () => {
    const game = new Game(createWorld());
    game.place('bridge', { x: 13, y: 15 });
    game.place('house', { x: 6, y: 23 });
    for (let i = 0; i < 3; i++) game.step();
    const house = buildingAt(game.state, 6, 23)!;
    game.pauseProject(house.id);
    const copy = readGameState(JSON.parse(JSON.stringify(game.state)))!;
    expect(copy).toEqual(game.state);
    expect(buildingAt(copy, 13, 15)!.underlay?.kind).toBe('canal');
    const restored = new Game(copy);
    finishPaused(restored, house.id);
    expect(validateState(restored.state)).toBe(true);
  });
  it('rejects invalid progress, overallocated workers, and terrain snapshots outside a footprint', () => {
    const game = new Game(flatWorld());
    game.place('house', { x: 8, y: 8 });
    const original = game.state;
    const a = structuredClone(original);
    buildingAt(a, 8, 8)!.construction!.workDone = 999;
    expect(validateState(a)).toBe(false);
    const b = structuredClone(original);
    b.population = 0;
    expect(validateState(b)).toBe(false);
    const c = structuredClone(original);
    buildingAt(c, 8, 8)!.terrainBefore[0]!.x = 31;
    expect(validateState(c)).toBe(false);
    const d = structuredClone(original);
    buildingAt(d, 8, 8)!.construction!.builders = -1;
    expect(validateState(d)).toBe(false);
  });
});
function finishPaused(game: Game, id: string) {
  game.pauseProject(id);
  finish(game);
}
