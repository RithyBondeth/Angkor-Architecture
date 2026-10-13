import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../src/core/Game';
import { completedBuilding } from '../src/core/buildingState';
import { Persistence, readGameState, validateState } from '../src/core/Persistence';
import { activeCommission, buildingUnlocked, earnedMerit } from '../src/core/progressionState';
import { createWorld, tileAt } from '../src/core/world';
import type { BuildingKind, GameState } from '../src/core/types';
import { COMMISSIONS } from '../src/data/progression';
import { Construction } from '../src/simulation/Construction';
import { Logistics } from '../src/simulation/Logistics';
import { Progression, goalValue } from '../src/simulation/Progression';
import { builderEfficiency, foodDemand, supportStrength } from '../src/simulation/survivalRules';

function world() {
  const s = createWorld();
  s.buildings = [];
  s.couriers = [];
  s.tiles.forEach((t) => {
    t.terrain = 'grass';
    t.elevation = 2.6;
    t.water = 0;
  });
  return s;
}
function add(s: GameState, kind: BuildingKind, x: number, y: number) {
  const b = completedBuilding(s, kind, x, y);
  s.buildings.push(b);
  return b;
}
function irrigated(s: GameState) {
  for (const [x, y] of [
    [8, 8],
    [12, 8],
    [16, 8],
  ]) {
    add(s, 'paddy', x!, y!);
    Object.assign(tileAt(s, x! - 1, y!)!, { terrain: 'canal', elevation: -0.8, water: 3 });
  }
}
function completeFoundation(s: GameState) {
  s.built.canal = s.built.paddy = s.built.baray = 1;
  new Progression().step(s);
}
function activeDrought(s: GameState) {
  s.progression.claimed = ['water-foundation', 'connected-city'];
  s.day = 100;
  irrigated(s);
}
function advanceDay(s: GameState) {
  s.tick += 6;
  s.day++;
  return new Progression().step(s);
}

describe('merit unlocks', () => {
  it('shows initial content as available and blocks locked projects atomically', () => {
    const s = world(),
      game = new Game(s),
      before = structuredClone(s);
    expect(buildingUnlocked(s, 'canal')).toBe(true);
    expect(buildingUnlocked(s, 'granary')).toBe(false);
    expect(game.place('granary', { x: 8, y: 8 })).toMatchObject({ ok: false });
    expect(s).toEqual(before);
    expect(game.place('workshop', { x: 8, y: 8 })).toMatchObject({ ok: false });
  });
  it('unlocks at exact merit thresholds and announces each unlock once', () => {
    const s = world(),
      progression = new Progression();
    s.resources.merit = 199;
    progression.step(s);
    expect(buildingUnlocked(s, 'granary')).toBe(false);
    s.resources.merit = 200;
    expect(progression.step(s).filter((e) => e.title.startsWith('Unlocked:'))).toHaveLength(1);
    expect(buildingUnlocked(s, 'granary')).toBe(true);
    s.resources.merit = 599;
    progression.step(s);
    expect(buildingUnlocked(s, 'workshop')).toBe(false);
    s.resources.merit = 600;
    expect(progression.step(s).filter((e) => e.title.startsWith('Unlocked:'))).toHaveLength(2);
    expect(progression.step(s)).toHaveLength(0);
  });
  it('retains unlocks after merit falls and after saving and reloading', () => {
    const s = world();
    s.resources.merit = 600;
    new Progression().step(s);
    s.resources.merit = 0;
    const copy = readGameState(JSON.parse(JSON.stringify(s)))!;
    expect(earnedMerit(copy)).toBe(600);
    expect(new Game(copy).place('workshop', { x: 8, y: 8 }).ok).toBe(true);
  });
  it('requires 600 merit for the final temple stage while preserving earlier buildings', () => {
    const s = createWorld(),
      game = new Game(s),
      temple = s.buildings.find((b) => b.kind === 'temple')!;
    Object.assign(tileAt(s, 14, 13)!, { terrain: 'canal', water: 3, elevation: -0.8 });
    const resources = { ...s.resources };
    expect(temple.level).toBe(2);
    expect(Logistics.rate(s, 'merit')).toBeGreaterThan(0);
    expect(game.upgrade(temple.id).ok).toBe(false);
    expect(s.resources).toEqual(resources);
    s.resources.merit = 600;
    expect(game.upgrade(temple.id).ok).toBe(true);
  });
});

