import { BUILDINGS, RESOURCE_INFO } from '../data/buildings';
import { COMMISSIONS, UNLOCKS } from '../data/progression';
import { activeCommission, earnedMerit, templeUpgradeMerit } from '../core/progressionState';
import type { Building, CampaignGoal, GameState, Resource, RoyalCommission } from '../core/types';
import { goalValue } from '../simulation/Progression';
import { staffedBuildings } from '../simulation/Workforce';
import { supportStrength } from '../simulation/survivalRules';
import { escapeHtml as esc, icon } from './icons';

const number = (n: number) => Math.floor(n).toLocaleString('en-US');
function rewards(c: RoyalCommission) {
  return Object.entries(c.reward)
    .map(([r, n]) => `+${n} ${RESOURCE_INFO[r as Resource].name.toLowerCase()}`)
    .join(' · ');
}
function goalRow(state: GameState, goal: CampaignGoal) {
  const value = goalValue(state, goal),
    done = value >= goal.target;
  const action =
    goal.type === 'build'
      ? `data-action="build" data-kind="${goal.kind}"`
      : goal.type === 'population'
        ? 'data-action="build" data-kind="house"'
        : `data-action="panel" data-panel="${goal.type === 'delivered' ? 'workforce' : goal.type === 'irrigated-fields' ? 'water' : goal.type === 'temple-level' ? 'monuments' : 'survival'}"`;
  return `<button class="objective campaign-goal ${done ? 'complete' : ''}" ${action} title="${esc(goal.hint)}"><span class="objective-check">${icon(done ? 'check' : 'circle')}</span><span><strong>${goal.label}</strong><small>${goal.hint}</small></span><span class="goal-count" aria-label="${number(Math.min(value, goal.target))} of ${goal.target}">${number(Math.min(value, goal.target))}/${goal.target}</span></button>`;
}
export function commissionOverview(state: GameState): string {
  const active = activeCommission(state);
  if (!active)
    return `<div class="panel-eyebrow">Campaign complete ${icon('crown')}</div><h2>An enduring legacy.</h2><p class="panel-subtitle">All five royal commissions are fulfilled. Continue shaping your kingdom in free play.</p><button class="secondary-button full-width" data-action="panel" data-panel="campaign">Review your campaign ${icon('arrow-up-right')}</button>`;
  const completed = active.goals.filter((g) => goalValue(state, g) >= g.target).length;
  return `<div class="panel-eyebrow">Royal commission ${state.progression.claimed.length + 1} / ${COMMISSIONS.length} ${icon('flag-pennant')}</div><h2>${active.title}</h2><p class="panel-subtitle">${active.description}</p><div class="commission-progress"><span>${completed} of ${active.goals.length} objectives</span><strong>${Math.round((completed / active.goals.length) * 100)}%</strong></div><div class="milestone-track">${active.goals.map((g) => `<span class="${goalValue(state, g) >= g.target ? 'done' : ''}"></span>`).join('')}</div><div class="objectives">${active.goals.map((g) => goalRow(state, g)).join('')}</div><div class="commission-reward"><span>${icon('sparkle')}Royal reward</span><strong>${rewards(active)}</strong></div><p class="campaign-note">Rewards are granted while the simulation runs once all objectives are met. Building goals count completed projects; current city conditions can change.</p><button class="secondary-button full-width" data-action="panel" data-panel="campaign">View the full campaign ${icon('arrow-up-right')}</button>`;
}
export function unlockPanel(state: GameState): string {
  const merit = earnedMerit(state);
  const next = UNLOCKS.find((u) => u.merit > merit);
  return `<section class="unlock-list" aria-label="Merit unlocks"><h3 class="resilience-heading">Merit unlocks <span>${number(merit)} earned</span></h3>${next ? `<p class="campaign-note">${number(next.merit - merit)} more merit to unlock ${next.name.toLowerCase()}. Temples and commissions earn merit.</p>` : '<p class="campaign-note">Every era unlock is available.</p>'}${UNLOCKS.map((u) => `<div class="unlock-row ${merit >= u.merit ? 'unlocked' : ''}">${icon(merit >= u.merit ? 'lock-open' : 'lock')}<span><strong>${u.name}</strong><small>${u.description}</small></span><b>${u.merit}<small>merit</small></b></div>`).join('')}<p class="campaign-note">Unlocks are permanent. Existing buildings and projects remain usable.</p></section>`;
}
export function campaignPanel(state: GameState): string {
  return `<div class="panel-eyebrow">The royal campaign ${icon('flag-pennant')}</div><h2>A kingdom in chapters.</h2><p class="panel-subtitle">${state.progression.claimed.length} of ${COMMISSIONS.length} commissions fulfilled.</p><div class="campaign-roadmap">${COMMISSIONS.map(
    (c, i) => {
      const complete = i < state.progression.claimed.length,
        active = i === state.progression.claimed.length;
      return `<details data-commission-id="${c.id}" class="campaign-chapter ${complete ? 'complete' : active ? 'current' : ''}" ${active ? 'open' : ''}><summary><span class="chapter-number">${complete ? icon('check') : i + 1}</span><span><strong>${c.title}</strong><small>${complete ? 'Reward awarded' : active ? 'Current commission' : 'Complete the previous chapter'}</small></span>${icon('caret-down')}</summary><p class="campaign-note">${c.description}</p>${active ? `<div class="objectives">${c.goals.map((g) => goalRow(state, g)).join('')}</div>` : `<ul class="chapter-requirements">${c.goals.map((g) => `<li>${g.label}<small>${g.hint}</small></li>`).join('')}</ul>`}<p class="chapter-reward">${icon('sparkle')}${rewards(c)}</p></details>`;
    },
  ).join(
    '',
  )}</div>${state.progression.claimed.length === COMMISSIONS.length ? '<p class="campaign-victory">Campaign complete. Your kingdom continues in free play.</p>' : '<p class="campaign-note">Consecutive-day objectives begin in their chapter and reset if conditions lapse. Delivery totals accumulate from the start of this campaign.</p>'}${unlockPanel(state)}`;
}
export function templeUpgradeButton(b: Building, state: GameState): string {
  if (b.level >= 3 || b.condition < 100) return '';
  const locked = earnedMerit(state) < templeUpgradeMerit(b.level);
  return `<button class="primary-button" data-action="upgrade" ${locked ? 'disabled' : ''}>${icon(locked ? 'lock' : 'hammer')}Advance construction<span>${locked ? `${templeUpgradeMerit(b.level)} merit` : `${b.level * 80} stone`}</span></button>${locked ? '<p class="campaign-note">Reach the Temple city era to unlock sculpted reliefs.</p>' : ''}`;
}
export function supportDetails(b: Building, state: GameState): string {
  if (b.kind !== 'granary' && b.kind !== 'workshop') return '';
  const active = staffedBuildings(state).has(b.id);
  const bonus = Math.round(supportStrength(state, b.kind) * (b.kind === 'granary' ? 25 : 20));
  return `<div class="support-benefit"><strong>${icon(active ? 'check-circle' : 'pause-circle')}${active ? 'Service active' : 'Service inactive'}</strong><p>${b.kind === 'granary' ? `City rice needs reduced by ${bonus}%.` : `City builder work increased by ${bonus}%.`} Requires ${BUILDINGS[b.kind].workers} operating workers; the strongest staffed building applies.</p></div>`;
}
