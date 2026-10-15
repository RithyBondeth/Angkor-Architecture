import { freshTutorial, inspectTutorialSite } from '../core/tutorialState';
import { tutorialPanel } from './TutorialUI';
import { neighbors } from '../core/world';
import { BUILDINGS, BUILD_ORDER, RESOURCE_INFO } from '../data/buildings';
import { templeDetails, reliefDialog } from './TempleUI';
import { playerFeedback, waterWarnings } from './FeedbackUI';
import { deliveredRate, lowWaterSites, lowReservoirs } from '../simulation/Feedback';
import { workforce } from '../simulation/Workforce';
import { CONFIG, ERAS } from '../data/config';
import { SeasonManager } from '../core/SeasonManager';
import { logisticsDetails, logisticsPanel, logisticsSummary } from './LogisticsUI';
import { storageCapacity } from '../simulation/logisticsRules';
import { Logistics } from '../simulation/Logistics';
import { WaterSimulation } from '../simulation/WaterSimulation';
import { footprint, tileAt } from '../core/world';
import { readGameState } from '../core/Persistence';
import { toScreen } from '../rendering/isometric';
import type { Game } from '../core/Game';
import type { Persistence } from '../core/Persistence';
import type { WorldRenderer } from '../rendering/WorldRenderer';
import type { BuildingKind, Category, GameState, Overlay, Resource } from '../core/types';
import { escapeHtml as esc, icon } from './icons';
import { constructionDetails, constructionPanel, removalDialog } from './ConstructionUI';
import {
  buildingStatus,
  buildingSurvivalDetails,
  foodDays,
  foodNeed,
  survivalPanel,
  survivalSummary,
} from './SurvivalUI';
import { productivity } from '../simulation/survivalRules';
import { buildingUnlocked, earnedMerit } from '../core/progressionState';
import {
  campaignPanel,
  commissionOverview,
  supportDetails,
  templeUpgradeButton,
  unlockPanel,
} from './CampaignUI';

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');
type Panel =
  | 'tutorial'
  | 'overview'
  | 'water'
  | 'workforce'
  | 'monuments'
  | 'chronicle'
  | 'construction'
  | 'survival'
  | 'campaign';

