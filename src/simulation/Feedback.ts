import type { GameState, Resource } from '../core/types';
import { CONFIG } from '../data/config';
import { WaterSimulation } from './WaterSimulation';
import { footprint, tileAt } from '../core/world';

export const RATE_WINDOW = 60;
export function recordReceipt(state: GameState, resource: Resource, amount: number): void {
  if (amount <= 0) return;
  const existing = state.feedback.receipts.find(
    (r) => r.tick === state.tick && r.resource === resource,
  );
  if (existing) existing.amount += amount;
  else state.feedback.receipts.push({ tick: state.tick, resource, amount });
}
/** Units actually received per simulation minute; pauses and speed changes do not skew it. */
export function deliveredRate(state: GameState, resource: Resource): number {
  const elapsed = Math.min(RATE_WINDOW, state.tick - state.feedback.sinceTick);
  if (elapsed <= 0) return 0;
  const total = state.feedback.receipts.reduce(
    (n, r) => n + (r.resource === resource && r.tick > state.tick - RATE_WINDOW ? r.amount : 0),
    0,
  );
  return (total * (60_000 / CONFIG.tickMs)) / elapsed;
}
export function lowWaterSites(state: GameState) {
  return state.buildings.filter(
    (b) =>
      b.kind === 'paddy' &&
      b.enabled &&
      !b.construction &&
      b.condition > 0 &&
      WaterSimulation.irrigation(state, b.x, b.y) < 0.5,
  );
}
export function lowReservoirs(state: GameState) {
  return state.buildings.filter(
    (b) =>
      b.kind === 'baray' &&
      !b.construction &&
      footprint(b).reduce((n, p) => n + tileAt(state, p.x, p.y)!.water, 0) / 16 < 1,
  );
}
