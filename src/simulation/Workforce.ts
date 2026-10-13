import { BUILDINGS } from '../data/buildings';
import type { GameState } from '../core/types';

export function workforce(state: GameState) {
  const total = Math.floor(state.population * 0.65);
  const demand = state.buildings
    .filter((b) => b.enabled && !b.construction)
    .reduce((n, b) => n + BUILDINGS[b.kind].workers, 0);
  const builders = state.buildings.reduce(
    (n, b) => n + (b.construction && !b.construction.paused ? b.construction.builders : 0),
    0,
  );
  const operating = Math.min(total, demand);
  return {
    total,
    demand,
    operating,
    builders,
    assigned: operating + builders,
    available: Math.max(0, total - operating - builders),
  };
}
/** Release surplus assignments when housing or operational labor changes. */
export function reconcileBuilders(state: GameState) {
  const labor = workforce(state);
  let available = Math.max(0, labor.total - labor.demand);
  for (const b of state.buildings)
    if (b.construction) {
      const p = b.construction;
      p.builders = p.paused ? 0 : Math.min(p.builders, available);
      available -= p.builders;
    }
}
