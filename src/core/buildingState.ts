import { freshEngineering } from '../simulation/TempleEngineering';
import { BUILDINGS } from '../data/buildings';
import type { Building, BuildingKind, GameState, Resources, TerrainSnapshot } from './types';

export function captureTerrain(
  state: GameState,
  kind: BuildingKind,
  x: number,
  y: number,
): TerrainSnapshot[] {
  const size = BUILDINGS[kind].size;
  return Array.from({ length: size * size }, (_, i) => {
    const px = x + (i % size),
      py = y + Math.floor(i / size);
    const t = state.tiles[py * state.width + px]!;
    return { x: px, y: py, terrain: t.terrain, elevation: t.elevation };
  });
}
export function initialInvestment(kind: BuildingKind, level = 1): Partial<Resources> {
  const cost = { ...BUILDINGS[kind].cost };
  if (kind === 'temple')
    for (let stage = 1; stage < level; stage++) {
      cost.sandstone = (cost.sandstone ?? 0) + stage * 80;
      cost.laterite = (cost.laterite ?? 0) + 30;
    }
  return cost;
}
export function completedBuilding(
  state: GameState,
  kind: BuildingKind,
  x: number,
  y: number,
  level = 1,
): Building {
  return {
    id: `b${state.nextId++}`,
    kind,
    x,
    y,
    level,
    enabled: true,
    stock: 0,
    deliveryIssue: null,
    engineering: kind === 'temple' ? freshEngineering(level >= 3) : null,
    condition: 100,
    crop: kind === 'paddy' ? { stress: 0, failed: false } : null,
    construction: null,
    investment: initialInvestment(kind, level),
    terrainBefore: captureTerrain(state, kind, x, y),
    underlay: null,
  };
}

/** Make the starting and legacy tile-only paths editable without changing their water. */
export function registerInfrastructure(state: GameState) {
  for (const t of state.tiles) {
    if (!['canal', 'road', 'bridge'].includes(t.terrain)) continue;
    if (
      state.buildings.some(
        (b) =>
          t.x >= b.x &&
          t.x < b.x + BUILDINGS[b.kind].size &&
          t.y >= b.y &&
          t.y < b.y + BUILDINGS[b.kind].size,
      )
    )
      continue;
    const bridge = t.terrain === 'bridge' || (t.terrain === 'road' && t.elevation < 0);
    const b = completedBuilding(
      state,
      bridge ? 'bridge' : t.terrain === 'canal' ? 'canal' : 'road',
      t.x,
      t.y,
    );
    b.terrainBefore = [{ x: t.x, y: t.y, terrain: 'grass', elevation: Math.max(2.6, t.elevation) }];
    if (bridge) {
      t.terrain = 'bridge';
      const canal = completedBuilding(state, 'canal', t.x, t.y);
      canal.terrainBefore = structuredClone(b.terrainBefore);
      b.terrainBefore = [{ x: t.x, y: t.y, terrain: 'canal', elevation: t.elevation }];
      b.underlay = canal;
    }
    state.buildings.push(b);
  }
}
