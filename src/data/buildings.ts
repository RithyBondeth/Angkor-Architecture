import type { BuildingDefinition, BuildingKind, Resource } from '../core/types';

export const BUILDINGS: Record<BuildingKind, BuildingDefinition> = {
  baray: {
    name: 'Baray reservoir',
    subtitle: 'Store the monsoon',
    description:
      'A great reservoir that collects rain and sustains the city through the dry season. Connect it to your paddies with canals.',
    category: 'water',
    size: 4,
    cost: { wood: 70, laterite: 40 },
    workers: 0,
    icon: 'waves',
  },
  canal: {
    name: 'Irrigation canal',
    subtitle: 'Let life flow',
    description:
      'Connect reservoirs, rivers, and fields. Water moves with elevation and pressure; barges need a continuous channel with enough depth.',
    category: 'water',
    size: 1,
    cost: { wood: 8, laterite: 4 },
    workers: 0,
    icon: 'path',
  },
  paddy: {
    name: 'Rice paddy',
    subtitle: 'Feed your people',
    description:
      'Produces rice when irrigated by nearby water. Keep a dry route to the village so workers can bring the harvest home.',
    category: 'production',
    size: 2,
    cost: { wood: 35, laterite: 10 },
    workers: 4,
    icon: 'grains',
    production: { resource: 'rice', amount: 16 },
  },
  house: {
    name: 'Khmer dwelling',
    subtitle: 'A place to call home',
    description:
      'A raised timber home for eight people. New residents join your workforce and need a steady supply of rice.',
    category: 'civic',
    size: 2,
    cost: { wood: 45, laterite: 15 },
    workers: 0,
    icon: 'house-line',
  },
  quarry: {
    name: 'Sandstone quarry',
    subtitle: 'Build for the ages',
    description:
      'Quarry fine sandstone for your monuments. Heavy stone can only reach the city along a navigable waterway to a landing.',
    category: 'production',
    size: 2,
    cost: { wood: 55, laterite: 25 },
    workers: 6,
    icon: 'mountains',
    production: { resource: 'sandstone', amount: 10 },
  },
  temple: {
    name: 'Prasat temple',
    subtitle: 'Honor a civilization',
    description:
      'Raise a sanctuary on a laterite foundation, then add a sandstone tower and sculpted reliefs. Active temples generate merit.',
    category: 'civic',
    size: 4,
    cost: { sandstone: 100, laterite: 80, wood: 30 },
    workers: 8,
    icon: 'bank',
    production: { resource: 'merit', amount: 2 },
  },
  lumber: {
    name: 'Woodcutter’s lodge',
    subtitle: 'From forest to city',
    description:
      'Harvests timber from nearby forest. Workers carry wood to the village over dry land.',
    category: 'production',
    size: 2,
    cost: { wood: 25, laterite: 10 },
    workers: 4,
    icon: 'tree',
    production: { resource: 'wood', amount: 12 },
  },
  dock: {
    name: 'River landing',
    subtitle: 'Connect the kingdom',
    description:
      'Receives sandstone barges. Place beside a river or canal to bring the quarries into your supply network.',
    category: 'water',
    size: 2,
    cost: { wood: 45, laterite: 20 },
    workers: 2,
    icon: 'boat',
  },
  gate: {
    name: 'Floodgate',
    subtitle: 'Balance the waters',
    description:
      'Regulates an existing canal. Open it to let water and barges through, or close it to hold back the monsoon.',
    category: 'water',
    size: 1,
    cost: { wood: 25, laterite: 30 },
    workers: 0,
    icon: 'sliders-horizontal',
  },
};
export const RESOURCE_INFO: Record<Resource, { name: string; icon: string; unit: string }> = {
  rice: { name: 'Rice', icon: 'grains', unit: 'sacks' },
  wood: { name: 'Timber', icon: 'tree', unit: 'logs' },
  sandstone: { name: 'Sandstone', icon: 'cube', unit: 'blocks' },
  laterite: { name: 'Laterite', icon: 'wall', unit: 'blocks' },
  merit: { name: 'Merit', icon: 'sparkle', unit: 'bun' },
};
export const BUILD_ORDER: BuildingKind[] = [
  'baray',
  'canal',
  'paddy',
  'house',
  'quarry',
  'temple',
  'lumber',
  'dock',
  'gate',
];