describe('unlock benefits and shared staffing', () => {
  it('only activates granaries after completion and while staffed', () => {
    const s = world(),
      game = new Game(s),
      base = foodDemand(s);
    s.resources.merit = 200;
    game.place('granary', { x: 8, y: 8 });
    const b = s.buildings[0]!;
    expect(foodDemand(s)).toBe(base);
    for (let i = 0; i < 32; i++) new Construction().step(s);
    expect(b.construction).toBeNull();
    expect(foodDemand(s)).toBeCloseTo(base * 0.75);
    b.enabled = false;
    expect(foodDemand(s)).toBe(base);
    b.enabled = true;
    s.population = 1;
    expect(supportStrength(s, 'granary')).toBe(0);
  });
  it('uses the strongest service without stacking and scales benefits with damage', () => {
    const s = world(),
      a = add(s, 'granary', 8, 8),
      b = add(s, 'granary', 12, 8);
    a.condition = 50;
    b.condition = 25;
    expect(foodDemand(s)).toBeCloseTo(5 * 0.875);
    b.condition = 100;
    expect(foodDemand(s)).toBeCloseTo(5 * 0.75);
    a.condition = b.condition = 0;
    expect(foodDemand(s)).toBe(5);
  });
  it('speeds builder work and keeps hunger as a productivity penalty', () => {
    const s = world(),
      game = new Game(s);
    add(s, 'workshop', 1, 1);
    add(s, 'workshop', 4, 1);
    expect(builderEfficiency(s)).toBeCloseTo(1.2);
    game.place('house', { x: 8, y: 8 });
    new Construction().step(s);
    expect(s.buildings[2]!.construction!.workDone).toBeCloseTo(3.6);
    s.survival.hunger = 100;
    expect(builderEfficiency(s)).toBeCloseTo(0.35 * 1.2);
    s.buildings[0]!.enabled = s.buildings[1]!.enabled = false;
    expect(builderEfficiency(s)).toBeCloseTo(0.35);
  });
  it('does not activate a support building while it is under repair', () => {
    const s = world(),
      game = new Game(s),
      b = add(s, 'granary', 8, 8);
    b.condition = 50;
    expect(foodDemand(s)).toBeLessThan(5);
    game.repair(b.id);
    expect(foodDemand(s)).toBe(5);
  });
  it('reserves support workers in the same order as production', () => {
    const s = world();
    s.population = 8; // Five workers: the granary gets two, leaving too few for a paddy.
    add(s, 'granary', 1, 1);
    add(s, 'paddy', 8, 8);
    Object.assign(tileAt(s, 7, 8)!, { terrain: 'canal', water: 3 });
    expect(foodDemand(s)).toBe(0.75);
    expect(Logistics.rate(s, 'rice')).toBe(0);
  });
});

