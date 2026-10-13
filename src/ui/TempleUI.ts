import type { Building, GameState } from '../core/types';
import {
  moatCoverage,
  moatRing,
  RELIEF_TARGET,
  templeBlocked,
} from '../simulation/TempleEngineering';
import { buildingAt, tileAt } from '../core/world';
import { icon } from './icons';

export function templeDetails(b: Building, state: GameState): string {
  const e = b.engineering;
  if (!e) return '';
  const available = moatRing(b).filter((p) => {
    const t = tileAt(state, p.x, p.y);
    return t && ['grass', 'forest'].includes(t.terrain) && !buildingAt(state, p.x, p.y);
  }).length;
  return `<section class="temple-engineering" aria-label="Temple engineering"><h3 class="resilience-heading">Temple engineering</h3><div class="detail-row"><span>Foundation stability</span><strong>${Math.round(e.stability)}%</strong></div><div class="detail-row"><span>Wet moat coverage</span><strong>${Math.round(moatCoverage(state, b) * 100)}%</strong></div><p class="resilience-note">${templeBlocked(b) ?? (e.stability < 60 ? 'Fill the moat to restore stability before upgrading.' : 'Foundation ready for the next stage.')} Keep at least half the moat wet (0.45 depth). Dry foundations slowly settle; flooding and uneven ground weaken them faster. Below 40%, construction stops; below 30%, the temple takes damage.</p><button class="secondary-button full-width" data-action="excavate-moat" data-id="${b.id}" ${!available ? 'disabled' : ''}>${icon('waves')}Plan surrounding moat</button><p class="resilience-note">${available} clear tiles · ${available * 6} timber + ${available * 2} laterite. Four causeways and existing roads remain. Assign builders in Construction; connect to a filled waterway.</p>${b.level === 2 && b.construction?.type === 'upgrade' ? `<button class="primary-button full-width" data-action="open-relief" data-id="${b.id}">${icon(e.reliefComplete ? 'check-circle' : 'pencil-line')}${e.reliefComplete ? 'Review finished bas-relief' : 'Carve the bas-relief'}</button><p class="resilience-note">Builders prepare 80% of this stage, then wait for your carving. The completed puzzle awards 40 merit once.</p>` : ''}</section>`;
}
const arrows = ['↑', '→', '↓', '←'];
function motif(rotation: number): string {
  return `<svg viewBox="0 0 80 80" aria-hidden="true"><g transform="rotate(${rotation * 90} 40 40)" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 66 Q40 44 68 66 M16 58 Q40 32 64 58 M24 44 Q40 18 56 44 M40 10 L47 27 L40 23 L33 27 Z"/><circle cx="40" cy="38" r="5"/></g></svg>`;
}
export function reliefDialog(b: Building): string {
  const e = b.engineering!;
  const matched = e.relief.filter((r, i) => r === RELIEF_TARGET[i]).length;
  return `<button class="dialog-close icon-button" data-action="close-dialog" aria-label="Close carving">${icon('x')}</button><span class="eyebrow">The artisan’s workshop</span><h2>Carve an enduring story.</h2><p>Rotate the nine stone panels to match the artisan’s reference. Select a panel to turn it clockwise. Your carving is saved with the city.</p><div class="relief-reference" aria-label="Artisan reference">${RELIEF_TARGET.map((r) => `<span>${motif(r)}<small>${arrows[r]}</small></span>`).join('')}</div><div class="relief-board" aria-label="Stone carving panels">${e.relief.map((r, i) => `<button class="relief-cell ${r === RELIEF_TARGET[i] ? 'matched' : ''}" data-action="rotate-relief" data-id="${b.id}" data-cell="${i}" aria-label="Panel ${i + 1}, facing ${arrows[r]}, target ${arrows[RELIEF_TARGET[i]!]}${r === RELIEF_TARGET[i] ? ', matched' : ''}" ${e.reliefComplete ? 'disabled' : ''}>${motif(r)}<small>${i + 1} · ${arrows[r]} ${r === RELIEF_TARGET[i] ? '✓' : ''}</small></button>`).join('')}</div><p class="relief-status" role="status" aria-live="polite">${e.reliefComplete ? 'Bas-relief complete. 40 merit awarded once; builders can finish the sanctuary.' : `${matched} of 9 panels matched · final construction waits for all nine`}</p><button class="secondary-button full-width" data-action="close-dialog">Return to the kingdom</button>`;
}
