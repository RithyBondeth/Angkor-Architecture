import type { GameState } from '../core/types';

export interface WaterFlux {
  from: number;
  to: number;
  amount: number;
}

/** Shared by the solver and planning tools: the next pressure-driven transfers, before weather. */
export function waterFluxes(state: GameState): WaterFlux[] {
  const resistance = new Map<number, number>();
  for (const b of state.buildings)
    if (b.kind === 'gate' && b.construction?.type !== 'build' && b.condition > 0 && !b.enabled)
      resistance.set(b.y * state.width + b.x, 0.02);
  const result: WaterFlux[] = [];
  for (let i = 0; i < state.tiles.length; i++) {
    const tile = state.tiles[i]!;
    if (tile.water <= 0) continue;
    const adjacent = [
      tile.x > 0 ? i - 1 : -1,
      tile.x < state.width - 1 ? i + 1 : -1,
      tile.y > 0 ? i - state.width : -1,
      tile.y < state.height - 1 ? i + state.width : -1,
    ];
    const flows: WaterFlux[] = [];
    let total = 0;
    for (const j of adjacent) {
      const neighbor = state.tiles[j];
      if (!neighbor) continue;
      const difference = tile.elevation + tile.water - neighbor.elevation - neighbor.water;
      if (difference <= 0.01) continue;
      const amount = difference * 0.12 * Math.min(resistance.get(i) ?? 1, resistance.get(j) ?? 1);
      total += amount;
      flows.push({ from: i, to: j, amount });
    }
    const scale = total > tile.water * 0.5 ? (tile.water * 0.5) / total : 1;
    for (const flow of flows) result.push({ ...flow, amount: flow.amount * scale });
  }
  return result;
}

/** One arrow per donor avoids drawing overlapping arrows for each neighbor. */
export function dominantFlows(state: GameState): Map<number, WaterFlux> {
  const result = new Map<number, WaterFlux>();
  for (const flow of waterFluxes(state))
    if (flow.amount >= 0.001 && flow.amount > (result.get(flow.from)?.amount ?? 0))
      result.set(flow.from, flow);
  return result;
}
