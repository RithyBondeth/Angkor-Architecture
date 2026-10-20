import { readGameState } from './SaveValidation';
export { readGameState, validateState } from './SaveValidation';
import type { GameState, SaveEnvelope } from './types';
import { BrowserSaveStorage } from './SaveStorage';
import type { SaveStorage } from './SaveStorage';

export const SLOT_COUNT = 6;
export const SLOT_HISTORY = 4;
const LEGACY_KEY = 'angkor-architect:save:v1';
const ACTIVE_KEY = 'angkor-architect:active-slot:v1';
export const slotKey = (id: number) => `angkor-architect:slot:${id}:v1`;
export type SaveKind = 'manual' | 'autosave' | 'recovery' | 'backup';
export interface Checkpoint extends SaveEnvelope {
  kind: SaveKind;
}
interface SlotRecord {
  version: 1;
  id: number;
  name: string;
  namedAt: number;
  revisions: Checkpoint[];
  backup: Checkpoint | null;
}
export interface SaveSlot {
  id: number;
  name: string;
  checkpoints: Checkpoint[];
  damaged: boolean;
}
function validId(id: number): boolean {
  return Number.isInteger(id) && id >= 1 && id <= SLOT_COUNT;
}
function nameFor(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 48) throw new Error('Give your kingdom a name of 1–48 characters.');
  return name;
}
function decode(value: unknown): SaveEnvelope | null {
  if (typeof value !== 'object' || value === null) return null;
  const envelope = value as Record<string, unknown>;
  if (
    ![1, 2, 3, 4, 5, 6].includes(envelope.schema as number) ||
    typeof envelope.savedAt !== 'number' ||
    !Number.isSafeInteger(envelope.savedAt) ||
    envelope.savedAt < 0
  )
    return null;
  const state = readGameState(envelope.state);
  return state ? { schema: 6, savedAt: envelope.savedAt, state } : null;
}
function newest(checkpoints: Checkpoint[], limit = SLOT_HISTORY): Checkpoint[] {
  const unique = new Map<number, Checkpoint>();
  for (const checkpoint of checkpoints) unique.set(checkpoint.savedAt, checkpoint);
  return [...unique.values()].sort((a, b) => b.savedAt - a.savedAt).slice(0, limit);
}
function checkpoints(record: SlotRecord): Checkpoint[] {
  return newest([...record.revisions, ...(record.backup ? [record.backup] : [])], SLOT_HISTORY + 1);
}

