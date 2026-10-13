import { BUILDINGS } from '../data/buildings';
import type { GameState, SaveEnvelope } from './types';

const SAVE_KEY = 'angkor-architect:save:v1';
const resources = ['rice', 'wood', 'sandstone', 'laterite', 'merit'];
const terrains = ['grass', 'forest', 'water', 'canal', 'reservoir', 'road'];
const finite = (n: unknown, min = 0, max = 1e8): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
const integer = (n: unknown, min = 0, max = 1e8): n is number =>
  finite(n, min, max) && Number.isInteger(n);
const record = (n: unknown): n is Record<string, unknown> =>
  typeof n === 'object' && n !== null && !Array.isArray(n);

/** Validate untrusted local JSON before it can reach the simulation or DOM. */
export function validateState(value: unknown): value is GameState {
  if (!record(value)) return false;
  const s = value as unknown as GameState;
  if (
    s.version !== 1 ||
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
    !record(s.resources) ||
    !resources.every((k) => finite(s.resources[k as keyof typeof s.resources], 0, 99999))
  )
    return false;
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
        integer(t.variant, 0, 4),
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
      !finite(b.stock, 0, 1000)
    )
      return false;
    if (Number(b.id.slice(1)) >= s.nextId) return false;
    ids.add(b.id);
    const size = BUILDINGS[b.kind].size;
    if (b.x + size > s.width || b.y + size > s.height) return false;
    for (let y = b.y; y < b.y + size; y++)
      for (let x = b.x; x < b.x + size; x++) {
        const key = y * s.width + x;
        if (occupied.has(key)) return false;
        occupied.add(key);
      }
  }
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
      !resources.includes(c.resource) ||
      !finite(c.amount, 0, 1000) ||
      !Array.isArray(c.path) ||
      c.path.length < 2 ||
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
    typeof s.objectivesClaimed === 'boolean'
  );
}
function decode(value: unknown): SaveEnvelope | null {
  if (
    !record(value) ||
    value.schema !== 1 ||
    !finite(value.savedAt, 0, Number.MAX_SAFE_INTEGER) ||
    !validateState(value.state)
  )
    return null;
  return value as unknown as SaveEnvelope;
}
export class Persistence {
  private database: Promise<IDBDatabase> | null = null;
  private open(): Promise<IDBDatabase> {
    if (!this.database)
      this.database = new Promise((resolve, reject) => {
        const request = indexedDB.open('angkor-architect', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('saves');
        request.onsuccess = () => {
          request.result.onversionchange = () => request.result.close();
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Save database is busy.'));
      });
    return this.database;
  }
  backup(state: GameState): boolean {
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ schema: 1, savedAt: Date.now(), state } satisfies SaveEnvelope),
      );
      return true;
    } catch {
      return false;
    }
  }
  async save(state: GameState): Promise<'IndexedDB' | 'LocalStorage'> {
    const envelope: SaveEnvelope = {
      schema: 1,
      savedAt: Date.now(),
      state: structuredClone(state),
    };
    let backup = false;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(envelope));
      backup = true;
    } catch {
      /* IndexedDB can still succeed. */
    }
    try {
      const db = await this.open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('saves', 'readwrite');
        tx.objectStore('saves').put(envelope, 'current');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      return 'IndexedDB';
    } catch {
      if (backup) return 'LocalStorage';
      throw new Error('Browser storage is unavailable. Download a save from Settings.');
    }
  }
  async load(): Promise<GameState | null> {
    const candidates: SaveEnvelope[] = [];
    try {
      const value = localStorage.getItem(SAVE_KEY);
      const save = value ? decode(JSON.parse(value)) : null;
      if (save) candidates.push(save);
    } catch {
      /* Try the database. */
    }
    try {
      const db = await this.open();
      const value = await new Promise<unknown>((resolve, reject) => {
        const req = db.transaction('saves').objectStore('saves').get('current');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const save = decode(value);
      if (save) candidates.push(save);
    } catch {
      /* The local backup remains available. */
    }
    return candidates.sort((a, b) => b.savedAt - a.savedAt)[0]?.state ?? null;
  }
}
