import { CONFIG } from '../data/config';
import { commissionsFor } from '../data/scenarios';
import { UNLOCKS } from '../data/progression';
import { activeCommission, earnedMerit } from '../core/progressionState';
import { SeasonManager } from '../core/SeasonManager';
import type { CampaignGoal, ChronicleEntry, GameState, Resource } from '../core/types';
import { WaterSimulation } from './WaterSimulation';
import { staffedBuildings } from './Workforce';

export function irrigatedFields(state: GameState): number {
  const staffed = staffedBuildings(state);
  return state.buildings.filter(
    (b) =>
      b.kind === 'paddy' &&
      staffed.has(b.id) &&
      !b.crop?.failed &&
      WaterSimulation.irrigation(state, b.x, b.y, 2) >= 0.5,
  ).length;
}
export function goalValue(state: GameState, goal: CampaignGoal): number {
  switch (goal.type) {
    case 'build':
      return state.built[goal.kind] ?? 0;
    case 'delivered':
      return state.progression.delivered[goal.resource] ?? 0;
    case 'stockpile':
      return state.resources[goal.resource];
    case 'population':
      return state.population;
    case 'irrigated-fields':
      return irrigatedFields(state);
    case 'sustain':
      return state.progression.streakDays;
    case 'temple-level': {
      const staffed = staffedBuildings(state);
      return state.buildings.reduce(
        (level, b) => (b.kind === 'temple' && staffed.has(b.id) ? Math.max(level, b.level) : level),
        0,
      );
    }
  }
}
function sustained(state: GameState, goal: Extract<CampaignGoal, { type: 'sustain' }>): boolean {
  if (state.population === 0 || state.survival.hunger > 0 || state.survival.lastFoodCoverage < 1)
    return false;
  if (goal.condition === 'dry-resilience')
    return !SeasonManager.at(state.day).wet && irrigatedFields(state) >= 2;
  return !state.buildings.some((b) => b.kind === 'house' && b.condition === 0);
}

/** One commission at a time. Rewards and era unlocks become durable state exactly once. */
export class Progression {
  step(state: GameState): Omit<ChronicleEntry, 'tick'>[] {
    const events: Omit<ChronicleEntry, 'tick'>[] = [];
    const p = state.progression;
    const previousMerit = p.meritPeak;
    p.meritPeak = earnedMerit(state);
    const commission = activeCommission(state);
    const hold = commission?.goals.find((g) => g.type === 'sustain');
    if (
      hold?.type === 'sustain' &&
      state.tick > p.lastDayTick &&
      state.tick % CONFIG.ticksPerDay === 0
    ) {
      p.streakDays = sustained(state, hold) ? Math.min(hold.target, p.streakDays + 1) : 0;
      p.lastDayTick = state.tick;
    }
    if (commission && commission.goals.every((g) => goalValue(state, g) >= g.target)) {
      p.claimed.push(commission.id);
      p.streakDays = 0;
      p.lastDayTick = state.tick;
      for (const [r, amount] of Object.entries(commission.reward)) {
        const resource = r as Resource;
        state.resources[resource] = Math.min(
          CONFIG.maxResource,
          state.resources[resource] + amount,
        );
      }
      p.meritPeak = earnedMerit(state);
      events.push({
        title: commission.title,
        text: 'Royal commission complete. The sovereign has granted your reward.',
        icon: 'seal-check',
      });
      if (p.claimed.length === commissionsFor(state).length)
        events.push({
          title: 'An enduring legacy',
          text: 'All royal commissions for this scenario are complete. Your temple city has fulfilled the campaign. Continue building your kingdom in free play.',
          icon: 'crown',
        });
    }
    for (const unlock of UNLOCKS)
      if (previousMerit < unlock.merit && p.meritPeak >= unlock.merit) {
        events.push({
          title: `Unlocked: ${unlock.name}`,
          text: unlock.description,
          icon: 'lock-open',
        });
      }
    return events;
  }
}
