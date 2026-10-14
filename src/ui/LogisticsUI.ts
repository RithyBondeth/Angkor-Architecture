import type { Building, GameState, Resource } from '../core/types';
import { BUILDINGS, RESOURCE_INFO } from '../data/buildings';
import { CONFIG } from '../data/config';
import { remainingDeposit } from '../simulation/Deposits';
import { ISSUE_TEXT, storageCapacity, transportCapacity } from '../simulation/logisticsRules';
import { staffedBuildings, workforce } from '../simulation/Workforce';
import { productivity } from '../simulation/survivalRules';
import { icon } from './icons';
const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');
const producers = (state: GameState) =>
  state.buildings.filter((b) => b.deliveryIssue && b.enabled && !b.construction && b.condition > 0);
export function logisticsSummary(state: GameState): string {
  const blocked = producers(state);
  return blocked.length
    ? `<button class="survival-summary at-risk" data-action="panel" data-panel="workforce"><span>${icon('warning')}<strong>${blocked.length} worksites need logistics attention</strong></span><small>Inspect destinations, capacity, and deposits</small>${icon('arrow-up-right')}</button>`
    : '';
}
export function logisticsDetails(b: Building, state: GameState): string {
  if (b.construction?.type === 'build') return '';
  const def = BUILDINGS[b.kind],
    staffed = staffedBuildings(state).has(b.id);
  if (b.kind === 'warehouse')
    return `<div class="logistics-details"><div class="detail-row"><span>Added storage / material</span><strong>${fmt((CONFIG.logistics.warehouseStorage * b.condition) / 100)}</strong></div><div class="detail-row"><span>Additional carts</span><strong>${staffed ? CONFIG.logistics.warehouseCarts : 0} / 2</strong></div><p class="resilience-note">${staffed ? 'Receiving land deliveries. Storage is pooled across the city.' : 'Loading service needs two operating workers and a completed, enabled building. Stored city goods are retained.'}</p></div>`;
  if (b.kind === 'dock')
    return `<div class="detail-row"><span>Available barge slots</span><strong>${staffed ? 1 : 0} / 1</strong></div><p class="resilience-note">A staffed landing receives stone and provides one barge carrying up to 40 blocks per trip.</p>`;
  if (!def.production || b.kind === 'temple') return '';
  const job = state.couriers.find((c) => c.sourceId === b.id);
  const target = state.buildings.find((t) => t.id === job?.targetId);
  const issue =
    b.enabled &&
    b.condition > 0 &&
    !b.construction &&
    b.deliveryIssue &&
    ISSUE_TEXT[b.deliveryIssue];
  const finite = ['lumber', 'quarry', 'lateritepit'].includes(b.kind);
  return `<div class="logistics-details"><div class="detail-row"><span>Worksite stock</span><strong>${fmt(b.stock)} / ${CONFIG.logistics.sourceBuffer}</strong></div>${b.stock > CONFIG.logistics.sourceBuffer ? '<p class="resilience-note">Returned cargo above the worksite buffer is retained until transport is available.</p>' : ''}${finite ? `<div class="detail-row"><span>Nearby deposit remaining</span><strong>${fmt(remainingDeposit(state, b))}</strong></div><button class="secondary-button full-width" data-action="overlay" data-overlay="resources">${icon('mountains')}Find resource deposits</button>` : ''}${!b.enabled ? `<p class="resilience-note">Production paused. Existing cargo returns on the next simulation tick.</p>` : job ? `<p class="resilience-note">${fmt(job.amount)} ${RESOURCE_INFO[job.resource].name.toLowerCase()} in transit to ${target ? BUILDINGS[target.kind].name.toLowerCase() : 'destination'} · one shipment per worksite.</p>` : issue ? `<div class="delivery-warning"><strong>${icon('warning')}${issue.title}</strong><p>${issue.remedy}</p><small>Last transport check · rechecked every 5 seconds at normal speed</small></div>` : `<p class="resilience-note">${!b.enabled ? 'Production paused.' : !staffed ? 'Waiting for operating workers.' : 'Preparing the next shipment.'} ${b.kind === 'quarry' ? 'Barges carry up to 40 blocks.' : 'Carts carry up to 12 units.'}</p>`}</div>`;
}
export function logisticsPanel(state: GameState): string {
  const labor = workforce(state),
    blocked = producers(state);
  const fleet = (mode: 'worker' | 'barge') =>
    `${state.couriers.filter((c) => c.kind === mode).length} / ${transportCapacity(state, mode)}`;
  const storage = (['rice', 'wood', 'sandstone', 'laterite'] as Resource[])
    .map(
      (r) =>
        `<div class="detail-row"><span>${icon(RESOURCE_INFO[r].icon)}${RESOURCE_INFO[r].name}</span><strong>${fmt(state.resources[r])} / ${fmt(storageCapacity(state, r))}</strong></div>`,
    )
    .join('');
  return `<div class="panel-eyebrow">People & logistics ${icon('users-three')}</div><h2>Keep the city moving.</h2><p class="panel-subtitle">Shorter routes. Reliable supplies.</p><div class="detail-row"><span>Assigned workers</span><strong>${labor.assigned} / ${labor.total}</strong></div><div class="detail-row"><span>Available workers</span><strong>${labor.available}</strong></div><div class="detail-row"><span>Builders at work</span><strong>${labor.builders}</strong></div><div class="detail-row"><span>Worker productivity</span><strong>${Math.round(productivity(state) * 100)}%</strong></div><h3 class="resilience-heading">Transport in use</h3><div class="detail-row"><span>${icon('person-simple-walk')}Carts · 12 units / trip</span><strong>${fleet('worker')}</strong></div><div class="detail-row"><span>${icon('boat')}Barges · 40 blocks / trip</span><strong>${fleet('barge')}</strong></div><p class="resilience-note">Up to four base carts (one per four city workers). Each staffed warehouse adds two carts; each staffed landing adds one barge. Trips already underway can finish if capacity falls.</p><h3 class="resilience-heading">City storage <span>per material</span></h3>${storage}<p class="resilience-note">Every completed warehouse adds up to 1,200 storage per material, scaled by condition. Stock above capacity is kept; deliveries wait for space. Rewards and refunds may exceed operating capacity.</p><button class="secondary-button full-width" data-action="build" data-kind="warehouse">${icon('warehouse')}Build a warehouse</button><h3 class="resilience-heading">Worksites needing attention <span>${blocked.length}</span></h3>${blocked.map((b) => `<button class="survival-site" data-action="select-building" data-id="${b.id}"><span>${icon(BUILDINGS[b.kind].icon)}<strong>${BUILDINGS[b.kind].name} · ${b.x + 1}, ${b.y + 1}</strong><small>${ISSUE_TEXT[b.deliveryIssue!].title}</small></span>${icon('arrow-up-right')}</button>`).join('') || '<p class="resilience-note">No blocked worksites at the last transport check.</p>'}<p class="resilience-note">Warnings are checked every production cycle. Gold routes show carts; pale routes show barges. A full worksite pauses extraction without spending deposits.</p><h3 class="resilience-heading">Finite resources</h3><div class="deposit-key"><span><i class="sandstone-deposit"></i>Sandstone</span><span><i class="laterite-deposit"></i>Laterite</span><span><i class="timber-deposit"></i>Timber</span></div><p class="resilience-note">Forests and mineral deposits do not regrow. Quarries extract sandstone; laterite pits extract laterite. Move production when nearby deposits run out.</p><button class="secondary-button full-width" data-action="overlay" data-overlay="resources">${icon('mountains')}Show resource deposits (R)</button><button class="secondary-button full-width" data-action="build" data-kind="lateritepit">${icon('wall')}Build a laterite pit</button><button class="secondary-button full-width" data-action="build" data-kind="dock">${icon('boat')}Build a river landing</button>`;
}
