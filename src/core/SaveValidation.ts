import { RESERVOIR_HISTORY_DAYS } from '../simulation/ReservoirHistory';
import { BUILDINGS } from '../data/buildings';
import { CONFIG } from '../data/config';
import { completedBuilding, initialInvestment, registerInfrastructure } from './buildingState';
import { footprint } from './world';
import { workforce } from '../simulation/Workforce';
import { freshSurvival } from './survivalState';
import { freshProgression } from './progressionState';
import { commissionsFor, isScenarioId } from '../data/scenarios';
import { freshEngineering, RELIEF_TARGET } from '../simulation/TempleEngineering';
import { seedDeposits } from '../simulation/Deposits';
import { DELIVERY_ISSUES } from './types';
import type { Building, GameState } from './types';

const resources = ['rice', 'wood', 'sandstone', 'laterite', 'merit'];
const terrains = ['grass', 'forest', 'moat', 'water', 'canal', 'reservoir', 'road', 'bridge'];
const finite = (n: unknown, min = 0, max = 1e8): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
const integer = (n: unknown, min = 0, max = 1e8): n is number =>
  finite(n, min, max) && Number.isInteger(n);
const record = (n: unknown): n is Record<string, unknown> =>
  typeof n === 'object' && n !== null && !Array.isArray(n);