describe('royal commissions and campaign', () => {
  it('requires new completed projects and awards each commission only once', () => {
    const s = createWorld(),
      progression = new Progression();
    progression.step(s);
    expect(s.progression.claimed).toEqual([]);
    const merit = s.resources.merit;
    completeFoundation(s);
    expect(s.resources.merit).toBe(merit + 50);
    expect(s.progression.claimed).toEqual(['water-foundation']);
    progression.step(s);
    expect(s.resources.merit).toBe(merit + 50);
    expect(activeCommission(s)!.id).toBe('connected-city');
  });
  it('does not count planned or canceled projects toward commissions', () => {
    const s = world(),
      game = new Game(s);
    game.place('paddy', { x: 8, y: 8 });
    const goal = COMMISSIONS[0]!.goals[1]!;
    expect(goalValue(s, goal)).toBe(0);
    game.cancelConstruction(s.buildings[0]!.id);
    expect(goalValue(s, goal)).toBe(0);
  });
  it('keeps later chapters locked until the earlier commission is complete', () => {
    const s = world();
    s.built.house = 2;
    s.built.road = 5;
    s.built.bridge = 1;
    new Progression().step(s);
    expect(s.progression.claimed).toEqual([]);
    completeFoundation(s);
    new Progression().step(s);
    expect(s.progression.claimed).toEqual(['water-foundation', 'connected-city']);
  });
  it('counts only received cargo, including actual storage space, and excludes starting stock', () => {
    const s = world(),
      b = add(s, 'paddy', 8, 8);
    expect(s.progression.delivered).toEqual({});
    const destination = add(s, 'house', 1, 1);
    s.resources.rice = 1198.5;
    s.tick = 1;
    s.couriers.push({
      id: `c${s.nextId++}`,
      sourceId: b.id,
      targetId: destination.id,
      kind: 'worker',
      path: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
      progress: 0.9,
      resource: 'rice',
      amount: 10,
    });
    new Logistics().step(s);
    expect(s.resources.rice).toBe(1200);
    expect(s.progression.delivered.rice).toBe(1.5);
  });
  it('does not count disconnected shipments as delivered cargo', () => {
    const s = world(),
      b = add(s, 'paddy', 8, 8);
    const destination = add(s, 'house', 1, 1);
    s.tick = 1;
    tileAt(s, 2, 1)!.water = 2;
    s.couriers.push({
      id: `c${s.nextId++}`,
      sourceId: b.id,
      targetId: destination.id,
      kind: 'worker',
      path: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
      progress: 0.9,
      resource: 'rice',
      amount: 10,
    });
    new Logistics().step(s);
    expect(b.stock).toBe(10);
    expect(s.progression.delivered).toEqual({});
  });
  it('counts consecutive dry days once each, and resets when conditions lapse', () => {
    const s = world();
    activeDrought(s);
    for (let i = 0; i < 3; i++) {
      advanceDay(s);
      new Progression().step(s);
    }
    expect(s.progression.streakDays).toBe(3);
    s.survival.hunger = 1;
    advanceDay(s);
    expect(s.progression.streakDays).toBe(0);
    s.survival.hunger = 0;
    s.day = 80;
    advanceDay(s);
    expect(s.progression.streakDays).toBe(0);
    s.day = 100;
    for (let i = 0; i < 5; i++) advanceDay(s);
    expect(s.progression.claimed).toHaveLength(3);
    expect(s.progression.streakDays).toBe(0);
  });
  it('does not carry an earlier healthy streak into a newly activated chapter', () => {
    const s = world();
    s.day = 100;
    irrigated(s);
    for (let i = 0; i < 12; i++) advanceDay(s);
    expect(s.progression.streakDays).toBe(0);
    s.progression.claimed = ['water-foundation', 'connected-city'];
    advanceDay(s);
    expect(s.progression.streakDays).toBe(1);
  });
  it('uses live population, reserves, healthy fields, and operational temple levels', () => {
    const s = world();
    irrigated(s);
    const goals = COMMISSIONS[2]!.goals;
    expect(goalValue(s, goals[0]!)).toBe(3);
    s.buildings[0]!.crop!.failed = true;
    expect(goalValue(s, goals[0]!)).toBe(2);
    s.resources.rice = 100;
    expect(goalValue(s, goals[1]!)).toBe(100);
    const temple = add(s, 'temple', 20, 10);
    temple.level = 3;
    const templeGoal = COMMISSIONS[4]!.goals[1]!;
    expect(goalValue(s, templeGoal)).toBe(3);
    temple.condition = 0;
    expect(goalValue(s, templeGoal)).toBe(0);
  });
  it('finishes all five chapters, caps rewards, and leaves the campaign in free play', () => {
    const s = world(),
      progression = new Progression();
    s.population = 120;
    s.resources.merit = 600;
    s.built = {
      canal: 1,
      paddy: 1,
      baray: 1,
      house: 2,
      road: 5,
      bridge: 1,
      granary: 1,
      workshop: 1,
    };
    s.progression.delivered = { rice: 200, sandstone: 100 };
    irrigated(s);
    add(s, 'temple', 20, 10).level = 3;
    s.day = 100;
    progression.step(s);
    progression.step(s);
    for (let i = 0; i < 5; i++) advanceDay(s);
    progression.step(s);
    s.resources.merit = 99990;
    const events = [];
    for (let i = 0; i < 7; i++) events.push(...advanceDay(s));
    expect(s.progression.claimed).toEqual(COMMISSIONS.map((c) => c.id));
    expect(s.resources.merit).toBe(99999);
    expect(activeCommission(s)).toBeUndefined();
    expect(events.some((e) => e.title === 'An enduring legacy')).toBe(true);
    expect(progression.step(s)).toHaveLength(0);
    expect(validateState(s)).toBe(true);
  });
});

