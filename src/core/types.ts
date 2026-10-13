export type Resource = 'rice' | 'wood' | 'sandstone' | 'laterite' | 'merit';
export type Resources = Record<Resource, number>;
export type Terrain = 'grass' | 'forest' | 'water' | 'canal' | 'reservoir' | 'road' | 'bridge';
export type BuildingKind =
  | 'baray'
  | 'canal'
  | 'paddy'
  | 'house'
  | 'quarry'
  | 'temple'
  | 'lumber'
  | 'dock'
  | 'gate'
  | 'road'
  | 'bridge';
export type Category = 'all' | 'water' | 'production' | 'civic' | 'infrastructure';
export type Overlay = 'none' | 'water' | 'logistics' | 'grid';
export interface Point {
  x: number;
  y: number;
}
export interface Tile extends Point {
  terrain: Terrain;
  elevation: number;
  water: number;
  fertility: number;
  variant: number;
}
export interface Building extends Point {
  id: string;
  kind: BuildingKind;
  level: number;
  enabled: boolean;
  stock: number;
  construction: ConstructionProject | null;
  investment: Partial<Resources>;
  terrainBefore: TerrainSnapshot[];
  /** A completed canal underneath a floodgate or bridge. Only one layer is supported. */
  underlay: Building | null;
}
export interface TerrainSnapshot extends Point {
  terrain: Terrain;
  elevation: number;
}
export interface ConstructionProject {
  type: 'build' | 'upgrade';
  workDone: number;
  workRequired: number;
  builders: number;
  paused: boolean;
  cost: Partial<Resources>;
}
export interface BuildingDefinition {
  name: string;
  subtitle: string;
  description: string;
  category: Exclude<Category, 'all'>;
  size: number;
  cost: Partial<Resources>;
  workers: number;
  icon: string;
  buildWork: number;
  builders: number;
  production?: { resource: Resource; amount: number };
}
export interface Courier {
  id: string;
  sourceId: string;
  kind: 'worker' | 'barge';
  path: Point[];
  progress: number;
  resource: Resource;
  amount: number;
}
export interface ChronicleEntry {
  tick: number;
  title: string;
  text: string;
  icon: string;
}
export interface GameState {
  version: 2;
  seed: number;
  width: number;
  height: number;
  tiles: Tile[];
  buildings: Building[];
  couriers: Courier[];
  resources: Resources;
  tick: number;
  day: number;
  population: number;
  happiness: number;
  speed: 0 | 1 | 2 | 4;
  nextId: number;
  chronicle: ChronicleEntry[];
  built: Partial<Record<BuildingKind, number>>;
  objectivesClaimed: boolean;
}
export interface PlacementResult {
  ok: boolean;
  message: string;
}
export interface SaveEnvelope {
  schema: 2;
  savedAt: number;
  state: GameState;
}
