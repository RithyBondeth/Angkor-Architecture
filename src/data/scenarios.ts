import type { GameState, Resources, RoyalCommission, ScenarioId } from '../core/types';
import { COMMISSIONS } from './progression';

export interface ScenarioDefinition {
  id: ScenarioId;
  name: string;
  region: string;
  difficulty: string;
  description: string;
  terrain: string;
  seed: number;
  day: number;
  resources: Resources;
  commissions: readonly RoyalCommission[];
  waterName: string;
}
const floodplain: readonly RoyalCommission[] = [
  {
    id: 'water-foundation',
    title: 'Tame the floodplain',
    description: 'Control the low banks and bring a fertile harvest safely home.',
    goals: [
      {
        type: 'build',
        kind: 'gate',
        target: 1,
        label: 'Regulate the monsoon',
        hint: 'Complete a floodgate on an existing canal.',
      },
      {
        type: 'build',
        kind: 'paddy',
        target: 2,
        label: 'Plant the fertile banks',
        hint: 'Complete two new paddies near water and dry delivery routes.',
      },
      {
        type: 'delivered',
        resource: 'rice',
        target: 100,
        label: 'Bring rice to safety',
        hint: 'Receive 100 rice through actual deliveries; starting supplies do not count.',
      },
    ],
    reward: { merit: 80, wood: 40 },
  },
  {
    id: 'connected-city',
    title: 'Link the river villages',
    description: 'Build crossings and sheltered storage for your growing settlement.',
    goals: [
      {
        type: 'build',
        kind: 'bridge',
        target: 2,
        label: 'Cross the waterways',
        hint: 'Complete two new timber bridges.',
      },
      {
        type: 'build',
        kind: 'warehouse',
        target: 1,
        label: 'Store the harvest',
        hint: 'Complete a new warehouse on dry land.',
      },
      {
        type: 'build',
        kind: 'house',
        target: 2,
        label: 'Welcome two households',
        hint: 'Complete two new dwellings.',
      },
    ],
    reward: { merit: 100, rice: 100 },
  },
  {
    ...COMMISSIONS[2]!,
    title: 'Store water beyond the monsoon',
    description: 'Prepare the fertile floodplain for five consecutive dry-season days.',
  },
  COMMISSIONS[3]!,
  COMMISSIONS[4]!,
];
const foothills: readonly RoyalCommission[] = [
  {
    id: 'water-foundation',
    title: 'Carry water from the hills',
    description: 'Extend the narrow waterways before the rains end.',
    goals: [
      {
        type: 'build',
        kind: 'canal',
        target: 6,
        label: 'Extend the water network',
        hint: 'Complete six new canal tiles.',
      },
      {
        type: 'build',
        kind: 'baray',
        target: 1,
        label: 'Capture the remaining rains',
        hint: 'Complete a new baray reservoir.',
      },
      {
        type: 'build',
        kind: 'paddy',
        target: 1,
        label: 'Establish a new field',
        hint: 'Complete a new rice paddy near stored water.',
      },
    ],
    reward: { merit: 80, rice: 100 },
  },
  {
    id: 'connected-city',
    title: 'Stone for the kingdom',
    description: 'Move quarried sandstone through the waterways and supply your worksites.',
    goals: [
      {
        type: 'delivered',
        resource: 'sandstone',
        target: 120,
        label: 'Float stone downstream',
        hint: 'Receive 120 sandstone through barge deliveries. Starting stone does not count.',
      },
      {
        type: 'build',
        kind: 'road',
        target: 8,
        label: 'Lay paths through the foothills',
        hint: 'Complete eight new road tiles.',
      },
      {
        type: 'build',
        kind: 'warehouse',
        target: 1,
        label: 'Supply the builders',
        hint: 'Complete a new warehouse.',
      },
    ],
    reward: { merit: 100, wood: 60 },
  },
  {
    ...COMMISSIONS[2]!,
    title: 'A harvest through the dry season',
    description: 'Use stored water to sustain the foothill fields through drought.',
  },
  COMMISSIONS[3]!,
  COMMISSIONS[4]!,
];
export const SCENARIOS: Record<ScenarioId, ScenarioDefinition> = {
  roluos: {
    id: 'roluos',
    name: 'Roluos foundations',
    region: 'Roluos',
    difficulty: 'Recommended first',
    description: 'A balanced settlement with broad waterways and room to learn.',
    terrain:
      'Level grasslands, eastern river, southern waters, and a connected starting canal network.',
    seed: 802,
    day: 12,
    resources: { rice: 680, wood: 420, sandstone: 340, laterite: 210, merit: 48 },
    commissions: COMMISSIONS,
    waterName: 'TONLÉ SAP',
  },
  floodplain: {
    id: 'floodplain',
    name: 'Tonlé Sap floodplain',
    region: 'Tonlé Sap',
    difficulty: 'Flood management',
    description: 'Fertile low banks and wider rivers reward careful water control.',
    terrain:
      'Wider eastern and southern waters, low outer banks, fertile fields, and a raised settlement core.',
    seed: 889,
    day: 35,
    resources: { rice: 900, wood: 500, sandstone: 200, laterite: 160, merit: 48 },
    commissions: floodplain,
    waterName: 'FLOODPLAIN WATERS',
  },
  foothills: {
    id: 'foothills',
    name: 'Kulen foothills',
    region: 'Kulen',
    difficulty: 'Dry-season preparation',
    description: 'Wooded slopes and a narrow river demand early water storage.',
    terrain:
      'Rising northwestern ground, denser forest, narrow eastern and southern rivers, and level building land in the center.',
    seed: 1113,
    day: 76,
    resources: { rice: 480, wood: 320, sandstone: 520, laterite: 300, merit: 48 },
    commissions: foothills,
    waterName: 'KULEN RIVER',
  },
};
export const SCENARIO_IDS = Object.keys(SCENARIOS) as ScenarioId[];
export function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === 'string' && Object.hasOwn(SCENARIOS, value);
}
export function scenarioFor(state: Pick<GameState, 'scenario'>): ScenarioDefinition {
  return SCENARIOS[state.scenario ?? 'roluos'];
}
export function commissionsFor(state: Pick<GameState, 'scenario'>): readonly RoyalCommission[] {
  return scenarioFor(state).commissions;
}
