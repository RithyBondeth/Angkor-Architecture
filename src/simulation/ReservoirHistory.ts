import type { Building, GameState } from '../core/types';
import { footprint, tileAt } from '../core/world';

export const RESERVOIR_HISTORY_DAYS = 60;
export const RESERVOIR_DEPTH = 6;
export function reservoirDepth(state: GameState, b: Building): number {
  const cells = footprint(b);
  return cells.reduce((n, p) => n + (tileAt(state, p.x, p.y)?.water ?? 0), 0) / cells.length;
}

/** Daily observed readings, including the first reading for newly completed reservoirs. */
export function recordReservoirHistory(state: GameState): void {
  const reservoirs = state.buildings.filter(
    (b) => b.kind === 'baray' && b.construction?.type !== 'build',
  );
  const currentIds = new Set(reservoirs.map((b) => b.id));
  state.reservoirHistory = (state.reservoirHistory ?? []).filter((h) => currentIds.has(h.id));
  for (const b of reservoirs) {
    let history = state.reservoirHistory.find((h) => h.id === b.id);
    if (!history) {
      history = { id: b.id, samples: [] };
      state.reservoirHistory.push(history);
    }
    // Pausing, changing speed, and repeated UI actions never add duplicate readings.
    if (history.samples.at(-1)?.day === state.day) continue;
    history.samples.push({ tick: state.tick, day: state.day, depth: reservoirDepth(state, b) });
    history.samples = history.samples
      .filter((s) => s.day > state.day - RESERVOIR_HISTORY_DAYS)
      .slice(-RESERVOIR_HISTORY_DAYS);
  }
}
