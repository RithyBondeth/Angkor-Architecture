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
import './welcome.css';

export interface WelcomeChoice {
  state: GameState;
  restored: boolean;
}

/** No renderer, simulation, or autosave starts until the player enters their kingdom. */
export async function showWelcome(
  root: HTMLElement,
  persistence: Persistence,
  audio: AudioController,
): Promise<WelcomeChoice> {
  root.innerHTML = `<main class="welcome-screen" aria-labelledby="welcome-title">
    <img class="welcome-backdrop" src="/art/angkor-cartoon.jpg" alt="" fetchpriority="high" />
    <div class="welcome-shade" aria-hidden="true"></div>
    <header class="welcome-header">
      <span class="welcome-brand"><span class="royal-mark">${angkorEmblem()}</span><span>ANGKOR<span class="brand-subtitle">ARCHITECT</span></span></span>
      <span class="welcome-edition">Your kingdom. Your story.</span>
    </header>
    <section class="welcome-menu">
      <div class="welcome-kicker"><span></span> A LITTLE KINGDOM. A GRAND ADVENTURE.</div>
      <h1 id="welcome-title">Angkor<span>Architect</span></h1>
      <p class="welcome-intro">Grow your city. Guide the waters.<br>Build something legendary.</p>
      <nav class="welcome-actions" aria-label="Main menu">
        <button class="welcome-play" data-menu="play" disabled><span class="menu-button-icon">${icon('play')}</span><span><strong>Play</strong><small>Let’s build a kingdom</small></span>${icon('arrow-up-right')}</button>
        <button class="welcome-continue" data-menu="continue" aria-describedby="welcome-save" disabled><span class="menu-button-icon">${icon('arrow-counter-clockwise')}</span><span><strong>Continue</strong><small id="welcome-save" role="status">Finding your kingdom…</small></span>${icon('arrow-right')}</button>
        <button class="welcome-continue" data-menu="slots" disabled>${icon('floppy-disk')} Your kingdoms</button><div class="welcome-secondary"><button data-menu="settings">${icon('sliders-horizontal')} Settings</button><button data-menu="guide">${icon('book-open-text')} How to play</button></div>
      </nav>
    </section>
    <aside class="welcome-world-note"><span class="note-diamond" aria-hidden="true">◇</span><div><span>THE KHMER EMPIRE</span><strong>Big dreams.<br>One little kingdom.</strong><small>A new adventure, one canal at a time.</small></div></aside>
    <footer class="welcome-footer"><span><span class="live-dot"></span> A world of your own. Play at your own pace.</span><span>${icon('floppy-disk')} Saved on this device <span class="footer-version">EARLY ACCESS · v0.1</span></span></footer>
  </main><dialog class="welcome-dialog" aria-labelledby="welcome-dialog-title"></dialog>`;

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
