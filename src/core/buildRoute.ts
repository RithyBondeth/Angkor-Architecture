import type { BuildingKind, PlacementResult, Point, Resources } from './types';

export type RouteKind = 'road' | 'canal';
export const isRouteKind = (kind: BuildingKind | null): kind is RouteKind =>
  kind === 'road' || kind === 'canal';

export interface RoutePreview extends PlacementResult {
  cells: { point: Point; status: 'new' | 'existing' | 'blocked' }[];
  cost: Partial<Resources>;
  newTiles: number;
  existingTiles: number;
}

/** A connected, duplicate-free L; take the longer axis first (X wins ties). */
export function orthogonalRoute(start: Point, end: Point): Point[] {
  if (![start.x, start.y, end.x, end.y].every(Number.isSafeInteger)) return [];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  // The largest supported map is 64 × 64. Bound input before allocating or looping.
  if (Math.abs(dx) + Math.abs(dy) > 126) return [];
  const points: Point[] = [{ ...start }];
  const p = { ...start };
  const axes: ('x' | 'y')[] = Math.abs(dx) >= Math.abs(dy) ? ['x', 'y'] : ['y', 'x'];
  for (const axis of axes) {
    const direction = Math.sign(end[axis] - p[axis]);
    while (p[axis] !== end[axis]) {
      p[axis] += direction;
      points.push({ ...p });
    }
  }
  return points;
}
