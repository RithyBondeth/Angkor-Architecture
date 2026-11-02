import { Sprite } from 'pixi.js';
import type { Container } from 'pixi.js';
import type { GameState, Point } from '../core/types';
import { buildingAt, neighbors, tileAt } from '../core/world';
import { toScreen } from './isometric';
import { LIFE_FRAMES } from './TextureAtlas';
import type { LifeKey, TextureAtlas } from './TextureAtlas';

interface Boat {
  sprite: Sprite;
  from: Point;
  to: Point;
  heading: Point;
  t: number;
  pause: number;
}
interface Egret {
  sprite: Sprite;
  at: Point;
  offset: Point;
  flight: { from: Point; to: Point; t: number; duration: number } | null;
  rest: number;
}
const TILE_MS = 3600;
const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)]!;

/**
 * Ambient life on open river and lake water: fishing boats, egrets, wading buffalo, and leaping
 * fish. Purely visual; it reads the map but never touches the simulation.
 */
export class WaterLife {
  private open: Point[] = [];
  private openKeys = new Set<string>();
  private bank: Point[] = [];
  private boats: Boat[] = [];
  private egrets: Egret[] = [];
  private buffalo: Sprite[] = [];
  private revision = '';
  private last = 0;
  private nextJump = 0;
  constructor(
    private readonly atlas: TextureAtlas,
    private readonly layer: Container,
    private readonly still: boolean,
    private readonly splash: (x: number, y: number) => void,
  ) {}

