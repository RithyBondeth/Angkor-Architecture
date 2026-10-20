import type { GameState } from '../core/types';
import { lowWaterSites, lowReservoirs } from './Feedback';
import { foodOutlook } from './Outlook';

export interface KingdomAlert {
  id: string;
  title: string;
  remedy: string;
  sites: string[];
  panel: 'water' | 'workforce' | 'survival' | 'monuments';
}
export function kingdomAlerts(state: GameState): KingdomAlert[] {
  const alerts: KingdomAlert[] = [];
  const outlook = foodOutlook(state);
  if (state.population > 0 && (state.survival.hunger > 0 || (outlook.reserveDays ?? Infinity) < 5))
    alerts.push({
      id: 'food',
      title:
        state.survival.hunger > 0
          ? 'Your people need food'
          : `${outlook.reserveDays} days of rice in reserve`,
      remedy: 'Inspect fields and deliveries to bring more rice home.',
      sites: [],
      panel: 'survival',
    });
  const add = (
    id: string,
    title: string,
    remedy: string,
    sites: string[],
    panel: KingdomAlert['panel'],
  ) => {
    if (sites.length)
      alerts.push({
        id,
        title: `${sites.length} ${sites.length === 1 ? title.replace('fields need', 'field needs').replace('reservoirs running', 'reservoir running').replace('worksites need', 'worksite needs').replace('structures need', 'structure needs').replace('temples need', 'temple needs') : title}`,
        remedy,
        sites,
        panel,
      });
  };
  add(
    'fields',
    'fields need water',
    'Connect filled waterways; aim for at least 50% irrigation.',
    lowWaterSites(state).map((b) => b.id),
    'water',
  );
  add(
    'reservoirs',
    'reservoirs running low',
    'Inspect water trends and connections before the dry season.',
    lowReservoirs(state).map((b) => b.id),
    'water',
  );
  add(
    'deliveries',
    'worksites need delivery help',
    'Inspect the highlighted site for its route or transport remedy.',
    state.buildings
      .filter((b) => b.enabled && !b.construction && b.condition > 0 && b.deliveryIssue)
      .map((b) => b.id),
    'workforce',
  );
  add(
    'damage',
    'structures need repairs',
    'Wait for floodwater to recede, then assign repair crews.',
    state.buildings.filter((b) => b.condition < 100 && !b.construction).map((b) => b.id),
    'survival',
  );
  add(
    'foundations',
    'temples need stable foundations',
    'Fill the surrounding moats and protect the foundations from flooding.',
    state.buildings.filter((b) => b.engineering && b.engineering.stability < 60).map((b) => b.id),
    'monuments',
  );
  return alerts;
}
