import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@phosphor-icons/web/regular/style.css';
import './ui/styles.css';
import { OfflineApp } from './pwa/OfflineApp';
import { AudioController } from './audio/AudioController';
import { Game } from './core/Game';
import { GameLoop } from './core/GameLoop';
import { Persistence } from './core/Persistence';
import { createScenario } from './core/world';
import { CONFIG } from './data/config';
import { WorldRenderer } from './rendering/WorldRenderer';
import { applyTheme, createShell, HUD } from './ui/HUD';
import { showWelcome } from './ui/Welcome';
import './ui/strategy.css';

async function main() {
  applyTheme();
  const root = document.querySelector<HTMLElement>('#app')!;
  const persistence = new Persistence();
  const audio = new AudioController(root);
  const offline = new OfflineApp(root);
  const choice = await showWelcome(root, persistence, audio);
  createShell(root);
  document.title = `${persistence.activeName} | Angkor Architect`;
  if (!choice.restored && choice.state.tutorial?.status === 'active') choice.state.speed = 0;
  const game = new Game(choice.state);
  const renderer = new WorldRenderer(game, document.querySelector<HTMLElement>('#world')!);
  await renderer.init();
  document.querySelector('.world-loading')?.remove();
  audio.attach(game);
  const hud = new HUD(
    game,
    renderer,
    persistence,
    async (scenario) => {
      const fresh = createScenario(scenario);
      await persistence.save(fresh);
      game.state = fresh;
      location.reload();
    },
    audio,
  );
  const loop = new GameLoop(game, (interpolation, elapsed) =>
    renderer.render(interpolation, elapsed),
  );
  offline.setBeforeReload(async () => {
    await persistence.save(game.state);
  });
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
  if (choice.restored) document.querySelector('#save-status')!.textContent = 'Kingdom restored';
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      clearInterval(autosave);
      loop.stop();
      hud.destroy();
      audio.destroy();
      offline.destroy();
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