export class HUD {
  private category: Category = 'all';
  private panel: Panel = 'overview';
  private placement: BuildingKind | null = null;
  private selected: string | null = null;
  private overlay: Overlay = 'none';
  private toastTimer = 0;
  private tutorialStep = -1;
  private lastSpeed: 1 | 2 | 4 = 1;
  private readonly abort = new AbortController();
  private readonly root: HTMLElement;
  private readonly inspector: HTMLElement;
  private readonly minimap: HTMLCanvasElement;
  private unsubscribe: () => void;
  private lastMinimapTick = -1;
  private inspectorMarkup = '';
  private inspectorViewKey = '';
  private demolition = false;
  private dialogResumeSpeed: 0 | 1 | 2 | 4 | null = null;
  private lastMapRevision = '';
  private lastUnlocks = '';
  constructor(
    private readonly game: Game,
    private readonly renderer: WorldRenderer,
    private readonly persistence: Persistence,
    private readonly reset: () => Promise<void>,
  ) {
    this.root = document.querySelector('#app')!;
    if (game.state.speed > 0) this.lastSpeed = game.state.speed as 1 | 2 | 4;
    this.inspector = this.root.querySelector('#inspector')!;
    this.minimap = this.root.querySelector('#minimap')!;
    if (game.state.tutorial?.status === 'active') this.panel = 'tutorial';
    this.renderBuildMenu();
    this.bindEvents();
    this.unsubscribe = game.subscribe(() => this.update());
    renderer.onSelect = (id, placed) => {
      this.selected = id;
      if (!placed) inspectTutorialSite(this.game.state, id);
      this.setPanelOpen(!!id);
      this.updateInspector();
    };
    renderer.onPlace = (message, ok) => {
      this.toast(message, !ok);
      this.update();
    };
    renderer.onResource = (message) => this.toast(message);
    renderer.onPreview = (message, ok) => {
      const banner = this.root.querySelector<HTMLElement>('#placement-banner')!;
      banner.classList.toggle('invalid', !ok);
      const status = banner.querySelector('small');
      if (status && this.placement)
        status.textContent = `${BUILDINGS[this.placement].size} × ${BUILDINGS[this.placement].size} · ${Object.entries(
          BUILDINGS[this.placement].cost,
        )
          .map(([r, n]) => `${n} ${r}`)
          .join(' + ')} · ${message}`;
    };
    renderer.onHover = (message) => {
      this.root.querySelector('#map-hint')!.textContent = message;
    };
    renderer.onZoom = (zoom) => {
      this.root.querySelector('#zoom-value')!.textContent = `${Math.round(zoom * 100)}%`;
    };
    this.root.querySelector('#zoom-value')!.textContent =
      `${Math.round(renderer.camera.zoom * 100)}%`;
    renderer.onDemolish = (id) => this.openRemoval(id, false);
    this.update();
    if (game.state.tutorial?.status === 'active') this.showPanel('tutorial');
    if (matchMedia('(max-width: 600px)').matches && game.state.tutorial?.status !== 'active')
      this.setPanelOpen(false);
  }
  private bindEvents() {
    const options = { signal: this.abort.signal };
    this.root.addEventListener(
      'click',
      (e) => {
        const button = (e.target as Element).closest<HTMLElement>('[data-action]');
        if (!button) return;
        const action = button.dataset.action;
        if (action === 'tutorial-start') {
          this.chooseBuilding(null);
          this.game.state.tutorial = freshTutorial();
          this.root.querySelector<HTMLDialogElement>('dialog')!.close();
          this.showPanel('tutorial');
          this.game.notify();
          this.persistence.backup(this.game.state);
        }
        if (action === 'tutorial-skip') {
          if (this.game.state.tutorial) this.game.state.tutorial.status = 'skipped';
          this.renderer.guideSite(null);
          this.showPanel('overview');
          this.game.notify();
          this.persistence.backup(this.game.state);
        }
        if (action === 'tutorial-retry' && this.game.state.tutorial) {
          this.game.state.tutorial.canalId = null;
          this.game.notify();
        }
        if (action === 'tutorial-help') this.helpTutorial();
        if (action === 'excavate-moat') {
          const result = this.game.excavateMoat(button.dataset.id!);
          this.toast(result.message, !result.ok);
        }
        if (action === 'open-relief') this.openRelief(button.dataset.id!);
        if (action === 'rotate-relief') {
          const result = this.game.rotateRelief(button.dataset.id!, Number(button.dataset.cell));
          if (result.ok) {
            this.openRelief(button.dataset.id!);
            const panel = this.root.querySelector<HTMLButtonElement>(
              `dialog [data-cell="${button.dataset.cell}"]`,
            );
            if (panel?.disabled) {
              const status = this.root.querySelector<HTMLElement>('.relief-status')!;
              status.tabIndex = -1;
              status.focus();
            } else panel?.focus();
            this.persistence.backup(this.game.state);
          } else this.toast(result.message, true);
        }
        if (action === 'demolish-mode') this.setDemolition(!this.demolition);
        if (action === 'builder-minus' || action === 'builder-plus') {
          const b = this.game.state.buildings.find((b) => b.id === button.dataset.id);
          if (b?.construction) {
            const r = this.game.assignBuilders(
              b.id,
              b.construction.builders + (action === 'builder-plus' ? 1 : -1),
            );
            if (!r.ok) this.toast(r.message, true);
          }
        }
        if (action === 'pause-project') {
          const r = this.game.pauseProject(button.dataset.id!);
          this.toast(r.message, !r.ok);
        }
        if (action === 'repair') {
          const r = this.game.repair(button.dataset.id!);
          this.toast(r.message, !r.ok);
        }
        if (action === 'cancel-project') this.openRemoval(button.dataset.id!, true);
        if (action === 'remove-structure') this.openRemoval(button.dataset.id!, false);
        if (action === 'confirm-remove') {
          const id = button.dataset.id!;
          const r =
            button.dataset.cancelOnly === 'true'
              ? this.game.cancelConstruction(id)
              : this.game.demolish(id);
          this.root.querySelector<HTMLDialogElement>('dialog')!.close();
          this.selected = this.game.state.buildings.some((b) => b.id === id) ? id : null;
          this.renderer.select(this.selected);
          this.setPanelOpen(true);
          this.updateInspector();
          this.toast(r.message, !r.ok);
        }
        if (action === 'build') this.chooseBuilding(button.dataset.kind as BuildingKind);
        if (action === 'category') {
          this.category = button.dataset.category as Category;
          this.renderBuildMenu();
        }
        if (action === 'return-menu') void this.returnToMenu(button);
        if (action === 'toggle-build') {
          const tray = this.root.querySelector<HTMLElement>('.build-tray')!;
          const collapsed = tray.classList.toggle('collapsed');
          button.setAttribute('aria-expanded', String(!collapsed));
          button.setAttribute(
            'aria-label',
            collapsed ? 'Show building dock' : 'Hide building dock',
          );
          if (collapsed) this.chooseBuilding(null);
        }
        if (action === 'panel') this.showPanel(button.dataset.panel as Panel);
        if (action === 'cancel-build') this.chooseBuilding(null);
        if (action === 'close-inspector') {
          this.selected = null;
          this.renderer.select(null);
          this.setPanelOpen(false);
          this.updateInspector();
        }
        if (action === 'pause')
          this.game.setSpeed(this.game.state.speed === 0 ? this.lastSpeed : 0);
        if (action === 'speed') {
          const speed = Number(button.dataset.speed) as 1 | 2 | 4;
          this.lastSpeed = speed;
          this.game.setSpeed(speed);
        }
        if (action === 'zoom-in') this.renderer.camera.setZoom(this.renderer.camera.zoom * 1.15);
        if (action === 'zoom-out') this.renderer.camera.setZoom(this.renderer.camera.zoom / 1.15);
        if (action === 'recenter') this.renderer.camera.reset();
        if (action === 'overlay')
          this.setOverlay(
            this.overlay === button.dataset.overlay ? 'none' : (button.dataset.overlay as Overlay),
          );
        if (action === 'save') void this.save();
        if (action === 'guide') this.openDialog('guide');
        if (action === 'settings') this.openDialog('settings');
        if (action === 'close-dialog')
          this.root.querySelector<HTMLDialogElement>('dialog')!.close();
        if (action === 'water-buildings') {
          this.category = 'water';
          this.renderBuildMenu();
          this.chooseBuilding('baray');
        }
        if (action === 'toggle-building' && this.selected) this.game.toggleBuilding(this.selected);
        if (action === 'upgrade' && this.selected) {
          const r = this.game.upgrade(this.selected);
          this.toast(r.message, !r.ok);
        }
        if (action === 'select-building') {
          this.selected = button.dataset.id!;
          inspectTutorialSite(this.game.state, this.selected);
          this.renderer.select(this.selected);
          this.setPanelOpen(true);
          this.updateInspector();
        }
        if (action === 'theme') {
          const dark = document.documentElement.dataset.theme !== 'dark';
          document.documentElement.dataset.theme = dark ? 'dark' : 'light';
          try {
            localStorage.setItem('angkor-cartoon-theme', dark ? 'dark' : 'light');
          } catch {
            /* Optional preference. */
          }
          button.setAttribute('aria-checked', String(dark));
        }
        if (action === 'export') {
          const blob = new Blob([JSON.stringify(this.game.state, null, 2)], {
            type: 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `angkor-day-${this.game.state.day}.json`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        if (action === 'import') this.root.querySelector<HTMLInputElement>('#import-file')!.click();
        if (action === 'reset')
          this.root.querySelector<HTMLElement>('#reset-confirm')!.hidden = false;
        if (action === 'cancel-reset')
          this.root.querySelector<HTMLElement>('#reset-confirm')!.hidden = true;
        if (action === 'confirm-reset')
          void this.reset().catch(() => this.toast('The new settlement could not be saved.', true));
      },
      options,
    );
    this.root.querySelector('.build-tabs')!.addEventListener(
      'keydown',
      (event) => {
        const e = event as KeyboardEvent;
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        e.stopPropagation();
        const tabs = Array.from(
          this.root.querySelectorAll<HTMLElement>('[data-action="category"]'),
        );
        const current = tabs.indexOf(e.target as HTMLElement);
        const index =
          e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? tabs.length - 1
              : (current + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        this.category = tabs[index]!.dataset.category as Category;
        this.renderBuildMenu();
        tabs[index]!.focus();
      },
      options,
    );
    document.addEventListener(
      'keydown',
      (e) => {
        if (
          this.root.querySelector<HTMLDialogElement>('dialog')?.open ||
          (e.target instanceof HTMLElement &&
            ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName))
        )
          return;
        if (e.code === 'Escape') {
          if (this.placement || this.demolition) this.chooseBuilding(null);
          else if (this.root.querySelector('.inspector-shell')?.classList.contains('is-open'))
            this.setPanelOpen(false);
          else this.openDialog('settings');
        }
        if (e.key === 'x') this.setDemolition(!this.demolition);
        if (e.code === 'Space') {
          if (e.target instanceof Element && e.target.closest('button, a, summary')) return;
          e.preventDefault();
          this.game.setSpeed(this.game.state.speed === 0 ? this.lastSpeed : 0);
        }
        if (e.key === 'w') this.setOverlay(this.overlay === 'water' ? 'none' : 'water');
        if (e.key === 'l') this.setOverlay(this.overlay === 'logistics' ? 'none' : 'logistics');
        if (e.key === 'r') this.setOverlay(this.overlay === 'resources' ? 'none' : 'resources');
        if (e.key === 'g') this.setOverlay(this.overlay === 'grid' ? 'none' : 'grid');
        if (e.key === '?' || e.key === 'h') this.openDialog('guide');
        if (e.key === '+' || e.key === '=')
          this.renderer.camera.setZoom(this.renderer.camera.zoom * 1.1);
        if (e.key === '-') this.renderer.camera.setZoom(this.renderer.camera.zoom / 1.1);
        const pan: Record<string, [number, number]> = {
          ArrowUp: [0, 35],
          ArrowDown: [0, -35],
          ArrowLeft: [35, 0],
          ArrowRight: [-35, 0],
        };
        if (pan[e.key]) {
          e.preventDefault();
          this.renderer.camera.pan(...pan[e.key]!);
        }
        const index = Number(e.key) - 1;
        if (index >= 0 && index < 6 && BUILD_ORDER[index]) this.chooseBuilding(BUILD_ORDER[index]!);
      },
      options,
    );
    this.root.querySelector<HTMLInputElement>('#import-file')!.addEventListener(
      'change',
      (e) => {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        void (async () => {
          try {
            if (file.size > 5_000_000) throw new Error('This save is too large.');
            const value = readGameState(JSON.parse(await file.text()));
            if (!value) throw new Error('This file is not a compatible Angkor save.');
            await this.persistence.save(value);
            this.game.state = value;
            location.reload();
          } catch (error) {
            this.toast(
              error instanceof Error ? error.message : 'Could not import this save.',
              true,
            );
          } finally {
            input.value = '';
          }
        })();
      },
      options,
    );
    this.root.querySelector<HTMLDialogElement>('dialog')!.addEventListener(
      'close',
      () => {
        if (this.dialogResumeSpeed !== null) {
          const speed = this.dialogResumeSpeed;
          this.dialogResumeSpeed = null;
          this.game.setSpeed(speed);
        }
      },
      { signal: this.abort.signal },
    );
    this.minimap.addEventListener(
      'click',
      (e) => {
        const rect = this.minimap.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * this.game.state.width;
        const y = ((e.clientY - rect.top) / rect.height) * this.game.state.height;
        const p = toScreen(x, y);
        const host = this.root.querySelector<HTMLElement>('#world')!;
        this.renderer.world.position.set(
          host.clientWidth * 0.4 - p.x * this.renderer.camera.zoom,
          host.clientHeight * 0.4 - p.y * this.renderer.camera.zoom,
        );
      },
      options,
    );
  }
  private openRemoval(id: string, cancelOnly: boolean) {
    const b = this.game.state.buildings.find((b) => b.id === id);
    if (!b) return;
    const dialog = this.root.querySelector<HTMLDialogElement>('dialog')!;
    this.dialogResumeSpeed = this.game.state.speed;
    this.game.setSpeed(0);
    dialog.innerHTML = removalDialog(b, this.game.refundFor(id, cancelOnly), cancelOnly);
    dialog.setAttribute('aria-label', 'Review demolition and material refund');
    dialog.showModal();
  }
  private setPanelOpen(open: boolean) {
    if (!open && this.root.querySelector('.inspector-shell')!.contains(document.activeElement))
      this.root
        .querySelector<HTMLElement>(`.nav-item[data-panel="${this.panel}"]`)
        ?.focus({ preventScroll: true });
    this.root.querySelector('.inspector-shell')!.classList.toggle('is-open', open);
    this.inspector.inert = !open;
    this.root.querySelectorAll<HTMLElement>('.nav-item').forEach((button) => {
      button.setAttribute('aria-pressed', String(open && button.dataset.panel === this.panel));
    });
  }
  private async returnToMenu(button: HTMLElement) {
    button.setAttribute('disabled', '');
    try {
      const state = structuredClone(this.game.state);
      // Settings pauses the simulation; preserve the player's prior speed in the save.
      state.speed = this.dialogResumeSpeed ?? state.speed;
      await this.persistence.save(state);
      this.game.state = state;
      location.reload();
    } catch {
      button.removeAttribute('disabled');
      this.toast('Could not save your kingdom. Download a save before leaving.', true);
    }
  }
  private showPanel(panel: Panel) {
    this.panel = panel;
    this.selected = null;
    this.renderer.select(null);
    this.setPanelOpen(true);
    this.setOverlay(panel === 'water' ? 'water' : panel === 'workforce' ? 'logistics' : 'none');
    if (panel === 'water') {
      this.category = 'water';
      this.renderBuildMenu();
    }
    this.root
      .querySelectorAll<HTMLElement>('[data-panel]')
      .forEach((b) => b.classList.toggle('active', b.dataset.panel === panel));
    this.updateInspector();
  }
  private setDemolition(active: boolean) {
    this.demolition = active;
    this.placement = null;
    this.renderer.setPlacement(null);
    this.renderer.setDemolition(active);
    const button = this.root.querySelector<HTMLElement>('[data-action="demolish-mode"]')!;
    button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('active', active);
    const banner = this.root.querySelector<HTMLElement>('#placement-banner')!;
    banner.hidden = !active;
    banner.classList.toggle('removal-banner', active);
    if (active)
      banner.innerHTML = `${icon('trash')}<span><strong>Remove structures</strong><small>Click a site to review its material refund</small></span><button data-action="cancel-build" aria-label="Cancel demolition">${icon('x')}<kbd>Esc</kbd></button>`;
    this.root.querySelectorAll<HTMLElement>('[data-action="build"]').forEach((b) => {
      b.classList.remove('selected');
      b.setAttribute('aria-pressed', 'false');
    });
  }
  private chooseBuilding(kind: BuildingKind | null) {
    if (kind && !buildingUnlocked(this.game.state, kind)) {
      this.chooseBuilding(null);
      this.showPanel('campaign');
      this.toast(`${BUILDINGS[kind].name} unlocks at ${BUILDINGS[kind].unlockMerit} merit.`, true);
      return;
    }
    if (this.demolition) this.setDemolition(false);
    if (kind) {
      this.root.querySelector('.build-tray')!.classList.remove('collapsed');
      const toggle = this.root.querySelector('[data-action="toggle-build"]')!;
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Hide building dock');
      if (this.category !== 'all' && this.category !== BUILDINGS[kind].category) {
        this.category = BUILDINGS[kind].category;
        this.renderBuildMenu();
      }
    }
    this.placement = this.placement === kind ? null : kind;
    const banner = this.root.querySelector<HTMLElement>('#placement-banner')!;
    banner.hidden = !this.placement;
    if (this.placement)
      banner.innerHTML = `${icon(BUILDINGS[this.placement].icon)}<span>Placing <strong>${BUILDINGS[this.placement].name}</strong><small>${BUILDINGS[this.placement].size} × ${BUILDINGS[this.placement].size} tiles · ${Object.entries(
        BUILDINGS[this.placement].cost,
      )
        .map(([r, n]) => `${n} ${r}`)
        .join(
          ' + ',
        )} · Move over a site to preview</small></span><button data-action="cancel-build" aria-label="Cancel building">${icon('x')}<kbd>Esc</kbd></button>`;
    this.renderer.setPlacement(this.placement);
    this.root.querySelectorAll<HTMLElement>('[data-action="build"]').forEach((b) => {
      const selected = b.dataset.kind === this.placement;
      b.classList.toggle('selected', selected);
      b.setAttribute('aria-pressed', String(selected));
    });
  }
  private setOverlay(overlay: Overlay) {
    this.overlay = overlay;
    if (
      overlay === 'water' &&
      this.game.state.tutorial?.status === 'active' &&
      this.game.state.tutorial.step === 0
    ) {
      this.game.state.tutorial.step = 1;
      this.game.notify();
    }
    this.renderer.setOverlay(overlay);
    this.root.querySelectorAll<HTMLElement>('[data-action="overlay"]').forEach((b) => {
      const selected = b.dataset.overlay === overlay;
      b.classList.toggle('active', selected);
      b.setAttribute('aria-pressed', String(selected));
    });
    const label = this.root.querySelector<HTMLElement>('#overlay-label')!;
    label.hidden = overlay === 'none';
    label.textContent =
      overlay === 'water'
        ? 'Water depth overlay'
        : overlay === 'logistics'
          ? 'Active delivery routes'
          : overlay === 'resources'
            ? 'Gold sandstone · clay laterite · green timber'
            : 'Construction grid';
  }
  private renderBuildMenu() {
    this.lastUnlocks = BUILD_ORDER.map((k) => buildingUnlocked(this.game.state, k)).join(':');
    this.root.querySelectorAll<HTMLElement>('[data-action="category"]').forEach((b) => {
      const active = b.dataset.category === this.category;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
      b.tabIndex = active ? 0 : -1;
    });
    this.root.querySelector('#building-list')!.innerHTML = BUILD_ORDER.filter(
      (k) => this.category === 'all' || BUILDINGS[k].category === this.category,
    )
      .map((kind) => {
        const def = BUILDINGS[kind];
        const locked = !buildingUnlocked(this.game.state, kind);
        const cost = Object.entries(def.cost)
          .slice(0, 2)
          .map(([r, n]) => `<span>${icon(RESOURCE_INFO[r as Resource].icon)}${n}</span>`)
          .join('');
        return `<button class="building-card ${kind === this.placement ? 'selected' : ''} ${locked ? 'locked' : ''}" aria-disabled="${locked}" data-action="build" data-kind="${kind}" aria-pressed="${kind === this.placement}" title="${locked ? `Unlocks at ${def.unlockMerit} merit. ` : ''}${def.description} About ${Math.ceil(((def.buildWork / def.builders) * CONFIG.tickMs) / 1000)}s with ${def.builders} builders."><div class="building-art"><img src="${this.renderer.atlas.thumbnail(kind)}" alt="" />${BUILD_ORDER.indexOf(kind) < 6 ? `<kbd>${BUILD_ORDER.indexOf(kind) + 1}</kbd>` : ''}</div><strong>${def.name}</strong><div class="building-cost">${locked ? `<span class="unlock-cost">${icon('lock')}${def.unlockMerit} merit</span>` : cost}<span class="build-plus" title="Recommended builders">${icon('hammer')}${def.builders}</span></div></button>`;
      })
      .join('');
  }
  private helpTutorial() {
    const t = this.game.state.tutorial;
    if (!t || t.status !== 'active') return;
    if (t.step === 0) {
      this.setOverlay('water');
      return;
    }
    if ((t.step === 1 && t.canalId) || t.step >= 3) {
      const id = t.step === 1 ? t.canalId : t.paddyId;
      if (!id) return;
      this.chooseBuilding(null);
      this.selected = id;
      this.renderer.select(id);
      inspectTutorialSite(this.game.state, id);
      this.game.notify();
      this.setPanelOpen(true);
      return;
    }
    const kind = t.step === 1 ? 'canal' : 'paddy';
    const candidates = this.game.state.tiles.filter(
      (tile) =>
        this.game.canPlace(kind, tile).ok &&
        (kind === 'canal'
          ? neighbors(tile).some((p) => {
              const n = tileAt(this.game.state, p.x, p.y);
              return (
                n && ['water', 'canal', 'reservoir', 'moat'].includes(n.terrain) && n.water >= 1.25
              );
            })
          : WaterSimulation.irrigation(this.game.state, tile.x, tile.y) >= 0.5),
    );
    candidates.sort(
      (a, b) => Math.abs(a.x - 14) + Math.abs(a.y - 14) - Math.abs(b.x - 14) - Math.abs(b.y - 14),
    );
    const site = candidates[0];
    this.chooseBuilding(kind);
    if (!site) {
      this.toast(
        'No suitable affordable site found. Check materials and clear land near a filled waterway.',
        true,
      );
      return;
    }
    this.renderer.guideSite({ ...site, kind });
    const point = toScreen(site.x, site.y);
    const host = this.root.querySelector<HTMLElement>('#world')!;
    this.renderer.world.position.set(
      host.clientWidth * 0.42 - point.x * this.renderer.camera.zoom,
      host.clientHeight * 0.45 - point.y * this.renderer.camera.zoom,
    );
    this.setPanelOpen(false);
    this.toast(
      'The gold outline marks a suggested site. Click it on the map to start construction.',
    );
  }
  update() {
    const state = this.game.state;
    const t = state.tutorial;
    if (t && t.step !== this.tutorialStep) {
      const previous = this.tutorialStep;
      this.tutorialStep = t.step;
      this.renderer.guideSite(null);
      if (previous >= 0 && t.status !== 'skipped') {
        this.toast(
          t.status === 'completed'
            ? 'Tutorial complete! Continue with Royal commissions.'
            : `Tutorial lesson ${t.step + 1} ready. Open the book in Kingdom views.`,
        );
        this.persistence.backup(state);
      }
    }
    const season = SeasonManager.at(state.day);
    if (BUILD_ORDER.map((k) => buildingUnlocked(state, k)).join(':') !== this.lastUnlocks) {
      const menu = this.root.querySelector<HTMLElement>('#building-list')!;
      const scroll = menu.scrollLeft;
      const kind = menu.contains(document.activeElement)
        ? (document.activeElement as HTMLElement).dataset.kind
        : undefined;
      this.renderBuildMenu();
      menu.scrollLeft = scroll;
      if (kind)
        menu.querySelector<HTMLElement>(`[data-kind="${kind}"]`)?.focus({ preventScroll: true });
    }
    for (const resource of Object.keys(RESOURCE_INFO) as Resource[]) {
      this.root.querySelector(`#resource-${resource}`)!.textContent = fmt(
        state.resources[resource],
      );
      const rate = deliveredRate(state, resource);
      const rateElement = this.root.querySelector<HTMLElement>(`#rate-${resource}`)!;
      rateElement.textContent = `+${rate.toLocaleString('en-US', { maximumFractionDigits: 1 })} / min ${resource === 'merit' ? 'earned' : 'delivered'}`;
      rateElement.title = `Actual receipts over the last 30 simulation seconds. Potential output: ${Logistics.rate(state, resource).toFixed(1)} per cycle. Rewards and refunds excluded.`;
      const capacity = storageCapacity(state, resource);
      this.root.querySelector<HTMLElement>(`#resource-${resource}`)!.title =
        resource === 'merit'
          ? 'Earned merit'
          : `${fmt(state.resources[resource])} / ${fmt(capacity)} storage${state.resources[resource] >= capacity ? ' · full' : ''}`;
    }
    this.root.querySelector('#logistics-count')!.textContent = String(
      state.buildings.filter(
        (b) => b.deliveryIssue && b.enabled && !b.construction && b.condition > 0,
      ).length || '',
    );
    this.root.querySelector('#population')!.textContent = fmt(state.population);
    this.root.querySelector('#idle-count')!.textContent = `${workforce(state).available} idle`;
    this.root.querySelector('#lowwater-count')!.textContent =
      lowWaterSites(state).length + lowReservoirs(state).length
        ? String(lowWaterSites(state).length + lowReservoirs(state).length)
        : '';
    const riceRate = this.root.querySelector<HTMLElement>('#rate-rice')!;
    riceRate.title += ` ${foodDays(state)} days of rice reserves; ${foodNeed(state)} rice needed per day.`;
    riceRate.classList.toggle('food-warning', state.population > 0 && foodDays(state) < 5);

    this.root.querySelector('#happiness')!.textContent =
      state.survival.hunger > 0
        ? `${Math.round(productivity(state) * 100)}% productive`
        : `${Math.floor(state.happiness)}% content`;
    this.root.querySelector('#game-date')!.textContent = `${season.year} CE`;
    this.root.querySelector('#game-day')!.textContent = `Day ${state.day}`;
    this.root.querySelector('#season-name')!.textContent = season.name;
    this.root.querySelector('#season-detail')!.textContent = season.wet
      ? 'The monsoon is here'
      : 'Make every drop count';
    this.root.querySelector('#season-icon')!.innerHTML = icon(season.wet ? 'cloud-rain' : 'sun');
    this.root.querySelector('#sidebar-season')!.textContent =
      `${season.remaining} days until ${season.wet ? 'dry' : 'wet'} season`;
    this.root.querySelector<HTMLElement>('#season-progress')!.style.width =
      `${season.progress * 100}%`;
    const era = [...ERAS].reverse().find((e) => earnedMerit(state) >= e.merit) ?? ERAS[0];
    this.root.querySelector('#era-name')!.textContent = era.name;
    const pause = this.root.querySelector<HTMLElement>('[data-action="pause"]')!;
    pause.innerHTML = icon(state.speed === 0 ? 'play' : 'pause');
    pause.setAttribute('aria-label', state.speed === 0 ? 'Resume simulation' : 'Pause simulation');
    pause.setAttribute('aria-pressed', String(state.speed === 0));
    this.root.querySelectorAll<HTMLElement>('[data-action="speed"]').forEach((b) => {
      const active = Number(b.dataset.speed) === state.speed;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    this.root.querySelectorAll<HTMLElement>('[data-action="build"]').forEach((b) => {
      const def = BUILDINGS[b.dataset.kind as BuildingKind];
      b.classList.toggle(
        'unaffordable',
        Object.entries(def.cost).some(([r, n]) => state.resources[r as Resource] < n),
      );
    });
    this.root.querySelector('#projects-count')!.textContent = String(
      state.buildings.filter((b) => b.construction).length,
    );
    this.updateInspector();
    const mapRevision =
      state.nextId +
      ':' +
      state.buildings.length +
      ':' +
      state.buildings.filter((b) => !b.construction).length;
    if (
      mapRevision !== this.lastMapRevision ||
      state.tick - this.lastMinimapTick >= 10 ||
      this.lastMinimapTick < 0
    ) {
      this.drawMinimap();
      this.lastMinimapTick = state.tick;
      this.lastMapRevision = mapRevision;
    }
  }
  private updateInspector() {
    const state = this.game.state;
    const selected = state.buildings.find((b) => b.id === this.selected);
    this.inspector.classList.toggle('has-selection', !!selected);
    this.inspector.classList.toggle('is-projects', this.panel !== 'overview');
    if (!selected && this.panel === 'tutorial') {
      this.renderInspector(tutorialPanel(state));
      return;
    }
    if (selected?.construction) {
      this.renderInspector(
        constructionDetails(selected, state, this.renderer.atlas.thumbnail(selected.kind)) +
          templeDetails(selected, state),
      );
      return;
    }
    if (!selected && this.panel === 'construction') {
      this.renderInspector(constructionPanel(state));
      return;
    }
    if (!selected && this.panel === 'campaign') {
      this.renderInspector(campaignPanel(state));
      return;
    }
    if (!selected && this.panel === 'survival') {
      this.renderInspector(survivalPanel(state));
      return;
    }
    if (selected) {
      const def = BUILDINGS[selected.kind];
      const irrigated = WaterSimulation.irrigation(state, selected.x, selected.y, def.size);
      const volume = footprint(selected).reduce(
        (sum, p) => sum + tileAt(state, p.x, p.y)!.water,
        0,
      );
      const fill = Math.min(100, (volume / (def.size * def.size * 6)) * 100);
      this.renderInspector(
        `<div class="panel-eyebrow">${def.category === 'water' ? 'Water management' : def.category === 'production' ? 'Production' : def.category === 'infrastructure' ? 'Paths & bridges' : 'Civic life'}<button class="icon-button" data-action="close-inspector" aria-label="Close building details">${icon('x')}</button></div><h2>${selected.kind === 'baray' ? 'Royal Baray' : def.name}</h2><p class="panel-subtitle">${def.subtitle}</p><div class="inspector-art"><img src="${this.renderer.atlas.thumbnail(selected.kind)}" alt="Isometric ${def.name.toLowerCase()}" /></div><div class="operational ${selected.enabled && selected.condition === 100 && !selected.crop?.failed ? '' : 'idle'}">${icon(selected.condition < 100 || selected.crop?.failed ? 'warning' : selected.enabled ? 'check-circle' : 'pause-circle')}${buildingStatus(selected)}</div><p class="building-description">${def.description}</p>${buildingSurvivalDetails(selected, state)}${supportDetails(selected, state)}${logisticsDetails(selected, state)}${templeDetails(selected, state)}${selected.kind === 'baray' ? `<div class="stat-heading"><span>Water stored</span><strong>${Math.round(fill)}%</strong></div><div class="water-meter"><span style="width:${fill}%"></span></div><div class="water-volume">${fmt(volume * 40)} <span>/ ${fmt(def.size * def.size * 6 * 40)} m³</span></div><div class="detail-row"><span>${icon('cloud-rain')}Current season</span><strong>${SeasonManager.at(state.day).name}</strong></div><div class="detail-row"><span>${icon('plant')}Irrigated fields</span><strong>${state.buildings.filter((b) => b.kind === 'paddy' && !b.construction && WaterSimulation.irrigation(state, b.x, b.y) > 0.2).length} fields</strong></div>` : `<div class="detail-row"><span>${icon('users')}Workers</span><strong>${def.workers}</strong></div>${def.production ? `<div class="detail-row"><span>${icon(RESOURCE_INFO[def.production.resource].icon)}Potential / cycle</span><strong>+${fmt(Logistics.outputs(state).get(selected.id) ?? 0)} ${RESOURCE_INFO[def.production.resource].name.toLowerCase()}</strong></div>` : ''}${selected.kind === 'paddy' ? `<div class="detail-row"><span>${icon('drop')}Irrigation</span><strong>${Math.round(irrigated * 100)}%</strong></div>` : ''}${selected.stock ? `<div class="detail-row"><span>Awaiting transport</span><strong>${fmt(selected.stock)}</strong></div>` : ''}`}${selected.kind === 'temple' ? `<div class="temple-stages">${['Laterite foundation', 'Sandstone towers', 'Sculpted reliefs'].map((s, i) => `<span class="${i < selected.level ? 'done' : ''}">${icon(i < selected.level ? 'check-circle' : 'circle')}${s}</span>`).join('')}</div>${templeUpgradeButton(selected, state)}` : ''}${!['baray', 'canal', 'moat', 'house', 'road', 'bridge'].includes(selected.kind) ? `<button class="secondary-button full-width" data-action="toggle-building">${icon(selected.enabled ? 'pause' : 'play')}${selected.kind === 'gate' ? (selected.enabled ? 'Close floodgate' : 'Open floodgate') : ['granary', 'workshop', 'warehouse'].includes(selected.kind) ? (selected.enabled ? 'Pause service' : 'Resume service') : selected.enabled ? 'Pause production' : 'Resume production'}</button>` : ''}<button class="remove-structure full-width" data-action="remove-structure" data-id="${selected.id}" aria-label="Remove structure">${icon('trash')}Remove structure<span>Review refund</span></button>`,
      );
      return;
    }
    if (this.panel === 'overview') {
      this.renderInspector(
        commissionOverview(state) +
          playerFeedback(state) +
          survivalSummary(state) +
          logisticsSummary(state),
      );
    } else if (this.panel === 'water') {
      const channels = state.tiles.filter((t) =>
        ['canal', 'moat', 'reservoir', 'bridge'].includes(t.terrain),
      );
      const stored = channels.reduce((n, t) => n + t.water, 0);
      this.renderInspector(
        `<div class="panel-eyebrow">Hydraulic network ${icon('waves')}</div><h2>Water is life.</h2>${playerFeedback(state)}${waterWarnings(state)}<p class="panel-subtitle">Guide it wisely through your kingdom.</p><div class="big-stat">${fmt(stored * 40)}<small>m³ in reservoirs & canals</small></div><div class="detail-row"><span>Reservoirs</span><strong>${state.buildings.filter((b) => b.kind === 'baray' && !b.construction).length}</strong></div><div class="detail-row"><span>Canal tiles</span><strong>${state.tiles.filter((t) => t.terrain === 'canal').length}</strong></div><div class="detail-row"><span>Irrigated fields</span><strong>${state.buildings.filter((b) => b.kind === 'paddy' && !b.construction && WaterSimulation.irrigation(state, b.x, b.y) > 0.2).length}</strong></div><p class="building-description">The blue overlay reveals water depth. Low land fills first; connected canals carry water and stone through the city.</p><button class="primary-button" data-action="water-buildings">${icon('plus')}Build a reservoir</button>`,
      );
    } else if (this.panel === 'workforce') {
      this.renderInspector(logisticsPanel(state));
    } else if (this.panel === 'monuments') {
      this.renderInspector(
        `<div class="panel-eyebrow">Monuments & merit ${icon('bank')}</div><h2>A legacy in stone.</h2><p class="panel-subtitle">Build sanctuaries. Earn divine favor.</p><div class="big-stat">${fmt(state.resources.merit)}<small>merit earned by your city</small></div>${
          state.buildings
            .filter((b) => b.kind === 'temple')
            .map(
              (b) =>
                `<button class="monument-row" data-action="select-building" data-id="${b.id}"><img src="${this.renderer.atlas.thumbnail('temple')}" alt=""/><span><strong>Prasat sanctuary</strong><small>Stage ${b.level} of 3</small></span>${icon('arrow-up-right')}</button>`,
            )
            .join('') ||
          '<p class="building-description">Establish your first temple to begin earning merit.</p>'
        }<div class="era-note">${icon('scroll')}<span>${ERAS.find((e) => e.merit > earnedMerit(state))?.description ?? 'Your city has entered the age of great temples.'}</span></div>${unlockPanel(state)}`,
      );
    } else {
      this.renderInspector(
        `<div class="panel-eyebrow">The city chronicle ${icon('scroll')}</div><h2>A story unfolding.</h2><p class="panel-subtitle">Remember the making of your city.</p><div class="chronicle-list">${state.chronicle
          .slice(0, 7)
          .map(
            (e) =>
              `<article>${icon(e.icon)}<div><strong>${esc(e.title)}</strong><p>${esc(e.text)}</p><small>Day ${12 + Math.floor(e.tick / CONFIG.ticksPerDay)}</small></div></article>`,
          )
          .join('')}</div>`,
      );
    }
  }
  private renderInspector(markup: string) {
    if (this.game.state.tutorial?.status === 'active' && this.selected)
      markup =
        '<button class="secondary-button full-width" data-action="panel" data-panel="tutorial">Return to tutorial lesson</button>' +
        markup;
    if (markup === this.inspectorMarkup) return;
    this.inspectorMarkup = markup;
    const key = `${this.selected ?? this.panel}:${this.game.state.progression.claimed.length}`;
    const sameView = key === this.inspectorViewKey;
    const scroll = sameView ? this.inspector.scrollTop : 0;
    const chapters = sameView
      ? Array.from(this.inspector.querySelectorAll<HTMLDetailsElement>('[data-commission-id]')).map(
          (d) => [d.dataset.commissionId, d.open] as const,
        )
      : [];
    const focused =
      sameView && this.inspector.contains(document.activeElement)
        ? (document.activeElement as HTMLElement)
        : null;
    const action = focused?.dataset.action;
    const id = focused?.dataset.id;
    const kind = focused?.dataset.kind;
    const panel = focused?.dataset.panel;
    const chapter = focused?.closest<HTMLElement>('[data-commission-id]')?.dataset.commissionId;
    this.inspector.innerHTML = markup;
    this.inspectorViewKey = key;
    for (const [id, open] of chapters) {
      const details = this.inspector.querySelector<HTMLDetailsElement>(
        `[data-commission-id="${id}"]`,
      );
      if (details) details.open = open;
    }
    this.inspector.scrollTop = scroll;
    if (action) {
      const replacement = Array.from(
        this.inspector.querySelectorAll<HTMLElement>('[data-action]'),
      ).find(
        (b) =>
          b.dataset.action === action &&
          b.dataset.id === id &&
          b.dataset.kind === kind &&
          b.dataset.panel === panel,
      );
      replacement?.focus({ preventScroll: true });
    } else if (chapter) {
      this.inspector
        .querySelector<HTMLElement>(`[data-commission-id="${chapter}"] > summary`)
        ?.focus({ preventScroll: true });
    }
  }
  private drawMinimap() {
    const c = this.minimap.getContext('2d')!;
    const s = this.game.state;
    const size = 4;
    this.minimap.width = s.width * size;
    this.minimap.height = s.height * size;
    for (const t of s.tiles) {
      c.fillStyle =
        t.terrain === 'water'
          ? '#50aeb8'
          : t.terrain === 'forest'
            ? '#76ae51'
            : ['canal', 'moat', 'reservoir', 'bridge'].includes(t.terrain)
              ? '#6fc0c4'
              : t.terrain === 'road'
                ? '#d2c7a0'
                : '#a5cb77';
      c.fillRect(t.x * size, t.y * size, size, size);
    }
    for (const b of s.buildings) {
      if (!b.construction && ['canal', 'moat', 'road', 'bridge'].includes(b.kind)) continue;
      c.fillStyle = b.construction
        ? '#b99b66'
        : b.kind === 'baray'
          ? '#50b4bc'
          : b.kind === 'paddy'
            ? '#c1be75'
            : '#dfd0ab';
      const d = BUILDINGS[b.kind].size;
      c.fillRect(b.x * size, b.y * size, d * size, d * size);
    }
    c.strokeStyle = '#fff6d9';
    c.lineWidth = 1.2;
    c.strokeRect(7 * size, 6 * size, 19 * size, 20 * size);
  }
  async save(quiet = false) {
    const status = this.root.querySelector('#save-status')!;
    status.textContent = 'Saving…';
    try {
      const medium = await this.persistence.save(this.game.state);
      status.textContent = 'Saved locally';
      if (!quiet)
        this.toast(
          medium === 'IndexedDB'
            ? 'Kingdom saved, with a local backup.'
            : 'Kingdom saved to local browser storage.',
        );
    } catch (error) {
      status.textContent = 'Save unavailable';
      if (!quiet) this.toast(error instanceof Error ? error.message : 'Unable to save.', true);
    }
  }
  toast(message: string, error = false) {
    const toast = this.root.querySelector<HTMLElement>('#toast')!;
    toast.innerHTML = `${icon(error ? 'warning-circle' : 'check-circle')}<span>${esc(message)}</span>`;
    toast.classList.toggle('error', error);
    toast.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 4200);
  }
  private openRelief(id: string) {
    const b = this.game.state.buildings.find((b) => b.id === id && b.engineering);
    if (!b || b.level !== 2 || b.construction?.type !== 'upgrade') return;
    const dialog = this.root.querySelector<HTMLDialogElement>('dialog')!;
    if (!dialog.open) {
      this.dialogResumeSpeed = this.game.state.speed;
      this.game.setSpeed(0);
    }
    dialog.setAttribute('aria-label', 'Bas-relief carving');
    dialog.innerHTML = reliefDialog(b);
    if (!dialog.open) dialog.showModal();
  }
  private openDialog(kind: 'guide' | 'settings') {
    const dialog = this.root.querySelector<HTMLDialogElement>('dialog')!;
    this.dialogResumeSpeed = this.game.state.speed;
    this.game.setSpeed(0);
    dialog.setAttribute('aria-label', kind === 'guide' ? 'Builder’s guide' : 'Game settings');
    dialog.innerHTML = `<button class="dialog-close icon-button" data-action="close-dialog" aria-label="Close dialog">${icon('x')}</button>${kind === 'guide' ? `<div class="dialog-symbol">${icon('book-open-text')}</div><span class="eyebrow">The royal builder’s guide</span><h2>Every great city<br>begins with water.</h2><p>Capture the monsoon in barays, connect your fields with canals, and turn a flourishing settlement into a temple city.</p><div class="guide-steps"><div>${icon('waves')}<span><strong>Capture & connect</strong>Build reservoirs on clear land. Join them to a river or a filled canal so water can flow.</span></div><div>${icon('grains')}<span><strong>Grow & sustain</strong>Irrigate paddies within two tiles of water. Workers bring rice and timber home over dry land. Roads speed up deliveries; timber bridges span waterways. Drought stress reaches crop failure at 70%; restore irrigation before harvests are lost.</span></div><div>${icon('bank')}<span><strong>Build & remember</strong>Connect quarries to river landings by water. Assign builders to each site. Follow the five royal commissions to earn rewards. At 200 merit unlock granaries; at 600 unlock workshops and sculpted sanctuaries.</span></div><div>${icon('warehouse')}<span><strong>Store & deliver</strong>Warehouses receive land cargo, expand storage, and add two carts when staffed. A staffed landing supplies one stone barge. Laterite comes from dedicated pits. Use Resources (R) to find finite mineral deposits and timber. People & logistics explains blocked deliveries.</span></div><div>${icon('bowl-food')}<span><strong>Weather & survive</strong>Feed residents daily. Hunger slows all work and prolonged shortages drive people away. Inspect Food & resilience for risks; repair flooded structures after water recedes.</span></div></div><button class="primary-button full-width" data-action="tutorial-start">Start or restart interactive tutorial</button><div class="keyboard-guide"><span><kbd>Space</kbd>Pause</span><span><kbd>1</kbd>–<kbd>6</kbd>Build</span><span><kbd>W</kbd>Water</span><span><kbd>L</kbd>Logistics</span><span><kbd>R</kbd>Resources</span><span><kbd>G</kbd>Grid</span><span><kbd>X</kbd>Demolish</span><span><kbd>Esc</kbd>Cancel</span></div><button class="primary-button full-width" data-action="close-dialog">Begin your legacy ${icon('arrow-right')}</button>` : `<div class="dialog-symbol">${icon('sliders-horizontal')}</div><span class="eyebrow">Make yourself at home</span><h2>Your kingdom,<br>your way.</h2><p>Your city is saved automatically every 30 seconds in this browser. Download a copy to keep it with you.</p><div class="settings-row"><span><strong>Evening colors</strong><small>A softer glow after sunset</small></span><button class="theme-switch" role="switch" aria-label="Evening colors" aria-checked="${document.documentElement.dataset.theme === 'dark'}" data-action="theme"><span></span></button></div><div class="settings-buttons"><button class="secondary-button" data-action="export">${icon('download-simple')}Download save</button><button class="secondary-button" data-action="import">${icon('upload-simple')}Import save</button></div><button class="secondary-button full-width" data-action="save">${icon('floppy-disk')}Save kingdom now</button><button class="secondary-button full-width return-menu" data-action="return-menu">${icon('sign-out')}Save & return to main menu</button><div class="reset-section"><button class="text-button" data-action="reset">Start a new settlement</button><div id="reset-confirm" hidden><p>This replaces the city saved in this browser. Download a copy first if you want to keep it.</p><div class="settings-buttons"><button class="secondary-button" data-action="cancel-reset">Keep this city</button><button class="danger-button" data-action="confirm-reset">Start fresh</button></div></div></div>`}`;
    dialog.showModal();
  }
  destroy() {
    this.abort.abort();
    this.unsubscribe();
    clearTimeout(this.toastTimer);
  }
}

export { createShell } from './Shell';

export function applyTheme() {
  let theme = 'light';
  try {
    theme = localStorage.getItem('angkor-cartoon-theme') ?? theme;
  } catch {
    /* Default to the system palette. */
  }
  document.documentElement.dataset.theme = theme;
}

export function exportDebugSnapshot(state: GameState) {
  return {
    day: state.day,
    tick: state.tick,
    resources: { ...state.resources },
    buildings: state.buildings.length,
    couriers: state.couriers.length,
  };
}
