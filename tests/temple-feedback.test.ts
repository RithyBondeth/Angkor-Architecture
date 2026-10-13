import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/Game';
import { completedBuilding } from '../src/core/buildingState';
import { createWorld, tileAt } from '../src/core/world';
import { readGameState, validateState } from '../src/core/Persistence';
import { Construction } from '../src/simulation/Construction';
import { Logistics } from '../src/simulation/Logistics';
import {
  deliveredRate,
  lowWaterSites,
  lowReservoirs,
  recordReceipt,
} from '../src/simulation/Feedback';
import {
  moatCoverage,
  moatRing,
  RELIEF_TARGET,
  TempleEngineeringSimulation,
} from '../src/simulation/TempleEngineering';
import { traversable } from '../src/simulation/Pathfinding';
import { WaterSimulation } from '../src/simulation/WaterSimulation';

function world() {
  const s = createWorld();
  s.buildings = [];
  s.couriers = [];
  for (const t of s.tiles) {
    t.terrain = 'grass';
    t.water = 0;
    t.elevation = 2.6;
    t.timber = 0;
  }
  return s;
}
function temple() {
  const s = world(),
    b = completedBuilding(s, 'temple', 8, 8, 2);
  s.buildings.push(b);
  s.resources.merit = 600;
  Object.assign(tileAt(s, 7, 8)!, { terrain: 'canal', water: 2.5, elevation: -0.8 });
  return { s, b, game: new Game(s) };
}
function fillMoat(s: ReturnType<typeof world>, b: ReturnType<typeof completedBuilding>) {
  for (const p of moatRing(b))
    Object.assign(tileAt(s, p.x, p.y)!, { terrain: 'moat', water: 1, elevation: -0.8 });
}

