import { defineConfig } from 'vite';
import { offlineBuild } from './build/offline.ts';

export default defineConfig({
  plugins: [offlineBuild()],
  server: { port: 5173 },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: { manualChunks: (id: string) => (id.includes('/pixi.js/') ? 'pixi' : undefined) },
    },
  },
});
