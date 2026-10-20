import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/Game';
import { createWorld, tileAt } from '../src/core/world';
import { completedBuilding } from '../src/core/buildingState';
import {
  advanceTutorial,
  freshTutorial,
  inspectTutorialSite,
  startTutorial,
  tutorialBuildings,
} from '../src/core/tutorialState';
import { readGameState, validateState } from '../src/core/Persistence';
import { Logistics } from '../src/simulation/Logistics';
import { tutorialPanel } from '../src/ui/TutorialUI';

function lesson() {
  const state = createWorld();
  state.tutorial = freshTutorial();
  return { state, t: state.tutorial, game: new Game(state) };
}

describe('interactive tutorial', () => {
  it('starts and restarts paused and introduces the paddy with its lesson', () => {
    const { state } = lesson();
    state.speed = 4;
    startTutorial(state);
    expect(state.speed).toBe(0);
    expect(tutorialBuildings(state)).toEqual(['canal', 'baray']);
    state.tutorial!.step = 2;
    expect(tutorialBuildings(state)).toContain('paddy');
    state.tutorial!.status = 'skipped';
    expect(tutorialBuildings(state)).toBeNull();
    delete state.tutorial;
    expect(tutorialBuildings(state)).toBeNull();
  });

  it('pauses at a new lesson without repeatedly interrupting the same lesson', () => {
    const { state, t, game } = lesson();
    t.step = 1;
    game.place('canal', { x: 12, y: 12 });
    const canal = state.buildings.find((b) => b.id === t.canalId)!;
    canal.construction = null;
    tileAt(state, 12, 12)!.water = 2;
    state.speed = 4;
    advanceTutorial(state);
    expect(t.step).toBe(2);
    expect(state.speed).toBe(0);
    state.speed = 2;
    advanceTutorial(state);
    expect(state.speed).toBe(2);
    expect(tutorialPanel({ ...state, speed: 0 })).toContain('tutorial-resume');
  });

  it('starts new settlements without auto-completing from starter infrastructure', () => {
    const { state, t, game } = lesson();
    for (let i = 0; i < 25; i++) game.step();
    expect(t.step).toBe(0);
    t.step = 1;
    advanceTutorial(state);
    expect(t.step).toBe(1);
  });

  it('tracks new sites and requires a completed wet canal, inspected crew, and irrigated finished paddy', () => {
    const { state, t, game } = lesson();
    t.step = 1;
    expect(game.place('canal', { x: 12, y: 12 }).ok).toBe(true);
    const canal = state.buildings.find((b) => b.id === t.canalId)!;
    expect(t.step).toBe(1);
    canal.construction = null;
    advanceTutorial(state);
    expect(t.step).toBe(1);
    tileAt(state, 12, 12)!.water = 2;
    advanceTutorial(state);
    expect(t.step).toBe(2);
    expect(game.place('paddy', { x: 14, y: 11 }).ok).toBe(true);
    const paddy = state.buildings.find((b) => b.id === t.paddyId)!;
    expect(t.step).toBe(3);
    paddy.construction!.builders = 0;
    inspectTutorialSite(state, paddy.id);
    expect(t.step).toBe(3);
    expect(game.assignBuilders(paddy.id, 1).ok).toBe(true);
    expect(t.step).toBe(4);
    paddy.construction = null;
    advanceTutorial(state);
    expect(t.step).toBe(5);
    expect(t.status).toBe('active');
  });

  it('counts rice only when received from the tutorial paddy', () => {
    const { state, t } = lesson();
    const paddy = state.buildings.find((b) => b.kind === 'paddy')!;
    const house = state.buildings.find((b) => b.kind === 'house')!;
    t.step = 5;
    t.paddyId = paddy.id;
    const end = { x: house.x, y: house.y };
    state.couriers = [
      {
        id: `c${state.nextId++}`,
        sourceId: paddy.id,
        targetId: house.id,
        kind: 'worker',
        path: [end],
        progress: 0,
        resource: 'rice',
        amount: 4,
      },
    ];
    // Full storage must not count as a receipt.
    state.resources.rice = 1200;
    new Logistics().step(state);
    expect(t.delivered).toBe(false);
    state.resources.rice = 100;
    const other = state.buildings.find((b) => b.kind === 'paddy' && b.id !== paddy.id)!;
    state.couriers = [
      {
        id: `c${state.nextId++}`,
        sourceId: other.id,
        targetId: house.id,
        kind: 'worker',
        path: [end],
        progress: 0,
        resource: 'rice',
        amount: 4,
      },
    ];
    new Logistics().step(state);
    expect(t.delivered).toBe(false);
    state.couriers = [
      {
        id: `c${state.nextId++}`,
        sourceId: paddy.id,
        targetId: house.id,
        kind: 'worker',
        path: [end],
        progress: 0,
        resource: 'rice',
        amount: 4,
      },
    ];
    new Logistics().step(state);
    advanceTutorial(state);
    expect(t.status).toBe('completed');
    expect(t.step).toBe(6);
  });

  it('recovers canceled teaching sites and permits inspection after construction finishes', () => {
    const { state, t } = lesson();
    t.step = 1;
    t.canalId = 'b999';
    advanceTutorial(state);
    expect(t.canalId).toBeNull();
    t.step = 5;
    t.paddyId = 'b999';
    t.delivered = true;
    advanceTutorial(state);
    expect(t).toMatchObject({ step: 2, paddyId: null, inspected: false, delivered: false });
    const paddy = completedBuilding(state, 'paddy', 14, 11);
    state.buildings.push(paddy);
    t.paddyId = paddy.id;
    t.step = 3;
    inspectTutorialSite(state, paddy.id);
    expect(t.step).toBe(5);
  });

  it('finishes through real construction, water flow, production, and transport', () => {
    const { state, t, game } = lesson();
    t.step = 1;
    expect(game.place('canal', { x: 14, y: 14 }).ok).toBe(true);
    for (let i = 0; i < 120 && t.step === 1; i++) game.step();
    expect(t.step).toBe(2);
    expect(game.place('paddy', { x: 14, y: 15 }).ok).toBe(true);
    expect(t.step).toBe(3);
    inspectTutorialSite(state, t.paddyId);
    for (let i = 0; i < 300 && t.status === 'active'; i++) game.step();
    expect(t).toMatchObject({ status: 'completed', step: 6, delivered: true });
    expect(validateState(state)).toBe(true);
  });

  it('preserves progress on save and leaves older saves opted out', () => {
    const { state, t } = lesson();
    t.step = 2;
    expect(readGameState(state)?.tutorial).toEqual(t);
    delete state.tutorial;
    expect(readGameState(state)?.tutorial).toBeUndefined();
    expect(validateState(state)).toBe(true);
  });

  it('rejects malformed imported progress and supports skipped or completed lessons', () => {
    const { state, t } = lesson();
    for (const value of [
      null,
      { ...t, step: 99 },
      { ...t, status: 'completed' },
      { ...t, canalId: '<script>' },
      { ...t, inspected: 1 },
    ]) {
      expect(readGameState({ ...state, tutorial: value })).toBeNull();
    }
    t.status = 'skipped';
    advanceTutorial(state);
    expect(t.step).toBe(0);
    expect(tutorialPanel(state)).toContain('Start tutorial');
    t.status = 'completed';
    t.step = 6;
    expect(validateState(state)).toBe(true);
    expect(tutorialPanel(state)).toContain('Restart tutorial');
  });
});
