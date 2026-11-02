import { offlineSettings } from '../pwa/OfflineApp';
import { newSlotSelection, slotLibrary, slotDetails } from './SaveSlotsUI';
import type { Persistence, SaveSlot } from '../core/Persistence';
import type { AudioController } from '../audio/AudioController';
import { scenarioPicker, selectedScenario, updateScenarioDetails } from './ScenarioSelection';
import { scenarioFor } from '../data/scenarios';
import { createScenario } from '../core/world';
import type { GameState } from '../core/types';
import { icon } from './icons';
import { angkorEmblem } from './emblem';
import { Game } from '../core/Game';
import { GameLoop } from '../core/GameLoop';
import { WorldRenderer } from '../rendering/WorldRenderer';
import { showcaseKingdom } from '../core/showcaseKingdom';
import './welcome.css';

/**
 * A living kingdom behind the menu: the finished showcase city, running and drifting slowly.
 * It is never saved, and its artwork is reused by the game.
 */
class MenuBackdrop {
  private timer = 0;
  private stopped = false;
  private loop: GameLoop | null = null;
  private renderer: WorldRenderer | null = null;
  private readonly abort = new AbortController();
  constructor(
    private readonly screen: HTMLElement,
    private readonly host: HTMLElement,
  ) {}
  start(state: GameState) {
    if (this.timer || this.stopped) return;
    // Let the menu paint and become usable before the artwork is rendered.
    this.timer = window.setTimeout(() => void this.build(state), 60);
  }
  private async build(state: GameState) {
    if (this.stopped) return;
    try {
      const game = new Game(state);
      const renderer = new WorldRenderer(game, this.host, true);
      await renderer.init();
      if (this.stopped) {
        renderer.destroy({ keepAtlas: true });
        return;
      }
      this.renderer = renderer;
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      let base = { x: renderer.world.x, y: renderer.world.y };
      window.addEventListener(
        'resize',
        () => {
          renderer.camera.reset();
          base = { x: renderer.world.x, y: renderer.world.y };
        },
        { signal: this.abort.signal },
      );
      this.loop = new GameLoop(game, (interpolation, now) => {
        if (!still)
          renderer.world.position.set(
            base.x + Math.sin(now * 0.00006) * 140,
            base.y + Math.sin(now * 0.000045) * 60,
          );
        renderer.render(interpolation, now);
      });
      this.loop.start();
      this.screen.classList.add('world-ready');
    } catch {
      // Without WebGL the menu simply stands on its meadow background.
      this.screen.classList.add('world-ready');
    }
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.abort.abort();
    this.loop?.stop();
    this.renderer?.destroy({ keepAtlas: true });
    this.renderer = null;
  }
}

export interface WelcomeChoice {
  state: GameState;
  restored: boolean;
}

