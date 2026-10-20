import type { Building, GameState } from '../core/types';
import { CONFIG } from '../data/config';
import { deliveredRate, RATE_WINDOW } from './Feedback';
import { foodDemand } from './survivalRules';
import { reservoirDepth } from './ReservoirHistory';

export function foodOutlook(state: GameState) {
  const demand = foodDemand(state);
  const observed = state.tick - state.feedback.sinceTick >= CONFIG.ticksPerDay * 2;
  const deliveredPerDay =
    (deliveredRate(state, 'rice') * CONFIG.tickMs * CONFIG.ticksPerDay) / 60_000;
  const loss = demand - deliveredPerDay;
  return {
    reserveDays: demand > 0 ? Math.floor(state.resources.rice / demand) : null,
    netDays: demand > 0 && observed && loss > 0 ? Math.floor(state.resources.rice / loss) : null,
    keepingUp: demand > 0 && observed && loss <= 0,
    observed,
    windowDays: Math.min(RATE_WINDOW, state.tick - state.feedback.sinceTick) / CONFIG.ticksPerDay,
  };
}

/** Linear estimate from up to five observed readings; does not run or mutate the simulation. */
export function reservoirOutlook(state: GameState, building: Building) {
  const samples =
    state.reservoirHistory?.find((h) => h.id === building.id)?.samples.slice(-5) ?? [];
  const first = samples[0],
    last = samples.at(-1);
  const depth = reservoirDepth(state, building);
  if (depth <= 1) return { daysToLow: 0, trend: 'unknown' as const };
  if (!first || !last || last.day <= first.day || state.day - last.day > 1)
    return { daysToLow: null, trend: 'unknown' as const };
  const dailyChange = (last.depth - first.depth) / (last.day - first.day);
  return {
    daysToLow: depth <= 1 ? 0 : dailyChange < -0.001 ? Math.ceil((depth - 1) / -dailyChange) : null,
    trend:
      dailyChange < -0.001
        ? ('falling' as const)
        : dailyChange > 0.001
          ? ('rising' as const)
          : ('steady' as const),
  };
}
