import { Container, Graphics } from 'pixi.js';

interface Tween {
  target: Container;
  start: number;
  duration: number;
  baseX: number;
  baseY: number;
  apply: (t: number, target: Container, baseX: number, baseY: number) => void;
}
interface Particle {
  view: Graphics;
  start: number;
  duration: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  grow: number;
  fade: number;
  scale: number;
}

/** Overshoots past 1 and settles: a springy "pop". */
export function easeOutBack(t: number): number {
  const s = 1.9;
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Short-lived map feedback. Purely visual: nothing here touches the simulation. */
export class Effects {
  readonly layer = new Container();
  private tweens: Tween[] = [];
  private particles: Particle[] = [];
  constructor(private readonly enabled: boolean) {}

  private tween(target: Container, duration: number, apply: Tween['apply']) {
    if (!this.enabled || target.destroyed) return;
    // A newer tween on the same sprite replaces the old one so scales never compound.
    const existing = this.tweens.find((t) => t.target === target);
    const baseX = existing?.baseX ?? target.scale.x;
    const baseY = existing?.baseY ?? target.scale.y;
    if (existing) target.scale.set(baseX, baseY);
    this.tweens = this.tweens.filter((t) => t.target !== target);
    this.tweens.push({ target, start: performance.now(), duration, baseX, baseY, apply });
    apply(0, target, baseX, baseY);
  }
  /** Spring a new building or finished project into place. */
  pop(target: Container, from = 0.4, duration = 620) {
    this.tween(target, duration, (t, s, bx, by) => {
      const k = from + (1 - from) * easeOutBack(t);
      s.scale.set(bx * k, by * (from + (1 - from) * easeOutBack(Math.min(1, t * 1.15))));
    });
  }
  /** A quick squash-and-stretch acknowledging a selection. */
  bounce(target: Container, duration = 420) {
    this.tween(target, duration, (t, s, bx, by) => {
      const wave = Math.sin(t * Math.PI * 2) * (1 - t);
      s.scale.set(bx * (1 + wave * 0.07), by * (1 - wave * 0.09));
    });
  }
  /** Side-to-side shake for a refused action. */
  shake(target: Container, duration = 360) {
    const x = target.x;
    this.tween(target, duration, (t, s) => {
      s.x = t >= 1 ? x : x + Math.sin(t * Math.PI * 6) * 5 * (1 - t);
    });
  }
  /** An expanding diamond on the ground under the pointer. */
  ripple(x: number, y: number, color: number, size = 1) {
    if (!this.enabled) return;
    const view = new Graphics()
      .poly([0, -18, 36, 0, 0, 18, -36, 0])
      .stroke({ color, width: 2.5, alpha: 1 })
      .poly([0, -18, 36, 0, 0, 18, -36, 0])
      .fill({ color, alpha: 0.18 });
    view.position.set(x, y);
    this.spawn(view, { duration: 560, x, y, grow: 1.6, fade: 1, startScale: 0.55 * size });
  }
  /** Bright motes thrown up and drifting down. */
  burst(x: number, y: number, colors: number[], count = 18, spread = 60) {
    if (!this.enabled) return;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
      const speed = 0.06 + Math.random() * 0.14;
      const star = i % 3 === 0;
      const color = colors[i % colors.length]!;
      const view = new Graphics();
      if (star)
        view
          .star(0, 0, 4, 4 + Math.random() * 2, 1.6)
          .fill({ color })
          .stroke({
            color: 0xffffff,
            width: 0.8,
            alpha: 0.7,
          });
      else view.circle(0, 0, 1.6 + Math.random() * 1.8).fill({ color });
      this.spawn(view, {
        duration: 800 + Math.random() * 500,
        x: x + (Math.random() - 0.5) * spread * 0.4,
        y: y - Math.random() * 20,
        vx: Math.cos(angle) * speed * (spread / 60),
        vy: Math.sin(angle) * speed * 1.3,
        gravity: 0.00022,
        fade: 1,
      });
    }
  }
  /** Earthy puffs rolling out along the ground. */
  dust(x: number, y: number, size = 1) {
    if (!this.enabled) return;
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const view = new Graphics().circle(0, 0, 5 + Math.random() * 4).fill({
        color: i % 2 ? 0xd8c39a : 0xeadcb8,
        alpha: 0.75,
      });
      this.spawn(view, {
        duration: 650 + Math.random() * 250,
        x: x + Math.cos(angle) * 30 * size,
        y: y + Math.sin(angle) * 15 * size,
        vx: Math.cos(angle) * 0.045 * size,
        vy: Math.sin(angle) * 0.022 * size - 0.01,
        grow: 0.9,
        fade: 1,
      });
    }
  }
  /** One slow wisp of cooking smoke. */
  smoke(x: number, y: number) {
    if (!this.enabled) return;
    const view = new Graphics().circle(0, 0, 3).fill({ color: 0xf4efe2, alpha: 0.5 });
    this.spawn(view, {
      duration: 2600,
      x,
      y,
      vx: 0.006 + Math.random() * 0.004,
      vy: -0.016,
      grow: 1.8,
      fade: 1,
    });
  }
  /** A single spark leaping from a flame. */
  ember(x: number, y: number) {
    if (!this.enabled) return;
    const color = Math.random() < 0.5 ? 0xffb43a : 0xff6a1a;
    const view = new Graphics()
      .circle(0, 0, 2.6)
      .fill({ color, alpha: 0.35 })
      .circle(0, 0, 1.1)
      .fill({ color: 0xfff2a8 });
    this.spawn(view, {
      duration: 600 + Math.random() * 500,
      x: x + (Math.random() - 0.5) * 10,
      y,
      vx: (Math.random() - 0.5) * 0.02,
      vy: -0.035 - Math.random() * 0.02,
      fade: 1,
    });
  }
  /** Gentle rising fireflies around a decoration. */
  glow(x: number, y: number, color = 0xffe68a) {
    if (!this.enabled) return;
    for (let i = 0; i < 3; i++) {
      const view = new Graphics()
        .circle(0, 0, 3.2)
        .fill({ color, alpha: 0.28 })
        .circle(0, 0, 1.3)
        .fill({ color: 0xfffbe6 });
      this.spawn(view, {
        duration: 1600 + Math.random() * 900,
        x: x + (Math.random() - 0.5) * 50,
        y: y - Math.random() * 30,
        vx: (Math.random() - 0.5) * 0.012,
        vy: -0.018 - Math.random() * 0.01,
        fade: 1,
      });
    }
  }
  private spawn(
    view: Graphics,
    p: {
      duration: number;
      x: number;
      y: number;
      vx?: number;
      vy?: number;
      gravity?: number;
      grow?: number;
      fade?: number;
      startScale?: number;
    },
  ) {
    view.position.set(p.x, p.y);
    view.scale.set(p.startScale ?? 1);
    this.layer.addChild(view);
    this.particles.push({
      view,
      start: performance.now(),
      duration: p.duration,
      x: p.x,
      y: p.y,
      vx: p.vx ?? 0,
      vy: p.vy ?? 0,
      gravity: p.gravity ?? 0,
      grow: p.grow ?? 0,
      fade: p.fade ?? 0,
      scale: p.startScale ?? 1,
    });
    if (this.particles.length > 240) this.particles.shift()!.view.destroy();
  }
  update(now: number) {
    this.tweens = this.tweens.filter((tween) => {
      if (tween.target.destroyed) return false;
      const t = Math.min(1, (now - tween.start) / tween.duration);
      tween.apply(t, tween.target, tween.baseX, tween.baseY);
      if (t >= 1) {
        tween.target.scale.set(tween.baseX, tween.baseY);
        return false;
      }
      return true;
    });
    this.particles = this.particles.filter((p) => {
      const age = now - p.start;
      const t = age / p.duration;
      if (t >= 1) {
        p.view.destroy();
        return false;
      }
      p.view.position.set(p.x + p.vx * age, p.y + p.vy * age + 0.5 * p.gravity * age * age);
      if (p.grow) p.view.scale.set(p.scale * (1 + easeOutCubic(t) * p.grow));
      p.view.alpha = p.fade ? 1 - t * t : 1;
      return true;
    });
  }
  destroy() {
    this.tweens = [];
    for (const p of this.particles) p.view.destroy();
    this.particles = [];
    this.layer.destroy({ children: true });
  }
}
