import { BUILDINGS } from '../data/buildings';
import { CONFIG } from '../data/config';
import { WaterSimulation } from '../simulation/WaterSimulation';
import { Logistics } from '../simulation/Logistics';
import { Construction } from '../simulation/Construction';
import { reconcileBuilders, workforce } from '../simulation/Workforce';
import { SeasonManager } from './SeasonManager';
import { buildingAt, footprint, tileAt } from './world';
import { captureTerrain } from './buildingState';
import { Survival } from '../simulation/Survival';
import { floodUnsafe, housingCapacity, repairCost } from '../simulation/survivalRules';
import { Progression } from '../simulation/Progression';
import { buildingUnlocked, earnedMerit, templeUpgradeMerit } from './progressionState';
import type {
  Building,
  BuildingKind,
  ConstructionProject,
  GameState,
  PlacementResult,
  Point,
  Resource,
  Resources,
} from './types';

export class Game {
  private readonly water = new WaterSimulation();
  private readonly logistics = new Logistics();
  private readonly construction = new Construction();
  private readonly survival = new Survival();
  private readonly progression = new Progression();
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
    for (const e of this.survival.environment(this.state)) this.log(e.title, e.text, e.icon);
    for (const b of this.construction.step(this.state))
      this.log(
        `${BUILDINGS[b.kind].name} completed`,
        `${BUILDINGS[b.kind].name} is ready to serve your city.`,
        'hammer',
      );
    this.logistics.step(this.state);
    for (const e of this.survival.food(this.state)) this.log(e.title, e.text, e.icon);
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
    for (const e of this.progression.step(this.state)) this.log(e.title, e.text, e.icon);
    this.notify();
  }
  setSpeed(speed: 0 | 1 | 2 | 4) {
    this.state.speed = speed;
    this.notify();
  }
  canPlace(kind: BuildingKind, p: Point): PlacementResult {
    if (!buildingUnlocked(this.state, kind))
      return {
        ok: false,
        message: `${BUILDINGS[kind].name} unlocks at ${BUILDINGS[kind].unlockMerit} merit. Earn merit through temples and royal commissions.`,
      };
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y))
      return { ok: false, message: 'Choose a whole tile inside the kingdom.' };
    const def = BUILDINGS[kind];
    const cells = footprint({ ...p, kind });
    if (cells.some((c) => !tileAt(this.state, c.x, c.y)))
      return { ok: false, message: 'Choose a site inside the kingdom.' };
    if (
      cells.some((c) => {
        const b = buildingAt(this.state, c.x, c.y);
        return b && !(['gate', 'bridge'].includes(kind) && b.kind === 'canal' && !b.construction);
      })
    )
      return { ok: false, message: 'There is already a building or project on this site.' };
    const tile = tileAt(this.state, p.x, p.y)!;
    if (kind === 'gate') {
      if (tile.terrain !== 'canal')
        return { ok: false, message: 'Floodgates must be placed on a completed canal.' };
    } else if (kind === 'bridge') {
      if (!['water', 'canal'].includes(tile.terrain))
        return {
          ok: false,
          message: 'Place a timber bridge over a river or completed canal tile.',
        };
    } else if (
      cells.some((c) =>
        ['water', 'reservoir', 'canal', 'road', 'bridge'].includes(
          tileAt(this.state, c.x, c.y)!.terrain,
        ),
      )
    )
      return { ok: false, message: 'Choose clear land away from waterways and roads.' };
    if (
      !['canal', 'baray', 'gate', 'bridge'].includes(kind) &&
      cells.some((c) => tileAt(this.state, c.x, c.y)!.water > 0.8)
    )
      return { ok: false, message: 'This land is flooded. Choose a drier site.' };
    if (
      kind === 'dock' &&
      !cells.some((c) =>
        this.state.tiles.some(
          (t) =>
            ['water', 'canal', 'bridge'].includes(t.terrain) &&
            Math.abs(t.x - c.x) + Math.abs(t.y - c.y) <= 2,
        ),
      )
    )
      return { ok: false, message: 'Place a landing within two tiles of a waterway.' };
    for (const [key, cost] of Object.entries(def.cost))
      if (this.state.resources[key as Resource] < cost)
        return { ok: false, message: `Not enough ${key} to start this project.` };
    return {
      ok: true,
      message: `Click to start ${def.name.toLowerCase()}${workforce(this.state).available === 0 ? ' (waiting for builders)' : ''}.`,
    };
  }
  private project(
    type: ConstructionProject['type'],
    cost: Partial<Resources>,
    workRequired: number,
    preferred: number,
  ): ConstructionProject {
    return {
      type,
      cost: { ...cost },
      workDone: 0,
      workRequired,
      builders: Math.min(preferred, workforce(this.state).available),
      paused: false,
    };
  }
  private pay(cost: Partial<Resources>) {
    for (const [r, n] of Object.entries(cost)) this.state.resources[r as Resource] -= n;
  }
  place(kind: BuildingKind, p: Point): PlacementResult {
    const result = this.canPlace(kind, p);
    if (!result.ok) return result;
    const def = BUILDINGS[kind];
    const underlay = ['gate', 'bridge'].includes(kind)
      ? (buildingAt(this.state, p.x, p.y) ?? null)
      : null;
    const building: Building = {
      ...p,
      id: `b${this.state.nextId++}`,
      kind,
      level: 1,
      enabled: true,
      stock: 0,
      condition: 100,
      crop: kind === 'paddy' ? { stress: 0, failed: false } : null,
      construction: this.project('build', def.cost, def.buildWork, def.builders),
      investment: {},
      terrainBefore: captureTerrain(this.state, kind, p.x, p.y),
      underlay,
    };
    this.pay(def.cost);
    if (underlay) this.state.buildings = this.state.buildings.filter((b) => b.id !== underlay.id);
    this.state.buildings.push(building);
    this.log(
      `${def.name} planned`,
      building.construction!.builders
        ? `Builders are preparing the new ${def.name.toLowerCase()}.`
        : 'The site is reserved. Assign available builders to begin work.',
      'hammer',
    );
    this.notify();
    return {
      ok: true,
      message: `${def.name} project started. Click the site to manage its builders.`,
    };
  }
  assignBuilders(id: string, count: number): PlacementResult {
    const b = this.state.buildings.find((b) => b.id === id);
    const p = b?.construction;
    if (!p) return { ok: false, message: 'Choose an active construction project.' };
    if (p.paused) return { ok: false, message: 'Resume this project before assigning builders.' };
    if (!Number.isInteger(count) || count < 0 || count > CONFIG.maxBuildersPerProject)
      return {
        ok: false,
        message: `Assign between 0 and ${CONFIG.maxBuildersPerProject} builders.`,
      };
    if (count > p.builders + workforce(this.state).available)
      return {
        ok: false,
        message: 'No free workers. Release builders from another project or pause production.',
      };
    p.builders = count;
    this.notify();
    return {
      ok: true,
      message: count
        ? `${count} builders assigned.`
        : 'Builders released. This project is waiting.',
    };
  }
  pauseProject(id: string): PlacementResult {
    const b = this.state.buildings.find((b) => b.id === id);
    const p = b?.construction;
    if (!p || !b) return { ok: false, message: 'This project is already complete.' };
    if (p.paused) {
      const builders = Math.min(BUILDINGS[b.kind].builders, workforce(this.state).available);
      if (!builders)
        return {
          ok: false,
          message: 'No free workers. Release builders or pause production first.',
        };
      p.paused = false;
      p.builders = builders;
    } else {
      p.paused = true;
      p.builders = 0;
    }
    this.notify();
    return {
      ok: true,
      message: p.paused
        ? 'Construction paused. Builders are available for other work.'
        : 'Construction resumed.',
    };
  }
  toggleBuilding(id: string) {
    const b = this.state.buildings.find((b) => b.id === id);
    if (b && !b.construction) {
      b.enabled = !b.enabled;
      reconcileBuilders(this.state);
      this.notify();
    }
  }
  upgrade(id: string): PlacementResult {
    const b = this.state.buildings.find((b) => b.id === id);
    if (!b || b.kind !== 'temple' || b.level >= 3)
      return { ok: false, message: 'This monument is already complete.' };
    if (b.construction)
      return { ok: false, message: 'Finish the current project before starting another stage.' };
    if (b.condition < 100)
      return { ok: false, message: 'Repair flood damage before upgrading the sanctuary.' };
    if (earnedMerit(this.state) < templeUpgradeMerit(b.level))
      return {
        ok: false,
        message: `The sculpted sanctuary unlocks at ${templeUpgradeMerit(b.level)} merit.`,
      };
    const cost = { sandstone: b.level * 80, laterite: 30 };
    if (this.state.resources.sandstone < cost.sandstone || this.state.resources.laterite < 30)
      return {
        ok: false,
        message: `The next stage needs ${cost.sandstone} sandstone and 30 laterite.`,
      };
    if (WaterSimulation.irrigation(this.state, b.x, b.y, 4) < 0.2)
      return {
        ok: false,
        message: 'Connect a waterway near the temple to stabilize its foundation.',
      };
    this.pay(cost);
    b.construction = {
      type: 'upgrade',
      cost,
      workDone: 0,
      workRequired: 120 * b.level,
      builders: 0,
      paused: false,
    };
    b.construction.builders = Math.min(BUILDINGS.temple.builders, workforce(this.state).available);
    this.log(
      'A new temple stage begins',
      'Builders are preparing the next stage of your sanctuary.',
      'bank',
    );
    this.notify();
    return { ok: true, message: 'Temple construction started. Assign builders at the sanctuary.' };
  }
  refundFor(id: string, cancelOnly = false): Partial<Resources> {
    const b = this.state.buildings.find((b) => b.id === id);
    if (!b) return {};
    const refund: Partial<Resources> = {};
    const add = (cost: Partial<Resources>, rate: number) => {
      for (const [key, n] of Object.entries(cost)) {
        const r = key as Resource;
        refund[r] = (refund[r] ?? 0) + Math.floor(n * rate);
      }
    };
    if (!cancelOnly) add(b.investment, (CONFIG.demolitionRefund * b.condition) / 100);
    if (b.construction)
      add(
        b.construction.cost,
        1 - ((1 - CONFIG.demolitionRefund) * b.construction.workDone) / b.construction.workRequired,
      );
    if (!cancelOnly) {
      const resource = BUILDINGS[b.kind].production?.resource;
      if (resource && b.stock) add({ [resource]: b.stock }, 1);
      for (const c of this.state.couriers)
        if (c.sourceId === id) add({ [c.resource]: c.amount }, 1);
    }
    for (const [key, amount] of Object.entries(refund)) {
      const resource = key as Resource;
      refund[resource] = Math.min(amount, CONFIG.maxResource - this.state.resources[resource]);
    }
    return refund;
  }
  private credit(refund: Partial<Resources>) {
    for (const [r, n] of Object.entries(refund))
      this.state.resources[r as Resource] = Math.min(
        CONFIG.maxResource,
        this.state.resources[r as Resource] + n,
      );
  }
  cancelConstruction(id: string): PlacementResult {
    const b = this.state.buildings.find((b) => b.id === id);
    if (!b?.construction)
      return {
        ok: false,
        message:
          'This project has already finished. Inspect it to demolish the completed building.',
      };
    if (b.construction.type === 'build') return this.demolish(id);
    const repair = b.construction.type === 'repair';
    this.credit(this.refundFor(id, true));
    b.construction = null;
    reconcileBuilders(this.state);
    this.log(
      repair ? 'Repairs canceled' : 'Temple upgrade canceled',
      repair
        ? 'The structure retains its current damage. Unused repair materials were recovered.'
        : 'The existing sanctuary remains. Unused construction materials were recovered.',
      'hammer',
    );
    this.notify();
    return {
      ok: true,
      message: repair
        ? 'Repairs canceled. Remaining damage still affects the structure.'
        : 'Upgrade canceled. The existing sanctuary is operational.',
    };
  }
  repair(id: string): PlacementResult {
    const b = this.state.buildings.find((b) => b.id === id);
    if (!b || b.condition === 100) return { ok: false, message: 'Choose a damaged structure.' };
    if (b.construction)
      return { ok: false, message: 'Finish or cancel the current project first.' };
    if (floodUnsafe(this.state, b))
      return { ok: false, message: 'Wait for floodwater to recede before starting repairs.' };
    const cost = repairCost(b);
    for (const [r, n] of Object.entries(cost))
      if (this.state.resources[r as Resource] < n)
        return { ok: false, message: `Repairs need more ${r}.` };
    this.pay(cost);
    b.construction = {
      type: 'repair',
      cost,
      workDone: 0,
      workRequired: Math.max(8, Math.ceil((100 - b.condition) * 2)),
      builders: 0,
      paused: false,
    };
    b.construction.builders = Math.min(BUILDINGS[b.kind].builders, workforce(this.state).available);
    this.log(
      'Repairs begin',
      `Builders are restoring ${BUILDINGS[b.kind].name.toLowerCase()}.`,
      'hammer',
    );
    this.notify();
    return { ok: true, message: 'Repair project started. Assign builders to restore condition.' };
  }
  demolish(id: string): PlacementResult {
    const b = this.state.buildings.find((b) => b.id === id);
    if (!b) return { ok: false, message: 'There is no structure here to remove.' };
    const pendingBuild = b.construction?.type === 'build';
    this.credit(this.refundFor(id));
    this.state.buildings = this.state.buildings.filter((item) => item.id !== id);
    this.state.couriers = this.state.couriers.filter((c) => c.sourceId !== id);
    for (const before of b.terrainBefore) {
      const tile = tileAt(this.state, before.x, before.y)!;
      tile.terrain =
        before.terrain === 'forest' && (!pendingBuild || (b.construction?.workDone ?? 0) > 0)
          ? 'grass'
          : before.terrain;
      tile.elevation = before.elevation;
    }
    if (b.underlay) this.state.buildings.push(b.underlay);
    if (b.kind === 'house' && !pendingBuild)
      this.state.population -= Math.min(
        8,
        b.condition > 0
          ? this.state.population
          : Math.max(0, this.state.population - housingCapacity(this.state)),
      );
    reconcileBuilders(this.state);
    this.log(
      pendingBuild ? 'Construction canceled' : `${BUILDINGS[b.kind].name} removed`,
      'Recoverable materials have been returned to the city.',
      'hammer',
    );
    this.notify();
    return {
      ok: true,
      message: pendingBuild
        ? 'Project canceled. Materials refunded and builders released.'
        : 'Structure removed. Materials recovered.',
    };
  }
  log(title: string, text: string, icon: string) {
    this.state.chronicle.unshift({ tick: this.state.tick, title, text, icon });
    this.state.chronicle = this.state.chronicle.slice(0, 30);
  }
}
