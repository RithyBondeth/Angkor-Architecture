import type { Building, DeliveryIssue, GameState, Point, Resource } from '../core/types';
import { CONFIG } from '../data/config';
import { BUILDINGS } from '../data/buildings';
import { staffedBuildings, workforce } from './Workforce';
import { findPathBetween, type RouteOptions, type TravelMode } from './Pathfinding';
import { siteDistance } from './Deposits';

export const transportMode = (b: Building): TravelMode =>
  b.kind === 'quarry' ? 'barge' : 'worker';
export function storageCapacity(state: GameState, resource: Resource): number {
  if (resource === 'merit') return CONFIG.maxResource;
  return Math.min(
    CONFIG.maxResource,
    CONFIG.logistics.baseStorage +
      state.buildings.reduce(
        (n, b) =>
          n +
          (b.kind === 'warehouse' && b.construction?.type !== 'build'
            ? Math.floor((CONFIG.logistics.warehouseStorage * b.condition) / 100)
            : 0),
        0,
      ),
  );
}
export function transportCapacity(state: GameState, mode: TravelMode): number {
  const staffed = staffedBuildings(state);
  const extra = state.buildings.reduce(
    (n, b) =>
      n +
      (staffed.has(b.id) && b.kind === (mode === 'worker' ? 'warehouse' : 'dock')
        ? mode === 'worker'
          ? CONFIG.logistics.warehouseCarts
          : CONFIG.logistics.dockBarges
        : 0),
    0,
  );
  return Math.min(
    CONFIG.maxCouriers,
    extra +
      (mode === 'worker'
        ? Math.min(
            CONFIG.logistics.baseCarts,
            Math.floor(workforce(state).total / CONFIG.logistics.workersPerCart),
          )
        : 0),
  );
}
export function isReceiver(
  state: GameState,
  b: Building,
  mode: TravelMode,
  staffed = staffedBuildings(state),
): boolean {
  return (
    b.enabled &&
    !b.construction &&
    b.condition > 0 &&
    (mode === 'barge'
      ? b.kind === 'dock' && staffed.has(b.id)
      : b.kind === 'house' || (b.kind === 'warehouse' && staffed.has(b.id)))
  );
}
function approaches(state: GameState, b: Building, mode: TravelMode, source: boolean): Point[] {
  const radius = mode === 'worker' ? 1 : source ? 3 : 2;
  const size = BUILDINGS[b.kind].size;
  const points: Point[] = [];
  for (let y = Math.max(0, b.y - radius); y < Math.min(state.height, b.y + size + radius); y++)
    for (let x = Math.max(0, b.x - radius); x < Math.min(state.width, b.x + size + radius); x++)
      if (siteDistance({ x, y }, b) <= radius) points.push({ x, y });
  return points;
}
export interface DeliveryPlan {
  path: Point[] | null;
  targetId: string | null;
  issue: DeliveryIssue | null;
}
export function planDelivery(state: GameState, b: Building): DeliveryPlan {
  const mode = transportMode(b);
  const staffed = staffedBuildings(state);
  const targets = state.buildings.filter((t) => isReceiver(state, t, mode, staffed));
  if (!targets.length) return { path: null, targetId: null, issue: 'no-receiver' };
  const starts = approaches(state, b, mode, true);
  const targetByCell = new Map<number, string>();
  const goals = targets.flatMap((t) =>
    approaches(state, t, mode, false).map((p) => {
      targetByCell.set(p.y * state.width + p.x, t.id);
      return p;
    }),
  );
  const search = (options: RouteOptions = {}) =>
    findPathBetween(state, starts, goals, mode, options);
  const path = search();
  if (path) {
    const end = path[path.length - 1]!;
    return { path, targetId: targetByCell.get(end.y * state.width + end.x)!, issue: null };
  }
  const issue: DeliveryIssue =
    mode === 'barge'
      ? search({ ignoreClosedGates: true })
        ? 'closed-gate'
        : search({ ignoreShallows: true })
          ? 'shallow-water'
          : search({ ignoreClosedGates: true, ignoreShallows: true })
            ? 'water-obstacles'
            : 'disconnected-waterway'
      : search({ ignoreFlooding: true })
        ? 'flooded-route'
        : search({ ignoreRuins: true })
          ? 'ruined-route'
          : 'blocked-land-route';
  return { path: null, targetId: null, issue };
}
export const ISSUE_TEXT: Record<DeliveryIssue, { title: string; remedy: string }> = {
  'no-workers': {
    title: 'Needs operating workers',
    remedy: 'Release builders, pause another workplace, or add dwellings.',
  },
  'storage-full': {
    title: 'City storage full',
    remedy: 'Spend these materials or build and repair warehouses. Existing stock is retained.',
  },
  'transport-full': {
    title: 'Transport capacity busy',
    remedy:
      'Wait for a trip to finish. Staff a warehouse for two carts, or a landing for one barge.',
  },
  'no-receiver': {
    title: 'No working destination',
    remedy:
      'Land cargo needs a dwelling or staffed warehouse; sandstone needs a staffed river landing.',
  },
  'receiver-unavailable': {
    title: 'Destination stopped receiving',
    remedy:
      'Restore its staffing, finish repairs, or build another destination. Cargo has returned to the worksite.',
  },
  'closed-gate': {
    title: 'Floodgate blocks barges',
    remedy: 'Open the floodgate along the route to a staffed landing.',
  },
  'shallow-water': {
    title: 'Water too shallow',
    remedy: 'Restore a continuous channel at least 0.45 units deep to a staffed landing.',
  },
  'water-obstacles': {
    title: 'Shallows and gates block barges',
    remedy: 'Open floodgates and restore at least 0.45 water depth along the channel.',
  },
  'disconnected-waterway': {
    title: 'Waterway disconnected',
    remedy:
      'Join water within three tiles of the quarry to water within two tiles of a staffed landing.',
  },
  'flooded-route': {
    title: 'Land route flooded',
    remedy: 'Build bridges across canals or wait for floodwater to fall below 0.8.',
  },
  'ruined-route': {
    title: 'Road or bridge ruined',
    remedy: 'Repair the damaged crossing or provide another dry route.',
  },
  'blocked-land-route': {
    title: 'Land route blocked',
    remedy:
      'Connect the worksite to a dwelling or staffed warehouse with dry ground, roads, and bridges.',
  },
  depleted: {
    title: 'Nearby resources exhausted',
    remedy:
      'Use the resource overlay (R) to find a fresh site. Stored output can still be delivered.',
  },
};
