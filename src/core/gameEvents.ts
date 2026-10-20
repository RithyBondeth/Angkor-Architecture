import type { MilestoneNotice } from './milestones';
import type { BuildingKind, Resource } from './types';

/** Transient gameplay feedback; never serialized or replayed when loading a save. */
export type GameEvent =
  | ({ type: 'milestone' } & MilestoneNotice)
  | { type: 'placement'; kind: BuildingKind; count: number }
  | { type: 'delivery'; resource: Resource; amount: number; mode: 'worker' | 'barge' };
export type DeliveryArrival = Extract<GameEvent, { type: 'delivery' }>;
