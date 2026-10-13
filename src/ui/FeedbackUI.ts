import type { GameState } from '../core/types';
import { lowWaterSites, lowReservoirs } from '../simulation/Feedback';
import { workforce } from '../simulation/Workforce';
import { icon } from './icons';

export function playerFeedback(state: GameState): string {
  const idle = workforce(state).available,
    thirsty = lowWaterSites(state),
    reservoirs = lowReservoirs(state);
  const unstable = state.buildings.filter((b) => b.engineering && b.engineering.stability < 60);
  return `<div class="player-feedback"><button class="survival-summary" data-action="panel" data-panel="construction"><span>${icon('users')}<strong>${idle} idle workers</strong></span><small>${idle ? 'Assign builders or add workplaces' : 'All available labor is assigned'}</small></button>${thirsty.length || reservoirs.length ? `<button class="survival-summary at-risk" data-action="panel" data-panel="water"><span>${icon('drop')}<strong>Low water · ${thirsty.length} fields · ${reservoirs.length} reservoirs</strong></span><small>Fields below 50% irrigation or reservoirs below 17% full</small></button>` : ''}${unstable.length ? `<button class="survival-summary at-risk" data-action="panel" data-panel="monuments"><span>${icon('warning')}<strong>${unstable.length} unstable temple foundations</strong></span><small>Inspect temples and fill surrounding moats</small></button>` : ''}</div>`;
}
export function waterWarnings(state: GameState): string {
  return [...lowWaterSites(state), ...lowReservoirs(state)]
    .map(
      (b) =>
        `<button class="survival-site" data-action="select-building" data-id="${b.id}"><span>${icon('drop')}<strong>${b.kind === 'paddy' ? 'Rice paddy needs water' : 'Reservoir running low'}</strong><small>Tile ${b.x + 1}, ${b.y + 1} · inspect water supply</small></span>${icon('arrow-up-right')}</button>`,
    )
    .join('');
}
