import { readGameState } from './SaveValidation';
export { readGameState, validateState } from './SaveValidation';
import type { GameState, SaveEnvelope } from './types';

const SAVE_KEY = 'angkor-architect:save:v1';
function decode(value: unknown): SaveEnvelope | null {
  if (typeof value !== 'object' || value === null) return null;
  const envelope = value as Record<string, unknown>;
  if (
    ![1, 2, 3, 4].includes(envelope.schema as number) ||
    typeof envelope.savedAt !== 'number' ||
    !Number.isSafeInteger(envelope.savedAt) ||
    envelope.savedAt < 0
  )
    return null;
  const state = readGameState(envelope.state);
  return state ? { schema: 4, savedAt: envelope.savedAt, state } : null;
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
        JSON.stringify({ schema: 4, savedAt: Date.now(), state } satisfies SaveEnvelope),
      );
      return true;
    } catch {
      return false;
    }
  }
  async save(state: GameState): Promise<'IndexedDB' | 'LocalStorage'> {
    const envelope: SaveEnvelope = {
      schema: 4,
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
