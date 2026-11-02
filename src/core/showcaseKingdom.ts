import { completedBuilding } from './buildingState';
import { Game } from './Game';
import { createScenario, footprint, tileAt } from './world';
import type { BuildingKind, GameState, Point } from './types';
import { BUILDINGS } from '../data/buildings';
import { CONFIG } from '../data/config';
import { freshEngineering } from '../simulation/TempleEngineering';
import { housingCapacity } from '../simulation/survivalRules';

/** Infrastructure may run right up to a building; everything else keeps a little breathing room. */
const PATHS: BuildingKind[] = ['road', 'canal', 'bridge', 'moat'];

/** Districts of the showcase city: what to build, how many, and where it should gather. */
const PLAN: { kind: BuildingKind; count: number; near: Point; margin: number }[] = [
  // The royal quarter north of the great canal.
  { kind: 'facetower', count: 1, near: { x: 18, y: 6 }, margin: 1 },
  { kind: 'elephant', count: 1, near: { x: 14, y: 6 }, margin: 1 },
  { kind: 'pavilion', count: 1, near: { x: 22, y: 6 }, margin: 1 },
  { kind: 'gopura', count: 1, near: { x: 11, y: 6 }, margin: 1 },
  { kind: 'workshop', count: 1, near: { x: 25, y: 7 }, margin: 1 },
  // Homes, markets, and gardens east and south of the temple.
  { kind: 'market', count: 1, near: { x: 21, y: 16 }, margin: 1 },
  { kind: 'market', count: 1, near: { x: 21, y: 21 }, margin: 1 },
  { kind: 'granary', count: 1, near: { x: 25, y: 22 }, margin: 1 },
  { kind: 'warehouse', count: 1, near: { x: 25, y: 14 }, margin: 1 },
  { kind: 'house', count: 6, near: { x: 22, y: 14 }, margin: 1 },
  { kind: 'house', count: 6, near: { x: 22, y: 23 }, margin: 1 },
  { kind: 'house', count: 3, near: { x: 15, y: 25 }, margin: 1 },
  { kind: 'lotuspond', count: 1, near: { x: 16, y: 20 }, margin: 0 },
  { kind: 'lotuspond', count: 1, near: { x: 24, y: 26 }, margin: 0 },
  // Rice country between the baray and the north–south canal.
  { kind: 'paddy', count: 5, near: { x: 9, y: 13 }, margin: 0 },
  { kind: 'paddy', count: 5, near: { x: 9, y: 24 }, margin: 0 },
  // Life on the river: a fishing pier, stilt houses along the bank, the royal barge, rafts.
  { kind: 'fishery', count: 1, near: { x: 24, y: 25 }, margin: 0 },
  { kind: 'royalbarge', count: 1, near: { x: 28, y: 14 }, margin: 1 },
  { kind: 'stilthouse', count: 5, near: { x: 26, y: 20 }, margin: 0 },
  { kind: 'lotusraft', count: 3, near: { x: 28, y: 23 }, margin: 0 },
  // Small pieces fill the gaps last.
  { kind: 'shrine', count: 3, near: { x: 22, y: 19 }, margin: 0 },
  { kind: 'naga', count: 2, near: { x: 17, y: 18 }, margin: 0 },
  { kind: 'singha', count: 4, near: { x: 17, y: 12 }, margin: 0 },
  { kind: 'parasol', count: 3, near: { x: 18, y: 9 }, margin: 0 },
  { kind: 'brazier', count: 4, near: { x: 15, y: 14 }, margin: 0 },
  { kind: 'gong', count: 1, near: { x: 21, y: 9 }, margin: 0 },
  { kind: 'garden', count: 6, near: { x: 22, y: 18 }, margin: 0 },
  { kind: 'palmgrove', count: 6, near: { x: 10, y: 18 }, margin: 0 },
];

function clearAround(state: GameState, kind: BuildingKind, p: Point, margin: number) {
  if (!margin) return true;
  const size = BUILDINGS[kind].size;
  return !state.buildings.some((b) => {
    if (PATHS.includes(b.kind)) return false;
    const other = BUILDINGS[b.kind].size;
    return (
      b.x < p.x + size + margin &&
      b.x + other + margin > p.x &&
      b.y < p.y + size + margin &&
      b.y + other + margin > p.y
    );
  });
}

/**
 * A finished, prosperous Roluos for the main menu: the completed temple, full rice country, busy
 * neighbourhoods, and every statue and wonder, all placed by the game's own rules on open grass.
 * Deterministic, and never saved.
 */
export function showcaseKingdom(): GameState {
  const state = createScenario('roluos');
  state.tutorial = undefined;
  state.resources = {
    rice: CONFIG.maxResource,
    wood: CONFIG.maxResource,
    sandstone: CONFIG.maxResource,
    laterite: CONFIG.maxResource,
    merit: 5000,
  };
  state.progression.meritPeak = 5000;
  for (const b of state.buildings) {
    b.construction = null;
    if (b.kind === 'temple') {
      b.level = 3;
      b.engineering = freshEngineering(true);
    }
  }
  const game = new Game(state);
  for (const { kind, count, near, margin } of PLAN) {
    const candidates = state.tiles
      .map((t) => ({ x: t.x, y: t.y, d: Math.hypot(t.x - near.x, t.y - near.y) }))
      .sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    let placed = 0;
    for (const p of candidates) {
      if (placed === count) break;
      const ground = BUILDINGS[kind].onWater ? 'water' : 'grass';
      if (!footprint({ ...p, kind }).every((c) => tileAt(state, c.x, c.y)?.terrain === ground))
        continue;
      if (!clearAround(state, kind, p, margin) || !game.canPlace(kind, p).ok) continue;
      state.buildings.push(completedBuilding(state, kind, p.x, p.y));
      placed++;
    }
  }
  // Healthy stocks, comfortably below storage limits.
  state.resources = { rice: 900, wood: 600, sandstone: 500, laterite: 500, merit: 5000 };
  state.population = housingCapacity(state);
  state.happiness = 99;
  state.speed = 1;
  return state;
}
