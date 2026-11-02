import type { Building, GameState } from '../core/types';
import { BUILDINGS } from '../data/buildings';
import { siteDistance } from './Deposits';

/** Decorations count only when a completed dwelling lives within this many tiles. */
export const BEAUTY_REACH = 4;
/** Beauty beyond this adds nothing; a few well-placed pieces are enough. */
export const BEAUTY_CAP = 30;
/** At or above this, fed residents settle every second day instead of every third. */
export const BEAUTY_GROWTH_THRESHOLD = 10;

function standing(b: Building) {
  return !b.construction && b.condition > 0;
}

/** Homes within reach of a finished decoration. */
export function homesNear(state: GameState, decor: Building): number {
  return state.buildings.filter(
    (h) => h.kind === 'house' && standing(h) && footprintDistance(h, decor) <= BEAUTY_REACH,
  ).length;
}

function footprintDistance(a: Building, b: Building) {
  const size = BUILDINGS[a.kind].size;
  let best = Infinity;
  for (let dy = 0; dy < size; dy++)
    for (let dx = 0; dx < size; dx++)
      best = Math.min(best, siteDistance({ x: a.x + dx, y: a.y + dy }, b));
  return best;
}

/** Kingdom beauty: the appeal of standing decorations that a dwelling can enjoy, capped. */
export function beauty(state: GameState): number {
  let total = 0;
  for (const b of state.buildings) {
    const appeal = BUILDINGS[b.kind].appeal;
    if (!appeal || !standing(b) || !homesNear(state, b)) continue;
    total += appeal * (b.condition / 100);
  }
  return Math.min(BEAUTY_CAP, Math.round(total));
}

/** Daily contentment gain while everyone is fed. */
export function contentmentGain(score: number): number {
  return 0.1 + score * 0.01;
}

/** Fraction of the usual contentment loss during a shortage; beauty softens up to half. */
export function shortageLossFactor(score: number): number {
  return 1 - Math.min(BEAUTY_CAP, score) / (BEAUTY_CAP * 2);
}

export function growthInterval(score: number): number {
  return score >= BEAUTY_GROWTH_THRESHOLD ? 2 : 3;
}
