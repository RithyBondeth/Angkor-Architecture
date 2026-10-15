import type { DeliveryArrival } from '../core/gameEvents';
import { recordReceipt, RATE_WINDOW } from './Feedback';
import { BUILDINGS } from '../data/buildings';
import { CONFIG } from '../data/config';
import type { Building, GameState, Point, Resource } from '../core/types';
import { traversable, movementRate } from './Pathfinding';
import { workforce, staffedBuildings } from './Workforce';
import { WaterSimulation } from './WaterSimulation';
import { floodUnsafe, productivity } from './survivalRules';
import { extractDeposit, remainingDeposit } from './Deposits';
import {
  isReceiver,
  planDelivery,
  storageCapacity,
  transportCapacity,
  transportMode,
} from './logisticsRules';

/** Compatibility helper for campaign connectivity; receiver selection uses weighted route cost. */
export function deliveryRoute(state: GameState, b: Building): Point[] | null {
  return planDelivery(state, b).path;
}
export class Logistics {
  step(state: GameState): DeliveryArrival[] {
    const arrivals: DeliveryArrival[] = [];
    state.feedback.receipts = state.feedback.receipts.filter(
      (r) => r.tick > state.tick - RATE_WINDOW,
    );
    const staffed = staffedBuildings(state);
    state.couriers = state.couriers.filter((c) => {
      const source = state.buildings.find((b) => b.id === c.sourceId);
      const target = state.buildings.find((b) => b.id === c.targetId);
      if (!source) return false;
      if (
        !target ||
        !isReceiver(state, target, c.kind, staffed) ||
        !c.path.every((p) => traversable(state, p, c.kind))
      ) {
        source.stock += c.amount;
        source.deliveryIssue =
          !target || !isReceiver(state, target, c.kind, staffed)
            ? 'receiver-unavailable'
            : (planDelivery(state, source).issue ??
              (c.kind === 'worker' ? 'blocked-land-route' : 'disconnected-waterway'));
        return false;
      }
      c.progress += movementRate(state, c);
      if (c.progress >= c.path.length - 1) {
        const received = Math.min(
          c.amount,
          Math.max(0, storageCapacity(state, c.resource) - state.resources[c.resource]),
        );
        state.resources[c.resource] += received;
        recordReceipt(state, c.resource, received);
        if (received > 0)
          arrivals.push({ type: 'delivery', resource: c.resource, amount: received, mode: c.kind });
        if (
          state.tutorial?.status === 'active' &&
          c.sourceId === state.tutorial.paddyId &&
          c.resource === 'rice' &&
          received > 0
        )
          state.tutorial.delivered = true;
        state.progression.delivered[c.resource] = Math.min(
          1e8,
          (state.progression.delivered[c.resource] ?? 0) + received,
        );
        source.stock += c.amount - received;
        source.deliveryIssue = received < c.amount ? 'storage-full' : null;
        return false;
      }
      return true;
    });
    if (state.tick % 10 !== 0) return arrivals;
    const outputs = Logistics.outputs(state);
    for (const b of state.buildings) {
      const production = BUILDINGS[b.kind].production;
      if (!production) continue;
      const amount = outputs.get(b.id) ?? 0;
      if (b.kind === 'temple') {
        recordReceipt(state, 'merit', Math.min(amount, CONFIG.maxResource - state.resources.merit));
        state.resources.merit = Math.min(CONFIG.maxResource, state.resources.merit + amount);
        continue;
      }
      const requested = Math.min(amount, Math.max(0, CONFIG.logistics.sourceBuffer - b.stock));
      b.stock += ['quarry', 'lateritepit', 'lumber'].includes(b.kind)
        ? extractDeposit(state, b, requested)
        : requested;
    }
    const producers = state.buildings.filter(
      (b) => BUILDINGS[b.kind].production && b.kind !== 'temple',
    );
    if (!producers.length) return arrivals;
    const start = state.logistics.dispatchCursor % producers.length;
    let next = (start + 1) % producers.length;
    for (let i = 0; i < producers.length; i++) {
      const index = (start + i) % producers.length,
        b = producers[index]!;
      if (state.couriers.some((c) => c.sourceId === b.id)) {
        b.deliveryIssue = null;
        continue;
      }
      b.deliveryIssue = null;
      if (!b.enabled || b.construction || b.condition <= 0) continue;
      if (!staffed.has(b.id)) {
        b.deliveryIssue = 'no-workers';
        continue;
      }
      if (b.stock < 1) {
        if (['lumber', 'quarry', 'lateritepit'].includes(b.kind) && remainingDeposit(state, b) <= 0)
          b.deliveryIssue = 'depleted';
        continue;
      }
      const resource = BUILDINGS[b.kind].production!.resource;
      const reserved = state.couriers.reduce(
        (n, c) => n + (c.resource === resource ? c.amount : 0),
        0,
      );
      const space = Math.max(
        0,
        storageCapacity(state, resource) - state.resources[resource] - reserved,
      );
      if (space < 1) {
        b.deliveryIssue = 'storage-full';
        continue;
      }
      const plan = planDelivery(state, b);
      if (!plan.path || !plan.targetId) {
        b.deliveryIssue = plan.issue;
        continue;
      }
      const kind = transportMode(b);
      if (
        state.couriers.length >= CONFIG.maxCouriers ||
        state.couriers.filter((c) => c.kind === kind).length >= transportCapacity(state, kind)
      ) {
        b.deliveryIssue = 'transport-full';
        continue;
      }
      const cargo = Math.min(
        Math.floor(b.stock),
        kind === 'worker' ? CONFIG.logistics.workerCargo : CONFIG.logistics.bargeCargo,
        space,
      );
      b.stock -= cargo;
      state.couriers.push({
        id: `c${state.nextId++}`,
        sourceId: b.id,
        targetId: plan.targetId,
        kind,
        path: plan.path,
        progress: 0,
        resource,
        amount: cargo,
      });
      next = (index + 1) % producers.length;
    }
    state.logistics.dispatchCursor = next;
    return arrivals;
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
  /** The HUD and production share staffing, remaining deposits, buffer space, and survival modifiers. */
  static outputs(state: GameState): Map<string, number> {
    const outputs = new Map<string, number>();
    const staffed = staffedBuildings(state);
    for (const b of state.buildings) {
      const def = BUILDINGS[b.kind];
      if (!staffed.has(b.id) || !def.production) continue;
      let amount = (def.production.amount * b.level * productivity(state) * b.condition) / 100;
      if (b.crop)
        amount *= b.crop.failed
          ? 0
          : WaterSimulation.irrigation(state, b.x, b.y, def.size) * (1 - b.crop.stress / 100);
      if (floodUnsafe(state, b)) amount *= 0.2;
      if (['lumber', 'quarry', 'lateritepit'].includes(b.kind))
        amount = Math.min(amount, remainingDeposit(state, b));
      if (b.kind !== 'temple')
        amount = Math.min(amount, Math.max(0, CONFIG.logistics.sourceBuffer - b.stock));
      outputs.set(b.id, amount);
    }
    return outputs;
  }
}