describe('temple engineering', () => {
  it('builds a foundation, towers, and reliefs as separate paid projects', () => {
    const s = world(),
      game = new Game(s),
      construction = new Construction();
    s.resources.merit = 600;
    Object.assign(tileAt(s, 7, 8)!, { terrain: 'canal', water: 2.5, elevation: -0.8 });
    expect(game.place('temple', { x: 8, y: 8 }).ok).toBe(true);
    const b = s.buildings[0]!;
    expect(b.construction!.type).toBe('build');
    for (let i = 0; i < 70; i++) construction.step(s);
    expect(b.level).toBe(1);
    expect(b.construction).toBeNull();
    expect(game.upgrade(b.id).ok).toBe(true);
    for (let i = 0; i < 40; i++) construction.step(s);
    expect(b.level).toBe(2);
    expect(b.construction).toBeNull();
    expect(game.upgrade(b.id).ok).toBe(true);
    for (let i = 0; i < 80; i++) construction.step(s);
    expect(b.level).toBe(2);
    for (let cell = 0; cell < 9; cell++)
      while (b.engineering!.relief[cell] !== RELIEF_TARGET[cell]) game.rotateRelief(b.id, cell);
    for (let i = 0; i < 20; i++) construction.step(s);
    expect(b.level).toBe(3);
    expect(b.construction).toBeNull();
    expect(b.investment.sandstone).toBe(340);
    expect(validateState(s)).toBe(true);
  });
  it('rejects uneven temple sites and invalid carving actions atomically', () => {
    const s = world(),
      game = new Game(s);
    tileAt(s, 9, 9)!.elevation = 3.2;
    const before = structuredClone(s.resources);
    expect(game.place('temple', { x: 8, y: 8 }).message).toContain('level ground');
    expect(s.resources).toEqual(before);
    const { game: active, b } = temple();
    expect(active.rotateRelief(b.id, 0).ok).toBe(false);
    active.upgrade(b.id);
    const board = [...b.engineering!.relief];
    for (const cell of [-1, 9, NaN, 0.5]) expect(active.rotateRelief(b.id, cell).ok).toBe(false);
    expect(b.engineering!.relief).toEqual(board);
  });
  it('plans a paid moat ring with four causeways and timed excavation', () => {
    const { s, b, game } = temple();
    const wood = s.resources.wood;
    expect(game.excavateMoat(b.id).ok).toBe(true);
    const moats = s.buildings.filter((b) => b.kind === 'moat');
    expect(moatRing(b)).toHaveLength(16);
    expect(moats).toHaveLength(15); // Existing canal occupies one tile.
    expect(s.resources.wood).toBe(wood - 15 * 6);
    expect(moats.every((b) => b.construction?.type === 'build')).toBe(true);
    expect(tileAt(s, b.x + 2, b.y - 1)!.terrain).toBe('grass');
    for (let i = 0; i < 12; i++) new Construction().step(s);
    expect(moats.some((b) => !b.construction)).toBe(true);
    expect(validateState(s)).toBe(true);
  });
  it('refuses an unaffordable moat without placing or spending anything', () => {
    const { s, b, game } = temple();
    s.resources.wood = 1;
    const before = structuredClone(s);
    expect(game.excavateMoat(b.id).ok).toBe(false);
    expect(s).toEqual(before);
    expect(game.canPlace('moat', { x: 25, y: 25 }).ok).toBe(false);
  });
  it('restores stability with a wet moat and weakens dry or flooded foundations', () => {
    const { s, b } = temple(),
      engine = new TempleEngineeringSimulation();
    b.engineering!.stability = 50;
    s.tick = 6;
    engine.step(s);
    expect(b.engineering!.stability).toBeCloseTo(49.2);
    fillMoat(s, b);
    s.tick = 12;
    engine.step(s);
    expect(moatCoverage(s, b)).toBe(1);
    expect(b.engineering!.stability).toBeCloseTo(51.2);
    tileAt(s, b.x, b.y)!.water = 1;
    s.tick = 18;
    engine.step(s);
    expect(b.engineering!.stability).toBeCloseTo(47.2);
    b.engineering!.stability = 28;
    const condition = b.condition;
    s.tick = 24;
    engine.step(s);
    expect(b.condition).toBe(condition - 2);
  });
  it('blocks unsafe upgrades, pauses unstable work, and resumes after recovery', () => {
    const { s, b, game } = temple();
    b.engineering!.stability = 59;
    expect(game.upgrade(b.id).ok).toBe(false);
    b.engineering!.stability = 60;
    expect(game.upgrade(b.id).ok).toBe(true);
    b.engineering!.stability = 39;
    new Construction().step(s);
    expect(b.construction!.workDone).toBe(0);
    fillMoat(s, b);
    s.tick = 6;
    new TempleEngineeringSimulation().step(s);
    new Construction().step(s);
    expect(b.construction!.workDone).toBeGreaterThan(0);
  });
  it('waits at 80% for the carving, preserves partial play, and rewards completion once', () => {
    const { s, b, game } = temple();
    game.upgrade(b.id);
    const construction = new Construction();
    for (let i = 0; i < 100; i++) construction.step(s);
    expect(b.level).toBe(2);
    expect(b.construction!.workDone).toBe(b.construction!.workRequired * 0.8);
    game.rotateRelief(b.id, 0);
    const copy = readGameState(JSON.parse(JSON.stringify(s)))!;
    expect(copy.buildings[0]!.engineering).toEqual(b.engineering);
    const merit = s.resources.merit;
    for (let cell = 0; cell < 9; cell++)
      while (b.engineering!.relief[cell] !== RELIEF_TARGET[cell])
        expect(game.rotateRelief(b.id, cell).ok).toBe(true);
    expect(s.resources.merit).toBe(merit + 40);
    expect(game.rotateRelief(b.id, 0).ok).toBe(false);
    expect(s.resources.merit).toBe(merit + 40);
    for (let i = 0; i < 20; i++) construction.step(s);
    expect(b.level).toBe(3);
    expect(b.construction).toBeNull();
    expect(validateState(s)).toBe(true);
  });
  it('preserves carving completion through cancellation without paying again', () => {
    const { s, b, game } = temple();
    game.upgrade(b.id);
    for (let cell = 0; cell < 9; cell++)
      while (b.engineering!.relief[cell] !== RELIEF_TARGET[cell]) game.rotateRelief(b.id, cell);
    const merit = s.resources.merit;
    game.cancelConstruction(b.id);
    game.upgrade(b.id);
    expect(b.engineering!.reliefComplete).toBe(true);
    expect(game.rotateRelief(b.id, 0).ok).toBe(false);
    expect(s.resources.merit).toBe(merit);
  });
  it('allows bridges over moats and restores the original moat on removal', () => {
    const { s, game } = temple();
    const moat = completedBuilding(s, 'moat', 8, 7);
    s.buildings.push(moat);
    Object.assign(tileAt(s, 8, 7)!, { terrain: 'moat', water: 1, elevation: -0.8 });
    expect(game.place('bridge', { x: 8, y: 7 }).ok).toBe(true);
    const bridge = s.buildings.find((b) => b.kind === 'bridge')!;
    for (let i = 0; i < 30; i++) new Construction().step(s);
    expect(traversable(s, { x: 8, y: 7 }, 'worker')).toBe(true);
    expect(traversable(s, { x: 8, y: 7 }, 'barge')).toBe(true);
    game.demolish(bridge.id);
    expect(s.buildings).toContain(moat);
    expect(tileAt(s, 8, 7)!.terrain).toBe('moat');
    expect(validateState(s)).toBe(true);
  });
  it('conserves water as a canal fills an excavated moat', () => {
    const { s } = temple();
    Object.assign(tileAt(s, 8, 8)!, { terrain: 'moat', water: 0, elevation: -0.8 });
    const before = s.tiles.reduce((n, t) => n + t.water, 0),
      water = new WaterSimulation();
    water.step(s, false);
    expect(tileAt(s, 8, 8)!.water).toBeGreaterThan(0);
    expect(s.tiles.reduce((n, t) => n + t.water, 0)).toBeCloseTo(before);
  });
});

