import type { GameState } from '../core/types';
import { SeasonManager } from '../core/SeasonManager';

/** Conservative four-neighbor cellular automaton. All fluxes read the same old buffer. */
export class WaterSimulation {
  private delta = new Float64Array(0);
  step(state: GameState, weather = true): void {
    if (this.delta.length !== state.tiles.length) this.delta = new Float64Array(state.tiles.length);
    this.delta.fill(0);
    const gateResistance = new Map<number, number>();
    for (const b of state.buildings)
      if (b.kind === 'gate' && !b.construction && !b.enabled)
        gateResistance.set(b.y * state.width + b.x, 0.02);
    for (let i = 0; i < state.tiles.length; i++) {
      const tile = state.tiles[i]!;
      if (tile.water <= 0) continue;
      const adjacent = [
        tile.x > 0 ? i - 1 : -1,
        tile.x < state.width - 1 ? i + 1 : -1,
        tile.y > 0 ? i - state.width : -1,
        tile.y < state.height - 1 ? i + state.width : -1,
      ];
      const flows: { index: number; amount: number }[] = [];
      let total = 0;
      for (const j of adjacent) {
        const neighbor = state.tiles[j];
        if (!neighbor) continue;
        const difference = tile.elevation + tile.water - neighbor.elevation - neighbor.water;
        if (difference <= 0.01) continue;
        const permeability = Math.min(gateResistance.get(i) ?? 1, gateResistance.get(j) ?? 1);
        const amount = difference * 0.12 * permeability;
        total += amount;
        flows.push({ index: j, amount });
      }
      const scale = total > tile.water * 0.5 ? (tile.water * 0.5) / total : 1;
      for (const flow of flows) {
        const amount = flow.amount * scale;
        this.delta[i]! -= amount;
        this.delta[flow.index]! += amount;
      }
    }
    const season = SeasonManager.at(state.day);
    for (let i = 0; i < state.tiles.length; i++) {
      const tile = state.tiles[i]!;
      let water = tile.water + this.delta[i]!;
      if (weather) {
        const channel = ['water', 'reservoir', 'canal', 'bridge'].includes(tile.terrain);
        water += channel ? season.rain - season.evaporation : -season.evaporation * 2;
        if (tile.terrain === 'water') water += (season.wet ? 5.8 : 3.2) > water ? 0.05 : 0;
      }
      tile.water = Math.max(0, water);
    }
  }
  static irrigation(state: GameState, x: number, y: number, size = 2): number {
    let best = 0;
    for (let dy = -2; dy < size + 2; dy++)
      for (let dx = -2; dx < size + 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) continue;
        const t = state.tiles[ny * state.width + nx]!;
        if (['water', 'canal', 'reservoir', 'bridge'].includes(t.terrain))
          best = Math.max(best, Math.min(1, t.water / 2.5));
      }
    return best;
  }
}
