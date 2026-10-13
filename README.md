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

Select a building from the bottom tray, then click a valid site to plan it. Drag the map to pan; scroll to zoom. Materials are reserved immediately, and builders complete the project over simulation ticks. Click a site to change its crew, pause or resume work, or review a cancellation refund. The Construction view lists all active projects and the available workforce.

Completed buildings can be inspected, paused, upgraded, or removed. The trash tool (`X`) lets you select a structure on the map and review its refund before removal. Demolition confirmation pauses the simulation so its preview stays accurate; closing the dialog restores the previous speed.

- **Water:** Excavate a baray, then connect it to an existing canal or river. Reservoirs collect monsoon rain. Water moves by elevation and surface pressure; during the dry season, evaporation drains the network. Floodgates must occupy an existing canal tile.
- **Agriculture:** Paddies need water within two tiles of their footprint. Workers deliver rice and timber to dwellings over dry land. The starting road bridge lets workers cross the irrigation canal.
- **Logistics:** Sandstone requires a continuous navigable route between a quarry and a river landing. Watch workers and barges move across the map. Disconnected deliveries return their cargo to production stock.
- **Roads and bridges:** The Paths & bridges category contains village roads and timber bridges. Workers prefer roads and travel faster on them. A bridge spans one river or completed canal tile; adjoining bridge tiles span wider water. Water and barges continue underneath. Removing a bridge or floodgate restores its original canal, when present.
- **Construction:** Projects start with a suggested crew when labor is available. Assign up to eight builders to one project to finish sooner. Pausing releases its crew; a project with zero builders waits for a manual assignment. New sites reserve their footprints but do not produce resources, house residents, excavate canals, or regulate water until complete.
- **Workforce:** Builders and production share the same pool. Dwellings bring eight residents when construction finishes; 65% of residents form the workforce. Finishing production buildings or removing housing can reduce construction crews to keep assignments within the population limit. Pausing production frees labor for construction.
- **Demolition and refunds:** Completed structures return 50% of invested materials, rounded down per resource. Unfinished projects return 100% at zero progress, decreasing linearly to 50% at completion. Stored goods and dispatched cargo are recovered when their producer is removed, subject to the city’s resource storage limits. Canceling a temple upgrade preserves the existing sanctuary. Demolishing a completed dwelling removes eight residents.
- **Water conservation:** Removing a canal or reservoir restores the terrain elevation while retaining its current water. Reclaiming filled waterways can flood neighboring land; the confirmation preview explains this effect.
- **Temples:** Sanctuaries generate merit and progress through foundations, towers, and reliefs. Upgrades are timed projects requiring nearby water, sandstone, laterite, and an assigned crew. Merit production pauses during an upgrade.
- **Royal commission:** Complete a canal, a paddy, and a baray to earn 50 merit. Planning sites alone does not complete milestones.

| Controls           | Action                                  |
| ------------------ | --------------------------------------- |
| Drag / arrow keys  | Pan the camera                          |
| Scroll / `+` / `-` | Zoom                                    |
| `Space`            | Pause or resume                         |
| `1` to `6`         | Select the first six buildings          |
| `Escape`           | Cancel placement                        |
| `X`                | Toggle demolition tool                  |
| `W` / `L` / `G`    | Water / delivery / construction overlay |
| `H` / `?`          | Builder’s guide                         |

The speed controls run the simulation at 1×, 2×, or 4×. A day lasts six fixed simulation ticks; wet and dry seasons last 90 days each.

## Architecture

```text
src/
├── core/          # Typed world, commands, construction state, saves and migration
├── simulation/    # Water, A*, logistics, construction progress and shared workforce
├── rendering/     # PixiJS scene, texture atlas, scaffolding, isometric mapping, camera
├── ui/            # HUD, project/crew controls, refund dialogs, responsive styles
├── data/          # Balance parameters, resource/building definitions, era thresholds
└── main.ts        # Initialization and lifecycle
tests/             # Deterministic simulation and state validation tests
```

`Game` owns authoritative state. Commands validate placement and affordability before reserving materials and creating a construction project. Crew assignment enforces the shared workforce budget. `Construction` advances builder work, activates completed buildings, and records invested materials. `GameLoop` advances the simulation in 500 ms fixed steps and renders independently with interpolation. Simulation modules have no dependency on PixiJS or the DOM.

Each building retains a terrain snapshot and its actual completed investment. Floodgates and bridges can retain a completed canal as an underlay; removal restores that original structure and ID. Project costs remain separate from completed investment so cancellation and demolition refunds cannot double count materials. Demolition restores terrain without deleting water, removes source delivery jobs, and reconciles builder assignments after population changes.

The water automaton reads the old state and accumulates pressure-driven flux in a second buffer. Each donor is limited to half its water per tick, so multiple neighbors cannot overspend its volume. Volume is conserved with weather disabled. Rain, river inflow, and evaporation are explicit sources and sinks. Closed gates reduce permeability and block barge paths. This is an intentionally lightweight 2D approximation, not a physically calibrated hydraulic model.

A* uses a binary min-heap, Manhattan distance, and mode-specific traversal. The worker heuristic is scaled to the minimum traversal cost to remain admissible with roads: roads and bridges cost 0.65, open land costs 1, and forests cost 2. Worker movement uses the same cost to speed up travel on paths. Barges need a water depth of at least 0.45. Delivery jobs carry actual cargo, which enters the global resource pool only on arrival. Rice consumption happens each production cycle. Rates in the resource bar are potential output per cycle; irrigation, labor, flooding, and route availability can reduce delivered output.

The 32 × 32 deterministic starting world uses one procedural canvas texture atlas shared by PixiJS sprites. All artwork is local. Tiles, trees, and buildings are created once and sorted by depth; changing overlays and water tint does not rebuild the scene. The UI uses self-hosted DM Sans and Cormorant Garamond, plus Phosphor icons.

## Saves

Every 30 seconds, the complete versioned state is written to IndexedDB with a LocalStorage backup. Leaving or hiding the page also writes a synchronous backup. Startup restores the newest valid copy. Version 2 saves include construction progress, crew assignments, material investment, terrain snapshots, and canal underlays. Version 1 saves and JSON exports migrate automatically; existing structures remain complete, and existing roads, canals, and the starting bridge become editable without resetting the city.

Save validation checks schemas, grid dimensions, numeric bounds, resources, building and underlay IDs, footprints and terrain snapshots, project progress and crew budgets, couriers, and chronicle records. If IndexedDB is unavailable, LocalStorage can still save the game.

Settings supports downloading and importing JSON saves, an evening interface, and starting a fresh settlement. Importing and resetting reloads the application after a successful save. Saves are local to this browser and origin; clearing site data removes them. There is no cloud sync in this initial codebase.

## Scope and next steps

This prototype includes the initial resource loop, timed construction and temple upgrades, shared builder assignment, demolition and refunds, buildable roads and bridges, hydraulic simulation, routing, rendering, and local persistence. Builder labor is pooled; the crews drawn at sites do not yet travel there as individual agents. Detailed foundation stability, erosion and silt, a bas-relief minigame, audio, campaign maps, cloud saves, and a PWA are future work. Era unlocks are shown as merit milestones; they do not yet introduce new content. Historical themes guide the visual language, while map dimensions, units, dates, resource rates, and progression are game balance abstractions.

The project’s design reference is in `docs/Angkor_Architect_Game_Design_Document.pdf`.
