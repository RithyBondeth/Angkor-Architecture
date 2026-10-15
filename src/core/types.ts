export type Resource = 'rice' | 'wood' | 'sandstone' | 'laterite' | 'merit';
export type Resources = Record<Resource, number>;
export type Terrain =
  'grass' | 'forest' | 'water' | 'canal' | 'moat' | 'reservoir' | 'road' | 'bridge';
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
  | 'bridge'
  | 'granary'
  | 'workshop'
  | 'warehouse'
  | 'lateritepit'
  | 'moat';
export type Category = 'all' | 'water' | 'production' | 'civic' | 'infrastructure';
export type Overlay = 'none' | 'water' | 'flow' | 'elevation' | 'logistics' | 'resources' | 'grid';
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
  timber: number;
  mineral: { resource: 'sandstone' | 'laterite'; remaining: number } | null;
}
export interface Building extends Point {
  id: string;
  kind: BuildingKind;
  level: number;
  enabled: boolean;
  stock: number;
  deliveryIssue: DeliveryIssue | null;
  engineering: TempleEngineering | null;
  condition: number;
  crop: { stress: number; failed: boolean } | null;
  construction: ConstructionProject | null;
  investment: Partial<Resources>;
  terrainBefore: TerrainSnapshot[];
  /** A completed canal or moat underneath a floodgate or bridge. Only one layer is supported. */
  underlay: Building | null;
}
export interface TerrainSnapshot extends Point {
  terrain: Terrain;
  elevation: number;
}
export interface ConstructionProject {
  type: 'build' | 'upgrade' | 'repair';
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
  unlockMerit?: number;
}
export interface Courier {
  id: string;
  sourceId: string;
  targetId: string;
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
export interface TutorialState {
  status: 'active' | 'skipped' | 'completed';
  step: number;
  canalId: string | null;
  paddyId: string | null;
  inspected: boolean;
  delivered: boolean;
}
export interface ReservoirHistory {
  id: string;
  samples: { tick: number; day: number; depth: number }[];
}
export interface GameState {
  /** Optional in older saves; observed readings begin when that kingdom is opened. */
  reservoirHistory?: ReservoirHistory[];
  /** Absent in older saves; existing kingdoms opt in through the guide. */
  tutorial?: TutorialState;
  version: 6;
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
  survival: SurvivalState;
  speed: 0 | 1 | 2 | 4;
  nextId: number;
  chronicle: ChronicleEntry[];
  built: Partial<Record<BuildingKind, number>>;
  progression: ProgressionState;
  logistics: { dispatchCursor: number };
  feedback: { sinceTick: number; receipts: { tick: number; resource: Resource; amount: number }[] };
}
export interface PlacementResult {
  ok: boolean;
  message: string;
}
export interface SaveEnvelope {
  schema: 6;
  savedAt: number;
  state: GameState;
}
export interface SurvivalState {
  hunger: number;
  shortageDays: number;
  fedDays: number;
  lastFoodCoverage: number;
  departed: number;
}
export type CommissionId =
  'water-foundation' | 'connected-city' | 'dry-season' | 'royal-granary' | 'temple-city';
export interface ProgressionState {
  meritPeak: number;
  claimed: CommissionId[];
  delivered: Partial<Resources>;
  streakDays: number;
  lastDayTick: number;
}
export type CampaignGoal = { label: string; hint: string; target: number } & (
  | { type: 'build'; kind: BuildingKind }
  | { type: 'delivered' | 'stockpile'; resource: Resource }
  | { type: 'population' | 'irrigated-fields' | 'temple-level' }
  | { type: 'sustain'; condition: 'dry-resilience' | 'healthy-city' }
);
export interface RoyalCommission {
  id: CommissionId;
  title: string;
  description: string;
  goals: readonly CampaignGoal[];
  reward: Partial<Resources>;
}

export const DELIVERY_ISSUES = [
  'no-workers',
  'storage-full',
  'transport-full',
  'no-receiver',
  'receiver-unavailable',
  'closed-gate',
  'shallow-water',
  'water-obstacles',
  'disconnected-waterway',
  'flooded-route',
  'ruined-route',
  'blocked-land-route',
  'depleted',
] as const;
export type DeliveryIssue = (typeof DELIVERY_ISSUES)[number];
export interface TempleEngineering {
  stability: number;
  relief: number[];
  reliefComplete: boolean;
}
