# Angkor Architect

A playable foundation for a web-based isometric city builder inspired by the hydraulic cities of the Khmer Empire. Built with **strict TypeScript, PixiJS 8, and Vite**. No account, server, or external image service is required.

## Run locally

Use Node.js 22.12+ (or a newer supported release).

```sh
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

```sh
npm test           # Simulation, routing, construction, and save validation
npm run typecheck  # Strict TypeScript checks
npm run build      # Type check and production bundle
npm run preview    # Serve the production build
```

## Play

Select a building from the bottom tray, then click clear land to place it. Drag the map to pan; scroll to zoom. New construction deducts resources only after a valid footprint and sufficient labor are confirmed. Click an existing building to inspect it, pause its production, operate a floodgate, or advance a temple.

- **Water:** Excavate a baray, then connect it to an existing canal or river. Reservoirs collect monsoon rain. Water moves by elevation and surface pressure; during the dry season, evaporation drains the network. Floodgates must occupy an existing canal tile.
- **Agriculture:** Paddies need water within two tiles of their footprint. Workers deliver rice and timber to dwellings over dry land. The starting road bridge lets workers cross the irrigation canal.
- **Logistics:** Sandstone requires a continuous navigable route between a quarry and a river landing. Watch workers and barges move across the map. Disconnected deliveries return their cargo to production stock.
- **Civic life:** Dwellings bring eight residents each; 65% of residents form the available workforce. Temples generate merit and progress through foundations, towers, and reliefs. Temple upgrades require water nearby, sandstone, and laterite.
- **Royal commission:** Build a canal, a paddy, and a baray to earn 50 merit.

| Controls           | Action                                  |
| ------------------ | --------------------------------------- |
| Drag / arrow keys  | Pan the camera                          |
| Scroll / `+` / `-` | Zoom                                    |
| `Space`            | Pause or resume                         |
| `1` to `6`         | Select the first six buildings          |
| `Escape`           | Cancel placement                        |
| `W` / `L` / `G`    | Water / delivery / construction overlay |
| `H` / `?`          | Builder’s guide                         |

The speed controls run the simulation at 1×, 2×, or 4×. A day lasts six fixed simulation ticks; wet and dry seasons last 90 days each.

## Architecture

```text
src/
├── core/          # Typed world, fixed-step loop, seasons, game commands, persistence
├── simulation/    # Conservative water automaton, heap-based A*, delivery logistics
├── rendering/     # PixiJS scene, procedural texture atlas, isometric transforms, camera
├── ui/            # HTML HUD, building menu, dialogs, theme tokens and responsive CSS
├── data/          # Balance parameters, resource/building definitions, era thresholds
└── main.ts        # Initialization and lifecycle
tests/             # Deterministic simulation and state validation tests
```

`Game` owns authoritative state. Commands validate placement, affordability, and workforce before mutation. `GameLoop` advances the simulation in 500 ms fixed steps and renders independently with interpolation. Simulation modules have no dependency on PixiJS or the DOM.

The water automaton reads the old state and accumulates pressure-driven flux in a second buffer. Each donor is limited to half its water per tick, so multiple neighbors cannot overspend its volume. Volume is conserved with weather disabled. Rain, river inflow, and evaporation are explicit sources and sinks. Closed gates reduce permeability and block barge paths. This is an intentionally lightweight 2D approximation, not a physically calibrated hydraulic model.

A* uses a binary min-heap, Manhattan distance, and mode-specific traversal. Forest costs workers more than open ground; barges need a water depth of at least 0.45. Delivery jobs carry actual cargo, which enters the global resource pool only on arrival. Rice consumption happens each production cycle. Rates in the resource bar are potential output per cycle; irrigation, labor, flooding, and route availability can reduce delivered output.

The 32 × 32 deterministic starting world uses one procedural canvas texture atlas shared by PixiJS sprites. All artwork is local. Tiles, trees, and buildings are created once and sorted by depth; changing overlays and water tint does not rebuild the scene. The UI uses self-hosted DM Sans and Cormorant Garamond, plus Phosphor icons.

## Saves

Every 30 seconds, the complete versioned state is written to IndexedDB with a LocalStorage backup. Leaving or hiding the page also writes a synchronous backup. Startup restores the newest valid copy. Save validation checks the schema, grid dimensions, numeric bounds, resources, building IDs and footprints, couriers, and chronicle records before loading. If IndexedDB is unavailable, LocalStorage can still save the game.

Settings supports downloading and importing JSON saves, an evening interface, and starting a fresh settlement. Importing and resetting reloads the application after a successful save. Saves are local to this browser and origin; clearing site data removes them. There is no cloud sync in this initial codebase.

## Scope and next steps

This prototype includes the initial resource loop and core hydraulic, routing, rendering, construction, and persistence systems. Building placement is instantaneous; the temple has three upgrade stages. Full construction scheduling, detailed foundation stability, erosion and silt, dynamic bridges, a bas-relief minigame, audio, campaign maps, cloud saves, and a PWA are future work. Era unlocks are shown as merit milestones; they do not yet introduce new content. Historical themes guide the visual language, while map dimensions, units, dates, resource rates, and progression are game balance abstractions.

The project’s design reference is in `docs/Angkor_Architect_Game_Design_Document.pdf`.
