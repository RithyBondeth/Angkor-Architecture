import type { Game } from './Game';
import type { BuildingKind, Point } from './types';
import { isRouteKind } from './buildRoute';

export interface TouchPlan {
  kind: BuildingKind;
  start: Point;
  end: Point;
}
/** Touch taps only stage a plan. Confirmation always revalidates current simulation state. */
export class TouchPlacement {
  plan: TouchPlan | null = null;
  stage(kind: BuildingKind, point: Point) {
    const start = this.plan?.kind === kind && isRouteKind(kind) ? this.plan.start : point;
    this.plan = { kind, start: { ...start }, end: { ...point } };
  }
  cancel() {
    this.plan = null;
  }
  confirm(game: Game) {
    const plan = this.plan;
    if (!plan) return { ok: false, message: 'Tap a site to preview it first.' };
    const result = isRouteKind(plan.kind)
      ? game.placeRoute(plan.kind, plan.start, plan.end)
      : game.place(plan.kind, plan.end);
    if (result.ok) this.cancel();
    return result;
  }
}
