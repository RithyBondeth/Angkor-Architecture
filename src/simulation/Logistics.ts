import { BUILDINGS } from '../data/buildings';
import { CONFIG } from '../data/config';
import type { Building, GameState, Point, Resource } from '../core/types';
import { tileAt } from '../core/world';
import { findPath, traversable, movementRate } from './Pathfinding';
import { workforce } from './Workforce';
import type { TravelMode } from './Pathfinding';
import { WaterSimulation } from './WaterSimulation';

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
      t.enabled && !t.construction && (mode === 'barge' ? t.kind === 'dock' : t.kind === 'house'),
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
        state.resources[c.resource] = Math.min(
          CONFIG.maxResource,
          state.resources[c.resource] + c.amount,
        );
        return false;
      }
      return true;
    });
    if (state.tick % 10 !== 0) return;
    const pool = workforce(state);
    let labor = pool.total - pool.builders;
    for (const b of state.buildings) {
      const def = BUILDINGS[b.kind];
      if (!b.enabled || b.construction || labor < def.workers) continue;
      labor -= def.workers;
      if (!def.production) continue;
      let amount = def.production.amount * b.level;
      if (b.kind === 'paddy') amount *= WaterSimulation.irrigation(state, b.x, b.y);
      if (b.kind === 'lumber') {
        const forest = state.tiles.some(
          (t) => t.terrain === 'forest' && Math.abs(t.x - b.x) + Math.abs(t.y - b.y) < 7,
        );
        if (!forest) continue;
      }
      const flooded = tileAt(state, b.x, b.y)!.water > 0.8;
      if (flooded && b.kind !== 'temple') amount *= 0.2;
      if (b.kind === 'temple') {
        state.resources.merit = Math.min(CONFIG.maxResource, state.resources.merit + amount);
        continue;
      }
      b.stock = Math.min(100, b.stock + Math.floor(amount));
      if (b.stock < 1 || state.couriers.length >= CONFIG.maxCouriers) continue;
      const path = deliveryRoute(state, b);
      if (!path) continue;
      const cargo = Math.min(b.stock, 30);
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
    const consumption = Math.max(1, Math.ceil(state.population / 18));
    state.resources.rice = Math.max(0, state.resources.rice - consumption);
    state.happiness = Math.max(
      20,
      Math.min(99, state.happiness + (state.resources.rice > 30 ? 0.1 : -2)),
    );
  }
  static workforce(state: GameState) {
    return workforce(state);
  }
  static rate(state: GameState, resource: Resource): number {
    return state.buildings
      .filter(
        (b) => b.enabled && !b.construction && BUILDINGS[b.kind].production?.resource === resource,
      )
      .reduce((n, b) => {
        const amount = BUILDINGS[b.kind].production!.amount * b.level;
        return (
          n + (b.kind === 'paddy' ? amount * WaterSimulation.irrigation(state, b.x, b.y) : amount)
        );
      }, 0);
  }
}
