import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import type { Plugin } from 'vite';

/** One complete immutable game shell per build; no runtime or save-data caching. */
export function workerSource(version: string, assets: string[]): string {
  return `const PREFIX = 'angkor-architect:offline:';
const CACHE = PREFIX + ${JSON.stringify(version)};
const ASSETS = ${JSON.stringify(assets)};
const SHELL = '/index.html';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const existed = (await caches.keys()).includes(CACHE);
    try {
      const cache = await caches.open(CACHE);
      await cache.addAll(ASSETS.map(url => new Request(url, {cache:'reload'})));
    } catch (error) {
      if (!existed) await caches.delete(CACHE);
      throw error;
    }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = (await caches.keys()).filter(key => key.startsWith(PREFIX));
    // Retain the previous build's hashed assets for tabs still using it.
    const previous = keys.filter(key => key !== CACHE).at(-1);
    await Promise.all(keys.filter(key => key !== CACHE && key !== previous).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
  if (event.data?.type === 'CACHE_OFFLINE') {
    event.waitUntil((async () => {
      try {
        const cache = await caches.open(CACHE);
        await cache.addAll(ASSETS.map(url => new Request(url, {cache:'reload'})));
        event.ports[0]?.postMessage({ready:true});
      } catch { event.ports[0]?.postMessage({ready:false}); }
    })());
  }
  if (event.data?.type === 'OFFLINE_STATUS') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const ready = (await Promise.all(ASSETS.map(asset => cache.match(asset, {ignoreVary:true})))).every(Boolean);
      event.ports[0]?.postMessage({ready, version:${JSON.stringify(version)}});
    })());
  }
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => (await (await caches.open(CACHE)).match(SHELL, {ignoreVary:true})) || fetch(request))());
    return;
  }
  // Public, same-origin build files are invariant across Origin headers. Vite
  // serves Vary: Origin, while module loads and precaching use different headers.
  // Ignore unrelated requests; only the known build assets belong in this cache.
  if (!ASSETS.includes(url.pathname) && !url.pathname.startsWith('/assets/')) return;
  event.respondWith((async () => {
    const current = await (await caches.open(CACHE)).match(request, {ignoreVary:true});
    if (current) return current;
    for (const key of (await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== CACHE)) {
      const old = await (await caches.open(key)).match(request, {ignoreVary:true});
      if (old) return old;
    }
    return fetch(request);
  })());
});
`;
}
async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(resolve(directory, entry.name))
          : [resolve(directory, entry.name)],
      ),
    )
  ).flat();
}
export function offlineBuild(): Plugin {
  let publicDirectory = '';
  return {
    name: 'angkor-offline',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      if (config.base !== '/')
        throw new Error('Angkor offline builds require the root base URL (/).');
      publicDirectory = config.publicDir;
    },
    generateBundle: {
      order: 'post',
      async handler(_, bundle) {
        if (!bundle['index.html'])
          this.error('Offline build requires the generated index.html shell.');
        const hash = createHash('sha256'),
          assets: string[] = [];
        for (const name of Object.keys(bundle).sort()) {
          const output = bundle[name]!;
          hash.update(name).update(output.type === 'chunk' ? output.code : output.source);
          assets.push('/' + name);
        }
        for (const path of (await files(publicDirectory)).sort()) {
          const name = '/' + relative(publicDirectory, path).split(sep).join('/');
          hash.update(name).update(await readFile(path));
          assets.push(name);
        }
        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          // Worker-only fixes must get a new cache identity too.
          source: workerSource(
            hash.update(workerSource('version', assets)).digest('hex').slice(0, 16),
            assets,
          ),
        });
      },
    },
  };
}
