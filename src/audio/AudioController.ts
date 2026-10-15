import type { Game } from '../core/Game';
import { SeasonManager } from '../core/SeasonManager';
import { AudioEngine } from './AudioEngine';
import { AUDIO_DEFAULTS, readAudioPreferences, saveAudioPreferences } from './preferences';
import type { AudioPreferences, VolumeChannel } from './preferences';
import { escapeHtml, icon } from '../ui/icons';
import './audio.css';

const channels: readonly [VolumeChannel, string][] = [
  ['master', 'Master volume'],
  ['effects', 'Sound effects'],
  ['ambience', 'Water ambience'],
];
export function audioSettings(preferences: AudioPreferences, status: string): string {
  return `<fieldset class="audio-settings"><legend>Sound & atmosphere</legend>${channels.map(([key, label]) => `<label class="audio-volume" for="audio-${key}"><span>${label}<output for="audio-${key}" data-audio-output="${key}">${Math.round(preferences[key] * 100)}%</output></span><input id="audio-${key}" type="range" min="0" max="100" step="1" value="${Math.round(preferences[key] * 100)}" aria-valuetext="${Math.round(preferences[key] * 100)}%" data-audio-volume="${key}"/></label>`).join('')}<div class="settings-buttons"><button class="secondary-button" data-audio-action="mute" aria-label="${preferences.muted ? 'Unmute sound' : 'Mute sound'}" aria-pressed="${preferences.muted}">${icon(preferences.muted ? 'speaker-slash' : 'speaker-high')}${preferences.muted ? 'Unmute sound' : 'Mute sound'}</button><button class="secondary-button" data-audio-action="test">${icon('music-note')}Test effects</button></div><p data-audio-status role="status">${escapeHtml(status)}</p><p>Separate volumes for building and delivery sounds, and water ambience. These preferences stay on this device.</p></fieldset>`;
}

/** Owns device preferences and browser lifecycle; audio failures cannot interrupt the game. */
export class AudioController {
  private preferences: AudioPreferences = { ...AUDIO_DEFAULTS };
  private readonly engine: AudioEngine;
  private readonly abort = new AbortController();
  private detach: (() => void) | null = null;
  private failed = false;
  constructor(private readonly root: HTMLElement) {
    try {
      this.preferences = readAudioPreferences(localStorage);
    } catch {
      /* Storage may be disabled. */
    }
    this.engine = new AudioEngine(this.preferences);
    const options = { signal: this.abort.signal };
    const unlock = () => {
      void this.engine
        .unlock()
        .then(() => this.refresh())
        .catch(() => this.fail());
    };
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (e.isTrusted) unlock();
      },
      options,
    );
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.isTrusted && !e.repeat && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key))
          unlock();
      },
      options,
    );
    document.addEventListener(
      'visibilitychange',
      () => {
        this.safe(() => this.engine.setVisible(!document.hidden));
        this.refresh();
      },
      options,
    );
    this.engine.setVisible(!document.hidden);
    root.addEventListener(
      'input',
      (event) => {
        const input = event.target as HTMLInputElement;
        const key = input.dataset.audioVolume;
        if (!channels.some(([channel]) => channel === key)) return;
        const value = Number(input.value);
        if (!Number.isFinite(value)) return;
        this.preferences[key as VolumeChannel] = Math.max(0, Math.min(100, value)) / 100;
        this.applyPreferences();
        if (event.isTrusted) unlock();
      },
      options,
    );
    root.addEventListener(
      'click',
      (event) => {
        const button = (event.target as Element).closest<HTMLElement>('[data-audio-action]');
        if (!button) return;
        if (button.dataset.audioAction === 'mute') {
          this.preferences.muted = !this.preferences.muted;
          this.applyPreferences();
          if (event.isTrusted) unlock();
        }
        if (button.dataset.audioAction === 'test') {
          void this.engine
            .unlock()
            .then(() => {
              this.safe(() => this.engine.testSound());
              this.refresh();
            })
            .catch(() => this.fail());
        }
      },
      options,
    );
  }
  settingsMarkup(): string {
    return audioSettings(
      this.preferences,
      this.failed
        ? 'Audio is unavailable in this browser. Your volume preferences are still saved.'
        : this.engine.status,
    );
  }
  attach(game: Game): void {
    this.detach?.();
    this.safe(() => {
      this.engine.setWet(SeasonManager.at(game.state.day).wet);
      this.engine.setPlaying(true);
    });
    const events = game.onEvent((event) =>
      this.safe(() => {
        if (event.type === 'placement') this.engine.playPlacement(event.kind);
        else this.engine.playDelivery(event.mode);
      }),
    );
    const world = game.subscribe(() =>
      this.safe(() => this.engine.setWet(SeasonManager.at(game.state.day).wet)),
    );
    this.detach = () => {
      events();
      world();
    };
    this.refresh();
  }
  private applyPreferences(): void {
    this.safe(() => this.engine.setPreferences(this.preferences));
    try {
      saveAudioPreferences(localStorage, this.preferences);
    } catch {
      /* Still works for this session. */
    }
    this.refresh();
  }
  private safe(action: () => void): void {
    if (!this.failed) {
      try {
        action();
      } catch {
        this.fail();
      }
    }
  }
  private fail(): void {
    this.failed = true;
    try {
      this.engine.destroy();
    } catch {
      /* Unsupported audio must not affect gameplay. */
    }
    this.refresh();
  }
  private refresh(): void {
    for (const [key] of channels) {
      const value = Math.round(this.preferences[key] * 100);
      this.root
        .querySelectorAll<HTMLInputElement>(`[data-audio-volume="${key}"]`)
        .forEach((input) => {
          input.value = String(value);
          input.setAttribute('aria-valuetext', `${value}%`);
        });
      this.root
        .querySelectorAll<HTMLOutputElement>(`[data-audio-output="${key}"]`)
        .forEach((output) => {
          output.textContent = `${value}%`;
        });
    }
    this.root.querySelectorAll<HTMLElement>('[data-audio-action="mute"]').forEach((button) => {
      const label = this.preferences.muted ? 'Unmute sound' : 'Mute sound';
      const changed = button.getAttribute('aria-label') !== label;
      button.setAttribute('aria-pressed', String(this.preferences.muted));
      button.setAttribute('aria-label', label);
      button.title = label;
      // Preserve the pointer target while an unlock promise resolves before click.
      if (changed)
        button.innerHTML =
          icon(this.preferences.muted ? 'speaker-slash' : 'speaker-high') +
          (button.hasAttribute('data-audio-compact') ? '' : label);
    });
    this.root.querySelectorAll<HTMLElement>('[data-audio-status]').forEach((status) => {
      status.textContent = this.failed
        ? 'Audio is unavailable in this browser. Your volume preferences are still saved.'
        : this.engine.status;
    });
  }
  destroy(): void {
    this.abort.abort();
    this.detach?.();
    this.detach = null;
    this.engine.destroy();
  }
}
