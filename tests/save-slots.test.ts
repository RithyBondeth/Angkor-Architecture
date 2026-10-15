import { describe, expect, it } from 'vitest';
import { Persistence, SLOT_HISTORY, slotKey } from '../src/core/Persistence';
import type { SaveStorage } from '../src/core/SaveStorage';
import { createScenario } from '../src/core/world';
import { validateState } from '../src/core/SaveValidation';
import { slotLibrary } from '../src/ui/SaveSlotsUI';

class MemoryStorage implements SaveStorage {
  database = new Map<string, unknown>();
  browser = new Map<string, string>();
  localFails = false;
  databaseFails = false;
  beforeWrite: (() => Promise<void>) | null = null;
  local = {
    getItem: (key: string) => {
      if (this.localFails) throw Error('Storage blocked');
      return this.browser.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (this.localFails) throw Error('Quota exceeded');
      this.browser.set(key, value);
    },
  };
  async read(key: string) {
    if (this.databaseFails) throw Error('Database blocked');
    return structuredClone(this.database.get(key));
  }
  async write(key: string, value: unknown) {
    if (this.beforeWrite) await this.beforeWrite();
    if (this.databaseFails) throw Error('Database blocked');
    this.database.set(key, structuredClone(value));
  }
}
function world(day = 12) {
  const state = createScenario('roluos');
  state.day = day;
  return state;
}
function envelope(day: number, time: number) {
  return { schema: 6, savedAt: time, state: world(day) };
}

describe('named save slots', () => {
  it('migrates the newest valid legacy copy without erasing either original', async () => {
    const store = new MemoryStorage();
    store.browser.set('angkor-architect:save:v1', JSON.stringify(envelope(20, 200)));
    store.database.set('current', envelope(10, 100));
    const persistence = new Persistence(store);
    expect((await persistence.load())!.day).toBe(20);
    expect(persistence.activeName).toBe('My first kingdom');
    expect((await persistence.slots()).filter((s) => s.checkpoints.length)).toHaveLength(1);
    expect(store.database.get('current')).toEqual(envelope(10, 100));
    expect(store.browser.has('angkor-architect:save:v1')).toBe(true);
    expect((await new Persistence(store).load())!.day).toBe(20);
  });
  it('keeps scenarios, resources, names and history independent across all six slots', async () => {
    const store = new MemoryStorage(),
      p = new Persistence(store);
    for (let id = 1; id <= 6; id++) {
      const state = createScenario(id % 2 ? 'foothills' : 'floodplain');
      state.resources.rice = id * 100;
      await p.create(id, `Kingdom ${id}`, state);
      state.day += 1;
      await p.save(state, 'autosave');
    }
    for (let id = 1; id <= 6; id++) {
      const state = await p.load(id);
      expect(state!.resources.rice).toBe(id * 100);
      expect(validateState(state)).toBe(true);
      expect(p.activeName).toBe(`Kingdom ${id}`);
    }
    expect((await p.slots()).every((s) => s.checkpoints.length === 2)).toBe(true);
    const reloaded = new Persistence(store);
    await reloaded.load();
    expect(reloaded.activeSlot).toBe(6);
  });
  it('renames safely without resetting or adding game checkpoints', async () => {
    const p = new Persistence(new MemoryStorage());
    await p.create(2, '  River   kingdom  ', world(40));
    await p.rename('  New name  ');
    expect(p.activeName).toBe('New name');
    expect((await p.load())!.day).toBe(40);
    expect((await p.slots())[1]!.checkpoints).toHaveLength(1);
    await expect(p.rename('   ')).rejects.toThrow('1–48');
    await expect(p.rename('x'.repeat(49))).rejects.toThrow('1–48');
    await expect(p.create(7, 'Invalid', world())).rejects.toThrow('valid save slot');
    await expect(p.load(0)).rejects.toThrow('valid save slot');
  });
  it('escapes player names in library markup and form values', async () => {
    const p = new Persistence(new MemoryStorage());
    await p.create(1, '<img src=x onerror=alert(1)>', world());
    const html = slotLibrary(await p.slots(), 1);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });
  it('copies snapshots before asynchronous storage and isolates callers', async () => {
    const store = new MemoryStorage(),
      p = new Persistence(store),
      state = world(12);
    await p.create(1, 'Original', state);
    const saved = p.save(state, 'autosave');
    state.day = 80;
    await saved;
    const loaded = (await p.load())!;
    expect(loaded.day).toBe(12);
    loaded.day = 60;
    expect((await p.load())!.day).toBe(12);
    const listed = await p.slots();
    listed[0]!.checkpoints[0]!.state.day = 50;
    expect((await p.load())!.day).toBe(12);
  });
});

