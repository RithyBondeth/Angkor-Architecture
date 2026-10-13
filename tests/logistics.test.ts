import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/Game';
import { completedBuilding } from '../src/core/buildingState';
import { readGameState, validateState } from '../src/core/Persistence';
import { createWorld, tileAt } from '../src/core/world';
import type { BuildingKind, GameState } from '../src/core/types';
import { extractDeposit, remainingDeposit } from '../src/simulation/Deposits';
import { Logistics } from '../src/simulation/Logistics';
import { planDelivery, storageCapacity, transportCapacity } from '../src/simulation/logisticsRules';

function world() {
  const s = createWorld();
  s.buildings = [];
  s.couriers = [];
  s.tiles.forEach((t) => {
    t.terrain = 'grass';
    t.elevation = 2.6;
    t.water = 0;
    t.timber = 0;
    t.mineral = null;
  });
  return s;
}
function add(s: GameState, kind: BuildingKind, x: number, y: number) {
  const b = completedBuilding(s, kind, x, y);
  s.buildings.push(b);
  return b;
}
function cycle(s: GameState, tick = 10) {
  s.tick = tick;
  new Logistics().step(s);
}

describe('finite production', () => {
  it('moves dedicated laterite from the starting pit into city stock', () => {
    const game = new Game(createWorld());
    const initial = game.state.resources.laterite;
    for (let i = 0; i < 180; i++) game.step();
    expect(game.state.progression.delivered.laterite).toBeGreaterThan(0);
    expect(game.state.resources.laterite).toBeGreaterThan(initial);
    expect(validateState(game.state)).toBe(true);
  });
  it('extracts laterite only at pits and sandstone only at quarries', () => {
    const s = world();
    const pit = add(s, 'lateritepit', 8, 8),
      quarry = add(s, 'quarry', 16, 8);
    tileAt(s, 9, 9)!.mineral = { resource: 'laterite', remaining: 5 };
    tileAt(s, 17, 9)!.mineral = { resource: 'sandstone', remaining: 7 };
    s.resources.laterite = 0;
    s.resources.sandstone = 0;
    cycle(s);
    expect(pit.stock).toBe(5);
    expect(quarry.stock).toBe(7);
    expect(s.resources.laterite).toBe(0);
    expect(s.resources.sandstone).toBe(0);
    expect(remainingDeposit(s, pit)).toBe(0);
    expect(remainingDeposit(s, quarry)).toBe(0);
    cycle(s, 20);
    expect(pit.stock).toBe(5);
    expect(quarry.stock).toBe(7);
  });
  it('clears the last harvested tree and does not replenish it after demolition', () => {
    const s = world(),
      lodge = add(s, 'lumber', 8, 8),
      tree = tileAt(s, 12, 8)!;
    tree.terrain = 'forest';
    tree.timber = 3;
    expect(extractDeposit(s, lodge, 20)).toBe(3);
    expect(tree.terrain).toBe('grass');
    expect(tree.timber).toBe(0);
    new Game(s).demolish(lodge.id);
    expect(tree.timber).toBe(0);
  });
  it('requires accessible mineral or timber near new extraction sites', () => {
    const s = world(),
      game = new Game(s);
    expect(game.canPlace('lateritepit', { x: 8, y: 8 }).message).toContain('No laterite deposits');
    expect(game.canPlace('quarry', { x: 8, y: 8 }).message).toContain('No sandstone deposits');
    expect(game.canPlace('lumber', { x: 8, y: 8 }).message).toContain('No harvestable timber');
    tileAt(s, 9, 9)!.mineral = { resource: 'laterite', remaining: 10 };
    expect(game.canPlace('lateritepit', { x: 8, y: 8 }).ok).toBe(true);
  });
});

