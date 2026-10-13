import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@phosphor-icons/web/regular/style.css';
import './ui/styles.css';
import { Game } from './core/Game';
import { GameLoop } from './core/GameLoop';
import { Persistence } from './core/Persistence';
import { createWorld } from './core/world';
import { CONFIG } from './data/config';
import { WorldRenderer } from './rendering/WorldRenderer';
import { applyTheme, createShell, HUD } from './ui/HUD';

async function main() {
  applyTheme();
  const root = document.querySelector<HTMLElement>('#app')!;
  createShell(root);
  const persistence = new Persistence();
  const saved = await persistence.load();
  const game = new Game(saved ?? createWorld());
  const renderer = new WorldRenderer(game, document.querySelector<HTMLElement>('#world')!);
  await renderer.init();
  document.querySelector('.world-loading')?.remove();
  const hud = new HUD(game, renderer, persistence, async () => {
    const fresh = createWorld();
    await persistence.save(fresh);
    game.state = fresh;
    location.reload();
  });
  const loop = new GameLoop(game, (interpolation, elapsed) =>
    renderer.render(interpolation, elapsed),
  );
  loop.start();
  const autosave = window.setInterval(() => void hud.save(true), CONFIG.autosaveMs);
  const backup = () => {
    persistence.backup(game.state);
  };
  window.addEventListener('pagehide', backup);
  const onVisibility = () => {
    if (document.hidden) backup();
  };
  document.addEventListener('visibilitychange', onVisibility);
  if (saved) document.querySelector('#save-status')!.textContent = 'Kingdom restored';
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      clearInterval(autosave);
      loop.stop();
      hud.destroy();
      renderer.destroy();
      window.removeEventListener('pagehide', backup);
      document.removeEventListener('visibilitychange', onVisibility);
    });
}
void main().catch((error) => {
  console.error('Angkor Architect failed to start:', error);
  const loading = document.querySelector('.world-loading');
  if (loading) {
    loading.innerHTML =
      '<strong>Your kingdom could not open.</strong><span>Enable WebGL in your browser and try again.</span><button class="primary-button" id="retry-start">Try again</button>';
    document.querySelector('#retry-start')?.addEventListener('click', () => location.reload());
  }
});
