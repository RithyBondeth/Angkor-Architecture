import { BUILDINGS, RESOURCE_INFO } from '../data/buildings';
import type { Building, GameState, Resource } from '../core/types';
import {
  foodDemand,
  floodUnsafe,
  housingCapacity,
  productivity,
  repairCost,
} from '../simulation/survivalRules';
import { icon } from './icons';

export function foodDays(state: GameState): number {
  const demand = foodDemand(state);
  return demand ? Math.floor(state.resources.rice / demand) : 0;
}
export function foodNeed(state: GameState): string {
  return foodDemand(state).toLocaleString('en-US', { maximumFractionDigits: 2 });
}
export function survivalSummary(state: GameState): string {
  const failed = state.buildings.filter((b) => b.crop?.failed).length;
  const damaged = state.buildings.filter((b) => b.condition < 100).length;
  const drying = state.buildings.some((b) => (b.crop?.stress ?? 0) >= 30);
  const lowFood = state.population > 0 && foodDays(state) < 5;
  const urgent =
    state.population === 0 || lowFood || state.survival.hunger > 0 || drying || damaged > 0;
  const title =
    state.population === 0
      ? 'The settlement is abandoned'
      : state.survival.hunger > 0
        ? 'Your people are hungry'
        : lowFood
          ? 'Rice reserves are running low'
          : failed
            ? 'Harvests need attention'
            : drying
              ? 'Fields are drying out'
              : damaged
                ? 'Flood repairs needed'
                : 'Keep the city nourished';
  return `<button class="survival-summary ${urgent ? 'at-risk' : ''}" data-action="panel" data-panel="survival" aria-label="View food and survival"><span>${icon(urgent ? 'warning' : 'bowl-food')}<strong>${title}</strong></span><small>${foodDemand(state) ? `${foodDays(state)} days of rice` : 'Start a new settlement from Settings'} · ${Math.round(productivity(state) * 100)}% productivity</small>${icon('arrow-up-right')}</button>`;
}
export function buildingStatus(b: Building): string {
  if (b.condition === 0) return 'Ruined · repairs needed';
  if (b.crop?.failed) return 'Crop failed · restore irrigation';
  if (!b.enabled)
    return b.kind === 'gate'
      ? 'Gate closed'
      : ['granary', 'workshop'].includes(b.kind)
        ? 'Service paused'
        : 'Production paused';
  if (b.condition < 100) return 'Flood damage · reduced condition';
  return b.kind === 'gate' ? 'Gate open' : 'Operational';
}
export function buildingSurvivalDetails(b: Building, state: GameState): string {
  const cost = Object.entries(repairCost(b))
    .map(([r, n]) => `${n} ${RESOURCE_INFO[r as Resource].name.toLowerCase()}`)
    .join(' · ');
  const flooded = floodUnsafe(state, b);
  const affordable = Object.entries(repairCost(b)).every(
    ([r, n]) => state.resources[r as Resource] >= n,
  );
  return `<div class="building-resilience"><div class="detail-row"><span>${icon('shield-check')}Condition</span><strong>${Math.round(b.condition)}%</strong></div>${b.crop ? `<div class="detail-row"><span>${icon('sun')}Drought stress</span><strong>${Math.round(b.crop.stress)}%</strong></div><p class="resilience-note">${b.crop.failed ? 'Harvest lost. Restore at least 50% irrigation; the field replants when stress falls to 20%.' : b.crop.stress > 0 ? 'Low irrigation is stressing the crop. At 70% stress, the harvest fails.' : 'A healthy crop. Keep irrigation above 50% to prevent drought stress.'}</p>` : ''}${b.condition < 100 ? `<p class="resilience-note">${flooded ? 'Floodwater is still damaging this site. Let it recede before repairing.' : b.condition === 0 ? 'This structure has stopped functioning. Repairs restore its condition.' : 'Flood damage reduces production. Assign builders to restore condition.'}</p><button class="secondary-button full-width" data-action="repair" data-id="${b.id}" ${flooded || !affordable ? 'disabled' : ''}>${icon('hammer')}Repair structure</button><p class="repair-cost">${cost}${!affordable ? '<br>More materials needed' : ''}</p>` : ''}</div>`;
}
export function survivalPanel(state: GameState): string {
  const s = state.survival;
  const damaged = state.buildings.filter(
    (b) => b.condition < 100 && b.construction?.type !== 'build',
  );
  const fields = state.buildings.filter(
    (b) => b.crop && b.construction?.type !== 'build' && (b.crop.failed || b.crop.stress > 0),
  );
  const row = (b: Building, text: string) =>
    `<button class="survival-site" data-action="select-building" data-id="${b.id}"><span>${icon(BUILDINGS[b.kind].icon)}<strong>${BUILDINGS[b.kind].name}</strong><small>${text}</small></span>${icon('arrow-up-right')}</button>`;
  return `<div class="panel-eyebrow">Food & resilience ${icon('bowl-food')}</div><h2>A city that endures.</h2><p class="panel-subtitle">Nourish your people. Protect their homes.</p>${survivalSummary(state)}<div class="detail-row"><span>Rice needed / day</span><strong>${foodNeed(state)}</strong></div><div class="detail-row"><span>Last meal coverage</span><strong>${Math.round(s.lastFoodCoverage * 100)}%</strong></div><div class="detail-row"><span>Hunger</span><strong>${Math.round(s.hunger)} / 100</strong></div><div class="detail-row"><span>Worker productivity</span><strong>${Math.round(productivity(state) * 100)}%</strong></div><div class="detail-row"><span>Consecutive shortage days</span><strong>${s.shortageDays}</strong></div><div class="detail-row"><span>Residents departed</span><strong>${s.departed}</strong></div><div class="detail-row"><span>Habitable capacity</span><strong>${housingCapacity(state)}</strong></div><p class="building-description">Missed meals slow production, deliveries, and construction. After three shortage days, severe hunger drives residents away. Regular meals restore productivity; five days of reserves and spare housing allow gradual resettlement.</p><h3 class="resilience-heading">Fields at risk <span>${fields.length}</span></h3>${fields.map((b) => row(b, b.crop!.failed ? 'Crop failed · restore irrigation' : `${Math.round(b.crop!.stress)}% drought stress`)).join('') || '<p class="resilience-note">No fields under drought stress.</p>'}<h3 class="resilience-heading">Flood damage <span>${damaged.length}</span></h3>${damaged.map((b) => row(b, `${Math.round(b.condition)}% condition${b.construction?.type === 'repair' ? ' · repairs underway' : ' · inspect to repair'}`)).join('') || '<p class="resilience-note">No damaged structures.</p>'}<p class="resilience-note">Canals and barays hold water safely. Deep flooding above 6 units threatens bridges, gates, and docks; ordinary buildings are vulnerable above 0.8, and paddies above 1.2.</p>`;
}