describe('player feedback and migration', () => {
  it('counts only received cargo in actual production rates, and expires old samples', () => {
    const s = world(),
      source = completedBuilding(s, 'paddy', 8, 8),
      target = completedBuilding(s, 'house', 1, 1);
    s.buildings.push(source, target);
    source.crop!.failed = true;
    s.tick = 30;
    s.resources.rice = 1197;
    s.couriers.push({
      id: `c${s.nextId++}`,
      sourceId: source.id,
      targetId: target.id,
      kind: 'worker',
      path: [{ x: 1, y: 1 }],
      progress: 0,
      resource: 'rice',
      amount: 10,
    });
    new Logistics().step(s);
    expect(deliveredRate(s, 'rice')).toBe(12); // 3 received / 15 seconds, expressed per minute.
    expect(source.stock).toBe(7);
    s.resources.rice += 100;
    s.speed = 0;
    expect(deliveredRate(s, 'rice')).toBe(12); // Refunds and a pause do not inflate the rate.
    s.tick = 91;
    new Logistics().step(s);
    expect(deliveredRate(s, 'rice')).toBe(0);
  });
  it('aggregates receipt samples without growing the save with every shipment', () => {
    const s = world();
    s.tick = 10;
    for (let i = 0; i < 50; i++) {
      recordReceipt(s, 'rice', 1);
      recordReceipt(s, 'wood', 2);
    }
    expect(s.feedback.receipts).toHaveLength(2);
    expect(s.feedback.receipts[0]!.amount).toBe(50);
  });
  it('warns about low irrigation and empty reservoirs before crop failure', () => {
    const s = world(),
      field = completedBuilding(s, 'paddy', 8, 8),
      reservoir = completedBuilding(s, 'baray', 20, 20);
    s.buildings.push(field, reservoir);
    expect(lowWaterSites(s)).toEqual([field]);
    expect(lowReservoirs(s)).toEqual([reservoir]);
    Object.assign(tileAt(s, 7, 8)!, { terrain: 'moat', water: 2.5 });
    expect(lowWaterSites(s)).toEqual([]);
  });
  it('migrates v5 without resetting deposits, cargo, or completed temples', () => {
    const s = createWorld();
    s.tick = 50;
    s.tiles[0]!.timber = 1;
    const temple = s.buildings.find((b) => b.kind === 'temple')!;
    temple.level = 3;
    const old = JSON.parse(JSON.stringify(s));
    old.version = 5;
    delete old.feedback;
    for (const b of old.buildings) {
      delete b.engineering;
      if (b.underlay) delete b.underlay.engineering;
    }
    const copy = readGameState(old)!;
    expect(copy.version).toBe(6);
    expect(copy.tiles).toEqual(s.tiles);
    expect(copy.resources).toEqual(s.resources);
    expect(copy.progression).toEqual(s.progression);
    expect(copy.buildings.find((b) => b.kind === 'temple')!.engineering!.reliefComplete).toBe(true);
    expect(copy.feedback).toEqual({ sinceTick: 50, receipts: [] });
    expect(validateState(copy)).toBe(true);
  });
  it('rejects malformed engineering and future receipt timestamps', () => {
    const s = createWorld(),
      temple = s.buildings.find((b) => b.kind === 'temple')!;
    temple.engineering!.stability = NaN;
    expect(validateState(s)).toBe(false);
    temple.engineering!.stability = 100;
    temple.engineering!.relief[0] = 4;
    expect(validateState(s)).toBe(false);
    temple.engineering!.relief[0] = 1;
    s.feedback.receipts.push({ tick: s.tick + 1, resource: 'rice', amount: 10 });
    expect(validateState(s)).toBe(false);
  });
});
