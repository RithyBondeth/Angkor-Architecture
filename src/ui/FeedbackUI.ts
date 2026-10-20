import { kingdomAlerts } from '../simulation/KingdomAlerts';
import type { GameState } from '../core/types';
import { lowWaterSites, lowReservoirs } from '../simulation/Feedback';
import { workforce } from '../simulation/Workforce';
import { icon } from './icons';

export function playerFeedback(state: GameState): string {
  const idle = workforce(state).available;
  return `<div class="player-feedback"><button class="survival-summary" data-action="panel" data-panel="construction"><span>${icon('users')}<strong>${idle} idle workers</strong></span><small>${idle ? 'Assign builders or add workplaces' : 'All available labor is assigned'}</small></button>${kingdomAlerts(
    state,
  )
    .map(
      (alert) =>
        `<button class="survival-summary at-risk" data-action="locate-issue" data-issue="${alert.id}"><span>${icon('warning')}<strong>${alert.title}</strong></span><small>${alert.remedy}</small><b>${alert.sites.length ? 'Locate affected sites' : 'Review food outlook'} ${icon('arrow-right')}</b></button>`,
    )
    .join('')}</div>`;
}
export function waterWarnings(state: GameState): string {
  return [...lowWaterSites(state), ...lowReservoirs(state)]
    .map(
      (b) =>
        `<button class="survival-site" data-action="select-building" data-id="${b.id}"><span>${icon('drop')}<strong>${b.kind === 'paddy' ? 'Rice paddy needs water' : 'Reservoir running low'}</strong><small>Tile ${b.x + 1}, ${b.y + 1} · inspect water supply</small></span>${icon('arrow-up-right')}</button>`,
    )
    .join('');
}