describe('progression saves', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('migrates version 3 without resetting survival, repairs, or duplicating the first reward', () => {
    const game = new Game(createWorld());
    const house = game.state.buildings.find((b) => b.kind === 'house')!;
    house.condition = 40;
    game.repair(house.id);
    game.state.survival.hunger = 14;
    const legacy = JSON.parse(JSON.stringify(game.state));
    legacy.version = 3;
    legacy.objectivesClaimed = true;
    delete legacy.progression;
    const copy = readGameState(legacy)!;
    expect(copy.version).toBe(6);
    expect(copy.survival).toEqual(legacy.survival);
    expect(copy.buildings).toEqual(legacy.buildings);
    expect(copy.resources).toEqual(legacy.resources);
    expect(copy.progression.claimed).toEqual(['water-foundation']);
    new Progression().step(copy);
    expect(copy.resources).toEqual(legacy.resources);
    expect(copy.progression.delivered).toEqual({});
  });
  it('round trips an active consecutive-day goal without losing or double-counting a day', () => {
    const s = world();
    activeDrought(s);
    for (let i = 0; i < 3; i++) advanceDay(s);
    const copy = readGameState(JSON.parse(JSON.stringify(s)))!;
    new Progression().step(copy);
    expect(copy.progression.streakDays).toBe(3);
    advanceDay(copy);
    advanceDay(copy);
    expect(copy.progression.claimed).toHaveLength(3);
  });
  it('saves and loads the new envelope through the LocalStorage fallback', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
    });
    const s = createWorld(),
      persistence = new Persistence();
    await persistence.save(s);
    expect(JSON.parse([...values.values()][0]!).schema).toBe(6);
    expect(await persistence.load()).toEqual(s);
  });
  it('rejects out-of-order or duplicate claims, unknown cargo, and invalid counters', () => {
    const s = createWorld();
    const mutations = [
      (v: GameState) => (v.progression.claimed = ['connected-city']),
      (v: GameState) => (v.progression.claimed = ['water-foundation', 'water-foundation']),
      (v: GameState) => (v.progression.meritPeak = NaN),
      (v: GameState) => (v.progression.lastDayTick = v.tick + 1),
      (v: GameState) => (v.progression.streakDays = 1),
      (v: GameState) => (v.progression.delivered.rice = -1),
    ];
    for (const mutate of mutations) {
      const copy = structuredClone(s);
      mutate(copy);
      expect(readGameState(copy)).toBeNull();
    }
    const unknown = JSON.parse(JSON.stringify(s));
    unknown.progression.delivered.gold = 10;
    expect(readGameState(unknown)).toBeNull();
  });
});
