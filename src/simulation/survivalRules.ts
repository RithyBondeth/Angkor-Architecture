import { CONFIG } from '../data/config';
import type { Building, GameState, Resources } from '../core/types';
import { footprint, tileAt } from '../core/world';
import { BUILDINGS } from '../data/buildings';
import { staffedBuildings } from './Workforce';

export function foodDemand(state: GameState): number {
  return (
    Math.ceil(state.population / CONFIG.survival.residentsPerRice) *
    (1 - supportStrength(state, 'granary') * 0.25)
  );
}
export function supportStrength(state: GameState, kind: 'granary' | 'workshop'): number {
  const staffed = staffedBuildings(state);
  return state.buildings.reduce(
    (best, b) => (b.kind === kind && staffed.has(b.id) ? Math.max(best, b.condition / 100) : best),
    0,
  );
}
export function builderEfficiency(state: GameState): number {
  return productivity(state) * (1 + supportStrength(state, 'workshop') * 0.2);
}
export function productivity(state: GameState): number {
  return 1 - state.survival.hunger * 0.0065;
}
export function housingCapacity(state: GameState): number {
  return (
    CONFIG.survival.baseHousing +
    state.buildings.filter(
      (b) => b.kind === 'house' && b.construction?.type !== 'build' && b.condition > 0,
    ).length *
      8
  );
}
export function floodDepth(state: GameState, b: Building): number {
  return Math.max(...footprint(b).map((p) => tileAt(state, p.x, p.y)!.water));
}
export function floodTolerance(b: Building): number {
  if (b.kind === 'baray' || b.kind === 'canal' || b.kind === 'moat') return Infinity;
  if (['bridge', 'gate', 'dock'].includes(b.kind)) return 6;
  return b.kind === 'paddy' ? 1.2 : 0.8;
}
export function floodUnsafe(state: GameState, b: Building): boolean {
  return floodDepth(state, b) > floodTolerance(b);
}
export function repairCost(b: Building): Partial<Resources> {
  const cost: Partial<Resources> = {};
  for (const [key, amount] of Object.entries(BUILDINGS[b.kind].cost)) {
    if (amount > 0)
      cost[key as keyof Resources] = Math.ceil(amount * 0.4 * (1 - b.condition / 100));
  }
  return cost;
}