describe('storage and transport', () => {
  it('keeps goods at the source until warehouse storage is built and staffed', () => {
    const s = world(),
      producer = add(s, 'paddy', 8, 8),
      house = add(s, 'house', 20, 20);
    producer.stock = 30;
    producer.crop = { stress: 100, failed: true };
    s.resources.rice = 1200;
    cycle(s);
    expect(producer.deliveryIssue).toBe('storage-full');
    expect(producer.stock).toBe(30);
    expect(s.couriers).toHaveLength(0);
    const warehouse = add(s, 'warehouse', 10, 8);
    expect(storageCapacity(s, 'rice')).toBe(2400);
    expect(transportCapacity(s, 'worker')).toBe(6);
    cycle(s, 20);
    expect(s.couriers).toHaveLength(1);
    expect(s.couriers[0]!.targetId).toBe(warehouse.id);
    expect(s.couriers[0]!.amount).toBe(12);
    expect(producer.stock).toBe(18);
    warehouse.enabled = false;
    s.tick = 21;
    new Logistics().step(s);
    // A dwelling still accepts the parcel if the warehouse has been shut down, but the
    // in-flight destination is explicit and its cargo returns to the producer.
    expect(s.couriers).toHaveLength(0);
    expect(producer.stock).toBe(30);
    expect(producer.deliveryIssue).toBe('receiver-unavailable');
    expect(house.kind).toBe('house');
  });
  it('reserves incoming capacity and credits only material actually received', () => {
    const s = world(),
      source = add(s, 'paddy', 8, 8),
      destination = add(s, 'house', 1, 1);
    s.resources.rice = 1198.5;
    source.stock = 20;
    source.crop = { stress: 100, failed: true };
    cycle(s);
    expect(s.couriers).toHaveLength(1);
    expect(s.couriers[0]!.amount).toBe(1.5);
    expect(source.stock).toBe(18.5);
    const cargo = s.couriers[0]!;
    cargo.path = [{ x: 1, y: 1 }];
    cargo.targetId = destination.id;
    s.tick = 11;
    new Logistics().step(s);
    expect(s.resources.rice).toBe(1200);
    expect(s.progression.delivered.rice).toBe(1.5);
    expect(validateState(s)).toBe(true);
  });
  it('limits active carts and rotates dispatch priority when they free up', () => {
    const s = world();
    add(s, 'house', 1, 1);
    const sources = [
      [8, 8],
      [11, 8],
      [14, 8],
      [17, 8],
      [20, 8],
      [23, 8],
    ].map(([x, y]) => add(s, 'paddy', x!, y!));
    for (const b of sources) {
      b.stock = 30;
      b.crop = { stress: 100, failed: true };
    }
    cycle(s);
    expect(s.couriers).toHaveLength(4);
    expect(sources.slice(4).map((b) => b.deliveryIssue)).toEqual([
      'transport-full',
      'transport-full',
    ]);
    expect(s.logistics.dispatchCursor).toBe(4);
    // Simulate the first trips finishing while leaving other worksite stock available.
    for (const c of s.couriers) c.path = [{ x: 1, y: 1 }];
    s.tick = 11;
    new Logistics().step(s);
    cycle(s, 20);
    expect(s.couriers.map((c) => c.sourceId)).toContain(sources[4]!.id);
    expect(s.couriers.map((c) => c.sourceId)).toContain(sources[5]!.id);
  });
  it('returns the undelivered portion when warehouse damage shrinks storage mid-trip', () => {
    const s = world(),
      source = add(s, 'paddy', 8, 8),
      destination = add(s, 'house', 1, 1),
      warehouse = add(s, 'warehouse', 20, 20);
    source.stock = 12;
    source.crop = { stress: 100, failed: true };
    s.resources.rice = 1195;
    cycle(s);
    expect(s.couriers[0]!.targetId).toBe(destination.id);
    expect(s.couriers[0]!.amount).toBe(12);
    warehouse.condition = 0;
    s.couriers[0]!.path = [{ x: 1, y: 1 }];
    s.tick = 11;
    new Logistics().step(s);
    expect(s.resources.rice).toBe(1200);
    expect(source.stock).toBe(7);
    expect(s.progression.delivered.rice).toBe(5);
    expect(source.deliveryIssue).toBe('storage-full');
    expect(validateState(s)).toBe(true);
  });
  it('distinguishes closed floodgates from shallow water on barge routes', () => {
    const s = world(),
      quarry = add(s, 'quarry', 2, 4);
    add(s, 'dock', 10, 4);
    for (let x = 4; x <= 9; x++) {
      const t = tileAt(s, x, 4)!;
      t.terrain = 'canal';
      t.water = 2;
    }
    const gate = add(s, 'gate', 6, 4);
    gate.enabled = false;
    expect(planDelivery(s, quarry).issue).toBe('closed-gate');
    gate.enabled = true;
    tileAt(s, 6, 4)!.water = 0;
    expect(planDelivery(s, quarry).issue).toBe('shallow-water');
  });
  it('reports a flooded land route with a specific remedy', () => {
    const s = world(),
      source = add(s, 'paddy', 2, 2);
    add(s, 'house', 9, 2);
    for (let y = 0; y < s.height; y++) tileAt(s, 6, y)!.water = 1;
    expect(planDelivery(s, source).issue).toBe('flooded-route');
    source.stock = 10;
    source.crop = { stress: 100, failed: true };
    cycle(s);
    expect(source.deliveryIssue).toBe('flooded-route');
  });
});

