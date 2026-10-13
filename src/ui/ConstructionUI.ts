import { templeBlocked, templeWorkFactor, templeStage } from '../simulation/TempleEngineering';
import { BUILDINGS, RESOURCE_INFO } from '../data/buildings';
import { CONFIG } from '../data/config';
import type { Building, GameState, Resource, Resources } from '../core/types';
import { workforce } from '../simulation/Workforce';
import { floodUnsafe, builderEfficiency } from '../simulation/survivalRules';
import { icon } from './icons';

export function progress(b: Building) {
  const p = b.construction!;
  return Math.floor((p.workDone / p.workRequired) * 100);
}
export function projectStatus(b: Building, state?: GameState) {
  const p = b.construction!;
  if (p.paused) return 'Construction paused';
  if (state && templeBlocked(b)) return templeBlocked(b)!;
  if (p.type === 'repair' && state && floodUnsafe(state, b)) return 'Waiting for floodwater';
  if (p.builders === 0) return 'Waiting for builders';
  if (b.engineering && p.type !== 'repair') return templeStage(b);
  return p.type === 'repair' ? 'Repairing structure' : 'Under construction';
}
export function constructionDetails(b: Building, state: GameState, thumbnail: string) {
  const p = b.construction!,
    def = BUILDINGS[b.kind],
    labor = workforce(state),
    percent = progress(b);
  const seconds = p.builders
    ? Math.ceil(
        (((p.workRequired - p.workDone) /
          (p.builders * builderEfficiency(state) * Math.max(0.01, templeWorkFactor(b)))) *
          CONFIG.tickMs) /
          1000,
      )
    : 0;
  return `<div class="panel-eyebrow">${p.type === 'repair' ? 'Repair project' : p.type === 'upgrade' ? 'Temple upgrade' : 'Building project'}<button class="icon-button" data-action="close-inspector" aria-label="Close building details">${icon('x')}</button></div><h2>${def.name}</h2><p class="panel-subtitle">${def.subtitle}</p><div class="inspector-art planned-art"><img src="${thumbnail}" alt="Planned ${def.name.toLowerCase()}" /></div><div class="project-status">${icon(p.paused ? 'pause-circle' : p.builders ? 'hammer' : 'hourglass')}<strong>${projectStatus(b, state)}</strong></div><div class="stat-heading"><span>Construction progress</span><strong>${percent}%</strong></div><div class="construction-meter" role="progressbar" aria-label="Construction progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div><p class="project-eta">${templeBlocked(b) ? 'Resolve the temple engineering warning below to continue.' : p.type === 'repair' && floodUnsafe(state, b) ? 'Work resumes once floodwater recedes.' : seconds && !p.paused ? `About ${seconds}s remaining at 1× speed` : 'Assign available builders to continue work.'}</p><div class="crew-control"><div><strong>Assigned builders</strong><small>${labor.available} workers available</small></div><div class="crew-stepper"><button data-action="builder-minus" data-id="${b.id}" aria-label="Remove builder" ${p.paused || p.builders === 0 ? 'disabled' : ''}>${icon('minus')}</button><output aria-label="Assigned builders">${p.builders}</output><button data-action="builder-plus" data-id="${b.id}" aria-label="Assign builder" ${p.paused || p.builders >= CONFIG.maxBuildersPerProject || labor.available === 0 ? 'disabled' : ''}>${icon('plus')}</button></div></div><p class="building-description">${p.type === 'repair' ? 'Repairs restore full condition when complete. Further flooding can suspend work.' : p.type === 'upgrade' ? 'The sanctuary resumes production when this stage is finished.' : 'Materials are reserved. This site becomes operational when construction is finished.'}</p><button class="secondary-button full-width" data-action="pause-project" data-id="${b.id}">${icon(p.paused ? 'play' : 'pause')}${p.paused ? 'Resume construction' : 'Pause construction'}</button><button class="remove-structure full-width" data-action="cancel-project" data-id="${b.id}" aria-label="${p.type === 'repair' ? 'Cancel repairs' : p.type === 'upgrade' ? 'Cancel upgrade' : 'Cancel project'}">${icon('x-circle')}${p.type === 'repair' ? 'Cancel repairs' : p.type === 'upgrade' ? 'Cancel upgrade' : 'Cancel project'}<span>Review refund</span></button>`;
}
export function constructionPanel(state: GameState) {
  const projects = state.buildings.filter((b) => b.construction),
    labor = workforce(state);
  return `<div class="panel-eyebrow">The builder’s council ${icon('hammer')}</div><h2>A city in the making.</h2><p class="panel-subtitle">Assign hands to the work ahead.</p><div class="construction-summary"><div><strong>${projects.length}</strong><span>active projects</span></div><div><strong>${labor.builders}</strong><span>builders assigned</span></div><div><strong>${labor.available}</strong><span>workers available</span></div></div>${projects.length ? `<div class="project-list">${projects.map((b) => `<button class="project-row" data-action="select-building" data-id="${b.id}"><span class="project-row-icon">${icon(BUILDINGS[b.kind].icon)}</span><span><strong>${BUILDINGS[b.kind].name}</strong><small>${projectStatus(b, state)} · ${b.construction!.builders} builders</small><span class="construction-meter"><span style="width:${progress(b)}%"></span></span></span><strong>${progress(b)}%</strong></button>`).join('')}</div>` : `<div class="construction-empty">${icon('hammer')}<strong>No active projects</strong><p>Choose a building or path below. Available workers will begin construction.</p><button class="secondary-button" data-action="category" data-category="all">Browse buildings ${icon('arrow-down')}</button></div>`}<p class="building-description">Builders share your city’s workforce with production. Pause a project to release its crew, or assign more builders to finish sooner.</p>`;
}
export function removalDialog(b: Building, refund: Partial<Resources>, cancelOnly: boolean) {
  const project = !!b.construction;
  const title = cancelOnly ? 'Cancel this project?' : 'Remove this structure?';
  const materials = Object.entries(refund)
    .filter(([, n]) => n > 0)
    .map(
      ([r, n]) =>
        `<div>${icon(RESOURCE_INFO[r as Resource].icon)}<span>${RESOURCE_INFO[r as Resource].name}</span><strong>+${n}</strong></div>`,
    )
    .join('');
  const note =
    cancelOnly && b.construction?.type === 'repair'
      ? 'The structure remains with its current damage.'
      : cancelOnly && b.construction?.type === 'upgrade'
        ? 'The existing sanctuary will remain.'
        : b.underlay
          ? `The ${b.underlay.kind === 'moat' ? 'moat' : 'canal'} underneath will remain.`
          : b.kind === 'bridge'
            ? 'The waterway remains, but workers will lose this crossing.'
            : b.kind === 'house' && b.construction?.type !== 'build'
              ? b.condition > 0
                ? 'Up to eight residents will leave. Available builders will be adjusted.'
                : 'Residents still without remaining housing will leave. Available builders will be adjusted.'
              : ['baray', 'moat', 'canal'].includes(b.kind)
                ? 'Stored water remains on the map and may flood nearby land.'
                : 'The site will be cleared and any assigned builders released.';
  return `<button class="dialog-close icon-button" data-action="close-dialog" aria-label="Close dialog">${icon('x')}</button><div class="dialog-symbol">${icon(project ? 'hammer' : 'trash')}</div><span class="eyebrow">${BUILDINGS[b.kind].name}</span><h2>${title}</h2><p>${project ? 'Unused materials are recovered in proportion to the work remaining.' : 'Recover half of invested construction materials, scaled by condition, plus stored goods and dispatched cargo.'} ${note}</p><div class="refund-preview"><span>Materials returned</span>${materials || '<p>No materials to recover.</p>'}</div><div class="settings-buttons"><button class="secondary-button" data-action="close-dialog">Keep ${project ? 'project' : 'structure'}</button><button class="danger-button" data-action="confirm-remove" data-id="${b.id}" data-cancel-only="${cancelOnly}">${cancelOnly ? 'Cancel project' : 'Remove structure'}</button></div>`;
}
