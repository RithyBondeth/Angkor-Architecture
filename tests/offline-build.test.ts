import { describe, expect, it } from 'vitest';
import { build } from 'vite';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { offlineBuild } from '../build/offline';

/** Exercise Vite's actual hook order, including its late HTML generation. */
describe('production offline build', () => {
  it('precaches the emitted HTML shell with its final hashed script and public assets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'angkor-offline-build-'));
    try {
      await mkdir(join(root, 'public'));
      await writeFile(
        join(root, 'index.html'),
        '<!doctype html><div id="app"></div><script type="module" src="/main.js"></script>',
      );
      await writeFile(
        join(root, 'main.js'),
        'document.querySelector("#app").textContent = "Offline kingdom";',
      );
      await writeFile(
        join(root, 'public', 'icon.svg'),
        '<svg xmlns="http://www.w3.org/2000/svg"/>',
      );
      await build({
        configFile: false,
        root,
        logLevel: 'silent',
        plugins: [offlineBuild()],
        build: { write: true },
      });
      const html = await readFile(join(root, 'dist', 'index.html'), 'utf8');
      const worker = await readFile(join(root, 'dist', 'sw.js'), 'utf8');
      const assets: string[] = JSON.parse(worker.match(/const ASSETS = (.*);/)![1]!);
      expect(assets).toContain('/index.html');
      expect(assets).toContain('/icon.svg');
      const script = html.match(/src="([^"]+\.js)"/)![1]!;
      expect(assets).toContain(script);
      expect(assets).not.toContain('/main.js');
      const firstVersion = worker.match(/const CACHE = PREFIX \+ "([^"]+)"/)![1];
      await writeFile(
        join(root, 'index.html'),
        '<!doctype html><h1>New kingdom</h1><script type="module" src="/main.js"></script>',
      );
      await build({
        configFile: false,
        root,
        logLevel: 'silent',
        plugins: [offlineBuild()],
        build: { write: true },
      });
      const updated = await readFile(join(root, 'dist', 'sw.js'), 'utf8');
      expect(updated.match(/const CACHE = PREFIX \+ "([^"]+)"/)![1]).not.toBe(firstVersion);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