/** Validate untrusted local JSON before it can reach the simulation or DOM. */
function validateShape(value: unknown, version: 1 | 2 | 3 | 4 | 5 | 6 = 6): boolean {
  if (!record(value)) return false;
  const s = value as unknown as GameState;
  if (value.scenario !== undefined && !isScenarioId(value.scenario)) return false;
  if (value.tutorial !== undefined) {
    const t = value.tutorial;
    const siteId = (id: unknown) => id === null || (typeof id === 'string' && /^b\d+$/.test(id));
    if (
      !record(t) ||
      !['active', 'skipped', 'completed'].includes(t.status as string) ||
      !integer(t.step, 0, 6) ||
      !siteId(t.canalId) ||
      !siteId(t.paddyId) ||
      typeof t.inspected !== 'boolean' ||
      typeof t.delivered !== 'boolean' ||
      (t.status === 'completed' ? t.step !== 6 : t.step === 6)
    )
      return false;
  }
  if (
    value.version !== version ||
    !integer(s.width, 8, 64) ||
    !integer(s.height, 8, 64) ||
    !integer(s.seed) ||
    !integer(s.nextId, 1) ||
    !integer(s.tick) ||
    !integer(s.day, 1) ||
    !integer(s.population, 0, 100_000) ||
    !finite(s.happiness, 0, 100) ||
    ![0, 1, 2, 4].includes(s.speed)
  )
    return false;
  if (
    version >= 3 &&
    (!record(s.survival) ||
      !finite(s.survival.hunger, 0, 100) ||
      !integer(s.survival.shortageDays) ||
      !integer(s.survival.fedDays) ||
      !finite(s.survival.lastFoodCoverage, 0, 1) ||
      !integer(s.survival.departed))
  )
    return false;
  if (
    !record(s.resources) ||
    !resources.every((k) => finite(s.resources[k as keyof typeof s.resources], 0, 99999))
  )
    return false;
  if (
    version >= 6 &&
    (!record(s.feedback) ||
      !integer(s.feedback.sinceTick, 0, s.tick) ||
      !Array.isArray(s.feedback.receipts) ||
      s.feedback.receipts.length > 2500 ||
      !s.feedback.receipts.every(
        (r) =>
          record(r) &&
          integer(r.tick, s.feedback.sinceTick, s.tick) &&
          resources.includes(r.resource) &&
          finite(r.amount, 0, 1e8),
      ))
  )
    return false;
  if (version >= 5 && (!record(s.logistics) || !integer(s.logistics.dispatchCursor))) return false;
  if (!Array.isArray(s.tiles) || s.tiles.length !== s.width * s.height) return false;
  if (
    !s.tiles.every(
      (t, i) =>
        record(t) &&
        t.x === i % s.width &&
        t.y === Math.floor(i / s.width) &&
        terrains.includes(t.terrain) &&
        finite(t.elevation, -20, 100) &&
        finite(t.water, 0, 1000) &&
        finite(t.fertility, 0, 1) &&
        integer(t.variant, 0, 4) &&
        (version < 5 ||
          (finite(t.timber, 0, 10000) &&
            (t.mineral === null ||
              (record(t.mineral) &&
                ['sandstone', 'laterite'].includes(t.mineral.resource) &&
                finite(t.mineral.remaining, 0, 100000))))),
    )
  )
    return false;
  if (!Array.isArray(s.buildings) || s.buildings.length > s.tiles.length) return false;
  const ids = new Set<string>();
  const occupied = new Set<number>();
  for (const b of s.buildings) {
    if (
      !record(b) ||
      typeof b.id !== 'string' ||
      !/^b\d+$/.test(b.id) ||
      ids.has(b.id) ||
      !Object.hasOwn(BUILDINGS, b.kind) ||
      !integer(b.x, 0, s.width - 1) ||
      !integer(b.y, 0, s.height - 1) ||
      !integer(b.level, 1, 3) ||
      typeof b.enabled !== 'boolean' ||
      !finite(b.stock, 0, version >= 5 ? CONFIG.maxResource : 1000)
    )
      return false;
    if (Number(b.id.slice(1)) >= s.nextId) return false;
    ids.add(b.id);
    if (version !== 1 && !validateBuildingMeta(b, s, ids, version)) return false;
    const size = BUILDINGS[b.kind].size;
    if (b.x + size > s.width || b.y + size > s.height) return false;
    for (let y = b.y; y < b.y + size; y++)
      for (let x = b.x; x < b.x + size; x++) {
        const key = y * s.width + x;
        if (occupied.has(key)) return false;
        occupied.add(key);
      }
  }
  if (value.reservoirHistory !== undefined) {
    if (
      !Array.isArray(value.reservoirHistory) ||
      value.reservoirHistory.length > Math.floor(s.tiles.length / 16)
    )
      return false;
    const historyIds = new Set<string>();
    for (const h of value.reservoirHistory) {
      if (
        !record(h) ||
        typeof h.id !== 'string' ||
        historyIds.has(h.id) ||
        !s.buildings.some(
          (b) => b.id === h.id && b.kind === 'baray' && b.construction?.type !== 'build',
        ) ||
        !Array.isArray(h.samples) ||
        h.samples.length > RESERVOIR_HISTORY_DAYS
      )
        return false;
      historyIds.add(h.id);
      let previousTick = -1,
        previousDay = 0;
      for (const sample of h.samples) {
        if (
          !record(sample) ||
          !integer(sample.tick, 0, s.tick) ||
          !integer(sample.day, 1, s.day) ||
          sample.tick <= previousTick ||
          sample.day <= previousDay ||
          !finite(sample.depth, 0, 1000)
        )
          return false;
        previousTick = sample.tick;
        previousDay = sample.day;
      }
    }
  }
  if (version >= 3 && workforce(s).assigned > workforce(s).total) return false;
  if (!Array.isArray(s.couriers) || s.couriers.length > 36) return false;
  for (const c of s.couriers) {
    if (
      !record(c) ||
      typeof c.id !== 'string' ||
      !/^c\d+$/.test(c.id) ||
      ids.has(c.id) ||
      Number(c.id.slice(1)) >= s.nextId ||
      typeof c.sourceId !== 'string' ||
      !s.buildings.some(
        (b) => b.id === c.sourceId && BUILDINGS[b.kind].production?.resource === c.resource,
      ) ||
      !['worker', 'barge'].includes(c.kind) ||
      (version >= 5 &&
        (typeof c.targetId !== 'string' ||
          !s.buildings.some(
            (b) =>
              b.id === c.targetId &&
              (c.kind === 'barge' ? b.kind === 'dock' : ['house', 'warehouse'].includes(b.kind)),
          ))) ||
      !resources.includes(c.resource) ||
      !finite(c.amount, 0, 1000) ||
      !Array.isArray(c.path) ||
      c.path.length < (version >= 5 ? 1 : 2) ||
      c.path.length > s.tiles.length ||
      !finite(c.progress, 0, c.path.length)
    )
      return false;
    if (
      !c.path.every(
        (p, i) =>
          record(p) &&
          integer(p.x, 0, s.width - 1) &&
          integer(p.y, 0, s.height - 1) &&
          (i === 0 || Math.abs(p.x - c.path[i - 1]!.x) + Math.abs(p.y - c.path[i - 1]!.y) === 1),
      )
    )
      return false;
    ids.add(c.id);
  }
  if (
    !Array.isArray(s.chronicle) ||
    s.chronicle.length > 30 ||
    !s.chronicle.every(
      (e) =>
        record(e) &&
        integer(e.tick) &&
        typeof e.title === 'string' &&
        e.title.length < 300 &&
        typeof e.text === 'string' &&
        e.text.length < 2000 &&
        typeof e.icon === 'string' &&
        /^[a-z-]+$/.test(e.icon),
    )
  )
    return false;
  return (
    record(s.built) &&
    Object.entries(s.built).every(([k, n]) => Object.hasOwn(BUILDINGS, k) && integer(n, 0, 4096)) &&
    (version >= 4 ? validProgression(s) : typeof value.objectivesClaimed === 'boolean')
  );
}

