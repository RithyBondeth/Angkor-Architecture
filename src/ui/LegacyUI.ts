import { commissionsFor, scenarioFor } from '../data/scenarios';
import type { GameState } from '../core/types';
import { earnedMerit } from '../core/progressionState';
import { escapeHtml, icon } from './icons';

export function kingdomSummary(state: GameState): string {
  const completed = state.progression.claimed.length === commissionsFor(state).length;
  const temples = state.buildings.filter(
    (b) => b.kind === 'temple' && b.level >= 3 && !b.construction && b.condition > 0,
  ).length;
  const stats = [
    ['Royal commissions', `${state.progression.claimed.length} / ${commissionsFor(state).length}`],
    ['Days shaping this kingdom', Math.max(0, state.day - scenarioFor(state).day)],
    ['Residents today', state.population],
    ['Merit earned', earnedMerit(state)],
    ['Rice delivered', Math.floor(state.progression.delivered.rice ?? 0)],
    ['Sandstone delivered', Math.floor(state.progression.delivered.sandstone ?? 0)],
    ['Completed building projects', Object.values(state.built).reduce((n, v) => n + (v ?? 0), 0)],
    ['Sculpted sanctuaries standing', temples],
  ];
  return `<section class="legacy-summary"><span class="eyebrow">${icon('crown')} ${completed ? 'A royal campaign fulfilled' : 'Your kingdom so far'}</span><h2>${completed ? 'An enduring legacy.' : 'A legacy in the making.'}</h2><p>${escapeHtml(scenarioFor(state).name)} · Day ${state.day}. ${completed ? 'Every commission is fulfilled. Your kingdom continues in free play.' : 'Keep building toward your royal commissions.'}</p><dl class="legacy-stats">${stats.map(([label, value]) => `<div><dt>${label}</dt><dd>${typeof value === 'number' ? value.toLocaleString('en-US') : value}</dd></div>`).join('')}</dl><p class="outlook-note">A snapshot of your kingdom when this summary is opened.</p></section>`;
}
