import type { Building, GameState, Resource } from '../core/types';
import { footprint, tileAt } from '../core/world';
import { reconcileBuilders } from './Workforce';

export class Construction {
  step(state: GameState): Building[] {
    reconcileBuilders(state);
    const completed: Building[] = [];
    for (const building of state.buildings) {
      const project = building.construction;
      if (!project || project.paused || project.builders === 0) continue;
      project.workDone = Math.min(project.workRequired, project.workDone + project.builders);
      if (project.workDone < project.workRequired) continue;
      for (const [resource, amount] of Object.entries(project.cost)) {
        const r = resource as Resource;
        building.investment[r] = (building.investment[r] ?? 0) + amount;
      }
      if (project.type === 'upgrade') building.level++;
      else {
        for (const p of footprint(building)) {
          const tile = tileAt(state, p.x, p.y)!;
          if (building.kind === 'baray' || building.kind === 'canal') {
            tile.terrain = building.kind === 'baray' ? 'reservoir' : 'canal';
            tile.elevation = building.kind === 'baray' ? -1 : -0.8;
          } else if (building.kind === 'road' || building.kind === 'bridge')
            tile.terrain = building.kind;
          else if (building.kind !== 'gate') tile.terrain = 'grass';
        }
        if (building.kind === 'house') state.population += 8;
        state.built[building.kind] = (state.built[building.kind] ?? 0) + 1;
      }
      building.construction = null;
      completed.push(building);
      reconcileBuilders(state);
    }
    return completed;
  }
}