function validProgression(s: GameState): boolean {
  const p = s.progression;
  const commissions = commissionsFor(s);
  if (
    !record(p) ||
    !finite(p.meritPeak, 0, CONFIG.maxResource) ||
    !Array.isArray(p.claimed) ||
    p.claimed.length > commissions.length ||
    !p.claimed.every((id, index) => id === commissions[index]!.id) ||
    !record(p.delivered) ||
    !Object.entries(p.delivered).every(([r, n]) => resources.includes(r) && finite(n)) ||
    !integer(p.lastDayTick, 0, s.tick) ||
    !integer(p.streakDays, 0, 7)
  )
    return false;
  const goal = commissions[p.claimed.length]?.goals.find((g) => g.type === 'sustain');
  return goal ? p.streakDays <= goal.target : p.streakDays === 0;
}

function validCost(value: unknown): boolean {
  return (
    record(value) &&
    Object.entries(value).every(([key, n]) => resources.includes(key) && integer(n, 0, 99999))
  );
}
function validateBuildingMeta(
  b: Building,
  s: GameState,
  ids: Set<string>,
  version: 2 | 3 | 4 | 5 | 6,
): boolean {
  if (version >= 6) {
    const e = b.engineering;
    if (b.kind === 'temple') {
      if (
        !record(e) ||
        !finite(e.stability, 0, 100) ||
        !Array.isArray(e.relief) ||
        e.relief.length !== 9 ||
        !e.relief.every((r) => integer(r, 0, 3)) ||
        typeof e.reliefComplete !== 'boolean' ||
        (e.reliefComplete && !e.relief.every((r, i) => r === RELIEF_TARGET[i]))
      )
        return false;
    } else if (e !== null) return false;
  }
  if (version >= 5 && b.deliveryIssue !== null && !DELIVERY_ISSUES.includes(b.deliveryIssue))
    return false;
  if (version >= 3) {
    if (!finite(b.condition, 0, 100)) return false;
    if (b.kind === 'paddy') {
      if (!record(b.crop) || !finite(b.crop.stress, 0, 100) || typeof b.crop.failed !== 'boolean')
        return false;
    } else if (b.crop !== null) return false;
  }
  const size = BUILDINGS[b.kind].size;
  if (
    !validCost(b.investment) ||
    !Array.isArray(b.terrainBefore) ||
    b.terrainBefore.length !== size * size
  )
    return false;
  const cells = new Set<number>();
  for (const t of b.terrainBefore) {
    if (
      !record(t) ||
      !integer(t.x, b.x, b.x + size - 1) ||
      !integer(t.y, b.y, b.y + size - 1) ||
      !terrains.includes(t.terrain) ||
      !finite(t.elevation, -20, 100)
    )
      return false;
    const key = t.y * s.width + t.x;
    if (cells.has(key)) return false;
    cells.add(key);
  }
  if (b.construction !== null) {
    const p = b.construction;
    if (
      !record(p) ||
      !(version >= 3 ? ['build', 'upgrade', 'repair'] : ['build', 'upgrade']).includes(p.type) ||
      !integer(p.workRequired, 1, 10000) ||
      !finite(p.workDone, 0, p.workRequired) ||
      p.workDone >= p.workRequired ||
      !integer(p.builders, 0, CONFIG.maxBuildersPerProject) ||
      typeof p.paused !== 'boolean' ||
      (p.paused && p.builders !== 0) ||
      !validCost(p.cost)
    )
      return false;
    if (p.type === 'upgrade' && (b.kind !== 'temple' || b.level >= 3)) return false;
  }
  if (b.underlay !== null) {
    const u = b.underlay;
    if (
      !['bridge', 'gate'].includes(b.kind) ||
      !record(u) ||
      !['canal', 'moat'].includes(u.kind) ||
      u.construction !== null ||
      u.underlay !== null ||
      u.x !== b.x ||
      u.y !== b.y ||
      u.level !== 1 ||
      typeof u.enabled !== 'boolean' ||
      !finite(u.stock, 0, 1000) ||
      typeof u.id !== 'string' ||
      !/^b\d+$/.test(u.id) ||
      ids.has(u.id) ||
      Number(u.id.slice(1)) >= s.nextId
    )
      return false;
    ids.add(u.id);
    if (!validateBuildingMeta(u, s, ids, version)) return false;
  }
  return true;
}
export function validateState(value: unknown): value is GameState {
  return validateShape(value);
}