/** Nothing is saved until the player enters a kingdom; the living backdrop is a discarded copy. */
export async function showWelcome(
  root: HTMLElement,
  persistence: Persistence,
  audio: AudioController,
): Promise<WelcomeChoice> {
  root.innerHTML = `<main class="welcome-screen" aria-labelledby="welcome-title">
    <div class="welcome-world" aria-hidden="true"></div>
    <div class="welcome-shade" aria-hidden="true"></div>
    <section class="welcome-center">
      <header class="welcome-logo">
        <span class="royal-mark">${angkorEmblem()}</span>
        <span class="welcome-eyebrow">The Khmer Empire</span>
        <h1 id="welcome-title">Angkor Architect</h1>
        <small lang="km">ស្ថាបត្យករ​អង្គរ</small>
        <p class="welcome-tagline">Tame the monsoon. Raise a temple city.</p>
      </header>
      <nav class="welcome-card" aria-label="Main menu">
        <button class="welcome-play" data-menu="play" disabled>${icon('play')}<span>Play</span></button>
        <button class="welcome-continue" data-menu="continue" aria-describedby="welcome-save" disabled><span><strong>Continue</strong><small id="welcome-save" role="status">Finding your kingdom…</small></span>${icon('arrow-right')}</button>
        <div class="welcome-tools">
          <button class="welcome-tool" data-menu="slots" disabled>${icon('crown-simple')}<span>Kingdoms</span></button>
          <button class="welcome-tool" data-menu="settings">${icon('gear-six')}<span>Settings</span></button>
          <button class="welcome-tool" data-menu="guide">${icon('book-open-text')}<span>Guide</span></button>
        </div>
      </nav>
    </section>
    <footer class="welcome-footer">${icon('floppy-disk')} Saved on this device · Early access v0.2</footer>
    <p class="welcome-loading" aria-hidden="true"><span></span>Preparing your kingdom…</p>
  </main><dialog class="welcome-dialog" aria-labelledby="welcome-dialog-title"></dialog>`;
  const screen = root.querySelector<HTMLElement>('.welcome-screen')!;
  const backdrop = new MenuBackdrop(screen, root.querySelector<HTMLElement>('.welcome-world')!);
  audio.enterMenu();
  backdrop.start(showcaseKingdom());

  const dialog = root.querySelector<HTMLDialogElement>('dialog')!;
  const play = root.querySelector<HTMLButtonElement>('[data-menu="play"]')!;
  const resume = root.querySelector<HTMLButtonElement>('[data-menu="continue"]')!;
  const saveStatus = root.querySelector<HTMLElement>('#welcome-save')!;
  const abort = new AbortController();
  let saved: GameState | null = null;
  let slots: SaveSlot[] = [];
  let busy = false;
  dialog.addEventListener(
    'cancel',
    (event) => {
      if (busy) event.preventDefault();
    },
    { signal: abort.signal },
  );
  const focusDialog = () => {
    const heading = dialog.querySelector<HTMLElement>('h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
    dialog.scrollTop = 0;
  };
  const showLibrary = () => {
    dialog.innerHTML = slotLibrary(slots, persistence.activeSlot);
    if (!dialog.open) dialog.showModal();
    focusDialog();
  };
  const refreshSlots = async () => {
    slots = await persistence.slots();
  };
  const updateReplacement = () => {
    const select = dialog.querySelector<HTMLSelectElement>('#kingdom-slot');
    if (!select) return;
    const slot = slots.find((s) => s.id === Number(select.value))!;
    dialog.querySelector('#slot-replacement-note')!.textContent = slot.checkpoints.length
      ? `This replaces ${slot.name} in slot ${slot.id}. Its recent saves remain available in recovery until newer saves rotate them out. Download a save first to keep a permanent copy.`
      : `Your new kingdom will be saved in empty slot ${slot.id}.`;
    const start = dialog.querySelector<HTMLButtonElement>('[data-menu="start-scenario"]')!;
    start.textContent = slot.checkpoints.length ? 'Replace slot & start' : 'Start kingdom';
  };

  const choice = new Promise<WelcomeChoice>((resolve) => {
    const enter = (state: GameState, restored: boolean) => {
      abort.abort();
      backdrop.stop();
      dialog.close();
      resolve({ state, restored });
    };
    root.addEventListener(
      'click',
      (event) => {
        if (busy) return;
        void (async () => {
          const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
          if (!button || button.disabled || busy) return;
          switch (button.dataset.menu) {
            case 'play':
              dialog.innerHTML = `<button class="dialog-close icon-button" data-menu="close" aria-label="Close scenario selection">${icon('x')}</button><h2 id="welcome-dialog-title">Choose your kingdom.</h2>${scenarioPicker()}${newSlotSelection(slots, persistence.activeSlot)}<div class="settings-buttons"><button class="secondary-button" data-menu="close">Back to menu</button><button class="primary-button" data-menu="start-scenario">Start kingdom</button></div>`;
              updateReplacement();
              dialog.showModal();
              break;
            case 'continue':
              if (saved) enter(saved, true);
              break;
            case 'slots':
              showLibrary();
              break;
            case 'manage-slot': {
              const slot = slots.find((s) => s.id === Number(button.dataset.slot));
              if (slot) {
                dialog.innerHTML = slotDetails(slot);
                focusDialog();
              }
              break;
            }
            case 'rename-slot': {
              const input = dialog.querySelector<HTMLInputElement>('#kingdom-name-input')!;
              if (!input.reportValidity()) return;
              busy = true;
              button.disabled = true;
              await persistence.renameSlot(Number(button.dataset.slot), input.value);
              await refreshSlots();
              dialog.innerHTML = slotDetails(
                slots.find((s) => s.id === Number(button.dataset.slot))!,
              );
              const status = document.createElement('p');
              status.setAttribute('role', 'status');
              status.textContent = 'Kingdom renamed.';
              dialog.append(status);
              focusDialog();
              break;
            }
            case 'open-slot': {
              busy = true;
              button.disabled = true;
              const state = await persistence.load(Number(button.dataset.slot));
              if (!state) throw new Error('No valid save is available in this slot.');
              enter(state, true);
              break;
            }
            case 'recover-slot': {
              busy = true;
              button.disabled = true;
              const state = await persistence.recover(
                Number(button.dataset.slot),
                Number(button.dataset.checkpoint),
              );
              enter(state, true);
              break;
            }
            case 'start-scenario': {
              const input = dialog.querySelector<HTMLInputElement>('#kingdom-name-input')!;
              if (!input.reportValidity()) return;
              busy = true;
              button.disabled = true;
              const state = createScenario(selectedScenario(dialog));
              await persistence.create(
                Number(dialog.querySelector<HTMLSelectElement>('#kingdom-slot')!.value),
                input.value,
                state,
              );
              enter(state, false);
              break;
            }
            case 'close':
              if (saved)
                saveStatus.textContent = `${persistence.activeName} · Day ${saved.day} · ${scenarioFor(saved).region}`;
              dialog.close();
              break;
            case 'guide':
              dialog.innerHTML = `<button class="dialog-close icon-button" data-menu="close" aria-label="Close guide">${icon('x')}</button><span class="eyebrow">The royal builder’s guide</span><h2 id="welcome-dialog-title">First, follow the water.</h2><div class="welcome-guide"><p><strong>01 · Capture the monsoon</strong>Connect a baray reservoir to your waterways. Irrigate your fields with canals.</p><p><strong>02 · Sustain your settlement</strong>Grow rice, build homes, and connect workplaces with roads and river landings.</p><p><strong>03 · Leave a legacy</strong>Complete royal commissions and raise sandstone sanctuaries to earn merit.</p></div><p>Drag to explore · Scroll to zoom · Space to pause</p><button class="primary-button full-width" data-menu="close">Return to menu ${icon('arrow-right')}</button>`;
              dialog.showModal();
              break;
            case 'settings':
              dialog.innerHTML = `<button class="dialog-close icon-button" data-menu="close" aria-label="Close settings">${icon('x')}</button><div class="dialog-symbol">${icon('gear-six')}</div><h2 id="welcome-dialog-title">Make it your own.</h2><div class="settings-row"><span><strong>Evening colors</strong><small>A softer glow after sunset</small></span><button class="theme-switch" role="switch" aria-label="Evening colors" aria-checked="${document.documentElement.dataset.theme === 'dark'}" data-menu="theme"><span></span></button></div>${audio.settingsMarkup()}${offlineSettings()}<p>Kingdoms save automatically every 30 seconds while you play. Continue your game to download or import a save from Settings.</p><button class="primary-button full-width" data-menu="close">Back to menu ${icon('arrow-right')}</button>`;
              dialog.showModal();
              break;
            case 'theme': {
              const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
              document.documentElement.dataset.theme = theme;
              button.setAttribute('aria-checked', String(theme === 'dark'));
              try {
                localStorage.setItem('angkor-cartoon-theme', theme);
              } catch {
                /* Optional preference. */
              }
              break;
            }
          }
        })()
          .catch((error: unknown) => {
            dialog.querySelector('.save-error')?.remove();
            const status = document.createElement('p');
            status.className = 'save-error';
            status.setAttribute('role', 'alert');
            status.textContent =
              error instanceof Error ? error.message : 'This kingdom could not be saved.';
            dialog.append(status);
            status.scrollIntoView({ block: 'nearest' });
            dialog
              .querySelectorAll<HTMLButtonElement>('button')
              .forEach((b) => (b.disabled = false));
          })
          .finally(() => {
            busy = false;
          });
      },
      { signal: abort.signal },
    );
  });

  root.addEventListener(
    'change',
    (event) => {
      if ((event.target as HTMLInputElement).name === 'scenario') updateScenarioDetails(dialog);
      if ((event.target as HTMLElement).id === 'kingdom-slot') updateReplacement();
    },
    { signal: abort.signal },
  );

  try {
    saved = await persistence.load();
    await refreshSlots();
    saveStatus.textContent = saved
      ? `${persistence.activeName} · Day ${saved.day} · ${scenarioFor(saved).region}${slots.find((s) => s.id === persistence.activeSlot)?.damaged ? ' · Recovery available' : ''}`
      : 'Your kingdom is yet to be built';
  } catch {
    saveStatus.textContent =
      'Your saved kingdom could not be read. You can start a new settlement.';
  }
  root.querySelector<HTMLButtonElement>('[data-menu="slots"]')!.disabled = false;
  play.disabled = false;
  resume.disabled = !saved;
  return choice;
}
