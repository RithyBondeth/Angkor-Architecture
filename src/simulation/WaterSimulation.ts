import { waterFluxes } from './waterFlow';
import type { GameState } from '../core/types';
import { SeasonManager } from '../core/SeasonManager';

/** Conservative four-neighbor cellular automaton. All fluxes read the same old buffer. */
export class WaterSimulation {
  private delta = new Float64Array(0);
  step(state: GameState, weather = true): void {
    if (this.delta.length !== state.tiles.length) this.delta = new Float64Array(state.tiles.length);
    this.delta.fill(0);
    for (const flow of waterFluxes(state)) {
      this.delta[flow.from]! -= flow.amount;
      this.delta[flow.to]! += flow.amount;
    }
    const season = SeasonManager.at(state.day);
    for (let i = 0; i < state.tiles.length; i++) {
      const tile = state.tiles[i]!;
      let water = tile.water + this.delta[i]!;
      if (weather) {
        const channel = ['water', 'reservoir', 'moat', 'canal', 'bridge'].includes(tile.terrain);
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
        if (['water', 'moat', 'canal', 'reservoir', 'bridge'].includes(t.terrain))
          best = Math.max(best, Math.min(1, t.water / 2.5));
      }
    return best;
  }
}
