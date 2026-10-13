import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/Game';
import { completedBuilding } from '../src/core/buildingState';
import { createWorld, footprint, tileAt } from '../src/core/world';
import { readGameState, validateState } from '../src/core/Persistence';
import { Construction } from '../src/simulation/Construction';
import { Logistics } from '../src/simulation/Logistics';
import { movementRate, traversable } from '../src/simulation/Pathfinding';
import { Survival } from '../src/simulation/Survival';
import { foodDemand, housingCapacity, productivity } from '../src/simulation/survivalRules';
import { workforce } from '../src/simulation/Workforce';
import type { Building, GameState } from '../src/core/types';

function world() {
  const s = createWorld();
  s.buildings = [];
  s.couriers = [];
  s.population = 36;
  s.tiles.forEach((t) => {
    t.water = 0;
    t.terrain = 'grass';
    t.elevation = 2.6;
  });
  return s;
}
const survival = new Survival();
function day(s: GameState, food = true) {
  s.tick += 6;
  survival.environment(s);
  if (food) survival.food(s);
}
function add(s: GameState, kind: Building['kind'], x = 8, y = 8) {
  const b = completedBuilding(s, kind, x, y);
  s.buildings.push(b);
  return b;
}
function irrigate(s: GameState) {
  Object.assign(tileAt(s, 7, 8)!, { terrain: 'canal', water: 3, elevation: -0.8 });
}
function flood(s: GameState, b: Building, water: number) {
  for (const p of footprint(b)) tileAt(s, p.x, p.y)!.water = water;
}

describe('drought and crop recovery', () => {
  it('accumulates drought stress before failure and preserves previously harvested rice', () => {
    const s = world(),
      paddy = add(s, 'paddy');
    paddy.stock = 12;
    for (let i = 0; i < 5; i++) day(s);
    expect(paddy.crop).toEqual({ stress: 60, failed: false });
    day(s);
    expect(paddy.crop).toEqual({ stress: 72, failed: true });
    expect(paddy.stock).toBe(12);
    expect(Logistics.rate(s, 'rice')).toBe(0);
  });
  it('requires sustained irrigation to replant a failed crop', () => {
    const s = world(),
      paddy = add(s, 'paddy');
    paddy.crop = { stress: 100, failed: true };
    irrigate(s);
    for (let i = 0; i < 7; i++) day(s);
    expect(paddy.crop).toEqual({ stress: 30, failed: true });
    expect(Logistics.rate(s, 'rice')).toBe(0);
    day(s);
    expect(paddy.crop).toEqual({ stress: 20, failed: false });
    expect(Logistics.rate(s, 'rice')).toBeGreaterThan(0);
  });
  it('reduces yield during stress and keeps irrigated crops healthy in the dry season', () => {
    const s = world(),
      paddy = add(s, 'paddy');
    s.day = 130;
    irrigate(s);
    const healthy = Logistics.rate(s, 'rice');
    paddy.crop!.stress = 50;
    expect(Logistics.rate(s, 'rice')).toBeCloseTo(healthy / 2);
    for (let i = 0; i < 8; i++) day(s);
    expect(paddy.crop).toEqual({ stress: 0, failed: false });
  });
  it('does not expose unfinished fields to drought', () => {
    const s = world(),
      game = new Game(s);
    game.place('paddy', { x: 8, y: 8 });
    for (let i = 0; i < 10; i++) day(s);
    expect(s.buildings[0]!.crop!.stress).toBe(0);
  });
});

