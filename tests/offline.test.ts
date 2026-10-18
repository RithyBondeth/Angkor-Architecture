import { describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { readFile } from 'node:fs/promises';
import { workerSource } from '../build/offline';

type WorkerEvent = {
  waitUntil: (promise: Promise<unknown>) => void;
  request?: unknown;
  data?: unknown;
  ports?: unknown[];
  respondWith?: (promise: Promise<unknown>) => void;
};
function harness(version = 'new', assets = ['/index.html', '/assets/game.js', '/art/temple.png']) {
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const stores = new Map<string, Map<string, Response>>();
  let failDownload = false;
  const url = (request: string | Request) =>
    typeof request === 'string' ? new URL(request, 'https://game.test').href : request.url;
  const caches = {
    keys: async () => [...stores.keys()],
    delete: vi.fn(async (key: string) => stores.delete(key)),
    open: async (key: string) => {
      if (!stores.has(key)) stores.set(key, new Map());
      const data = stores.get(key)!;
      return {
        addAll: async (requests: Request[]) => {
          if (failDownload) throw Error('offline');
          for (const request of requests)
            data.set(url(request), new Response(request.url, { headers: { Vary: 'Origin' } }));
        },
        match: async (request: string | Request, options?: CacheQueryOptions) => {
          const response = data.get(url(request));
          // Match browser CacheStorage behavior when precaching has no Origin header.
          if (
            response?.headers.get('Vary') === 'Origin' &&
            !options?.ignoreVary &&
            typeof request !== 'string' &&
            request.headers.has('Origin')
          )
            return undefined;
          return response;
        },
      };
    },
  };
  const self = {
    location: { origin: 'https://game.test' },
    clients: { claim: vi.fn(async () => {}) },
    skipWaiting: vi.fn(async () => {}),
    addEventListener: (type: string, callback: (event: WorkerEvent) => void) =>
      listeners.set(type, callback),
  };
  const fetch = vi.fn(async () => new Response('network'));
  class RelativeRequest extends Request {
    constructor(input: string, init?: RequestInit) {
      super(new URL(input, 'https://game.test'), init);
    }
  }
  runInNewContext(workerSource(version, assets), {
    self,
    caches,
    fetch,
    URL,
    Request: RelativeRequest,
  });
  async function event(type: string, extra: Partial<WorkerEvent> = {}) {
    let pending: Promise<unknown> | undefined, response: Promise<unknown> | undefined;
    listeners.get(type)!({
      waitUntil: (p) => {
        pending = p;
      },
      respondWith: (p) => {
        response = p;
      },
      ...extra,
    });
    await pending;
    return response ? ((await response) as Response) : undefined;
  }
  return {
    event,
    stores,
    caches,
    self,
    fetch,
    fail: () => {
      failDownload = true;
    },
  };
}

describe('offline shell lifecycle', () => {
  it('requires a complete install and never activates an update without a request', async () => {
    const worker = harness();
    await worker.event('install');
    expect(worker.stores.get('angkor-architect:offline:new')!.size).toBe(3);
    expect(worker.self.skipWaiting).not.toHaveBeenCalled();
    await worker.event('message', { data: { type: 'ACTIVATE_UPDATE' } });
    expect(worker.self.skipWaiting).toHaveBeenCalledOnce();
  });
  it('discards a failed new cache while preserving the old offline build', async () => {
    const worker = harness();
    worker.stores.set('angkor-architect:offline:old', new Map());
    worker.fail();
    await expect(worker.event('install')).rejects.toThrow('offline');
    expect(worker.stores.has('angkor-architect:offline:new')).toBe(false);
    expect(worker.stores.has('angkor-architect:offline:old')).toBe(true);
  });
  it('does not remove an existing cache if reinstalling the same build fails', async () => {
    const worker = harness();
    await worker.event('install');
    worker.fail();
    await expect(worker.event('install')).rejects.toThrow('offline');
    expect(worker.stores.get('angkor-architect:offline:new')!.size).toBe(3);
  });
  it('keeps the previous build for open tabs and does not delete other application caches', async () => {
    const worker = harness();
    for (const name of [
      'other-app',
      'angkor-architect:offline:ancient',
      'angkor-architect:offline:previous',
    ])
      worker.stores.set(name, new Map());
    await worker.event('install');
    await worker.event('activate');
    expect([...worker.stores.keys()]).toEqual([
      'other-app',
      'angkor-architect:offline:previous',
      'angkor-architect:offline:new',
    ]);
    expect(worker.self.clients.claim).toHaveBeenCalledOnce();
  });
  it('reopens navigation and assets from the cache with no network requests', async () => {
    const worker = harness();
    await worker.event('install');
    const navigation = await worker.event('fetch', {
      request: { url: 'https://game.test/?continue=1', method: 'GET', mode: 'navigate' },
    });
    expect(await navigation!.text()).toBe('https://game.test/index.html');
    const asset = await worker.event('fetch', {
      request: new Request('https://game.test/art/temple.png'),
    });
    expect(await asset!.text()).toBe('https://game.test/art/temple.png');
    expect(worker.fetch).not.toHaveBeenCalled();
  });
  it('uses public precached modules even when Vary: Origin differs from install requests', async () => {
    const worker = harness();
    await worker.event('install');
    const module = await worker.event('fetch', {
      request: new Request('https://game.test/assets/game.js', {
        headers: { Origin: 'https://game.test' },
      }),
    });
    expect(await module!.text()).toBe('https://game.test/assets/game.js');
    expect(worker.fetch).not.toHaveBeenCalled();
  });
  it('serves previous hashed assets to old tabs and leaves unrelated requests alone', async () => {
    const worker = harness();
    await worker.event('install');
    worker.stores.set(
      'angkor-architect:offline:previous',
      new Map([['https://game.test/assets/old.js', new Response('old code')]]),
    );
    const old = await worker.event('fetch', {
      request: new Request('https://game.test/assets/old.js'),
    });
    expect(await old!.text()).toBe('old code');
    for (const request of [
      new Request('https://other.test/image.png'),
      new Request('https://game.test/api/save'),
      new Request('https://game.test/index.html', { method: 'POST' }),
    ])
      expect(await worker.event('fetch', { request })).toBeUndefined();
    expect(worker.fetch).not.toHaveBeenCalled();
  });
  it('reports missing assets honestly and repairs them without deleting save storage', async () => {
    const worker = harness();
    await worker.event('install');
    const postMessage = vi.fn();
    worker.stores.get('angkor-architect:offline:new')!.delete('https://game.test/art/temple.png');
    await worker.event('message', { data: { type: 'OFFLINE_STATUS' }, ports: [{ postMessage }] });
    expect(postMessage).toHaveBeenLastCalledWith({ ready: false, version: 'new' });
    await worker.event('message', { data: { type: 'CACHE_OFFLINE' }, ports: [{ postMessage }] });
    expect(postMessage).toHaveBeenLastCalledWith({ ready: true });
    await worker.event('message', { data: { type: 'OFFLINE_STATUS' }, ports: [{ postMessage }] });
    expect(postMessage).toHaveBeenLastCalledWith({ ready: true, version: 'new' });
  });
  it('reports failed repairs without claiming readiness or removing existing files', async () => {
    const worker = harness();
    await worker.event('install');
    worker.fail();
    const postMessage = vi.fn();
    await worker.event('message', { data: { type: 'CACHE_OFFLINE' }, ports: [{ postMessage }] });
    expect(postMessage).toHaveBeenCalledWith({ ready: false });
    expect(worker.stores.get('angkor-architect:offline:new')!.size).toBe(3);
  });
});

describe('installation assets', () => {
  it('declares a standalone root-scoped application and correctly sized PNG icons', async () => {
    const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));
    expect(manifest).toMatchObject({
      name: 'Angkor Architect',
      id: '/',
      start_url: '/',
      scope: '/',
      display: 'standalone',
    });
    for (const icon of manifest.icons) {
      const png = await readFile('public' + icon.src);
      expect(png.readUInt32BE(16)).toBe(Number(icon.sizes.split('x')[0]));
      expect(png.readUInt32BE(20)).toBe(Number(icon.sizes.split('x')[1]));
    }
    expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === 'maskable')).toBe(
      true,
    );
  });
});
