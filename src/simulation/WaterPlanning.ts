import type { GameState, Tile } from '../core/types';
import { dominantFlows } from './waterFlow';

export function elevationRange(state: GameState): { min: number; max: number } {
  let min = Infinity,
    max = -Infinity;
  for (const t of state.tiles) {
    min = Math.min(min, t.elevation);
    max = Math.max(max, t.elevation);
  }
  return { min, max };
}
export function elevationColor(height: number, range: { min: number; max: number }): number {
  const t =
    range.max === range.min
      ? 0.5
      : Math.max(0, Math.min(1, (height - range.min) / (range.max - range.min)));
  const low = [47, 100, 145],
    high = [239, 197, 113];
  const rgb = low.map((v, i) => Math.round(v + (high[i]! - v) * t));
  return (rgb[0]! << 16) | (rgb[1]! << 8) | rgb[2]!;
}

export function waterTileDescription(state: GameState, tile: Tile): string {
  const flow = dominantFlows(state).get(tile.y * state.width + tile.x);
  const target = flow ? state.tiles[flow.to]! : null;
  return `Tile ${tile.x + 1}, ${tile.y + 1} · Ground ${tile.elevation.toFixed(2)} · Water ${tile.water.toFixed(2)} · Surface ${(tile.elevation + tile.water).toFixed(2)}${flow && target ? ` · Strongest outflow → ${target.x + 1}, ${target.y + 1}: ${flow.amount.toFixed(3)} / tick` : ' · No significant outflow'}`;
}
