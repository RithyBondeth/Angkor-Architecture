export type Resource = 'rice' | 'wood' | 'sandstone' | 'laterite' | 'merit';
export type Resources = Record<Resource, number>;
export type Terrain = 'grass' | 'forest' | 'water' | 'canal' | 'reservoir' | 'road';
export type BuildingKind =
  'baray' | 'canal' | 'paddy' | 'house' | 'quarry' | 'temple' | 'lumber' | 'dock' | 'gate';
export type Category = 'all' | 'water' | 'production' | 'civic';
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
  version: 1;
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
  schema: 1;
  savedAt: number;
  state: GameState;
}
