import { birdCall, cicadas, rain, thunder } from './instruments';
import type { Out } from './instruments';

/**
 * Living ambience beneath the water texture: birdsong all year, cicadas in the dry season, and a
 * steady rain with rare distant thunder in the wet season. Events are random and never repeat
 * exactly; nothing here depends on game time.
 */
export class NatureDirector {
  private timer: ReturnType<typeof setInterval> | null = null;
  private wet = true;
  private stopRain: ((at: number) => void) | null = null;
  constructor(
    private readonly out: Out,
    private readonly withWeather: () => boolean,
  ) {}
  get running() {
    return this.timer !== null;
  }
  setWet(wet: boolean) {
    if (wet === this.wet) return;
    this.wet = wet;
    if (this.timer) this.updateRain();
  }
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 400);
    this.updateRain();
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stopRain?.(this.out.ctx.currentTime);
    this.stopRain = null;
  }
  private updateRain() {
    const raining = this.wet && this.withWeather();
    if (raining && !this.stopRain) this.stopRain = rain(this.out, this.out.ctx.currentTime, 0.05);
    if (!raining && this.stopRain) {
      this.stopRain(this.out.ctx.currentTime);
      this.stopRain = null;
    }
  }
  private tick() {
    const t = this.out.ctx.currentTime + 0.05;
    const weather = this.withWeather();
    if (Math.random() < (this.wet ? 0.05 : 0.09)) birdCall(this.out, t);
    if (weather && !this.wet && Math.random() < 0.025)
      cicadas(this.out, t, 2.5 + Math.random() * 3);
    if (weather && this.wet && Math.random() < 0.004) thunder(this.out, t);
    this.updateRain();
  }
}
