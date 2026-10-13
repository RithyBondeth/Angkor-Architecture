import type { RoyalCommission } from '../core/types';
import { ERAS } from './config';

export const FINAL_TEMPLE_MERIT = ERAS[2].merit;
export const UNLOCKS = [
  {
    merit: ERAS[1].merit,
    name: 'Royal granary',
    description: 'A staffed granary reduces daily rice needs by up to 25%.',
    kind: 'granary',
  },
  {
    merit: ERAS[2].merit,
    name: 'Architect’s workshop',
    description: 'A staffed workshop speeds construction and repairs by up to 20%.',
    kind: 'workshop',
  },
  {
    merit: FINAL_TEMPLE_MERIT,
    name: 'Sculpted sanctuary',
    description: 'Complete the final stage of your temples.',
    kind: 'temple',
  },
] as const;

export const COMMISSIONS: readonly RoyalCommission[] = [
  {
    id: 'water-foundation',
    title: 'A city sustained by water',
    description: 'Lay the foundations of a settlement sustained by its hydraulic network.',
    goals: [
      {
        type: 'build',
        kind: 'canal',
        target: 1,
        label: 'Connect the waters',
        hint: 'Complete a new irrigation canal.',
      },
      {
        type: 'build',
        kind: 'paddy',
        target: 1,
        label: 'Nourish your people',
        hint: 'Complete a new rice paddy.',
      },
      {
        type: 'build',
        kind: 'baray',
        target: 1,
        label: 'Store the monsoon',
        hint: 'Complete a new baray reservoir.',
      },
    ],
    reward: { merit: 50 },
  },
  {
    id: 'connected-city',
    title: 'Bring the settlement together',
    description: 'Give growing families homes and connect both banks of the city.',
    goals: [
      {
        type: 'build',
        kind: 'house',
        target: 2,
        label: 'Welcome two households',
        hint: 'Complete two new dwellings.',
      },
      {
        type: 'build',
        kind: 'road',
        target: 5,
        label: 'Lay village paths',
        hint: 'Complete five new road tiles.',
      },
      {
        type: 'build',
        kind: 'bridge',
        target: 1,
        label: 'Join both banks',
        hint: 'Complete a new timber bridge.',
      },
    ],
    reward: { merit: 100, wood: 40, rice: 100 },
  },
  {
    id: 'dry-season',
    title: 'Carry the city through drought',
    description: 'Prove that stored water and a steady harvest can sustain the city without rain.',
    goals: [
      {
        type: 'irrigated-fields',
        target: 3,
        label: 'Water three healthy fields',
        hint: 'Keep three operational paddies at 50% irrigation or better.',
      },
      {
        type: 'stockpile',
        resource: 'rice',
        target: 150,
        label: 'Keep a food reserve',
        hint: 'Hold 150 rice in the city granary.',
      },
      {
        type: 'sustain',
        condition: 'dry-resilience',
        target: 5,
        label: 'Withstand five dry-season days',
        hint: 'For five consecutive dry days, feed everyone, keep hunger at zero, and irrigate at least two healthy fields. A lapse resets this streak.',
      },
    ],
    reward: { merit: 200, laterite: 50 },
  },
  {
    id: 'royal-granary',
    title: 'A kingdom well supplied',
    description: 'Put the new granary to work and support a larger settlement.',
    goals: [
      {
        type: 'build',
        kind: 'granary',
        target: 1,
        label: 'Establish a royal granary',
        hint: 'Reach 200 merit and complete a granary.',
      },
      {
        type: 'delivered',
        resource: 'rice',
        target: 200,
        label: 'Bring the harvest home',
        hint: 'Receive 200 rice through worker deliveries. Starting stock and rewards do not count.',
      },
      {
        type: 'population',
        target: 100,
        label: 'Sustain one hundred residents',
        hint: 'Grow and maintain a population of at least 100.',
      },
    ],
    reward: { merit: 150, wood: 60 },
  },
  {
    id: 'temple-city',
    title: 'An enduring temple city',
    description: 'Unite skilled builders, a completed sanctuary, and a thriving population.',
    goals: [
      {
        type: 'build',
        kind: 'workshop',
        target: 1,
        label: 'Train the master builders',
        hint: 'Reach 600 merit and complete an architect’s workshop.',
      },
      {
        type: 'temple-level',
        target: 3,
        label: 'Finish a sculpted sanctuary',
        hint: 'Complete the final temple stage and keep the sanctuary operational.',
      },
      {
        type: 'delivered',
        resource: 'sandstone',
        target: 100,
        label: 'Bring stone by water',
        hint: 'Receive 100 sandstone through actual barge deliveries.',
      },
      {
        type: 'population',
        target: 120,
        label: 'Nurture a thriving city',
        hint: 'Maintain at least 120 residents.',
      },
      {
        type: 'sustain',
        condition: 'healthy-city',
        target: 7,
        label: 'Seven days of wellbeing',
        hint: 'For seven consecutive days, feed everyone, keep hunger at zero, and avoid ruined dwellings. A lapse resets this streak.',
      },
    ],
    reward: { merit: 250, sandstone: 40 },
  },
];
