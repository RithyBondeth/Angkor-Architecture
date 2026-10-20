import type { GameState } from './types';
import { commissionsFor } from '../data/scenarios';

export const MILESTONE_IDS = ['first-harvest', 'dry-season', 'sanctuary', 'campaign'] as const;
export type MilestoneId = (typeof MILESTONE_IDS)[number];
export interface MilestoneNotice {
  id: MilestoneId | 'commission';
  title: string;
  text: string;
  icon: string;
}
/** Existing achievements are remembered silently when an older kingdom is first opened. */
export function initializeMilestones(state: GameState) {
  if (state.milestones) return;
  state.milestones = [];
  if ((state.progression.delivered.rice ?? 0) > 0) state.milestones.push('first-harvest');
  if (state.buildings.some((b) => b.kind === 'temple' && b.level >= 3 && !b.construction))
    state.milestones.push('sanctuary');
  if (state.progression.claimed.length === commissionsFor(state).length)
    state.milestones.push('campaign');
}
export function collectMilestones(state: GameState, wetSeasonReturned: boolean): MilestoneNotice[] {
  initializeMilestones(state);
  const notices: MilestoneNotice[] = [];
  const award = (id: MilestoneId, ready: boolean, title: string, text: string, icon: string) => {
    if (!ready || state.milestones!.includes(id)) return;
    state.milestones!.push(id);
    notices.push({ id, title, text, icon });
  };
  award(
    'first-harvest',
    (state.progression.delivered.rice ?? 0) > 0,
    'The first harvest is home!',
    'Your waterways, fields, and delivery routes brought real rice to the kingdom.',
    'grains',
  );
  award(
    'dry-season',
    wetSeasonReturned &&
      state.population > 0 &&
      state.survival.hunger === 0 &&
      state.survival.lastFoodCoverage === 1,
    'Through the dry season',
    'The monsoon has returned, and your kingdom welcomes it with fed residents.',
    'sun',
  );
  award(
    'sanctuary',
    state.buildings.some(
      (b) => b.kind === 'temple' && b.level >= 3 && !b.construction && b.condition > 0,
    ),
    'A sanctuary for the ages',
    'Your builders and artisans have completed a sculpted sanctuary.',
    'bank',
  );
  award(
    'campaign',
    state.progression.claimed.length === commissionsFor(state).length,
    'Your temple city has a legacy',
    'Every royal commission is complete. Review your kingdom’s achievements, then continue in free play.',
    'crown',
  );
  return notices;
}
