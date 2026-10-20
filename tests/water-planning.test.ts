import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/Game';
import { completedBuilding } from '../src/core/buildingState';
import { createWorld, footprint, random, tileAt } from '../src/core/world';
import { readGameState, validateState } from '../src/core/Persistence';
import { WaterSimulation } from '../src/simulation/WaterSimulation';
import { dominantFlows, waterFluxes } from '../src/simulation/waterFlow';
import { recordReservoirHistory, RESERVOIR_HISTORY_DAYS } from '../src/simulation/ReservoirHistory';
import {
  elevationColor,
  elevationRange,
  waterTileDescription,
} from '../src/simulation/WaterPlanning';
import { reservoirHistoryChart, reservoirList } from '../src/ui/WaterPlanningUI';

function flatWorld() {
  const s = createWorld();
  s.buildings = [];
  s.couriers = [];
  for (const t of s.tiles) {
    t.elevation = 0;
    t.water = 0;
    t.terrain = 'grass';
  }
  return s;
}

describe('flow planning', () => {
  it('predicts the exact next solver transfers without mutating the kingdom', () => {
    const state = flatWorld();
    const rand = random(27);
    for (const tile of state.tiles) {
      tile.elevation = rand() * 4;
      tile.water = rand() * 3;
    }
    const before = structuredClone(state);
    const predicted = state.tiles.map((t) => t.water);
    const out = new Map<number, number>();
    for (const f of waterFluxes(state)) {
      predicted[f.from]! -= f.amount;
      predicted[f.to]! += f.amount;
      out.set(f.from, (out.get(f.from) ?? 0) + f.amount);
      const a = state.tiles[f.from]!,
        b = state.tiles[f.to]!;
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1);
    }
    expect(state).toEqual(before);
    for (const [i, total] of out)
      expect(total).toBeLessThanOrEqual(state.tiles[i]!.water * 0.5 + 1e-12);
    new WaterSimulation().step(state, false);
    state.tiles.forEach((tile, i) => expect(tile.water).toBeCloseTo(predicted[i]!, 10));
  });

  it('uses surface pressure and hides stationary or insignificant outflow', () => {
    const state = flatWorld();
    tileAt(state, 5, 5)!.water = 4;
    tileAt(state, 6, 5)!.elevation = 1;
    const flows = waterFluxes(state);
    expect(flows.some((f) => f.from === 5 * state.width + 5 && f.to === 5 * state.width + 6)).toBe(
      true,
    );
    const arrows = dominantFlows(state);
    expect(arrows.size).toBe(1);
    expect(arrows.get(5 * state.width + 5)!.amount).toBe(Math.max(...flows.map((f) => f.amount)));
    state.tiles.forEach((t) => {
      t.water = 1;
      t.elevation = 0;
    });
    expect(dominantFlows(state).size).toBe(0);
    expect(waterTileDescription(state, state.tiles[0]!)).toContain('No significant outflow');
  });

  it('shows the same reduction for gates on either side, and ignores ruined or unfinished gates', () => {
    const state = flatWorld();
    state.tiles.forEach((t) => {
      t.elevation = 10;
    });
    const source = tileAt(state, 5, 5)!,
      target = tileAt(state, 6, 5)!;
    source.elevation = target.elevation = 0;
    source.water = 3;
    target.water = 1;
    const baseline = waterFluxes(state)[0]!.amount;
    for (const p of [source, target]) {
      const gate = completedBuilding(state, 'gate', p.x, p.y);
      gate.enabled = false;
      state.buildings = [gate];
      expect(waterFluxes(state)[0]!.amount).toBeCloseTo(baseline * 0.02);
      gate.condition = 0;
      expect(waterFluxes(state)[0]!.amount).toBe(baseline);
      gate.condition = 100;
      gate.construction = {
        type: 'build',
        builders: 0,
        paused: false,
        cost: {},
        workDone: 0,
        workRequired: 10,
      };
      expect(waterFluxes(state)[0]!.amount).toBe(baseline);
    }
  });

  it('provides numeric elevation, depth, surface, and destination readouts', () => {
    const state = flatWorld();
    const t = tileAt(state, 5, 5)!;
    t.elevation = 2;
    t.water = 3;
    const text = waterTileDescription(state, t);
    expect(text).toContain('Ground 2.00 · Water 3.00 · Surface 5.00');
    expect(text).toContain('Strongest outflow');
    const range = elevationRange(state);
    expect(range).toEqual({ min: 0, max: 2 });
    expect(elevationColor(0, range)).toBe(0x2f6491);
    expect(elevationColor(2, range)).toBe(0xefc571);
    expect(Number.isFinite(elevationColor(2, { min: 2, max: 2 }))).toBe(true);
  });
});

