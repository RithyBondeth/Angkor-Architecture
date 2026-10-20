import type { BuildingKind, GameState, TutorialState } from './types';
import { WaterSimulation } from '../simulation/WaterSimulation';

export function freshTutorial(): TutorialState {
  return {
    status: 'active',
    step: 0,
    canalId: null,
    paddyId: null,
    inspected: false,
    delivered: false,
  };
}

/** A new lesson leaves time stopped until the player is ready to run it. */
export function startTutorial(state: GameState): void {
  state.tutorial = freshTutorial();
  state.speed = 0;
}

export function tutorialBuildings(state: GameState): readonly BuildingKind[] | null {
  if (state.tutorial?.status !== 'active') return null;
  return state.tutorial.step < 2 ? ['canal', 'baray'] : ['canal', 'paddy', 'baray'];
}

/** Remember milestones, but recover gracefully if the player's teaching site is removed. */
export function advanceTutorial(state: GameState): void {
  const t = state.tutorial;
  if (!t || t.status !== 'active') return;
  const previousStep = t.step;
  const canal = state.buildings.find((b) => b.id === t.canalId);
  const paddy = state.buildings.find((b) => b.id === t.paddyId);
  if (t.step === 1 && t.canalId && !canal) t.canalId = null;
  if (t.step >= 3 && !paddy) {
    t.step = 2;
    t.paddyId = null;
    t.inspected = false;
    t.delivered = false;
  }
  if (
    t.step === 1 &&
    canal &&
    !canal.construction &&
    state.tiles[canal.y * state.width + canal.x]!.water >= 0.45
  )
    t.step = 2;
  if (t.step === 2 && paddy) t.step = 3;
  if (
    t.step === 3 &&
    paddy &&
    t.inspected &&
    (!paddy.construction || (!paddy.construction.paused && paddy.construction.builders > 0))
  )
    t.step = 4;
  if (
    t.step === 4 &&
    paddy &&
    !paddy.construction &&
    paddy.enabled &&
    paddy.condition > 0 &&
    !paddy.crop?.failed &&
    WaterSimulation.irrigation(state, paddy.x, paddy.y) >= 0.5
  )
    t.step = 5;
  if (t.step === 5 && t.delivered) {
    t.step = 6;
    t.status = 'completed';
  }
  if (t.step !== previousStep && t.status === 'active') state.speed = 0;
}

export function inspectTutorialSite(state: GameState, id: string | null): void {
  if (state.tutorial?.status === 'active' && id === state.tutorial.paddyId && id !== null) {
    state.tutorial.inspected = true;
    advanceTutorial(state);
  }
}