/** Upgrade instant-building saves without restarting the player's settlement. */
export function readGameState(value: unknown): GameState | null {
  if (validateState(value)) return structuredClone(value);
  if (
    !record(value) ||
    (value.version !== 1 &&
      value.version !== 2 &&
      value.version !== 3 &&
      value.version !== 4 &&
      value.version !== 5) ||
    !validateShape(value, value.version)
  )
    return null;
  const state = structuredClone(value) as unknown as GameState;
  const legacy = value.version === 1;
  state.version = 6;
  state.feedback = { sinceTick: state.tick, receipts: [] };
  for (const b of state.buildings) {
    b.engineering = b.kind === 'temple' ? freshEngineering(b.level >= 3) : null;
    if (b.underlay) b.underlay.engineering = null;
  }
  if (value.version === 5) return validateState(state) ? state : null;
  state.logistics = { dispatchCursor: 0 };
  seedDeposits(state);
  for (const b of state.buildings) {
    b.deliveryIssue = null;
    if (b.underlay) b.underlay.deliveryIssue = null;
  }
  if (value.version < 4) {
    state.progression = freshProgression(state.resources.merit, state.tick);
    if (value.objectivesClaimed === true) state.progression.claimed.push('water-foundation');
    delete (state as unknown as Record<string, unknown>).objectivesClaimed;
  }
  state.couriers = state.couriers.filter((c) => {
    const end = c.path[c.path.length - 1]!;
    const target = state.buildings
      .filter(
        (b) =>
          b.enabled &&
          !b.construction &&
          (b.condition === undefined || b.condition > 0) &&
          (c.kind === 'barge' ? b.kind === 'dock' : b.kind === 'house'),
      )
      .sort(
        (a, b) =>
          Math.abs(a.x - end.x) +
          Math.abs(a.y - end.y) -
          Math.abs(b.x - end.x) -
          Math.abs(b.y - end.y),
      )[0];
    if (target) {
      c.targetId = target.id;
      return true;
    }
    const source = state.buildings.find((b) => b.id === c.sourceId);
    if (source) source.stock += c.amount;
    return false;
  });
  if (value.version >= 3) return validateState(state) ? state : null;
  state.survival = freshSurvival();
  for (const b of state.buildings) {
    b.condition = 100;
    b.crop = b.kind === 'paddy' ? { stress: 0, failed: false } : null;
    if (!legacy) {
      if (b.underlay) {
        b.underlay.condition = 100;
        b.underlay.crop = null;
      }
      continue;
    }
    b.construction = null;
    b.investment = initialInvestment(b.kind, b.level);
    b.underlay = null;
    b.terrainBefore = footprint(b).map((p) => ({
      ...p,
      terrain: b.kind === 'gate' ? 'canal' : 'grass',
      elevation:
        b.kind === 'gate'
          ? state.tiles[p.y * state.width + p.x]!.elevation
          : Math.max(2.6, state.tiles[p.y * state.width + p.x]!.elevation),
    }));
    if (b.kind === 'gate') {
      const canal = completedBuilding(state, 'canal', b.x, b.y);
      canal.terrainBefore = [{ x: b.x, y: b.y, terrain: 'grass', elevation: 2.6 }];
      b.underlay = canal;
    }
  }
  if (legacy) registerInfrastructure(state);
  return validateState(state) ? state : null;
}