describe('flood damage and repairs', () => {
  it('checks the entire footprint and applies persistent damage even to paused buildings', () => {
    const s = world(),
      house = add(s, 'house');
    house.enabled = false;
    tileAt(s, 9, 9)!.water = 3;
    day(s);
    expect(house.condition).toBe(88);
    tileAt(s, 9, 9)!.water = 0;
    day(s);
    expect(house.condition).toBe(88);
  });
  it('tolerates ordinary waterway depths and ruins infrastructure in severe floods', () => {
    const s = world(),
      baray = add(s, 'baray', 1, 1),
      bridge = add(s, 'bridge');
    flood(s, baray, 20);
    flood(s, bridge, 5.5);
    day(s);
    expect(baray.condition).toBe(100);
    expect(bridge.condition).toBe(100);
    flood(s, bridge, 8);
    for (let i = 0; i < 9; i++) day(s);
    expect(bridge.condition).toBe(0);
    tileAt(s, 8, 8)!.terrain = 'bridge';
    expect(traversable(s, bridge, 'worker')).toBe(false);
    expect(traversable(s, bridge, 'barge')).toBe(true);
  });
  it('reduces output with condition, and a ruined producer frees its workers', () => {
    const s = world(),
      temple = add(s, 'temple');
    const healthy = Logistics.rate(s, 'merit');
    temple.condition = 50;
    expect(Logistics.rate(s, 'merit')).toBeCloseTo(healthy / 2);
    temple.condition = 0;
    expect(Logistics.rate(s, 'merit')).toBe(0);
    expect(workforce(s).demand).toBe(0);
  });
  it('reserves repair materials and builders then restores condition without inflating investment', () => {
    const s = world(),
      temple = add(s, 'temple'),
      game = new Game(s);
    temple.condition = 50;
    const investment = { ...temple.investment };
    const stone = s.resources.sandstone;
    expect(game.repair(temple.id).ok).toBe(true);
    expect(s.resources.sandstone).toBe(stone - 20);
    expect(temple.construction!.type).toBe('repair');
    expect(workforce(s).builders).toBe(4);
    expect(Logistics.rate(s, 'merit')).toBe(0);
    const construction = new Construction();
    for (let i = 0; i < 25; i++) construction.step(s);
    expect(temple.condition).toBe(100);
    expect(temple.construction).toBeNull();
    expect(temple.investment).toEqual(investment);
    expect(Logistics.rate(s, 'merit')).toBeGreaterThan(0);
  });
  it('rejects unaffordable, flooded, intact, and duplicate repairs', () => {
    const s = world(),
      house = add(s, 'house'),
      game = new Game(s);
    expect(game.repair(house.id).ok).toBe(false);
    house.condition = 30;
    flood(s, house, 1);
    expect(game.repair(house.id).ok).toBe(false);
    flood(s, house, 0);
    s.resources.wood = 0;
    expect(game.repair(house.id).ok).toBe(false);
    s.resources.wood = 100;
    expect(game.repair(house.id).ok).toBe(true);
    expect(game.repair(house.id).ok).toBe(false);
  });
  it('suspends repairs during renewed flooding and resumes after recession', () => {
    const s = world(),
      house = add(s, 'house'),
      game = new Game(s),
      construction = new Construction();
    house.condition = 40;
    game.repair(house.id);
    construction.step(s);
    const progress = house.construction!.workDone;
    flood(s, house, 2);
    for (let i = 0; i < 10; i++) construction.step(s);
    expect(house.construction!.workDone).toBe(progress);
    flood(s, house, 0);
    construction.step(s);
    expect(house.construction!.workDone).toBeGreaterThan(progress);
  });
  it('cancels repairs with an unused-material refund and retains damage', () => {
    const s = world(),
      house = add(s, 'house'),
      game = new Game(s);
    house.condition = 50;
    const wood = s.resources.wood;
    game.repair(house.id);
    game.cancelConstruction(house.id);
    expect(s.resources.wood).toBe(wood);
    expect(house.condition).toBe(50);
    expect(house.construction).toBeNull();
    expect(game.refundFor(house.id).wood).toBe(11);
  });
  it('requires repairing damage before a temple upgrade', () => {
    const s = world(),
      temple = add(s, 'temple'),
      game = new Game(s);
    irrigate(s);
    temple.condition = 99;
    expect(game.upgrade(temple.id)).toMatchObject({ ok: false });
  });
  it('loses housing capacity when homes are ruined and restores it with repairs', () => {
    const s = world(),
      house = add(s, 'house'),
      game = new Game(s);
    s.population = 68;
    expect(housingCapacity(s)).toBe(68);
    house.condition = 0;
    day(s);
    expect(s.population).toBe(66);
    expect(s.survival.departed).toBe(2);
    expect(housingCapacity(s)).toBe(60);
    game.repair(house.id);
    for (let i = 0; i < 100; i++) new Construction().step(s);
    expect(housingCapacity(s)).toBe(68);
  });
});

