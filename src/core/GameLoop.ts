import { CONFIG } from '../data/config';
import type { Game } from './Game';

/** Fixed simulation time steps stay independent of the render frame rate. */
export class GameLoop {
  private accumulator = 0;
  private last = 0;
  private frame = 0;
  constructor(
    private readonly game: Game,
    private readonly render: (interpolation: number, elapsed: number) => void,
  ) {}
  start() {
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.update);
  }
  stop() {
    cancelAnimationFrame(this.frame);
  }
  private update = (now: number) => {
    // RAF timestamps describe the start of a frame and can precede start()'s clock read.
    const elapsed = Math.max(0, Math.min(now - this.last, 100));
    this.last = now;
    this.accumulator += elapsed * this.game.state.speed;
    while (this.accumulator >= CONFIG.tickMs) {
      this.game.step();
      this.accumulator -= CONFIG.tickMs;
    }
    this.render(this.accumulator / CONFIG.tickMs, now);
    this.frame = requestAnimationFrame(this.update);
  };
}
