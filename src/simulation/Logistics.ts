import { BUILDINGS } from '../data/buildings';
import { CONFIG } from '../data/config';
import type { Building, GameState, Point, Resource } from '../core/types';
import { findPath, traversable, movementRate } from './Pathfinding';
import { workforce, staffedBuildings } from './Workforce';
import type { TravelMode } from './Pathfinding';
import { WaterSimulation } from './WaterSimulation';
import { floodUnsafe, productivity } from './survivalRules';

function approaches(state: GameState, b: Building, mode: TravelMode): Point[] {
  const size = BUILDINGS[b.kind].size;
  const points: Point[] = [];
  for (let y = b.y - 3; y < b.y + size + 3; y++)
    for (let x = b.x - 3; x < b.x + size + 3; x++) {
      if (traversable(state, { x, y }, mode)) points.push({ x, y });
    }
  return points.sort(
    (a, c) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) - Math.abs(c.x - b.x) - Math.abs(c.y - b.y),
  );
}
export function deliveryRoute(state: GameState, b: Building): Point[] | null {
  const mode = b.kind === 'quarry' ? 'barge' : 'worker';
  const targets = state.buildings.filter(
    (t) =>
      t.enabled &&
      !t.construction &&
      t.condition > 0 &&
      (mode === 'barge' ? t.kind === 'dock' : t.kind === 'house'),
  );
  const starts = approaches(state, b, mode).slice(0, 6);
  for (const target of targets) {
    const goals = approaches(state, target, mode).slice(0, 6);
    for (const start of starts)
      for (const goal of goals) {
        const path = findPath(state, start, goal, mode);
        if (path && path.length > 1) return path;
      }
  }
  return null;
}
export class Logistics {
  step(state: GameState): void {
    state.couriers = state.couriers.filter((c) => {
      // Rerouting is deferred to the next production cycle; a disconnected shipment returns to stock.
      if (!c.path.every((p) => traversable(state, p, c.kind))) {
        const source = state.buildings.find((b) => b.id === c.sourceId);
        if (source) source.stock += c.amount;
        return false;
      }
      c.progress += movementRate(state, c);
      if (c.progress >= c.path.length - 1) {
        const received = Math.min(c.amount, CONFIG.maxResource - state.resources[c.resource]);
        state.progression.delivered[c.resource] = Math.min(
          1e8,
          (state.progression.delivered[c.resource] ?? 0) + received,
        );
        state.resources[c.resource] = Math.min(
          CONFIG.maxResource,
          state.resources[c.resource] + c.amount,
        );
        return false;
      }
      return true;
    });
    if (state.tick % 10 !== 0) return;
    const outputs = Logistics.outputs(state);
    for (const b of state.buildings) {
      const def = BUILDINGS[b.kind];
      if (!def.production) continue;
      const amount = outputs.get(b.id);
      if (amount === undefined) continue;
      if (b.kind === 'temple') {
        state.resources.merit = Math.min(CONFIG.maxResource, state.resources.merit + amount);
        continue;
      }
      b.stock = Math.min(100, b.stock + amount);
      if (b.stock < 1 || state.couriers.length >= CONFIG.maxCouriers) continue;
      const path = deliveryRoute(state, b);
      if (!path) continue;
      const cargo = Math.min(Math.floor(b.stock), 30);
      b.stock -= cargo;
      state.couriers.push({
        id: `c${state.nextId++}`,
        sourceId: b.id,
        kind: b.kind === 'quarry' ? 'barge' : 'worker',
        path,
        progress: 0,
        resource: def.production.resource,
        amount: cargo,
      });
      if (b.kind === 'quarry')
        state.resources.laterite = Math.min(CONFIG.maxResource, state.resources.laterite + 2);
    }
  }
  static workforce(state: GameState) {
    return workforce(state);
  }
  static rate(state: GameState, resource: Resource): number {
    const outputs = Logistics.outputs(state);
    return state.buildings.reduce(
      (n, b) =>
        n + (BUILDINGS[b.kind].production?.resource === resource ? (outputs.get(b.id) ?? 0) : 0),
      0,
    );
  }
  /** The HUD and production share staffing, crop, flood, damage, and hunger modifiers. */
  static outputs(state: GameState): Map<string, number> {
    const outputs = new Map<string, number>();
    const staffed = staffedBuildings(state);
    for (const b of state.buildings) {
      const def = BUILDINGS[b.kind];
      if (!staffed.has(b.id)) continue;
      if (!def.production) continue;
      let amount = (def.production.amount * b.level * productivity(state) * b.condition) / 100;
      if (b.crop)
        amount *= b.crop.failed
          ? 0
          : WaterSimulation.irrigation(state, b.x, b.y, def.size) * (1 - b.crop.stress / 100);
      if (floodUnsafe(state, b)) amount *= 0.2;
      if (
        b.kind === 'lumber' &&
        !state.tiles.some(
          (t) => t.terrain === 'forest' && Math.abs(t.x - b.x) + Math.abs(t.y - b.y) < 7,
        )
      )
        amount = 0;
      outputs.set(b.id, amount);
    }
    return outputs;
  }
}
