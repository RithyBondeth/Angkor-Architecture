import './offline.css';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export function offlineSettings(): string {
  return `<section class="offline-settings" data-pwa-settings><h3>Play anywhere</h3><p data-pwa-status role="status">Checking offline availability…</p><p data-pwa-install-info>Use your browser’s Install app or Add to Home Screen menu. On iPhone or iPad, open Safari’s Share menu, then Add to Home Screen. Installation options depend on your browser.</p><div class="settings-buttons"><button class="secondary-button" data-pwa="install" hidden>Install Angkor Architect</button><button class="secondary-button" data-pwa="prepare" hidden>Download offline files</button><button class="secondary-button" data-pwa="update" hidden>Save & reload update</button></div><p>Open once online and wait for “Ready for offline play.” Kingdom saves stay on this device and browser; keep a downloaded save for a permanent backup.</p></section>`;
}

/** Installation and cache lifecycle are independent of game state and save storage. */
export class OfflineApp {
  private registration: ServiceWorkerRegistration | null = null;
  private prompt: InstallPrompt | null = null;
  private status = 'Checking offline availability…';
  private ready = false;
  private busy = false;
  private updating = false;
  private updateTimer: number | null = null;
  private installed =
    window.matchMedia('(display-mode: standalone)').matches ||
    !!(navigator as Navigator & { standalone?: boolean }).standalone;
  private beforeReload: () => Promise<void> = async () => {};
  private readonly abort = new AbortController();
  private readonly observer: MutationObserver;
  constructor(private readonly root: HTMLElement) {
    const options = { signal: this.abort.signal };
    window.addEventListener(
      'beforeinstallprompt',
      (event) => {
        event.preventDefault();
        this.prompt = event as InstallPrompt;
        this.refresh();
      },
      options,
    );
    window.addEventListener(
      'appinstalled',
      () => {
        this.installed = true;
        this.prompt = null;
        this.refresh();
      },
      options,
    );
    window.addEventListener(
      'online',
      () => {
        void this.check();
      },
      options,
    );
    window.addEventListener('offline', () => this.refresh(), options);
    document.addEventListener(
      'visibilitychange',
      () => {
        if (!document.hidden) {
          void this.check();
          void this.registration?.update().catch(() => {});
        }
      },
      options,
    );
    navigator.serviceWorker?.addEventListener(
      'controllerchange',
      () => {
        if (this.updating) {
          if (this.updateTimer !== null) clearTimeout(this.updateTimer);
          location.reload();
        } else void this.check();
      },
      options,
    );
    root.addEventListener(
      'click',
      (event) => {
        const action = (event.target as Element).closest<HTMLElement>('[data-pwa]')?.dataset.pwa;
        if (action === 'install') void this.install();
        if (action === 'prepare') void this.prepare();
        if (action === 'update') void this.update();
      },
      options,
    );
    this.observer = new MutationObserver((mutations) => {
      if (
        mutations.some((m) =>
          [...m.addedNodes].some(
            (node) =>
              node instanceof HTMLElement &&
              (node.matches('[data-pwa-settings]') || node.querySelector('[data-pwa-settings]')),
          ),
        )
      )
        this.refresh();
    });
    this.observer.observe(root, { childList: true, subtree: true });
    void this.start();
  }
  setBeforeReload(callback: () => Promise<void>): void {
    this.beforeReload = callback;
  }
  private async start(): Promise<void> {
    if (!import.meta.env.PROD) {
      this.status = 'Offline caching is available in the production build.';
      this.refresh();
      return;
    }
    if (!('serviceWorker' in navigator) || !window.isSecureContext) {
      this.status =
        'Offline caching is unavailable here. Use HTTPS and a browser with service worker support.';
      this.refresh();
      return;
    }
    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });
      const watch = (worker: ServiceWorker | null) =>
        worker?.addEventListener(
          'statechange',
          () => {
            if (worker.state === 'installed' || worker.state === 'activated') void this.check();
            if (worker.state === 'redundant') {
              this.status = 'Offline download did not finish. Reconnect and reload to retry.';
              this.refresh();
            }
          },
          { signal: this.abort.signal },
        );
      watch(this.registration.installing);
      this.registration.addEventListener(
        'updatefound',
        () => watch(this.registration!.installing),
        { signal: this.abort.signal },
      );
      await this.check();
    } catch {
      this.status = 'Offline setup could not finish. Reload when connected to try again.';
      this.refresh();
    }
  }
  private request(worker: ServiceWorker, type: string): Promise<boolean> {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      const finish = (ready: boolean) => {
        clearTimeout(timer);
        channel.port1.close();
        channel.port2.close();
        resolve(ready);
      };
      const timer = window.setTimeout(
        () => finish(false),
        type === 'CACHE_OFFLINE' ? 120000 : 5000,
      );
      channel.port1.onmessage = (event) => finish(event.data?.ready === true);
      try {
        worker.postMessage({ type }, [channel.port2]);
      } catch {
        finish(false);
      }
    });
  }
  private async check(): Promise<void> {
    const worker = this.registration?.active;
    if (!worker) {
      if (this.registration) this.status = 'Downloading game files for offline play…';
      this.refresh();
      return;
    }
    this.ready = await this.request(worker, 'OFFLINE_STATUS');
    this.status = this.ready
      ? 'Ready for offline play.'
      : 'Offline files are incomplete. Connect and download them again.';
    this.refresh();
  }
  private async prepare(): Promise<void> {
    if (this.busy || !this.registration?.active) return;
    this.busy = true;
    this.status = 'Downloading game files for offline play…';
    this.refresh();
    this.ready = await this.request(this.registration.active, 'CACHE_OFFLINE');
    this.status = this.ready
      ? 'Ready for offline play.'
      : 'Offline download did not finish. Reconnect and retry.';
    this.busy = false;
    this.refresh();
  }
  private async install(): Promise<void> {
    const prompt = this.prompt;
    if (!prompt) return;
    this.prompt = null;
    this.refresh();
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      /* Browser menu remains available. */
    }
    this.refresh();
  }
  private async update(): Promise<void> {
    if (this.busy || !this.registration?.waiting) return;
    this.busy = true;
    this.status = 'Saving your kingdom before the update…';
    this.refresh();
    try {
      await this.beforeReload();
      const waiting = this.registration.waiting;
      if (!waiting) {
        location.reload();
        return;
      }
      this.updating = true;
      waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
      // A failed activation must not leave the controls locked indefinitely.
      this.updateTimer = window.setTimeout(() => {
        if (this.updating) {
          this.updating = false;
          this.busy = false;
          this.status = 'Update could not activate. Your kingdom was saved; try again.';
          this.refresh();
        }
      }, 15000);
    } catch {
      this.busy = false;
      this.status = 'Could not save your kingdom. Download a save before updating.';
      this.refresh();
    }
  }
  private refresh(): void {
    for (const section of this.root.querySelectorAll<HTMLElement>('[data-pwa-settings]')) {
      const message =
        this.status +
        (!navigator.onLine ? ' You are offline.' : '') +
        (this.registration?.waiting
          ? ' An update is ready. Save and reload when you’re ready.'
          : '');
      const status = section.querySelector<HTMLElement>('[data-pwa-status]')!;
      if (status.textContent !== message) status.textContent = message;
      const info = section.querySelector<HTMLElement>('[data-pwa-install-info]')!;
      info.hidden = this.installed;
      for (const button of section.querySelectorAll<HTMLButtonElement>('[data-pwa]')) {
        button.hidden =
          button.dataset.pwa === 'install'
            ? !this.prompt || this.installed
            : button.dataset.pwa === 'update'
              ? !this.registration?.waiting
              : this.ready || !this.registration?.active;
        button.disabled = this.busy;
      }
    }
  }
  destroy(): void {
    this.abort.abort();
    this.observer.disconnect();
    if (this.updateTimer !== null) clearTimeout(this.updateTimer);
  }
}