describe('autosave recovery', () => {
  it('bounds rolling history while keeping a separate latest exit backup', async () => {
    const store = new MemoryStorage(),
      p = new Persistence(store);
    await p.create(1, 'River', world());
    for (let day = 20; day <= 25; day++) await p.save(world(day), 'autosave');
    expect((await p.slots())[0]!.checkpoints.map((s) => s.state.day)).toEqual([25, 24, 23, 22]);
    expect(p.backup(world(26))).toBe(true);
    expect(p.backup(world(27))).toBe(true);
    const slot = (await p.slots())[0]!;
    expect(slot.checkpoints).toHaveLength(SLOT_HISTORY + 1);
    expect(slot.checkpoints.map((s) => s.state.day)).toEqual([27, 25, 24, 23, 22]);
    expect((await new Persistence(store).load())!.day).toBe(27);
  });
  it('does not evict history with repeated unchanged autosaves while paused', async () => {
    const p = new Persistence(new MemoryStorage());
    await p.create(1, 'Paused city', world(12));
    await p.save(world(20), 'autosave');
    p.backup(world(20));
    const before = (await p.slots())[0]!.checkpoints;
    for (let i = 0; i < 8; i++) await p.save(world(20), 'autosave');
    expect((await p.slots())[0]!.checkpoints).toEqual(before);
  });
  it('promotes an earlier save and retains the previous head for undo', async () => {
    const store = new MemoryStorage(),
      p = new Persistence(store);
    await p.create(1, 'First', world(12));
    await p.save(world(20), 'autosave');
    await p.create(2, 'Other', world(40));
    const points = (await p.slots())[0]!.checkpoints;
    const recovered = await p.recover(1, points[1]!.savedAt);
    expect(recovered.day).toBe(12);
    expect(p.activeSlot).toBe(1);
    expect((await p.slots())[0]!.checkpoints[0]!.kind).toBe('recovery');
    expect((await p.slots())[0]!.checkpoints.some((s) => s.state.day === 20)).toBe(true);
    expect((await new Persistence(store).load())!.day).toBe(12);
    expect((await p.load(2))!.day).toBe(40);
    await expect(p.recover(1, -1)).rejects.toThrow('no longer available');
  });
  it('keeps old checkpoints when intentionally replacing a slot with a new scenario', async () => {
    const p = new Persistence(new MemoryStorage());
    await p.create(1, 'Old city', world(40));
    await p.create(1, 'New city', createScenario('foothills'));
    const slot = (await p.slots())[0]!;
    expect(slot.name).toBe('New city');
    expect(slot.checkpoints[0]!.state.scenario).toBe('foothills');
    expect(slot.checkpoints[1]!.state.day).toBe(40);
  });
  it('skips corrupted newest saves and offers the most recent valid checkpoint', async () => {
    const store = new MemoryStorage(),
      p = new Persistence(store);
    await p.create(1, 'Resilient', world(12));
    await p.save(world(20), 'autosave');
    const record = JSON.parse(store.browser.get(slotKey(1))!);
    record.revisions[0].state = { bad: true };
    record.backup = { schema: 6, savedAt: Date.now() + 100, state: null, kind: 'backup' };
    store.browser.set(slotKey(1), JSON.stringify(record));
    store.database.set('slot:1', structuredClone(record));
    const reopened = new Persistence(store);
    expect((await reopened.load())!.day).toBe(12);
    expect((await reopened.slots())[0]!.damaged).toBe(true);
    expect((await reopened.slots())[0]!.checkpoints).toHaveLength(1);
  });
  it('merges newer local backup with database history even if an older write finishes last', async () => {
    const store = new MemoryStorage(),
      p = new Persistence(store);
    await p.create(1, 'Race safe', world(12));
    let release!: () => void;
    store.beforeWrite = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const saving = p.save(world(20), 'autosave');
    while (!release) await Promise.resolve();
    p.backup(world(21));
    release();
    await saving;
    store.beforeWrite = null;
    const reopened = new Persistence(store);
    expect((await reopened.load())!.day).toBe(21);
    expect((await reopened.slots())[0]!.checkpoints.map((s) => s.state.day)).toEqual([21, 20, 12]);
  });
  it('does not lose a backup created while a rename is awaiting the database', async () => {
    const store = new MemoryStorage(),
      p = new Persistence(store);
    await p.create(1, 'Old name', world());
    let release!: () => void;
    store.beforeWrite = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const renaming = p.rename('New name');
    while (!release) await Promise.resolve();
    p.backup(world(22));
    release();
    await renaming;
    store.beforeWrite = null;
    expect(p.activeName).toBe('New name');
    expect((await p.load())!.day).toBe(22);
    await p.save(world(23));
    expect((await p.slots())[0]!.checkpoints.some((s) => s.state.day === 22)).toBe(true);
  });
  it('carries a pending rename into a concurrent autosave and durable reload', async () => {
    const store = new MemoryStorage(),
      p = new Persistence(store);
    await p.create(1, 'Old', world(12));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    store.beforeWrite = () => gate;
    const naming = p.rename('New');
    await Promise.resolve();
    await Promise.resolve();
    const saving = p.save(world(30), 'autosave');
    release();
    await Promise.all([naming, saving]);
    store.beforeWrite = null;
    const reloaded = new Persistence(store);
    expect((await reloaded.load())!.day).toBe(30);
    expect(reloaded.activeName).toBe('New');
  });
});