describe('save migration', () => {
  it('upgrades a version 4 shipment, deposits, and progression without losing cargo', () => {
    const s = createWorld(),
      source = s.buildings.find((b) => b.kind === 'paddy')!,
      house = s.buildings.find((b) => b.kind === 'house')!;
    source.stock = 7;
    s.couriers.push({
      id: `c${s.nextId++}`,
      sourceId: source.id,
      targetId: house.id,
      kind: 'worker',
      path: [
        { x: 19, y: 19 },
        { x: 20, y: 19 },
      ],
      progress: 0,
      resource: 'rice',
      amount: 9,
    });
    const old = JSON.parse(JSON.stringify(s));
    old.version = 4;
    delete old.logistics;
    for (const t of old.tiles) {
      delete t.timber;
      delete t.mineral;
    }
    for (const b of old.buildings) {
      delete b.deliveryIssue;
      if (b.underlay) delete b.underlay.deliveryIssue;
    }
    for (const c of old.couriers) delete c.targetId;
    const restored = readGameState(old)!;
    expect(restored.version).toBe(6);
    expect(restored.couriers[0]!.targetId).toBe(house.id);
    expect(restored.buildings.find((b) => b.id === source.id)!.stock).toBe(7);
    expect(restored.progression).toEqual(s.progression);
    expect(restored.tiles.some((t) => t.mineral?.resource === 'laterite')).toBe(true);
    expect(validateState(restored)).toBe(true);
  });
  it('retains an untouched forest deposit under a migrated unfinished site', () => {
    const game = new Game(createWorld());
    const site = { x: 0, y: 0 };
    expect(game.place('warehouse', site).ok).toBe(true);
    const old = JSON.parse(JSON.stringify(game.state));
    old.version = 4;
    delete old.logistics;
    for (const t of old.tiles) {
      delete t.timber;
      delete t.mineral;
    }
    for (const b of old.buildings) {
      delete b.deliveryIssue;
      if (b.underlay) delete b.underlay.deliveryIssue;
    }
    const restored = readGameState(old)!;
    expect(restored.tiles[0]!.timber).toBeGreaterThan(0);
    const pending = restored.buildings.find((b) => b.kind === 'warehouse')!;
    new Game(restored).cancelConstruction(pending.id);
    expect(restored.tiles[0]!.terrain).toBe('forest');
    expect(restored.tiles[0]!.timber).toBeGreaterThan(0);
  });
  it('returns legacy cargo to a source when its destination no longer exists', () => {
    const s = createWorld(),
      source = s.buildings.find((b) => b.kind === 'paddy')!;
    s.buildings = [source];
    s.couriers.push({
      id: `c${s.nextId++}`,
      sourceId: source.id,
      targetId: 'b999',
      kind: 'worker',
      path: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
      progress: 0,
      resource: 'rice',
      amount: 9,
    });
    const old = JSON.parse(JSON.stringify(s));
    old.version = 4;
    delete old.logistics;
    for (const t of old.tiles) {
      delete t.timber;
      delete t.mineral;
    }
    delete old.buildings[0].deliveryIssue;
    delete old.couriers[0].targetId;
    const restored = readGameState(old)!;
    expect(restored.couriers).toHaveLength(0);
    expect(restored.buildings[0]!.stock).toBe(9);
  });
});