describe('reservoir observations', () => {
  it('starts with one actual reading and samples once per simulation day', () => {
    const game = new Game(createWorld());
    const h = game.state.reservoirHistory![0]!;
    expect(h.samples).toHaveLength(1);
    expect(h.samples[0]!.depth).toBeCloseTo(4.2);
    game.setSpeed(0);
    game.notify();
    game.setSpeed(4);
    expect(h.samples).toHaveLength(1);
    for (let i = 0; i < 6; i++) game.step();
    expect(h.samples).toHaveLength(2);
    expect(h.samples[1]).toMatchObject({ day: 13, tick: 6 });
    expect(validateState(game.state)).toBe(true);
  });

  it('retains only 60 daily samples and records reservoirs independently', () => {
    const state = createWorld();
    const other = completedBuilding(state, 'baray', 1, 10);
    state.buildings.push(other);
    for (let i = 0; i < 75; i++) {
      state.day = 12 + i;
      state.tick = i * 6;
      for (const p of footprint(other)) tileAt(state, p.x, p.y)!.water = i / 10;
      recordReservoirHistory(state);
    }
    expect(state.reservoirHistory).toHaveLength(2);
    for (const h of state.reservoirHistory!) expect(h.samples).toHaveLength(RESERVOIR_HISTORY_DAYS);
    expect(state.reservoirHistory![1]!.samples.at(-1)!.depth).toBeCloseTo(7.4);
    expect(state.reservoirHistory![0]!.samples[0]!.day).toBe(27);
    expect(validateState(state)).toBe(true);
  });

  it('waits for construction, records completion, and removes demolished history', () => {
    const game = new Game(createWorld());
    expect(game.place('baray', { x: 1, y: 10 }).ok).toBe(true);
    const b = game.state.buildings.find((b) => b.x === 1 && b.y === 10 && b.kind === 'baray')!;
    expect(game.state.reservoirHistory!.some((h) => h.id === b.id)).toBe(false);
    for (let i = 0; i < 100 && b.construction; i++) game.step();
    expect(game.state.reservoirHistory!.some((h) => h.id === b.id)).toBe(true);
    game.demolish(b.id);
    expect(game.state.reservoirHistory!.some((h) => h.id === b.id)).toBe(false);
    expect(validateState(game.state)).toBe(true);
  });

  it('round-trips observations and begins older saves at the current day without invented history', () => {
    const state = new Game(createWorld()).state;
    expect(readGameState(JSON.parse(JSON.stringify(state)))?.reservoirHistory).toEqual(
      state.reservoirHistory,
    );
    delete state.reservoirHistory;
    const old = readGameState(state)!;
    expect(old.reservoirHistory).toBeUndefined();
    new Game(old);
    expect(old.reservoirHistory![0]!.samples).toHaveLength(1);
    expect(old.reservoirHistory![0]!.samples[0]!.day).toBe(old.day);
  });

  it('rejects malformed, duplicated, future, unbounded, or orphaned readings', () => {
    const state = new Game(createWorld()).state;
    const h = state.reservoirHistory![0]!,
      sample = h.samples[0]!;
    const bad = [
      null,
      {},
      [{ ...h, id: 'b99999' }],
      [h, h],
      [{ ...h, samples: [sample, sample] }],
      [{ ...h, samples: [{ ...sample, tick: state.tick + 1 }] }],
      [{ ...h, samples: [{ ...sample, day: state.day + 1 }] }],
      [{ ...h, samples: [{ ...sample, depth: NaN }] }],
      [{ ...h, samples: Array(61).fill(sample) }],
    ];
    for (const reservoirHistory of bad)
      expect(readGameState({ ...state, reservoirHistory })).toBeNull();
  });

  it('renders empty and single-point charts, exact readings, and overflow without clipping at 100%', () => {
    const state = createWorld(),
      b = state.buildings.find((b) => b.kind === 'baray')!;
    expect(reservoirHistoryChart(state, b)).toContain('Readings begin');
    new Game(state);
    expect(reservoirHistoryChart(state, b)).toContain('First reading recorded');
    state.reservoirHistory![0]!.samples.push({ day: 13, tick: 6, depth: 9 });
    const chart = reservoirHistoryChart(state, b);
    expect(chart).toContain('150%');
    expect(chart).toContain('<table>');
    expect(chart).toContain('150.0%');
    expect(chart).not.toContain('NaN');
    expect(chart).toContain('role="img"');
    expect(reservoirList(state)).toContain('inspect history');
  });
});
