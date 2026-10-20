import type { ScenarioId } from '../core/types';
import { SCENARIOS, SCENARIO_IDS, isScenarioId } from '../data/scenarios';
import { RESOURCE_INFO } from '../data/buildings';
import { SeasonManager } from '../core/SeasonManager';
import type { Resource } from '../core/types';
import { icon } from './icons';
import './scenarios.css';

export function scenarioDetails(id: ScenarioId): string {
  const s = SCENARIOS[id],
    season = SeasonManager.at(s.day);
  return `<h3>${s.name}</h3><p>${s.terrain}</p><p><strong>Day ${s.day} · ${season.name}</strong> · ${season.remaining} days until ${season.wet ? 'dry' : 'wet'} season · 84 residents</p><dl class="scenario-supplies">${Object.entries(
    s.resources,
  )
    .map(
      ([r, n]) =>
        `<div><dt>${icon(RESOURCE_INFO[r as Resource].icon)}${RESOURCE_INFO[r as Resource].name}</dt><dd>${n}</dd></div>`,
    )
    .join(
      '',
    )}</dl><h4>Opening commission: ${s.commissions[0]!.title}</h4><ul>${s.commissions[0]!.goals.map((g) => `<li>${g.hint}</li>`).join('')}</ul><p class="scenario-campaign-note">Five commissions lead to a thriving temple city, then free play. Later chapters: ${s.commissions
    .slice(1)
    .map((c) => c.title)
    .join(' · ')}.</p>`;
}
export function scenarioPicker(selected: ScenarioId = 'roluos'): string {
  return `<fieldset class="scenario-picker"><legend>Choose a scenario</legend><div class="scenario-options">${SCENARIO_IDS.map(
    (id) => {
      const s = SCENARIOS[id];
      return `<label class="scenario-option"><input type="radio" name="scenario" value="${id}" ${id === selected ? 'checked' : ''}/><span><strong>${s.name}</strong><small>${s.difficulty}</small><span>${s.description}</span></span></label>`;
    },
  ).join(
    '',
  )}</div></fieldset><section class="scenario-details" aria-label="Selected scenario details" aria-live="polite">${scenarioDetails(selected)}</section>`;
}
export function selectedScenario(root: ParentNode): ScenarioId {
  const value = root.querySelector<HTMLInputElement>('input[name="scenario"]:checked')?.value;
  return isScenarioId(value) ? value : 'roluos';
}
export function updateScenarioDetails(root: ParentNode): void {
  const details = root.querySelector('.scenario-details');
  if (details) details.innerHTML = scenarioDetails(selectedScenario(root));
}