  /** Re-read where open water is, but only when buildings have changed. */
  refresh(state: GameState) {
    const revision = `${state.nextId}:${state.buildings.length}`;
    if (revision === this.revision) return;
    this.revision = revision;
    const isOpen = (p: Point) => {
      const t = tileAt(state, p.x, p.y);
      return !!t && t.terrain === 'water' && t.water >= 0.45 && !buildingAt(state, p.x, p.y);
    };
    this.open = state.tiles.filter((t) => isOpen(t)).map((t) => ({ x: t.x, y: t.y }));
    this.openKeys = new Set(this.open.map((p) => `${p.x},${p.y}`));
    this.bank = this.open.filter((p) =>
      neighbors(p).some((n) =>
        ['grass', 'forest', 'road'].includes(tileAt(state, n.x, n.y)?.terrain ?? ''),
      ),
    );
    this.populate();
  }
  private sprite(key: LifeKey, scale: number) {
    const f = LIFE_FRAMES[key];
    const sprite = new Sprite(this.atlas.get(key));
    sprite.anchor.set(f.originX / f.width, f.originY / f.height);
    sprite.scale.set(scale);
    this.layer.addChild(sprite);
    return sprite;
  }
  private place(sprite: Sprite, p: Point, offset: Point = { x: 0, y: 0 }, lift = 0) {
    const s = toScreen(p.x, p.y);
    sprite.position.set(s.x + offset.x, s.y + offset.y - lift);
    sprite.zIndex = s.y + offset.y + 4;
  }
  private populate() {
    const valid = (p: Point) => this.openKeys.has(`${p.x},${p.y}`);
    // Drop anything left stranded by new building work, then fill up to a gentle density.
    this.boats = this.boats.filter((b) => (valid(b.to) ? true : (b.sprite.destroy(), false)));
    this.egrets = this.egrets.filter((e) => (valid(e.at) ? true : (e.sprite.destroy(), false)));
    for (const b of this.buffalo.splice(0)) b.destroy();
    const boats = Math.min(7, Math.floor(this.open.length / 30));
    while (this.boats.length < boats && this.open.length) {
      const at = pick(this.open);
      const boat: Boat = {
        sprite: this.sprite('life-boat', 1.35),
        from: at,
        to: at,
        heading: pick([
          { x: 1, y: 0 },
          { x: -1, y: 0 },
          { x: 0, y: 1 },
          { x: 0, y: -1 },
        ]),
        t: 1,
        pause: Math.random() * 4000,
      };
      this.place(boat.sprite, at);
      this.boats.push(boat);
    }
    const egrets = Math.min(10, Math.floor(this.bank.length / 5));
    while (this.egrets.length < egrets && this.bank.length) {
      const at = pick(this.bank);
      const egret: Egret = {
        sprite: this.sprite('life-egret', 1),
        at,
        offset: { x: (Math.random() - 0.5) * 30, y: (Math.random() - 0.5) * 12 },
        flight: null,
        rest: 4000 + Math.random() * 12000,
      };
      egret.sprite.scale.x *= Math.random() < 0.5 ? -1 : 1;
      this.place(egret.sprite, at, egret.offset);
      this.egrets.push(egret);
    }
    const herd = Math.min(3, Math.floor(this.bank.length / 20));
    for (let i = 0; i < herd; i++) {
      const sprite = this.sprite('life-buffalo', 1);
      sprite.scale.x *= i % 2 ? -1 : 1;
      this.place(sprite, pick(this.bank), { x: (Math.random() - 0.5) * 20, y: 0 });
      this.buffalo.push(sprite);
    }
  }
  update(now: number) {
    const dt = Math.min(100, this.last ? now - this.last : 16);
    this.last = now;
    if (this.still) return;
    for (const boat of this.boats) this.sail(boat, dt, now);
    for (const egret of this.egrets) this.fly(egret, dt);
    this.buffalo.forEach((b, i) => (b.pivot.y = Math.sin(now * 0.0012 + i) * 0.8));
    if (now > this.nextJump && this.open.length) {
      this.nextJump = now + 1800 + Math.random() * 2400;
      const spot = pick(this.open);
      const s = toScreen(spot.x, spot.y);
      this.splash(s.x + (Math.random() - 0.5) * 30, s.y + (Math.random() - 0.5) * 10);
    }
  }
  private sail(boat: Boat, dt: number, now: number) {
    if (boat.pause > 0) {
      boat.pause -= dt;
    } else if (boat.t >= 1) {
      // Arrived: sometimes stop to fish, otherwise drift on, mostly keeping the same heading.
      boat.from = boat.to;
      if (Math.random() < 0.18) boat.pause = 3000 + Math.random() * 5000;
      const options = neighbors(boat.from).filter((n) => this.openKeys.has(`${n.x},${n.y}`));
      if (options.length) {
        const ahead = options.find(
          (n) => n.x - boat.from.x === boat.heading.x && n.y - boat.from.y === boat.heading.y,
        );
        const next = ahead && Math.random() < 0.75 ? ahead : pick(options);
        boat.heading = { x: next.x - boat.from.x, y: next.y - boat.from.y };
        boat.to = next;
        boat.t = 0;
        const a = toScreen(boat.from.x, boat.from.y);
        const b = toScreen(next.x, next.y);
        boat.sprite.scale.x = Math.abs(boat.sprite.scale.x) * (b.x < a.x ? -1 : 1);
      }
    } else boat.t = Math.min(1, boat.t + dt / TILE_MS);
    const p = {
      x: boat.from.x + (boat.to.x - boat.from.x) * boat.t,
      y: boat.from.y + (boat.to.y - boat.from.y) * boat.t,
    };
    this.place(boat.sprite, p, { x: 0, y: 0 }, Math.sin(now * 0.002 + boat.from.x) * 1.2);
  }
  private fly(egret: Egret, dt: number) {
    if (!egret.flight) {
      egret.rest -= dt;
      if (egret.rest > 0 || this.bank.length < 2) return;
      const nearby = this.bank.filter(
        (p) => Math.abs(p.x - egret.at.x) + Math.abs(p.y - egret.at.y) < 9,
      );
      const to = pick(nearby.length > 1 ? nearby : this.bank);
      const distance = Math.hypot(to.x - egret.at.x, to.y - egret.at.y);
      egret.flight = { from: egret.at, to, t: 0, duration: 900 + distance * 260 };
      egret.sprite.texture = this.atlas.get('life-egret-fly');
      const f = LIFE_FRAMES['life-egret-fly'];
      egret.sprite.anchor.set(f.originX / f.width, f.originY / f.height);
      const a = toScreen(egret.at.x, egret.at.y);
      const b = toScreen(to.x, to.y);
      egret.sprite.scale.x = Math.abs(egret.sprite.scale.x) * (b.x < a.x ? 1 : -1);
      return;
    }
    const flight = egret.flight;
    flight.t = Math.min(1, flight.t + dt / flight.duration);
    const p = {
      x: flight.from.x + (flight.to.x - flight.from.x) * flight.t,
      y: flight.from.y + (flight.to.y - flight.from.y) * flight.t,
    };
    this.place(egret.sprite, p, egret.offset, 18 + Math.sin(flight.t * Math.PI) * 46);
    egret.sprite.zIndex += 400;
    if (flight.t >= 1) {
      egret.at = flight.to;
      egret.flight = null;
      egret.rest = 5000 + Math.random() * 14000;
      egret.sprite.texture = this.atlas.get('life-egret');
      const f = LIFE_FRAMES['life-egret'];
      egret.sprite.anchor.set(f.originX / f.width, f.originY / f.height);
      this.place(egret.sprite, egret.at, egret.offset);
    }
  }
  destroy() {
    for (const b of this.boats) b.sprite.destroy();
    for (const e of this.egrets) e.sprite.destroy();
    for (const b of this.buffalo) b.destroy();
    this.boats = [];
    this.egrets = [];
    this.buffalo = [];
  }
}
