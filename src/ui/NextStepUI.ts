import { activeCommission } from '../core/progressionState';
import type { BuildingKind, GameState } from '../core/types';
import { BUILDINGS } from '../data/buildings';
import { BEAUTY_CAP, beauty } from '../simulation/Beauty';
import { goalValue } from '../simulation/Progression';
import { escapeHtml as esc, icon } from './icons';

export interface NextStep {
  key: string;
  title: string;
  hint: string;
  value: number;
  target: number;
  /** Building to suggest in the dock and to pick up when the guide is pressed. */
  kind: BuildingKind | null;
  action: string;
  label: string;
}

/** One clear thing to do next. The tutorial card takes over while lessons run. */
export function nextStep(state: GameState): NextStep | null {
  if (state.tutorial?.status === 'active') return null;
  const commission = activeCommission(state);
  const goal = commission?.goals.find((g) => goalValue(state, g) < g.target);
  if (commission && goal) {
    const kind: BuildingKind | null =
      goal.type === 'build' ? goal.kind : goal.type === 'population' ? 'house' : null;
    const panel =
      goal.type === 'delivered'
        ? 'workforce'
        : goal.type === 'irrigated-fields'
          ? 'water'
          : goal.type === 'temple-level'
            ? 'monuments'
            : 'survival';
    return {
      key: `${commission.id}:${goal.label}`,
      title: goal.label,
      hint: goal.hint,
      value: Math.min(goalValue(state, goal), goal.target),
      target: goal.target,
      kind,
      action: kind
        ? `data-action="build" data-kind="${kind}"`
        : `data-action="panel" data-panel="${panel}"`,
      label: kind ? `Build ${BUILDINGS[kind].name.toLowerCase()}` : 'Show me how',
    };
  }
  const homes = state.buildings.some((b) => b.kind === 'house' && !b.construction);
  const score = beauty(state);
  if (homes && score < BEAUTY_CAP)
    return {
      key: 'beautify',
      title: 'Beautify your neighbourhoods',
      hint: 'Place gardens, ponds, and shrines near dwellings to raise contentment.',
      value: score,
      target: BEAUTY_CAP,
      kind: null,
      action: 'data-action="next-decor"',
      label: 'Browse decor',
    };
  return null;
}

export function nextStepMarkup(step: NextStep): string {
  const percent = Math.round((step.value / step.target) * 100);
  return `<span class="next-step-icon" aria-hidden="true">${icon(step.kind ? BUILDINGS[step.kind].icon : 'compass')}</span><span class="next-step-text"><small>Next step · ${step.value}/${step.target}</small><strong>${esc(step.title)}</strong><span class="next-step-bar" aria-hidden="true"><span style="width:${percent}%"></span></span></span><span class="next-step-go">${esc(step.label)}${icon('arrow-right')}</span>`;
}
