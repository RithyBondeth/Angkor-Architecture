import type { SurvivalState } from './types';

export function freshSurvival(): SurvivalState {
  return { hunger: 0, shortageDays: 0, fedDays: 0, lastFoodCoverage: 1, departed: 0 };
}
