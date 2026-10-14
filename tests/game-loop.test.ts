import { afterEach, expect, it, vi } from 'vitest';
import type { Game } from '../src/core/Game';
import { GameLoop } from '../src/core/GameLoop';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('never renders negative courier interpolation when the first frame predates startup', () => {
  let frame: FrameRequestCallback = () => {};
  vi.spyOn(performance, 'now').mockReturnValue(1000);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const step = vi.fn();
  const game = { state: { speed: 1 }, step } as unknown as Game;
  const render = vi.fn();
  const loop = new GameLoop(game, render);
  loop.start();

  frame(995);
  expect(render).toHaveBeenLastCalledWith(0, 995);
  expect(step).not.toHaveBeenCalled();

  frame(1015);
  expect(render.mock.lastCall![0]).toBeGreaterThan(0);
  expect(render.mock.lastCall![0]).toBeLessThan(1);
  loop.stop();
});
