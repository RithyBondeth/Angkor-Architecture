import type { Game } from '../core/Game';
import type { MilestoneNotice } from '../core/milestones';
import { escapeHtml, icon } from './icons';

/** A quiet, dismissible queue; loading a kingdom never replays its celebrations. */
export class Celebrations {
  private readonly queue: MilestoneNotice[] = [];
  private timer = 0;
  private readonly unsubscribe: () => void;
  pendingSummary = false;
  constructor(
    private readonly host: HTMLElement,
    game: Game,
  ) {
    this.unsubscribe = game.onEvent((event) => {
      if (event.type !== 'milestone') return;
      if (event.id === 'campaign') this.pendingSummary = true;
      this.queue.push(event);
      if (this.queue.length === 1) this.render();
    });
  }
  dismiss() {
    clearTimeout(this.timer);
    this.queue.shift();
    this.render();
  }
  private render() {
    const notice = this.queue[0];
    this.host.hidden = !notice;
    if (!notice) {
      this.host.innerHTML = '';
      return;
    }
    this.host.innerHTML = `<div class="milestone-emblem" aria-hidden="true">${icon(notice.icon)}</div><div><span class="eyebrow">A moment in your kingdom</span><h2>${escapeHtml(notice.title)}</h2><p>${escapeHtml(notice.text)}</p>${notice.id === 'campaign' ? '<button class="secondary-button" data-action="kingdom-summary">Review kingdom summary</button>' : ''}</div><button class="icon-button" data-action="milestone-dismiss" aria-label="Dismiss celebration">${icon('x')}</button>`;
    // Keep keyboard focus stable: a focused celebration stays until explicitly dismissed.
    this.timer = window.setTimeout(() => {
      if (this.host.contains(document.activeElement)) return;
      this.dismiss();
    }, 12_000);
  }
  destroy() {
    clearTimeout(this.timer);
    this.unsubscribe();
  }
}