describe('food, productivity, and population', () => {
  it('uses food delivered on the meal tick before measuring a shortage', () => {
    const s = world(),
      paddy = add(s, 'paddy');
    s.tick = 5;
    s.resources.rice = 0;
    s.couriers.push({
      id: `c${s.nextId++}`,
      sourceId: paddy.id,
      kind: 'worker',
      path: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
      progress: 0.9,
      resource: 'rice',
      amount: 2,
    });
    new Game(s).step();
    expect(s.resources.rice).toBe(0);
    expect(s.survival.lastFoodCoverage).toBe(1);
    expect(s.survival.hunger).toBe(0);
  });
  it('does not evict residents twice when removing a ruined, abandoned dwelling', () => {
    const s = world(),
      house = add(s, 'house'),
      game = new Game(s);
    s.population = 60;
    house.condition = 0;
    game.demolish(house.id);
    expect(s.population).toBe(60);
  });
  it('feeds residents once per day, counts partial meals, and ignores intermediate ticks', () => {
    const s = world();
    s.resources.rice = 1;
    s.tick = 1;
    survival.food(s);
    expect(s.resources.rice).toBe(1);
    expect(s.survival.hunger).toBe(0);
    s.tick = 6;
    survival.food(s);
    expect(s.resources.rice).toBe(0);
    expect(s.survival.lastFoodCoverage).toBe(0.5);
    expect(s.survival.hunger).toBe(7);
    expect(s.population).toBe(36);
  });
  it('slows production, transport, and construction with the same hunger modifier', () => {
    const s = world(),
      temple = add(s, 'temple'),
      game = new Game(s);
    const rate = Logistics.rate(s, 'merit');
    game.place('house', { x: 15, y: 15 });
    const site = s.buildings[1]!;
    s.survival.hunger = 100;
    expect(productivity(s)).toBeCloseTo(0.35);
    expect(Logistics.rate(s, 'merit')).toBeCloseTo(rate * 0.35);
    const c = {
      id: 'c999',
      sourceId: temple.id,
      kind: 'worker' as const,
      progress: 0,
      path: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
      resource: 'rice' as const,
      amount: 1,
    };
    expect(movementRate(s, c)).toBeCloseTo(0.42 * 0.35);
    new Construction().step(s);
    expect(site.construction!.workDone).toBeCloseTo(3 * 0.35);
    expect(validateState(s)).toBe(true);
  });
  it('allows a grace period then reduces population and reconciles builders during sustained hunger', () => {
    const s = world(),
      game = new Game(s);
    s.resources.rice = 0;
    s.population = 8;
    game.place('baray', { x: 1, y: 1 });
    game.place('canal', { x: 8, y: 8 });
    for (let i = 0; i < 3; i++) day(s);
    expect(s.population).toBe(8);
    day(s);
    expect(s.population).toBe(7);
    expect(s.survival.departed).toBe(1);
    expect(workforce(s).assigned).toBeLessThanOrEqual(workforce(s).total);
  });
  it('recovers hunger gradually after meals resume and welcomes residents back within capacity', () => {
    const s = world();
    s.survival.hunger = 42;
    s.survival.shortageDays = 3;
    for (let i = 0; i < 4; i++) day(s);
    expect(s.survival.hunger).toBe(2);
    day(s);
    expect(s.survival.hunger).toBe(0);
    expect(s.survival.shortageDays).toBe(0);
    expect(productivity(s)).toBe(1);
    for (let i = 0; i < 5; i++) day(s);
    expect(s.population).toBe(37);
    s.population = 60;
    for (let i = 0; i < 12; i++) day(s);
    expect(s.population).toBe(60);
  });
  it('never consumes negative rice or loses population below zero', () => {
    const s = world();
    s.population = 1;
    s.resources.rice = 0;
    for (let i = 0; i < 20; i++) day(s);
    expect(s.population).toBe(0);
    expect(s.resources.rice).toBe(0);
    expect(foodDemand(s)).toBe(0);
    expect(s.survival.departed).toBe(1);
    expect(validateState(s)).toBe(true);
  });
  it('does not produce resources with insufficient operating workers', () => {
    const s = world();
    add(s, 'temple');
    s.population = 1;
    expect(Logistics.rate(s, 'merit')).toBe(0);
  });
  it('keeps speed-independent survival state and runs daily consequences through Game', () => {
    const a = world(),
      b = structuredClone(a);
    a.resources.rice = b.resources.rice = 0;
    a.speed = 1;
    b.speed = 4;
    const ga = new Game(a),
      gb = new Game(b);
    for (let i = 0; i < 30; i++) {
      ga.step();
      gb.step();
    }
    expect(a.survival).toEqual(b.survival);
    expect(a.population).toBeLessThan(36);
    expect(a.chronicle.some((e) => e.title === 'Food shortage')).toBe(true);
  });
});

