import { SCENARIOS } from '../data/scenarios';
import { freshTutorial } from './tutorialState';
import { CONFIG } from '../data/config';
import { BUILDINGS } from '../data/buildings';
import { completedBuilding, registerInfrastructure } from './buildingState';
import { seedDeposits } from '../simulation/Deposits';
import { freshSurvival } from './survivalState';
import { freshProgression } from './progressionState';
import type { Building, BuildingKind, GameState, Point, Tile, ScenarioId } from './types';

export function tileAt(
  state: Pick<GameState, 'width' | 'height' | 'tiles'>,
  x: number,
  y: number,
): Tile | undefined {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return undefined;
  return state.tiles[y * state.width + x];
}
export function footprint(building: Point & { kind: BuildingKind }): Point[] {
  const size = BUILDINGS[building.kind].size;
  return Array.from({ length: size * size }, (_, i) => ({
    x: building.x + (i % size),
    y: building.y + Math.floor(i / size),
  }));
}
export function buildingAt(state: GameState, x: number, y: number): Building | undefined {
  return state.buildings.find(
    (b) =>
      x >= b.x && x < b.x + BUILDINGS[b.kind].size && y >= b.y && y < b.y + BUILDINGS[b.kind].size,
  );
}
export function neighbors(p: Point): Point[] {
  return [
    { x: p.x - 1, y: p.y },
    { x: p.x + 1, y: p.y },
    { x: p.x, y: p.y - 1 },
    { x: p.x, y: p.y + 1 },
  ];
}
export function random(seed: number): () => number {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function createWorld(seed = 802, scenario: ScenarioId = 'roluos'): GameState {
  const definition = SCENARIOS[scenario];
  const rand = random(seed);
  const size = CONFIG.worldSize;
  const state: GameState = {
    version: 6,
    scenario,
    tutorial: freshTutorial(),
    seed,
    width: size,
    height: size,
    tiles: [],
    buildings: [],
    couriers: [],
    resources: { ...definition.resources },
    tick: 0,
    day: definition.day,
    population: 84,
    happiness: 88,
    survival: freshSurvival(),
    speed: 1,
    nextId: 1,
    built: {},
    progression: freshProgression(definition.resources.merit),
    logistics: { dispatchCursor: 0 },
    feedback: { sinceTick: 0, receipts: [] },
    chronicle: [
      {
        tick: 0,
        title: 'Your story begins',
        text: `${definition.name}: ${definition.description}`,
        icon: 'scroll',
      },
    ],
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const river =
        scenario === 'foothills'
          ? x >= 29 || y >= 30
          : x >= (scenario === 'floodplain' ? 25 : 26) + Math.sin(y * 0.31) * 1.5 ||
            y >= (scenario === 'floodplain' ? 26 : 28) + Math.sin(x * 0.24);
      const forest =
        !river &&
        (x < 5 ||
          y < 5 ||
          (rand() < (scenario === 'foothills' ? 0.35 : 0.18) && (x < 10 || y > 22 || x > 22)));
      state.tiles.push({
        x,
        y,
        terrain: river ? 'water' : forest ? 'forest' : 'grass',
        elevation: river
          ? -2
          : scenario === 'floodplain' && (x < 7 || y < 6 || x > 23 || y > 24)
            ? 2.1 + rand() * 0.25
            : 2.6 +
              rand() * 0.12 +
              (scenario === 'foothills' ? Math.max(0, 9 - y) * 0.35 + Math.max(0, 9 - x) * 0.2 : 0),
        water: river ? (scenario === 'floodplain' ? 5 : scenario === 'foothills' ? 4.6 : 5.5) : 0,
        fertility:
          scenario === 'floodplain'
            ? 0.85 + rand() * 0.15
            : scenario === 'foothills'
              ? 0.5 + rand() * 0.3
              : 0.65 + rand() * 0.35,
        variant: Math.floor(rand() * 5),
        timber: 0,
        mineral: null,
      });
    }
  const add = (kind: BuildingKind, x: number, y: number, level = 1) => {
    const building = completedBuilding(state, kind, x, y, level);
    state.buildings.push(building);
    for (const p of footprint(building)) {
      const t = tileAt(state, p.x, p.y)!;
      t.terrain = kind === 'baray' ? 'reservoir' : 'grass';
      if (kind === 'baray') {
        t.elevation = -1;
        t.water = scenario === 'foothills' ? 3.1 : 4.2;
      }
    }
  };
  add('baray', 7, 8);
  add('temple', 16, 13, 2);
  add('paddy', 11, 17);
  add('paddy', 11, 20);
  add('paddy', 14, 22);
  add('house', 19, 19);
  add('house', 22, 20);
  add('house', 19, 22);
  add('quarry', 23, 6);
  add('lumber', 7, 17);
  add('dock', 23, 12);
  add('lateritepit', 21, 24);
  for (let x = 11; x < 29; x++) {
    const t = tileAt(state, x, 10)!;
    if (t.terrain !== 'water') {
      t.terrain = 'canal';
      t.elevation = -0.8;
      t.water = scenario === 'foothills' ? 2.7 : 3.5;
    }
  }
  for (let y = 11; y < 29; y++) {
    const t = tileAt(state, 13, y)!;
    t.terrain = 'canal';
    t.elevation = -0.8;
    t.water = scenario === 'foothills' ? 2.7 : 3.5;
  }
  for (let y = 12; y < 27; y++) {
    const t = tileAt(state, 18, y)!;
    if (!buildingAt(state, 18, y)) t.terrain = 'road';
  }
  for (let x = 6; x < 26; x++) {
    const t = tileAt(state, x, 18)!;
    if (!buildingAt(state, x, 18) && t.terrain !== 'canal') t.terrain = 'road';
  }
  // A road over a low canal bed is a bridge: both workers and barges can pass.
  tileAt(state, 13, 18)!.terrain = 'bridge';
  registerInfrastructure(state);
  seedDeposits(state);
  return state;
}

export function createScenario(id: ScenarioId): GameState {
  return createWorld(SCENARIOS[id].seed, id);
}
