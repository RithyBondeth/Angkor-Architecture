import { CONFIG } from '../data/config';
import { BUILDINGS } from '../data/buildings';
import { completedBuilding, registerInfrastructure } from './buildingState';
import { freshSurvival } from './survivalState';
import type { Building, BuildingKind, GameState, Point, Tile } from './types';

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
export function createWorld(seed = 802): GameState {
  const rand = random(seed);
  const size = CONFIG.worldSize;
  const state: GameState = {
    version: 3,
    seed,
    width: size,
    height: size,
    tiles: [],
    buildings: [],
    couriers: [],
    resources: { rice: 680, wood: 420, sandstone: 340, laterite: 210, merit: 48 },
    tick: 0,
    day: 12,
    population: 84,
    happiness: 88,
    survival: freshSurvival(),
    speed: 1,
    nextId: 1,
    built: {},
    objectivesClaimed: false,
    chronicle: [
      {
        tick: 0,
        title: 'Your story begins',
        text: 'The sovereign has entrusted you with a new settlement. Let water be its foundation.',
        icon: 'scroll',
      },
    ],
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const river = x >= 26 + Math.sin(y * 0.31) * 1.5 || y >= 28 + Math.sin(x * 0.24);
      const forest = !river && (x < 5 || y < 5 || (rand() < 0.18 && (x < 10 || y > 22 || x > 22)));
      state.tiles.push({
        x,
        y,
        terrain: river ? 'water' : forest ? 'forest' : 'grass',
        elevation: river ? -2 : 2.6 + rand() * 0.12,
        water: river ? 5.5 : 0,
        fertility: 0.65 + rand() * 0.35,
        variant: Math.floor(rand() * 5),
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
        t.water = 4.2;
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
  for (let x = 11; x < 29; x++) {
    const t = tileAt(state, x, 10)!;
    if (t.terrain !== 'water') {
      t.terrain = 'canal';
      t.elevation = -0.8;
      t.water = 3.5;
    }
  }
  for (let y = 11; y < 29; y++) {
    const t = tileAt(state, 13, y)!;
    t.terrain = 'canal';
    t.elevation = -0.8;
    t.water = 3.5;
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
  return state;
}
