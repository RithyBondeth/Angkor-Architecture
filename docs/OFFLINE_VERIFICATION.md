# Offline and installation verification

Verified on 18 October 2026 using Chrome 155.0.8059.82 on macOS, with a production build at `http://localhost:4180/`.

## Issues reproduced and fixed

The original production worker did not list `/index.html` in `ASSETS`. The offline build plugin collected output before Vite's HTML emission. Chrome reported readiness because all listed files existed, but reloading with the preview server stopped failed. The plugin now runs after HTML generation and fails the build if the emitted shell is missing. Its content also participates in the build's cache identity.

After the shell fix, offline navigation returned HTML but scripts and styles did not load. Vite preview serves `Vary: Origin`, and module requests carry different Origin headers from the precache requests. Lookups now ignore response Vary headers only for the public, same-origin build caches. Other origins, non-GET requests, and unrelated API paths remain outside worker interception. Search parameters are still matched normally.

## Regular-browser checks

1. Built the production app and opened it in Chrome. Settings displayed **Ready for offline play** and **Install Angkor Architect**.
2. Stopped the preview server completely. After the fixes, Chrome reloaded the full menu with its artwork and fonts.
3. Created `Chrome offline kingdom`, rendered the map, and saved back to the main menu while the server remained stopped.
4. Closed the browser tab and opened a fresh Chrome tab at the same origin. The game opened offline and Continue listed the saved kingdom.
5. Completed Chrome's installation flow. The macOS Angkor Architect application and its standalone window were observed. The installed app opened and continued the same kingdom while the server remained stopped.
6. After Chrome and the installed app had both been closed, cold-launched the installed application with the preview server still unreachable. Its menu loaded and Continue retained the kingdom at day 30. Continued that kingdom, saved back to the menu, and reloaded the installed app successfully offline.

Stopping the origin server makes every uncached game request fail without changing the computer's network settings. These checks cover the local production origin and Chrome on macOS; they do not establish Safari, iOS, Android, or deployed-origin behavior.

## Regression coverage

`tests/offline-build.test.ts` invokes a real Vite build, then checks that the generated worker includes the final HTML, its hashed script, and public assets. It also confirms that changing only HTML changes cache identity. This exercises the HTML hook ordering that the worker mock tests previously missed.

`tests/offline.test.ts` models `Vary: Origin` cache misses and verifies that a public module request still uses the precache without a network request. Existing tests cover complete installs, failed downloads, retained previous builds, cached navigation, repair, and separation from unrelated requests. Installation/update tests cover install prompt handling and save-before-activation behavior.
