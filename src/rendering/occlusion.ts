import { BUILDINGS } from '../data/buildings';
import type { Building, Point } from '../core/types';
import { footprint } from '../core/world';
import { toScreen } from './isometric';

/** Fade a tall object's painted silhouette when it hides a different tile behind its base. */
export function obstructsTile(building: Building, target: Point | null): boolean {
  if (
    !target ||
    !['temple', 'house', 'lumber', 'warehouse', 'granary', 'workshop'].includes(building.kind)
  )
    return false;
  if (footprint(building).some((p) => p.x === target.x && p.y === target.y)) return false;
  const size = BUILDINGS[building.kind].size;
  const base = toScreen(building.x + (size - 1) / 2, building.y + (size - 1) / 2);
  const point = toScreen(target.x, target.y);
  const halfWidth = building.kind === 'temple' ? 145 : 80;
  const height = building.kind === 'temple' && building.level > 1 ? 220 : 110;
  return Math.abs(point.x - base.x) < halfWidth && point.y < base.y && point.y > base.y - height;
}