/** Independent slots, bounded validated history, and synchronous crash recovery. */
export class Persistence {
  private readonly records = new Map<number, SlotRecord>();
  private readonly damaged = new Set<number>();
  private initialization: Promise<void> | null = null;
  private writes: Promise<unknown> = Promise.resolve();
  private active = 1;
  constructor(private readonly storage: SaveStorage = new BrowserSaveStorage()) {}
  get activeSlot(): number {
    return this.active;
  }
  get activeName(): string {
    return this.records.get(this.active)?.name ?? `Kingdom ${this.active}`;
  }
  private localRead(key: string): unknown {
    try {
      const value = this.storage.local.getItem(key);
      if (!value) return null;
      try {
        return JSON.parse(value);
      } catch {
        return { invalid: true };
      }
    } catch {
      return null;
    }
  }
  private localWrite(key: string, value: unknown): boolean {
    try {
      this.storage.local.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
  private record(value: unknown, id: number): SlotRecord | null {
    if (!value || typeof value !== 'object') return null;
    const raw = value as Record<string, unknown>;
    if (raw.version !== 1 || raw.id !== id) {
      this.damaged.add(id);
      return null;
    }
    const read = (value: unknown): Checkpoint | null => {
      const save = decode(value);
      const kind =
        value && typeof value === 'object' ? (value as Record<string, unknown>).kind : null;
      if (!save || !['manual', 'autosave', 'recovery', 'backup'].includes(kind as string)) {
        this.damaged.add(id);
        return null;
      }
      return { ...save, kind: kind as SaveKind };
    };
    const revisions = Array.isArray(raw.revisions)
      ? raw.revisions.map(read).filter((s): s is Checkpoint => !!s)
      : [];
    if (!Array.isArray(raw.revisions)) this.damaged.add(id);
    let name = `Kingdom ${id}`;
    try {
      if (typeof raw.name === 'string') name = nameFor(raw.name);
    } catch {
      /* Preserve valid city data even with damaged metadata. */
    }
    return {
      version: 1,
      id,
      name,
      namedAt:
        typeof raw.namedAt === 'number' && Number.isSafeInteger(raw.namedAt) && raw.namedAt >= 0
          ? raw.namedAt
          : 0,
      revisions: newest(revisions),
      backup: raw.backup ? read(raw.backup) : null,
    };
  }
  initialize(): Promise<void> {
    return (this.initialization ??= this.initializeSlots());
  }
  private async initializeSlots(): Promise<void> {
    await Promise.all(
      Array.from({ length: SLOT_COUNT }, async (_, i) => {
        const id = i + 1,
          local = this.record(this.localRead(slotKey(id)), id);
        let database: SlotRecord | null = null;
        try {
          database = this.record(await this.storage.read(`slot:${id}`), id);
        } catch {
          /* Local fallback. */
        }
        const sources = [local, database].filter((s): s is SlotRecord => !!s);
        if (!sources.length) return;
        const metadata = sources.reduce((a, b) => (a.namedAt >= b.namedAt ? a : b));
        const record: SlotRecord = {
          ...metadata,
          revisions: newest(sources.flatMap((s) => s.revisions)),
          backup:
            newest(
              sources.flatMap((s) => (s.backup ? [s.backup] : [])),
              1,
            )[0] ?? null,
        };
        if (checkpoints(record).length) this.records.set(id, record);
      }),
    );
    if (!this.records.has(1)) {
      const legacy = [decode(this.localRead(LEGACY_KEY))];
      try {
        legacy.push(decode(await this.storage.read('current')));
      } catch {
        /* Legacy local copy may still work. */
      }
      const save = legacy
        .filter((s): s is SaveEnvelope => !!s)
        .sort((a, b) => b.savedAt - a.savedAt)[0];
      if (save) {
        const record: SlotRecord = {
          version: 1,
          id: 1,
          name: 'My first kingdom',
          namedAt: Date.now(),
          revisions: [{ ...save, kind: 'manual' }],
          backup: null,
        };
        this.records.set(1, record);
        // Keep the legacy copies untouched until migration has a durable destination.
        try {
          await this.persist(record);
        } catch {
          /* A later save can retry; the original remains safe. */
        }
      }
    }
    let preferred = 0;
    try {
      preferred = Number(this.storage.local.getItem(ACTIVE_KEY));
    } catch {
      /* Select newest. */
    }
    this.active =
      validId(preferred) && this.records.has(preferred)
        ? preferred
        : ([...this.records.values()].sort(
            (a, b) => checkpoints(b)[0]!.savedAt - checkpoints(a)[0]!.savedAt,
          )[0]?.id ?? 1);
  }
  async slots(): Promise<SaveSlot[]> {
    await this.initialize();
    return Array.from({ length: SLOT_COUNT }, (_, i) => {
      const id = i + 1,
        record = this.records.get(id);
      return {
        id,
        name: record?.name ?? (this.damaged.has(id) ? `Unreadable slot ${id}` : `Empty slot ${id}`),
        checkpoints: record ? structuredClone(checkpoints(record)) : [],
        damaged: this.damaged.has(id),
      };
    });
  }
  private select(id: number): void {
    if (!validId(id)) throw new Error('Choose a valid save slot.');
    this.active = id;
    try {
      this.storage.local.setItem(ACTIVE_KEY, String(id));
    } catch {
      /* Selection still works this session. */
    }
  }
  async load(id?: number): Promise<GameState | null> {
    await this.initialize();
    const slot = id ?? this.active;
    if (!validId(slot)) throw new Error('Choose a valid save slot.');
    const record = this.records.get(slot),
      state = record ? checkpoints(record)[0]?.state : null;
    if (!state) return null;
    this.select(slot);
    return structuredClone(state);
  }
  private stamp(record?: SlotRecord): number {
    return Math.max(
      Date.now(),
      (record ? Math.max(record.namedAt, checkpoints(record)[0]?.savedAt ?? 0) : 0) + 1,
    );
  }
  private async persist(record: SlotRecord): Promise<'IndexedDB' | 'LocalStorage'> {
    const copy = structuredClone(record),
      backup = this.localWrite(slotKey(record.id), copy);
    const write = this.writes
      .catch(() => {})
      .then(() => this.storage.write(`slot:${record.id}`, copy));
    this.writes = write;
    try {
      await write;
      return 'IndexedDB';
    } catch {
      if (backup) return 'LocalStorage';
      throw new Error('Browser storage is unavailable. Download a save from Settings.');
    }
  }
  async create(id: number, name: string, state: GameState): Promise<void> {
    await this.initialize();
    if (!validId(id)) throw new Error('Choose a valid save slot.');
    const previous = this.records.get(id),
      now = this.stamp(previous);
    const record: SlotRecord = {
      version: 1,
      id,
      name: nameFor(name),
      namedAt: now,
      revisions: newest([
        { schema: 6, savedAt: now, state: structuredClone(state), kind: 'manual' },
        ...(previous ? checkpoints(previous) : []),
      ]),
      backup: null,
    };
    await this.persist(record);
    this.records.set(id, record);
    this.select(id);
  }
  async rename(name: string): Promise<void> {
    await this.renameSlot(this.active, name);
  }
  async renameSlot(id: number, name: string): Promise<void> {
    await this.initialize();
    const record = this.records.get(id);
    if (!record) throw new Error('Start a kingdom in this slot first.');
    const renamed = { ...record, name: nameFor(name), namedAt: this.stamp(record) };
    // Publish metadata before yielding so a concurrent autosave carries the new name.
    this.records.set(id, renamed);
    try {
      await this.persist(renamed);
    } catch (error) {
      // Roll back only if no newer autosave or exit backup depends on this metadata.
      if (this.records.get(id) === renamed) this.records.set(id, record);
      throw error;
    }
  }
  backup(state: GameState): boolean {
    const record = this.records.get(this.active);
    if (!record) return false;
    const updated: SlotRecord = {
      ...record,
      backup: {
        schema: 6,
        savedAt: this.stamp(record),
        state: structuredClone(state),
        kind: 'backup',
      },
    };
    const saved = this.localWrite(slotKey(record.id), updated);
    if (saved) this.records.set(record.id, updated);
    return saved;
  }
  async save(
    state: GameState,
    kind: 'manual' | 'autosave' | 'recovery' = 'manual',
  ): Promise<'IndexedDB' | 'LocalStorage'> {
    // Capture before awaiting storage; simulation may advance while IndexedDB is busy.
    const snapshot = structuredClone(state);
    await this.initialize();
    const previous = this.records.get(this.active),
      now = this.stamp(previous);
    // Pausing in Settings must not rotate useful recovery points out of history.
    if (
      kind === 'autosave' &&
      previous &&
      JSON.stringify(checkpoints(previous)[0]?.state) === JSON.stringify(snapshot)
    )
      return this.persist(previous);
    const record: SlotRecord = {
      version: 1,
      id: this.active,
      name: previous?.name ?? 'My kingdom',
      namedAt: previous?.namedAt ?? now,
      revisions: newest([
        { schema: 6, savedAt: now, state: snapshot, kind },
        ...(previous ? checkpoints(previous) : []),
      ]),
      backup: null,
    };
    this.records.set(record.id, record);
    return this.persist(record);
  }
  async recover(id: number, savedAt: number): Promise<GameState> {
    await this.initialize();
    const record = this.records.get(id),
      checkpoint = record ? checkpoints(record).find((s) => s.savedAt === savedAt) : null;
    if (!checkpoint) throw new Error('This recovery point is no longer available.');
    // Preserve the current head as another recovery point before promoting the chosen city.
    const now = this.stamp(record),
      state = structuredClone(checkpoint.state);
    const recovered: SlotRecord = {
      ...record!,
      revisions: newest([
        { schema: 6, savedAt: now, state, kind: 'recovery' },
        ...checkpoints(record!),
      ]),
      backup: null,
    };
    await this.persist(recovered);
    this.records.set(id, recovered);
    this.select(id);
    return structuredClone(state);
  }
}
