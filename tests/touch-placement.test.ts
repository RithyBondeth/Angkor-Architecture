import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/Game';
import { createWorld } from '../src/core/world';
import { TouchPlacement } from '../src/core/touchPlacement';

describe('touch placement confirmation', () => {
  it('previews without spending and builds exactly once after explicit confirmation', () => {
    const game = new Game(createWorld()),
      touch = new TouchPlacement();
    const before = structuredClone(game.state);
    touch.stage('paddy', { x: 14, y: 11 });
    expect(game.state).toEqual(before);
    expect(touch.confirm(game).ok).toBe(true);
    expect(game.state.resources.wood).toBe(before.resources.wood - 35);
    const resources = { ...game.state.resources };
    expect(touch.confirm(game).ok).toBe(false);
    expect(game.state.resources).toEqual(resources);
  });
  it('revalidates materials and occupied sites before committing', () => {
    const game = new Game(createWorld()),
      touch = new TouchPlacement();
    touch.stage('paddy', { x: 14, y: 11 });
    game.place('paddy', { x: 14, y: 11 });
    const before = structuredClone(game.state);
    expect(touch.confirm(game).ok).toBe(false);
    expect(game.state).toEqual(before);
    touch.stage('canal', { x: 12, y: 12 });
    game.state.resources.wood = 0;
    expect(touch.confirm(game).ok).toBe(false);
    expect(game.state.resources.wood).toBe(0);
  });
  it('supports two route endpoints, cancellation, and changing tools without payment', () => {
    const game = new Game(createWorld()),
      touch = new TouchPlacement();
    const before = structuredClone(game.state);
    touch.stage('canal', { x: 12, y: 12 });
    touch.stage('canal', { x: 13, y: 12 });
    expect(touch.plan).toMatchObject({ start: { x: 12, y: 12 }, end: { x: 13, y: 12 } });
    touch.stage('paddy', { x: 14, y: 11 });
    expect(touch.plan!.start).toEqual({ x: 14, y: 11 });
    touch.cancel();
    expect(touch.confirm(game).ok).toBe(false);
    expect(game.state).toEqual(before);
  });
});
