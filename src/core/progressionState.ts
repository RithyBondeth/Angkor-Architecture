import { BUILDINGS } from '../data/buildings';
import { COMMISSIONS, FINAL_TEMPLE_MERIT } from '../data/progression';
import type { BuildingKind, GameState, ProgressionState } from './types';

export function freshProgression(merit: number, tick = 0): ProgressionState {
  return { meritPeak: merit, claimed: [], delivered: {}, streakDays: 0, lastDayTick: tick };
}
export function earnedMerit(state: GameState): number {
  return Math.max(state.resources.merit, state.progression.meritPeak);
}
export function buildingUnlocked(state: GameState, kind: BuildingKind): boolean {
  return earnedMerit(state) >= (BUILDINGS[kind].unlockMerit ?? 0);
}
export function templeUpgradeMerit(level: number): number {
  return level >= 2 ? FINAL_TEMPLE_MERIT : 0;
}
export function activeCommission(state: GameState) {
  return COMMISSIONS[state.progression.claimed.length];
}
