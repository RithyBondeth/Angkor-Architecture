import { BUILDINGS } from '../data/buildings';
import type { Building, GameState } from '../core/types';
import {
  BEAUTY_CAP,
  BEAUTY_GROWTH_THRESHOLD,
  BEAUTY_REACH,
  beauty,
  homesNear,
} from '../simulation/Beauty';
import { icon } from './icons';

export function decorDetails(b: Building, state: GameState): string {
  const appeal = BUILDINGS[b.kind].appeal;
  if (!appeal) return '';
  const homes = b.construction ? 0 : homesNear(state, b);
  const score = beauty(state);
  return `<div class="support-benefit decor-benefit"><strong>${icon(homes ? 'heart' : 'heart-break')}${homes ? `Delighting ${homes} ${homes === 1 ? 'home' : 'homes'}` : b.construction ? 'Blooms once finished' : 'No homes nearby yet'}</strong><p>Adds ${appeal} beauty while a dwelling stands within ${BEAUTY_REACH} tiles. Kingdom beauty: ${score} / ${BEAUTY_CAP}.${score >= BEAUTY_GROWTH_THRESHOLD ? ' Residents are settling faster.' : ` Reach ${BEAUTY_GROWTH_THRESHOLD} to help residents settle faster.`}</p><div class="beauty-meter" aria-hidden="true"><span style="width:${(score / BEAUTY_CAP) * 100}%"></span></div></div>`;
}
