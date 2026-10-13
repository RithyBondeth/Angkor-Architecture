import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import { BUILDINGS } from '../data/buildings';
import { buildingAt, footprint, tileAt } from '../core/world';
import type { BuildingKind, Overlay, Point } from '../core/types';
import type { Game } from '../core/Game';
import { Camera } from './Camera';
import { TextureAtlas } from './TextureAtlas';
import { toGrid, toScreen } from './isometric';

export class WorldRenderer {
  readonly app = new Application();
  readonly atlas = new TextureAtlas();
  readonly world = new Container();
  camera!: Camera;
  private readonly ground = new Container();
  private readonly objects = new Container();
  private readonly routes = new Graphics();
  private readonly highlight = new Graphics();
  private readonly tileSprites: Sprite[] = [];
  private readonly waterMarkers: Sprite[] = [];
  private readonly buildingSprites = new Map<string, Sprite>();
  private readonly courierSprites = new Map<string, Sprite>();
  private readonly treeSprites = new Map<number, Sprite>();
  private bridgeCreated = false;
  private readonly labels = new Container();
  private selected: string | null = null;
  private placement: BuildingKind | null = null;
  private hover: Point | null = null;
  private overlay: Overlay = 'none';
  private resizeObserver!: ResizeObserver;
  private unsubscribe?: () => void;
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  onSelect: (id: string | null) => void = () => {};
  onPlace: (message: string, ok: boolean) => void = () => {};
  onHover: (message: string) => void = () => {};
  onZoom: (zoom: number) => void = () => {};
  constructor(
    private readonly game: Game,
    private readonly host: HTMLElement,
  ) {}
  async init() {
    await this.app.init({
      resizeTo: this.host,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(devicePixelRatio, 2),
      autoDensity: true,
      preference: 'webgl',
      autoStart: false,
    });
    this.host.append(this.app.canvas);
    this.app.canvas.setAttribute(
      'aria-label',
      'Isometric map of your Angkor settlement. Drag to pan, scroll to zoom, and click to inspect or build.',
    );
    this.app.canvas.setAttribute('role', 'img');
    this.world.addChild(this.ground, this.routes, this.objects, this.labels, this.highlight);
    this.objects.sortableChildren = true;
    this.app.stage.addChild(this.world);
    for (const tile of this.game.state.tiles) {
      const pos = toScreen(tile.x, tile.y);
      const sprite = new Sprite(this.atlas.get(`${tile.terrain}-${tile.variant}`));
      sprite.anchor.set(0.5, 18 / 56);
      sprite.position.set(pos.x, pos.y);
      this.ground.addChild(sprite);
      this.tileSprites.push(sprite);
      const water = new Sprite(this.atlas.get(`water-${tile.variant}`));
      water.anchor.set(0.5, 18 / 56);
      water.position.set(pos.x, pos.y - 0.4);
      water.alpha = 0;
      this.ground.addChild(water);
      this.waterMarkers.push(water);
    }
    this.addLabel('ROYAL BARAY', 8.5, 8.5, -46);
    this.addLabel('PRASAT SANCTUARY', 17.5, 14.5, -200);
    this.addLabel('TONLÉ SAP', 28, 20, 0);
    this.camera = new Camera(
      this.world,
      this.host,
      (x, y) => this.click(x, y),
      (x, y) => this.move(x, y),
      (zoom) => this.onZoom(zoom),
    );
    this.camera.reset();
    this.resizeObserver = new ResizeObserver(() => {
      this.app.resize();
      this.camera.reset();
    });
    this.resizeObserver.observe(this.host);
    this.unsubscribe = this.game.subscribe(() => this.sync());
    this.sync();
  }
  private addLabel(text: string, x: number, y: number, offset: number) {
    const p = toScreen(x, y);
    const label = new Text({
      text,
      style: {
        fontFamily: 'DM Sans',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 3,
        fill: '#425c45',
        dropShadow: { color: '#eef0d9', alpha: 0.75, blur: 3, distance: 0 },
      },
    });
    label.anchor.set(0.5);
    label.position.set(p.x, p.y + offset);
    this.labels.addChild(label);
  }
  private sync() {
    const state = this.game.state;
    for (let i = 0; i < state.tiles.length; i++) {
      const t = state.tiles[i]!;
      const sprite = this.tileSprites[i]!;
      const key = `${t.terrain}-${t.variant}`;
      if (sprite.label !== key) {
        sprite.texture = this.atlas.get(key);
        sprite.label = key;
      }
      sprite.tint = this.overlay === 'water' ? (t.water > 0.45 ? 0x8fc8d4 : 0xa3ab81) : 0xffffff;
      const channel = ['water', 'reservoir', 'canal'].includes(t.terrain);
      const flood = this.waterMarkers[i]!;
      flood.alpha = channel ? 0 : Math.min(0.6, t.water * 0.55);
      if (channel && t.water < 0.45) sprite.tint = 0xa7ac7b;
      if (t.terrain === 'forest' && !buildingAt(state, t.x, t.y)) {
        if (!this.treeSprites.has(i)) {
          const tree = new Sprite(this.atlas.get(`tree-${t.variant}`));
          const p = toScreen(t.x, t.y);
          tree.anchor.set(0.5, 145 / 160);
          tree.position.set(p.x, p.y);
          tree.scale.set(0.8 + (t.variant % 3) * 0.09);
          tree.zIndex = p.y + 5;
          this.objects.addChild(tree);
          this.treeSprites.set(i, tree);
        }
      } else if (this.treeSprites.has(i)) {
        this.treeSprites.get(i)!.destroy();
        this.treeSprites.delete(i);
      }
      if (t.terrain === 'road' && t.elevation < 0 && !this.bridgeCreated) {
        const bridge = new Graphics()
          .poly([-36, -2, 0, -20, 36, -2, 0, 16])
          .fill(0xb4a073)
          .stroke({ color: 0xd0bd8d, width: 2 });
        const p = toScreen(t.x, t.y);
        bridge.position.set(p.x, p.y - 3);
        bridge.zIndex = p.y + 3;
        this.objects.addChild(bridge);
        this.bridgeCreated = true;
      }
    }
    for (const b of state.buildings) {
      if (b.kind === 'canal') continue;
      const artwork = b.kind === 'temple' && b.level === 1 ? 'temple-foundation' : b.kind;
      let sprite = this.buildingSprites.get(b.id);
      if (!sprite) {
        sprite = new Sprite(this.atlas.get(artwork));
        sprite.anchor.set(0.5, 252 / 320);
        const size = BUILDINGS[b.kind].size;
        const p = toScreen(b.x + (size - 1) / 2, b.y + (size - 1) / 2);
        sprite.position.set(p.x, p.y);
        sprite.zIndex = p.y + size * 8;
        if (size === 1) sprite.scale.set(0.72);
        this.objects.addChild(sprite);
        this.buildingSprites.set(b.id, sprite);
      }
      if (sprite.label !== artwork) {
        sprite.texture = this.atlas.get(artwork);
        sprite.label = artwork;
      }
      sprite.alpha = b.enabled ? 1 : 0.55;
      sprite.tint = this.selected === b.id ? 0xfff2cf : 0xffffff;
    }
    for (const [id, sprite] of this.courierSprites)
      if (!state.couriers.some((c) => c.id === id)) {
        sprite.destroy();
        this.courierSprites.delete(id);
      }
    for (const courier of state.couriers)
      if (!this.courierSprites.has(courier.id)) {
        const sprite = new Sprite(this.atlas.get(courier.kind));
        sprite.anchor.set(0.5, courier.kind === 'barge' ? 0.6 : 0.9);
        sprite.scale.set(courier.kind === 'barge' ? 0.55 : 0.7);
        this.objects.addChild(sprite);
        this.courierSprites.set(courier.id, sprite);
      }
    this.drawRoutes();
    this.drawHighlight();
  }
  render(interpolation: number, elapsed: number) {
    for (const c of this.game.state.couriers) {
      const sprite = this.courierSprites.get(c.id);
      if (!sprite) continue;
      const progress = Math.min(
        c.path.length - 1,
        c.progress +
          (this.game.state.speed > 0 ? interpolation * (c.kind === 'barge' ? 0.23 : 0.42) : 0),
      );
      const index = Math.floor(progress);
      const from = c.path[index]!;
      const to = c.path[Math.min(index + 1, c.path.length - 1)]!;
      const mix = progress - index;
      const p = toScreen(from.x + (to.x - from.x) * mix, from.y + (to.y - from.y) * mix);
      sprite.position.set(
        p.x,
        p.y - (c.kind === 'barge' && !this.reducedMotion ? Math.sin(elapsed * 0.002) * 1.2 : 0),
      );
      sprite.zIndex = p.y + 7;
    }
    this.app.renderer.render(this.app.stage);
  }
  select(id: string | null) {
    this.selected = id;
    this.sync();
  }
  setPlacement(kind: BuildingKind | null) {
    this.placement = kind;
    this.host.classList.toggle('placing', !!kind);
    this.drawHighlight();
  }
  setOverlay(overlay: Overlay) {
    this.overlay = overlay;
    this.sync();
  }
  private point(x: number, y: number) {
    return toGrid((x - this.world.x) / this.camera.zoom, (y - this.world.y) / this.camera.zoom);
  }
  private click(x: number, y: number) {
    const p = this.point(x, y);
    if (this.placement) {
      const result = this.game.place(this.placement, p);
      this.onPlace(result.message, result.ok);
    } else {
      const b = buildingAt(this.game.state, p.x, p.y);
      this.select(b?.id ?? null);
      this.onSelect(b?.id ?? null);
    }
  }
  private move(x: number, y: number) {
    const p = this.point(x, y);
    if (this.hover?.x === p.x && this.hover.y === p.y) return;
    this.hover = p;
    this.drawHighlight();
    if (this.placement) this.onHover(this.game.canPlace(this.placement, p).message);
    else {
      const b = buildingAt(this.game.state, p.x, p.y);
      this.onHover(b ? BUILDINGS[b.kind].name : 'Drag to explore • Scroll to zoom');
    }
  }
  private drawHighlight() {
    this.highlight.clear();
    const selected = this.game.state.buildings.find((b) => b.id === this.selected);
    const origin =
      this.placement && this.hover ? { ...this.hover, kind: this.placement } : selected;
    if (!origin) return;
    const cells = footprint(origin);
    const valid = this.placement ? this.game.canPlace(this.placement, origin).ok : true;
    for (const c of cells) {
      if (!tileAt(this.game.state, c.x, c.y)) continue;
      const p = toScreen(c.x, c.y);
      this.highlight
        .poly([p.x, p.y - 18, p.x + 36, p.y, p.x, p.y + 18, p.x - 36, p.y])
        .fill({ color: valid ? 0xf2dfab : 0xd77c62, alpha: 0.14 })
        .stroke({ color: valid ? 0xf2dfab : 0xd77c62, width: 1.5, alpha: 0.9 });
    }
  }
  private drawRoutes() {
    this.routes.clear();
    if (this.overlay === 'grid')
      for (const t of this.game.state.tiles) {
        const p = toScreen(t.x, t.y);
        this.routes
          .poly([p.x, p.y - 18, p.x + 36, p.y, p.x, p.y + 18, p.x - 36, p.y])
          .stroke({ color: 0x5e7751, width: 0.6, alpha: 0.35 });
      }
    if (this.overlay !== 'logistics') return;
    for (const c of this.game.state.couriers) {
      c.path.forEach((p, i) => {
        const v = toScreen(p.x, p.y);
        if (i === 0) this.routes.moveTo(v.x, v.y);
        else this.routes.lineTo(v.x, v.y);
      });
      this.routes.stroke({ color: c.kind === 'barge' ? 0xeff5da : 0xdac080, width: 3, alpha: 0.7 });
    }
  }
  destroy() {
    this.unsubscribe?.();
    this.resizeObserver.disconnect();
    this.camera.destroy();
    this.app.destroy(true, { children: true });
    this.atlas.texture.destroy(true);
  }
}
