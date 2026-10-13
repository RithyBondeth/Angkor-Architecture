import { BUILDINGS } from '../data/buildings';
import { CONFIG } from '../data/config';
import { WaterSimulation } from '../simulation/WaterSimulation';
import { Logistics } from '../simulation/Logistics';
import { SeasonManager } from './SeasonManager';
import { buildingAt, footprint, tileAt } from './world';
import type { Building, BuildingKind, GameState, PlacementResult, Point, Resource } from './types';

export class Game {
  private readonly water = new WaterSimulation();
  private readonly logistics = new Logistics();
  private readonly listeners = new Set<() => void>();
  constructor(public state: GameState) {}
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  notify() {
    for (const listener of this.listeners) listener();
  }
  step() {
    const oldSeason = SeasonManager.at(this.state.day).wet;
    this.state.tick++;
    if (this.state.tick % CONFIG.ticksPerDay === 0) this.state.day++;
    this.water.step(this.state);
    this.logistics.step(this.state);
    if (oldSeason !== SeasonManager.at(this.state.day).wet) {
      const season = SeasonManager.at(this.state.day);
      this.log(
        season.wet ? 'The monsoon returns' : 'The dry season begins',
        season.wet
          ? 'Your reservoirs are filling. Watch the water around your fields.'
          : 'The rains have passed. Stored water will sustain your city.',
        season.wet ? 'cloud-rain' : 'sun',
      );
    }
    if (
      !this.state.objectivesClaimed &&
      ['canal', 'paddy', 'baray'].every((k) => (this.state.built[k as BuildingKind] ?? 0) > 0)
    ) {
      this.state.objectivesClaimed = true;
      this.state.resources.merit += 50;
      this.log(
        'A city sustained by water',
        'Your first royal commission is complete. The sovereign grants you 50 merit.',
        'seal-check',
      );
    }
    this.notify();
  }
  setSpeed(speed: 0 | 1 | 2 | 4) {
    this.state.speed = speed;
    this.notify();
  }
  canPlace(kind: BuildingKind, p: Point): PlacementResult {
    const def = BUILDINGS[kind];
    const cells = footprint({ ...p, kind });
    if (cells.some((c) => !tileAt(this.state, c.x, c.y)))
      return { ok: false, message: 'Choose a site inside the kingdom.' };
    if (
      cells.some((c) => {
        const existing = buildingAt(this.state, c.x, c.y);
        return existing && !(kind === 'gate' && existing.kind === 'canal');
      })
    )
      return { ok: false, message: 'There is already a building on this site.' };
    if (kind === 'gate') {
      if (tileAt(this.state, p.x, p.y)!.terrain !== 'canal')
        return { ok: false, message: 'Floodgates must be placed on an existing canal.' };
    } else if (
      cells.some((c) =>
        ['water', 'reservoir', 'canal', 'road'].includes(tileAt(this.state, c.x, c.y)!.terrain),
      )
    ) {
      return { ok: false, message: 'Choose clear land away from waterways and roads.' };
    }
    if (
      kind !== 'canal' &&
      kind !== 'baray' &&
      kind !== 'gate' &&
      cells.some((c) => tileAt(this.state, c.x, c.y)!.water > 0.8)
    )
      return { ok: false, message: 'This land is flooded. Choose a drier site.' };
    if (
      kind === 'dock' &&
      !cells.some((c) =>
        this.state.tiles.some(
          (t) =>
            ['water', 'canal'].includes(t.terrain) &&
            Math.abs(t.x - c.x) + Math.abs(t.y - c.y) <= 2,
        ),
      )
    )
      return { ok: false, message: 'Place a landing within two tiles of a waterway.' };
    for (const [key, cost] of Object.entries(def.cost))
      if (this.state.resources[key as Resource] < cost)
        return { ok: false, message: `Not enough ${key} to build this.` };
    const labor = Logistics.workforce(this.state);
    if (def.workers > labor.total - labor.assigned)
      return { ok: false, message: 'Build more dwellings to grow your available workforce.' };
    return { ok: true, message: `Click to build ${def.name.toLowerCase()}.` };
  }
  place(kind: BuildingKind, p: Point): PlacementResult {
    const result = this.canPlace(kind, p);
    if (!result.ok) return result;
    const def = BUILDINGS[kind];
    for (const [key, cost] of Object.entries(def.cost))
      this.state.resources[key as Resource] -= cost;
    if (kind === 'gate')
      this.state.buildings = this.state.buildings.filter(
        (b) => !(b.kind === 'canal' && b.x === p.x && b.y === p.y),
      );
    const building: Building = {
      ...p,
      id: `b${this.state.nextId++}`,
      kind,
      level: 1,
      enabled: true,
      stock: 0,
    };
    this.state.buildings.push(building);
    this.state.built[kind] = (this.state.built[kind] ?? 0) + 1;
    for (const c of footprint(building)) {
      const t = tileAt(this.state, c.x, c.y)!;
      if (kind === 'baray' || kind === 'canal') {
        t.terrain = kind === 'baray' ? 'reservoir' : 'canal';
        t.elevation = kind === 'baray' ? -1 : -0.8;
      } else if (kind !== 'gate') t.terrain = 'grass';
    }
    if (kind === 'house') this.state.population += 8;
    this.log(
      `${def.name} established`,
      `A new ${def.name.toLowerCase()} joins your settlement.`,
      def.icon,
    );
    this.notify();
    return { ok: true, message: `${def.name} built. Select another site or press Escape.` };
  }
  toggleBuilding(id: string) {
    const b = this.state.buildings.find((b) => b.id === id);
    if (b) {
      b.enabled = !b.enabled;
      this.notify();
    }
  }
  upgrade(id: string): PlacementResult {
    const b = this.state.buildings.find((b) => b.id === id);
    if (!b || b.kind !== 'temple' || b.level >= 3)
      return { ok: false, message: 'This monument is already complete.' };
    const cost = b.level * 80;
    if (this.state.resources.sandstone < cost || this.state.resources.laterite < 30)
      return { ok: false, message: `The next stage needs ${cost} sandstone and 30 laterite.` };
    if (WaterSimulation.irrigation(this.state, b.x, b.y, 4) < 0.2)
      return {
        ok: false,
        message: 'Connect a waterway near the temple to stabilize its foundation.',
      };
    this.state.resources.sandstone -= cost;
    this.state.resources.laterite -= 30;
    b.level++;
    this.log(
      'A monument rises',
      b.level === 3
        ? 'The sculpted sanctuary is complete. Its merit will carry your city forward.'
        : 'The sandstone superstructure rises above its laterite foundation.',
      'bank',
    );
    this.notify();
    return { ok: true, message: 'Temple construction advanced.' };
  }
  log(title: string, text: string, icon: string) {
    this.state.chronicle.unshift({ tick: this.state.tick, title, text, icon });
    this.state.chronicle = this.state.chronicle.slice(0, 30);
  }
}
