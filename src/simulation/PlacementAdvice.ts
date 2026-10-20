import { completedBuilding } from '../core/buildingState';
import type { BuildingKind, GameState, Point } from '../core/types';
import { footprint, neighbors, tileAt } from '../core/world';
import { BUILDINGS } from '../data/buildings';
import { remainingDeposit } from './Deposits';
import { ISSUE_TEXT, planDelivery } from './logisticsRules';
import { WaterSimulation } from './WaterSimulation';
import { workforce } from './Workforce';

export interface SiteAdvice {
  warning: boolean;
  message: string;
}

/** Current conditions after completion, not a promise about future weather or staffing.
 * Call only after placement validation; the speculative building never enters live state.
 */
export function placementAdvice(state: GameState, kind: BuildingKind, point: Point): SiteAdvice[] {
  const advice: SiteAdvice[] = [];
  const add = (message: string, warning = false) => advice.push({ message, warning });
  if (kind === 'paddy') {
    const irrigation = WaterSimulation.irrigation(state, point.x, point.y);
    add(
      irrigation >= 0.5
        ? `Watered site · ${Math.round(irrigation * 100)}% irrigation now`
        : `Needs more water · ${Math.round(irrigation * 100)}% irrigation now; aim for at least 50%`,
      irrigation < 0.5,
    );
  }
  // Shallow state copy isolates completedBuilding's ID allocation. All shared data is read-only.
  const projected = { ...state, buildings: [...state.buildings] };
  const site = completedBuilding(projected, kind, point.x, point.y);
  projected.buildings.push(site);
  if (['quarry', 'lateritepit', 'lumber'].includes(kind)) {
    const amount = Math.floor(remainingDeposit(projected, site));
    const material =
      kind === 'quarry' ? 'sandstone' : kind === 'lateritepit' ? 'laterite' : 'timber';
    add(
      amount > 0
        ? `${amount.toLocaleString('en-US')} ${material} available in reach after building`
        : `No ${material} remains in reach after building`,
      amount === 0,
    );
  }
  if (['paddy', 'quarry', 'lateritepit', 'lumber'].includes(kind)) {
    const delivery = planDelivery(projected, site);
    if (delivery.issue) {
      const issue = ISSUE_TEXT[delivery.issue];
      add(`No delivery route · ${issue.title}. ${issue.remedy}`, true);
    } else
      add(
        kind === 'quarry'
          ? 'Barge route reaches a staffed landing now'
          : 'Dry delivery route reaches a receiving building now',
      );
    const available = workforce(state).available;
    if (available < BUILDINGS[kind].workers)
      add(
        `Needs ${BUILDINGS[kind].workers} operating workers; ${available} idle now. Builders and production share labor.`,
        true,
      );
  }
  if (['canal', 'moat', 'baray'].includes(kind)) {
    const adjacentWater = footprint(site).some((p) =>
      neighbors(p).some((n) => {
        const t = tileAt(state, n.x, n.y);
        return (
          t &&
          ['water', 'canal', 'moat', 'reservoir', 'bridge'].includes(t.terrain) &&
          t.water >= 0.45
        );
      }),
    );
    add(
      adjacentWater
        ? 'Touches a filled waterway · flow depends on ground and water levels'
        : kind === 'baray'
          ? 'Rain can fill this reservoir; connect a waterway for a steadier supply'
          : 'No filled waterway beside this site · connect it to bring water here',
      !adjacentWater,
    );
  }
  return advice;
}
