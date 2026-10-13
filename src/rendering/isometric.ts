import { CONFIG } from '../data/config';
import type { Point } from '../core/types';

export function toScreen(x: number, y: number): Point {
  return { x: ((x - y) * CONFIG.tileWidth) / 2, y: ((x + y) * CONFIG.tileHeight) / 2 };
}
export function toGrid(x: number, y: number): Point {
  return {
    x: Math.floor(x / CONFIG.tileWidth + y / CONFIG.tileHeight + 0.5),
    y: Math.floor(y / CONFIG.tileHeight - x / CONFIG.tileWidth + 0.5),
  };
}