describe('storage failures', () => {
  it('saves with only local storage and still recovers after reload', async () => {
    const store = new MemoryStorage();
    store.databaseFails = true;
    const p = new Persistence(store);
    await p.create(2, 'Local city', world(20));
    expect(await p.save(world(21), 'autosave')).toBe('LocalStorage');
    expect((await new Persistence(store).load())!.day).toBe(21);
  });
  it('saves with only IndexedDB when browser backup storage is full', async () => {
    const store = new MemoryStorage();
    store.localFails = true;
    const p = new Persistence(store);
    await p.create(3, 'Database city', world(30));
    expect(await p.save(world(31))).toBe('IndexedDB');
    expect(p.backup(world(32))).toBe(false);
    expect((await new Persistence(store).load())!.day).toBe(31);
  });
  it('rolls back a failed rename when neither storage can persist it', async () => {
    const store = new MemoryStorage(),
      p = new Persistence(store);
    await p.create(1, 'Saved name', world());
    store.localFails = true;
    store.databaseFails = true;
    await expect(p.rename('Unsaved name')).rejects.toThrow('unavailable');
    expect(p.activeName).toBe('Saved name');
  });
  it('flags malformed slot JSON without overwriting it on read', async () => {
    const store = new MemoryStorage();
    store.browser.set(slotKey(1), '{broken');
    const p = new Persistence(store);
    expect(await p.load()).toBeNull();
    expect((await p.slots())[0]!.damaged).toBe(true);
    expect(store.browser.get(slotKey(1))).toBe('{broken');
  });
  it('reports total storage failure without replacing an existing durable slot', async () => {
    const store = new MemoryStorage(),
      p = new Persistence(store);
    await p.create(1, 'Safe city', world(12));
    store.localFails = true;
    store.databaseFails = true;
    await expect(p.create(1, 'Unsaved replacement', world(80))).rejects.toThrow('unavailable');
    expect(p.activeName).toBe('Safe city');
    store.localFails = false;
    store.databaseFails = false;
    expect((await new Persistence(store).load())!.day).toBe(12);
  });
});
