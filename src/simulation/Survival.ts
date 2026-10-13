import { CONFIG } from '../data/config';
import { BUILDINGS } from '../data/buildings';
import type { ChronicleEntry, GameState } from '../core/types';
import { WaterSimulation } from './WaterSimulation';
import { reconcileBuilders } from './Workforce';
import { floodDepth, floodTolerance, foodDemand, housingCapacity } from './survivalRules';

type Event = Omit<ChronicleEntry, 'tick'>;

/** Daily consequences use simulation ticks, so pause, speed, and saves share one clock. */
export class Survival {
  environment(state: GameState): Event[] {
    if (state.tick % CONFIG.ticksPerDay !== 0) return [];
    const events: Event[] = [];
    for (const b of state.buildings) {
      if (b.construction?.type === 'build') continue;
      const name = BUILDINGS[b.kind].name;
      if (b.crop) {
        const irrigation = WaterSimulation.irrigation(state, b.x, b.y, BUILDINGS[b.kind].size);
        b.crop.stress = Math.max(
          0,
          Math.min(
            100,
            b.crop.stress +
              (irrigation < CONFIG.survival.droughtIrrigation ? 12 : irrigation < 0.5 ? 4 : -10),
          ),
        );
        if (!b.crop.failed && b.crop.stress >= CONFIG.survival.cropFailureStress) {
          b.crop.failed = true;
          events.push({
            title: 'A rice crop has failed',
            text: 'Prolonged drought destroyed a harvest. Restore nearby irrigation; the field replants once drought stress falls to 20%.',
            icon: 'plant',
          });
        } else if (b.crop.failed && b.crop.stress <= CONFIG.survival.cropRecoveryStress) {
          b.crop.failed = false;
          events.push({
            title: 'A field is growing again',
            text: 'Restored irrigation has allowed a failed rice paddy to replant.',
            icon: 'plant',
          });
        }
      }
      const excess = floodDepth(state, b) - floodTolerance(b);
      if (excess <= 0 || b.condition === 0) continue;
      const firstDamage = b.condition === 100;
      b.condition = Math.max(0, b.condition - Math.min(12, Math.ceil(excess * 6)));
      if (b.condition === 0) {
        events.push({
          title: `${name} ruined`,
          text: 'Flood damage has stopped this structure. Let the water recede, then assign builders to repair it.',
          icon: 'warning',
        });
      } else if (firstDamage) {
        events.push({
          title: `${name} damaged by flooding`,
          text: 'Floodwater is damaging this site. Its output declines with condition; repairs become possible once the water recedes.',
          icon: 'waves',
        });
      }
    }
    reconcileBuilders(state);
    return events;
  }

  food(state: GameState): Event[] {
    if (state.tick % CONFIG.ticksPerDay !== 0) return [];
    const events: Event[] = [];
    const s = state.survival;
    const previousHunger = s.hunger;
    const demand = foodDemand(state);
    const eaten = Math.min(state.resources.rice, demand);
    state.resources.rice -= eaten;
    s.lastFoodCoverage = demand === 0 ? 1 : eaten / demand;
    if (s.lastFoodCoverage < 1) {
      s.shortageDays++;
      s.fedDays = 0;
      s.hunger = Math.min(
        100,
        s.hunger + CONFIG.survival.hungerPerMissedMeal * (1 - s.lastFoodCoverage),
      );
      state.happiness = Math.max(20, state.happiness - 2);
      if (s.shortageDays === 1)
        events.push({
          title: 'Food shortage',
          text: 'The granary could not feed everyone today. Hunger slows production, deliveries, and building work. Restore rice harvests and delivery routes.',
          icon: 'bowl-food',
        });
    } else {
      s.shortageDays = 0;
      s.hunger = Math.max(0, s.hunger - CONFIG.survival.hungerRecovery);
      s.fedDays = s.hunger === 0 ? s.fedDays + 1 : 0;
      state.happiness = Math.min(99, state.happiness + 0.1);
      if (previousHunger > 0 && s.hunger === 0)
        events.push({
          title: 'The city is fed again',
          text: 'Regular meals have restored worker productivity. Maintain five days of food reserves to welcome residents back into available housing.',
          icon: 'bowl-food',
        });
    }
    let lost = 0;
    if (
      s.shortageDays > CONFIG.survival.shortageGraceDays &&
      s.hunger >= CONFIG.survival.departureHunger
    ) {
      lost = Math.min(state.population, Math.max(1, Math.ceil(state.population * 0.02)));
      if (lost)
        events.push({
          title: 'Residents leave in search of food',
          text: `${lost} residents departed after sustained hunger. Feeding the city restores productivity and allows gradual resettlement.`,
          icon: 'users-three',
        });
    }
    state.population -= lost;
    const ruinedHomes = state.buildings.some((b) => b.kind === 'house' && b.condition === 0);
    const displaced = ruinedHomes
      ? Math.min(2, Math.max(0, state.population - housingCapacity(state)))
      : 0;
    state.population -= displaced;
    if (displaced)
      events.push({
        title: 'Residents need shelter',
        text: `${displaced} residents left because their homes are ruined. Repair dwellings to restore housing capacity.`,
        icon: 'house-line',
      });
    s.departed += lost + displaced;
    if (
      state.population > 0 &&
      s.fedDays >= 5 &&
      s.fedDays % 3 === 0 &&
      state.resources.rice >= foodDemand(state) * 5 &&
      state.population < housingCapacity(state)
    ) {
      state.population++;
    }
    reconcileBuilders(state);
    return events;
  }
}
