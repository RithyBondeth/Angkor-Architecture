import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineApp } from '../src/pwa/OfflineApp';

const controllers: OfflineApp[] = [];
afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.destroy());
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function app() {
  vi.stubEnv('PROD', true);
  const status = { textContent: '' },
    info = { hidden: false };
  const buttons = ['install', 'prepare', 'update'].map((action) => ({
    dataset: { pwa: action },
    hidden: true,
    disabled: false,
  }));
  const section = {
    querySelector: (selector: string) => (selector === '[data-pwa-status]' ? status : info),
    querySelectorAll: () => buttons,
  };
  let click: (event: unknown) => void = () => {};
  const root = {
    querySelectorAll: () => [section],
    addEventListener: (_type: string, listener: (event: unknown) => void) => {
      click = listener;
    },
  };
  const active = new EventTarget() as EventTarget & { postMessage: ReturnType<typeof vi.fn> };
  active.postMessage = vi.fn((_message: unknown, ports: MessagePort[]) =>
    ports[0]!.postMessage({ ready: true }),
  );
  const waiting = { postMessage: vi.fn() };
  const registration = Object.assign(new EventTarget(), {
    active,
    waiting: null as typeof waiting | null,
    installing: null,
    update: vi.fn(async () => {}),
  });
  const service = Object.assign(new EventTarget(), { register: vi.fn(async () => registration) });
  const windowTarget = Object.assign(new EventTarget(), {
    matchMedia: () => ({ matches: false }),
    isSecureContext: true,
    setTimeout: (callback: () => void, ms: number) => setTimeout(callback, ms),
  });
  vi.stubGlobal('window', windowTarget);
  vi.stubGlobal('navigator', { serviceWorker: service, onLine: true });
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }));
  vi.stubGlobal(
    'MutationObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  const reload = vi.fn();
  vi.stubGlobal('location', { reload });
  const controller = new OfflineApp(root as unknown as HTMLElement);
  controllers.push(controller);
  return {
    controller,
    status,
    info,
    buttons,
    waiting,
    registration,
    service,
    windowTarget,
    reload,
    click: (action: string) => click({ target: { closest: () => ({ dataset: { pwa: action } }) } }),
  };
}

describe('installation and update controls', () => {
  it('offers browser install only after an install prompt and handles dismissal', async () => {
    const test = app();
    await vi.waitFor(() => expect(test.status.textContent).toContain('Ready for offline play'));
    expect(test.buttons[0]!.hidden).toBe(true);
    const event = new Event('beforeinstallprompt', { cancelable: true });
    const prompt = vi.fn(async () => {});
    Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    test.windowTarget.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(test.buttons[0]!.hidden).toBe(false);
    test.click('install');
    await vi.waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    expect(test.buttons[0]!.hidden).toBe(true);
    expect(test.info.hidden).toBe(false);
    test.windowTarget.dispatchEvent(new Event('appinstalled'));
    expect(test.info.hidden).toBe(true);
  });
  it('waits for a successful save before activating and never reloads on automatic controller changes', async () => {
    const test = app();
    await vi.waitFor(() => expect(test.status.textContent).toContain('Ready'));
    test.service.dispatchEvent(new Event('controllerchange'));
    expect(test.reload).not.toHaveBeenCalled();
    test.registration.waiting = test.waiting;
    let finish!: () => void;
    test.controller.setBeforeReload(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    test.click('update');
    expect(test.waiting.postMessage).not.toHaveBeenCalled();
    finish();
    await vi.waitFor(() =>
      expect(test.waiting.postMessage).toHaveBeenCalledWith({ type: 'ACTIVATE_UPDATE' }),
    );
    test.service.dispatchEvent(new Event('controllerchange'));
    expect(test.reload).toHaveBeenCalledOnce();
  });
  it('keeps the running game when saving before update fails', async () => {
    const test = app();
    await vi.waitFor(() => expect(test.status.textContent).toContain('Ready'));
    test.registration.waiting = test.waiting;
    test.controller.setBeforeReload(async () => {
      throw Error('storage full');
    });
    test.click('update');
    await vi.waitFor(() =>
      expect(test.status.textContent).toContain('Could not save your kingdom'),
    );
    expect(test.waiting.postMessage).not.toHaveBeenCalled();
    expect(test.reload).not.toHaveBeenCalled();
  });
});
