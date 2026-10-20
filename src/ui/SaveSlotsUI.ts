import type { SaveSlot, Checkpoint } from '../core/Persistence';
import { scenarioFor } from '../data/scenarios';
import { escapeHtml as esc, icon } from './icons';
import './save-slots.css';

export function checkpointLabel(save: Checkpoint): string {
  const kind = {
    manual: 'Manual save',
    autosave: 'Autosave',
    backup: 'Recovery backup',
    recovery: 'Recovered save',
  }[save.kind];
  return `${kind} · Day ${save.state.day} · ${scenarioFor(save.state).region} · ${new Date(save.savedAt).toLocaleString()}`;
}
export function kingdomNameInput(name = 'My kingdom'): string {
  return `<label class="kingdom-name">Kingdom name<input id="kingdom-name-input" type="text" maxlength="48" required value="${esc(name)}" autocomplete="off" /></label>`;
}
export function newSlotSelection(slots: SaveSlot[], active: number): string {
  const selected = slots.find((s) => !s.checkpoints.length && !s.damaged)?.id ?? active;
  return `${kingdomNameInput()}<label class="kingdom-name">Save slot<select id="kingdom-slot">${slots.map((s) => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>Slot ${s.id} · ${esc(s.name)}${s.checkpoints.length ? ' (replace)' : ''}</option>`).join('')}</select></label><p id="slot-replacement-note"></p>`;
}
export function slotLibrary(slots: SaveSlot[], active: number): string {
  return `<h2 id="welcome-dialog-title">Your kingdoms.</h2><p>Six separate slots. Opening a kingdom keeps the others safe. Choose Manage to rename it or recover an earlier save.</p><div class="save-slots">${slots.map((s) => `<article class="save-slot"><span class="eyebrow">Slot ${s.id}${s.id === active && s.checkpoints.length ? ' · Last played' : ''}</span><h3>${esc(s.name)}</h3>${s.checkpoints[0] ? `<p>Day ${s.checkpoints[0].state.day} · ${s.checkpoints[0].state.population} residents · ${esc(scenarioFor(s.checkpoints[0].state).region)}</p><small>${esc(checkpointLabel(s.checkpoints[0]))}</small>${s.damaged ? '<p class="save-warning">Some save data was unreadable. Valid recovery points are available below.</p>' : ''}<div class="settings-buttons"><button class="primary-button" data-menu="open-slot" data-slot="${s.id}">${icon('play')}Open ${esc(s.name)}</button><button class="secondary-button" data-menu="manage-slot" data-slot="${s.id}">Manage</button></div>` : s.damaged ? '<p class="save-warning">No valid checkpoint could be read. The stored data has been left untouched. Choose a different slot for a new kingdom.</p>' : '<p>Ready for a new kingdom. Choose Play from the main menu.</p>'}</article>`).join('')}</div><button class="secondary-button full-width" data-menu="close">Back to menu</button>`;
}
export function slotDetails(slot: SaveSlot): string {
  return `<h2 id="welcome-dialog-title">${esc(slot.name)}</h2>${kingdomNameInput(slot.name)}<button class="secondary-button full-width" data-menu="rename-slot" data-slot="${slot.id}">Rename kingdom</button><h3>Autosave recovery</h3><p>Up to four recent saves and a recovery backup are kept per slot. Recovering an earlier point makes it the current save and keeps the previous head in history.</p>${slot.damaged ? '<p class="save-warning">Unreadable checkpoints were skipped. Choose a valid point to recover.</p>' : ''}<div class="save-checkpoints">${slot.checkpoints.map((save, i) => `<article><strong>${i === 0 ? 'Latest save' : 'Earlier save'}</strong><p>${esc(checkpointLabel(save))}</p><small>${save.state.population} residents</small><button class="secondary-button full-width" data-menu="recover-slot" data-slot="${slot.id}" data-checkpoint="${save.savedAt}">${i === 0 ? 'Open latest save' : `Recover day ${save.state.day}`}</button></article>`).join('')}</div><button class="text-button" data-menu="slots">Back to kingdoms</button>`;
}