describe('survival persistence', () => {
  it('migrates version 2 projects and canal underlays without losing progress or investments', () => {
    const game = new Game(createWorld());
    game.place('bridge', { x: 13, y: 15 });
    game.step();
    const legacy = JSON.parse(JSON.stringify(game.state));
    legacy.version = 2;
    delete legacy.survival;
    for (const b of legacy.buildings) {
      delete b.condition;
      delete b.crop;
      if (b.underlay) {
        delete b.underlay.condition;
        delete b.underlay.crop;
      }
    }
    const state = readGameState(legacy)!;
    expect(state.version).toBe(3);
    expect(state.survival.hunger).toBe(0);
    expect(state.buildings.find((b) => b.construction)!.construction!.workDone).toBe(2);
    expect(state.buildings.find((b) => b.underlay)!.underlay!.condition).toBe(100);
    expect(state.resources).toEqual(legacy.resources);
    expect(validateState(state)).toBe(true);
    expect(legacy.version).toBe(2);
  });
  it('round trips fractional repair progress, drought stress, hunger, and departure history', () => {
    const s = world(),
      house = add(s, 'house'),
      paddy = add(s, 'paddy', 15, 15),
      game = new Game(s);
    house.condition = 40;
    paddy.crop = { stress: 82, failed: true };
    s.survival.hunger = 20;
    s.survival.departed = 4;
    game.repair(house.id);
    new Construction().step(s);
    expect(house.construction!.workDone).not.toBe(Math.floor(house.construction!.workDone));
    const copy = readGameState(JSON.parse(JSON.stringify(s)))!;
    expect(copy).toEqual(s);
  });
  it('rejects corrupt survival, condition, crop, and repair progress data', () => {
    const s = world(),
      house = add(s, 'house'),
      game = new Game(s);
    house.condition = 50;
    game.repair(house.id);
    const mutations = [
      (v: GameState) => (v.survival.hunger = 101),
      (v: GameState) => (v.survival.shortageDays = -1),
      (v: GameState) => (v.survival.lastFoodCoverage = NaN),
      (v: GameState) => (v.buildings[0]!.condition = -1),
      (v: GameState) => (v.buildings[0]!.crop = { stress: 1, failed: false }),
      (v: GameState) => (v.buildings[0]!.construction!.workDone = Infinity),
    ];
    for (const mutate of mutations) {
      const copy = structuredClone(s);
      mutate(copy);
      expect(readGameState(copy)).toBeNull();
    }
  });
});
