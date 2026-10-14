import type { Building, GameState, Point, TempleEngineering } from '../core/types';
import { BUILDINGS } from '../data/buildings';
import { CONFIG } from '../data/config';
import { footprint, tileAt } from '../core/world';

export const RELIEF_TARGET = [0, 1, 2, 3, 0, 1, 2, 3, 0] as const;
export function freshEngineering(complete = false): TempleEngineering {
  return {
    stability: 100,
    relief: RELIEF_TARGET.map((r, i) => (complete ? r : (r + 1 + (i % 3)) % 4)),
    reliefComplete: complete,
  };
}
/** One-tile ring with four dry causeways kept for access. */
export function moatRing(b: Point & { kind: Building['kind'] }): Point[] {
  const size = BUILDINGS[b.kind].size,
    result: Point[] = [];
  const middle = Math.floor(size / 2);
  for (let y = -1; y <= size; y++)
    for (let x = -1; x <= size; x++) {
      if (x >= 0 && y >= 0 && x < size && y < size) continue;
      if ((x === middle && (y === -1 || y === size)) || (y === middle && (x === -1 || x === size)))
        continue;
      result.push({ x: b.x + x, y: b.y + y });
    }
  return result;
}
export function moatCoverage(state: GameState, b: Building): number {
  const ring = moatRing(b);
  return (
    ring.filter((p) => {
      const t = tileAt(state, p.x, p.y);
      return (
        t &&
        ['moat', 'canal', 'reservoir', 'water', 'bridge'].includes(t.terrain) &&
        t.water >= 0.45
      );
    }).length / ring.length
  );
}
export function templeWorkFactor(b: Building): number {
  if (!b.engineering || b.construction?.type === 'repair') return 1;
  return b.engineering.stability < 40 ? 0 : Math.min(1, b.engineering.stability / 60);
}
export function templeBlocked(b: Building): string | null {
  if (!b.engineering || !b.construction || b.construction.type === 'repair') return null;
  if (b.engineering.stability < 40) return 'Foundation unstable · fill the moat';
  if (
    b.level === 2 &&
    b.construction.type === 'upgrade' &&
    b.construction.workDone >= b.construction.workRequired * 0.8 &&
    !b.engineering.reliefComplete
  )
    return 'Awaiting bas-relief carving';
  return null;
}
export function templeStage(b: Building): string {
  const p = b.construction;
  if (!p || p.type === 'repair')
    return ['Laterite foundation', 'Sandstone towers', 'Sculpted sanctuary'][b.level - 1]!;
  const progress = p.workDone / p.workRequired;
  if (p.type === 'build')
    return progress < 0.2
      ? 'Surveying and preparing footings'
      : progress < 0.7
        ? 'Laying the laterite foundation'
        : 'Compacting and finishing the foundation';
  if (b.level === 1)
    return progress < 0.2
      ? 'Preparing tower supports'
      : progress < 0.8
        ? 'Raising sandstone towers'
        : 'Finishing tower roofs';
  return b.engineering?.reliefComplete
    ? 'Installing the carved panels'
    : 'Preparing sandstone for reliefs';
}
export class TempleEngineeringSimulation {
  step(state: GameState): void {
    if (state.tick % CONFIG.ticksPerDay !== 0) return;
    for (const b of state.buildings) {
      const e = b.engineering;
      if (!e || b.construction?.type === 'build') continue;
      const flooded = footprint(b).some((p) => tileAt(state, p.x, p.y)!.water > 0.8);
      const elevations = footprint(b).map((p) => tileAt(state, p.x, p.y)!.elevation);
      const uneven = Math.max(...elevations) - Math.min(...elevations) > 0.5;
      const delta = flooded ? -4 : uneven ? -2 : moatCoverage(state, b) >= 0.5 ? 2 : -0.8;
      e.stability = Math.max(0, Math.min(100, e.stability + delta));
      if (e.stability < 30) b.condition = Math.max(0, b.condition - 2);
    }
  }
}
