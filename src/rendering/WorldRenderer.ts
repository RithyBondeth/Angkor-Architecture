import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import { moatRing, templeBlocked } from '../simulation/TempleEngineering';
import { BUILDINGS } from '../data/buildings';
import { buildingAt, footprint, tileAt } from '../core/world';
import type { BuildingKind, Overlay, Point } from '../core/types';
import { resourceDescription } from '../simulation/Deposits';
import { ISSUE_TEXT } from '../simulation/logisticsRules';
import { movementRate } from '../simulation/Pathfinding';
import { constructionSite } from './ConstructionSite';
import { floodUnsafe } from '../simulation/survivalRules';
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
  private readonly tutorialMarker = new Graphics();
  private readonly ambience = new Graphics();
  private readonly ghost = new Sprite();
  private readonly tileSprites: Sprite[] = [];
  private readonly waterMarkers: Sprite[] = [];
  private readonly buildingSprites = new Map<string, Sprite>();
  private readonly courierSprites = new Map<string, Sprite>();
  private readonly treeSprites = new Map<number, Sprite>();
  private readonly sites = new Map<string, ReturnType<typeof constructionSite>>();
  private readonly riskLabels = new Map<string, Text>();
  private demolition = false;
  private readonly labels = new Container();
  private selected: string | null = null;
  private placement: BuildingKind | null = null;
  private hover: Point | null = null;
  private overlay: Overlay = 'none';
  private resizeObserver!: ResizeObserver;
  private unsubscribe?: () => void;
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  onPreview: (message: string, ok: boolean) => void = () => {};
  onResource: (message: string) => void = () => {};
  onSelect: (id: string | null, placed?: boolean) => void = () => {};
  onPlace: (message: string, ok: boolean) => void = () => {};
  onHover: (message: string) => void = () => {};
  onZoom: (zoom: number) => void = () => {};
  onDemolish: (id: string) => void = () => {};
  constructor(
    private readonly game: Game,
    private readonly host: HTMLElement,
  ) {}
  async init() {
    await this.atlas.loadIllustrations();
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
    this.world.addChild(
      this.ground,
      this.routes,
      this.objects,
      this.labels,
      this.ghost,
      this.highlight,
      this.tutorialMarker,
    );
    this.objects.sortableChildren = true;
    this.app.stage.addChild(this.world, this.ambience);
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
    this.addLabel('ROYAL BARAY', 8.5, 8.5, 76);
    this.addLabel('PRASAT SANCTUARY', 17.5, 14.5, 112);
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
        fontFamily: 'Fredoka',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1.5,
        fill: '#fff5d5',
        dropShadow: { color: '#466b3e', alpha: 0.8, blur: 1, distance: 2 },
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
      if (this.overlay === 'resources')
        sprite.tint =
          t.mineral && t.mineral.remaining > 0
            ? t.mineral.resource === 'sandstone'
              ? 0xffe1a3
              : 0xed8b61
            : t.terrain === 'forest' && t.timber > 0
              ? 0x7cb85c
              : 0x8e9988;
      const channel = ['water', 'reservoir', 'moat', 'canal', 'bridge'].includes(t.terrain);
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
    }
    for (const [id, sprite] of this.buildingSprites)
      if (!state.buildings.some((b) => b.id === id)) {
        sprite.destroy();
        this.buildingSprites.delete(id);
      }
    for (const [id, site] of this.sites)
      if (!state.buildings.some((b) => b.id === id && b.construction)) {
        site.view.destroy({ children: true });
        this.sites.delete(id);
      }
    for (const [id, label] of this.riskLabels)
      if (
        !state.buildings.some(
          (b) =>
            b.id === id &&
            !b.construction &&
            (b.condition < 100 || (b.crop?.stress ?? 0) >= 30 || !!b.deliveryIssue),
        )
      ) {
        label.destroy();
        this.riskLabels.delete(id);
      }
    for (const b of state.buildings) {
      const size = BUILDINGS[b.kind].size;
      const center = toScreen(b.x + (size - 1) / 2, b.y + (size - 1) / 2);
      if (b.construction) {
        let site = this.sites.get(b.id);
        if (!site) {
          site = constructionSite(b, this.atlas);
          site.view.position.set(center.x, center.y);
          site.view.zIndex = center.y + size * 8 + 1;
          this.objects.addChild(site.view);
          this.sites.set(b.id, site);
        }
        const p = b.construction;
        site.label.text = p.paused
          ? 'Paused'
          : templeBlocked(b)
            ? b.engineering!.stability < 40
              ? 'Unstable'
              : 'Carve relief'
            : p.type === 'repair' && floodUnsafe(state, b)
              ? 'Flooded'
              : !p.builders
                ? 'Queued'
                : `${Math.floor((p.workDone / p.workRequired) * 100)}%`;
        site.label.style.fontSize = 9;
        site.workers.forEach((worker, i) => (worker.visible = !p.paused && i < p.builders));
      }
      if (
        !b.construction &&
        (b.condition < 100 || (b.crop?.stress ?? 0) >= 30 || !!b.deliveryIssue)
      ) {
        let label = this.riskLabels.get(b.id);
        if (!label) {
          label = new Text({
            text: '',
            style: {
              fontFamily: 'Fredoka',
              fontSize: 10,
              fontWeight: '600',
              fill: 0xfff2df,
              stroke: { color: 0x584a35, width: 4 },
            },
          });
          label.anchor.set(0.5);
          label.position.set(center.x, center.y + size * 18 + 12);
          label.zIndex = center.y + size * 8 + 2;
          this.objects.addChild(label);
          this.riskLabels.set(b.id, label);
        }
        label.text =
          b.condition === 0
            ? 'Ruined'
            : b.crop?.failed
              ? 'Crop failed'
              : b.condition < 100
                ? `${Math.round(b.condition)}% condition`
                : (b.crop?.stress ?? 0) >= 30
                  ? 'Drought stress'
                  : b.deliveryIssue
                    ? ISSUE_TEXT[b.deliveryIssue].title
                    : '';
      }
      if (b.kind === 'road' && b.condition < 100)
        this.tileSprites[b.y * state.width + b.x]!.tint = 0xb19b81;
      if (b.kind === 'canal' || b.kind === 'moat' || b.kind === 'road') continue;
      const artwork =
        b.kind === 'temple'
          ? b.level === 1
            ? 'temple-foundation'
            : b.level === 2
              ? 'temple-towers'
              : 'temple'
          : b.kind;
      let sprite = this.buildingSprites.get(b.id);
      if (!sprite) {
        sprite = new Sprite(this.atlas.get(artwork));
        sprite.anchor.set(0.5, 252 / 320);
        const size = BUILDINGS[b.kind].size;
        const p = toScreen(b.x + (size - 1) / 2, b.y + (size - 1) / 2);
        sprite.position.set(p.x, p.y);
        sprite.zIndex = p.y + size * 8;
        if (size === 1 && b.kind !== 'bridge') sprite.scale.set(0.72);
        this.objects.addChild(sprite);
        this.buildingSprites.set(b.id, sprite);
      }
      if (sprite.label !== artwork) {
        sprite.texture = this.atlas.get(artwork);
        sprite.label = artwork;
      }
      sprite.alpha =
        b.construction?.type === 'build'
          ? 0.28
          : b.construction?.type === 'upgrade'
            ? 0.7
            : b.enabled
              ? 1
              : 0.55;
      sprite.tint =
        this.selected === b.id
          ? 0xfff2cf
          : b.crop?.failed
            ? 0xb9a075
            : b.condition < 100
              ? 0xc8a080
              : 0xffffff;
    }
    this.labels.children[0]!.visible = state.buildings.some(
      (b) => b.kind === 'baray' && b.x === 7 && b.y === 8,
    );
    this.labels.children[1]!.visible = state.buildings.some(
      (b) => b.kind === 'temple' && b.x === 16 && b.y === 13,
    );
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
    this.ambience.clear();
    if (!this.reducedMotion) {
      const width = this.host.clientWidth;
      const height = this.host.clientHeight;
      for (let i = 0; i < 22; i++) {
        const x = (i * 137.7 + Math.sin(elapsed * 0.00012 + i) * 28 + width) % width;
        const y = (i * 79.3 - elapsed * (0.002 + (i % 3) * 0.001) + height * 100) % height;
        this.ambience
          .circle(x, y, i % 3 === 0 ? 1.8 : 1)
          .fill({ color: 0xe8d6a3, alpha: 0.12 + Math.sin(elapsed * 0.0006 + i) * 0.07 });
      }
    }
    for (const c of this.game.state.couriers) {
      const sprite = this.courierSprites.get(c.id);
      if (!sprite) continue;
      const progress = Math.min(
        c.path.length - 1,
        c.progress +
          (this.game.state.speed > 0 ? interpolation * movementRate(this.game.state, c) : 0),
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
  guideSite(site: (Point & { kind: BuildingKind }) | null) {
    this.tutorialMarker.clear();
    if (!site) return;
    this.hover = site;
    this.drawHighlight();
    for (const cell of footprint(site)) {
      const p = toScreen(cell.x, cell.y);
      this.tutorialMarker
        .poly([p.x, p.y - 18, p.x + 36, p.y, p.x, p.y + 18, p.x - 36, p.y])
        .fill({ color: 0xffd66b, alpha: 0.25 })
        .stroke({ color: 0xffd66b, width: 3 });
    }
  }
  setPlacement(kind: BuildingKind | null) {
    this.guideSite(null);
    this.placement = kind;
    this.host.classList.toggle('placing', !!kind);
    this.drawHighlight();
  }
  setDemolition(active: boolean) {
    this.demolition = active;
    this.host.classList.toggle('demolishing', active);
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
    if (this.demolition) {
      const b = buildingAt(this.game.state, p.x, p.y);
      if (b) this.onDemolish(b.id);
      else this.onPlace('Choose a building, road, or bridge to remove.', false);
    } else if (this.placement) {
      const result = this.game.place(this.placement, p);
      this.onPlace(result.message, result.ok);
      if (result.ok) {
        const b = buildingAt(this.game.state, p.x, p.y);
        this.select(b?.id ?? null);
        this.onSelect(b?.id ?? null, true);
      }
    } else {
      const b = buildingAt(this.game.state, p.x, p.y);
      this.select(b?.id ?? null);
      this.onSelect(b?.id ?? null);
      if (this.overlay === 'resources') {
        const t = tileAt(this.game.state, p.x, p.y);
        if (t) this.onResource(resourceDescription(t));
      }
    }
  }
  private move(x: number, y: number) {
    const p = this.point(x, y);
    if (this.hover?.x === p.x && this.hover.y === p.y) return;
    this.hover = p;
    this.drawHighlight();
    if (this.demolition) {
      const b = buildingAt(this.game.state, p.x, p.y);
      this.onHover(
        b
          ? `Click to review removal of ${BUILDINGS[b.kind].name.toLowerCase()}.`
          : 'Choose a structure to remove.',
      );
    } else if (this.placement) this.onHover(this.game.canPlace(this.placement, p).message);
    else {
      const b = buildingAt(this.game.state, p.x, p.y);
      const t = tileAt(this.game.state, p.x, p.y);
      this.onHover(
        this.overlay === 'resources' && t
          ? resourceDescription(t)
          : b
            ? BUILDINGS[b.kind].name
            : 'Drag to explore • Scroll to zoom',
      );
    }
  }
  private drawHighlight() {
    this.highlight.clear();
    this.ghost.visible = false;
    const selected = this.game.state.buildings.find((b) => b.id === this.selected);
    const origin =
      this.demolition && this.hover
        ? buildingAt(this.game.state, this.hover.x, this.hover.y)
        : this.placement && this.hover
          ? { ...this.hover, kind: this.placement }
          : selected;
    if (!origin) return;
    if (origin.kind === 'temple')
      for (const c of moatRing(origin)) {
        const t = tileAt(this.game.state, c.x, c.y);
        if (!t) continue;
        const p = toScreen(c.x, c.y);
        const occupied = buildingAt(this.game.state, c.x, c.y);
        this.highlight.poly([p.x, p.y - 18, p.x + 36, p.y, p.x, p.y + 18, p.x - 36, p.y]).stroke({
          color:
            occupied && !['canal', 'moat', 'bridge'].includes(occupied.kind) ? 0xcf9b6c : 0x64a9ad,
          width: 1.5,
          alpha: 0.8,
        });
      }
    const cells = footprint(origin);
    if (this.placement && this.hover) {
      const result = this.game.canPlace(this.placement, this.hover);
      const size = BUILDINGS[this.placement].size;
      this.ghost.texture = this.atlas.get(
        this.placement === 'temple' ? 'temple-foundation' : this.placement,
      );
      this.ghost.anchor.set(0.5, 252 / 320);
      this.ghost.scale.set(size === 1 && this.placement !== 'bridge' ? 0.72 : 1);
      const center = toScreen(origin.x + (size - 1) / 2, origin.y + (size - 1) / 2);
      this.ghost.position.set(center.x, center.y);
      this.ghost.alpha = 0.5;
      this.ghost.tint = result.ok ? 0xdcebc3 : 0xe6a18c;
      this.ghost.visible = true;
      this.onPreview(result.message, result.ok);
    }
    const valid = this.demolition
      ? false
      : this.placement
        ? this.game.canPlace(this.placement, origin).ok
        : true;
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
    if (this.overlay === 'resources')
      for (const t of this.game.state.tiles) {
        if (!t.mineral || t.mineral.remaining <= 0) continue;
        const p = toScreen(t.x, t.y);
        this.routes
          .circle(p.x, p.y, 6)
          .fill({ color: t.mineral.resource === 'sandstone' ? 0xffe1a3 : 0xcd6340, alpha: 0.95 })
          .stroke({ color: 0x594a35, width: 1.5 });
      }
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
