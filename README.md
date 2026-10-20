<div align="center">

# Angkor Architect

**A browser-based isometric city-building and resource-management game inspired by the hydraulic engineering of the medieval Khmer Empire.**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PixiJS](https://img.shields.io/badge/PixiJS-E72264?style=for-the-badge&logo=pixijs&logoColor=white)
![WebGL](https://img.shields.io/badge/WebGL-990000?style=for-the-badge&logo=webgl&logoColor=white)

</div>

---

## Overview

Angkor Architect is a browser-based isometric simulation game: _SimCity_ meets ancient Angkor. Players take the role of the **Royal Master Builder (_Kru Vitu_)** during the golden age of the Khmer Empire (9th–15th century).

**Waterways are the lifeblood** of the city. Design, excavate, and regulate a hydraulic grid of _barays_ (reservoirs) and canals to survive the monsoon seasons, keep rice fields irrigated, and float sandstone to build monumental temples.

A playable foundation for a web-based isometric city builder inspired by the hydraulic cities of the Khmer Empire. Built with **strict TypeScript, PixiJS 8, and Vite**. No account, server, or external image service is required.

## Tech stack

| Area             | Technology                                                 |
| ---------------- | ---------------------------------------------------------- |
| Rendering        | PixiJS (WebGL-accelerated isometric 2D)                    |
| Language         | TypeScript with strict mode                                |
| Build tool       | Vite                                                       |
| Water simulation | Cellular automata for elevation and pressure-driven flow   |
| Pathfinding      | A* for workers and river barges                            |
| Persistence      | IndexedDB with a LocalStorage backup and JSON save exports |

## Run locally

Use Node.js 22.12+ (or a newer supported release).

```sh
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

```sh
npm test           # Simulation, progression, survival, routing, construction, and save validation
npm run typecheck  # Strict TypeScript checks
npm run build      # Type check and production bundle
npm run preview    # Serve the production build
```

## Play

The welcome screen offers **Play**, **Continue**, and **Settings**. Play opens a scenario picker with terrain, supplies, season timing, and opening objectives. Choose a scenario and explicitly start it; when a save exists, the final button confirms replacement. Browsing or canceling the picker leaves the saved kingdom untouched. Continue restores the newest valid local save and shows its day and population; it stays disabled when no valid save exists. Settings lets you choose the evening colors before entering the game, and How to play introduces water, food, and royal commissions. The simulation and autosave begin only after you choose Play or Continue.

New kingdoms start paused in the interactive tutorial. Each new lesson pauses time again; use the lesson’s Resume button or the time controls when ready. Early lessons show canals and reservoirs, then introduce paddies. “Show all buildings” opens the full catalog at any time. Older saves keep their chosen speed on entry.

The compact building dock collapses when you select a tool, and the information panel clears so you can see the site. Reopen the dock to change tools. Before placing a valid building, the preview checks current irrigation, available deposits after construction, operating labor, and dry-land or barge delivery access. Warnings explain missing destinations, flooding, closed gates, and shallow channels without preventing a valid placement. These checks describe current conditions, not future weather or guaranteed production.

On touchscreens, drag with one finger to pan and pinch with two fingers to zoom around their midpoint. Selecting a tool does not change navigation: tap a site to stage a preview, then use **Confirm building** to spend materials. Tap a second tile to extend a road or canal route before confirming it. Panning, pinching, changing tools, opening a dialog, losing pointer capture, or leaving the page clears the staged plan. Confirmation rechecks the current site and resources. Mouse placement and route dragging retain their existing behavior.

Select a building from the bottom tray, then click a valid site to plan it. For roads and canals, press and drag to preview a connected L-shaped route (longer grid axis first, X first on ties); release to build. The preview lists the total material cost and the number of new and existing matching tiles. Existing roads/canals and their projects are retained without another charge. Blocked or unaffordable routes spend nothing. Escape or Cancel discards the drag; zooming, opening a dialog, or losing pointer capture also cancels it. While these tools are selected, use middle-drag or arrow keys to pan; tap/click still plans one tile. Drag the map to pan; scroll to zoom. Materials are reserved immediately, and builders complete the project over simulation ticks. Click a site to change its crew, pause or resume work, or review a cancellation refund. The Construction view lists all active projects and the available workforce.

Completed buildings can be inspected, paused, upgraded, or removed. The trash tool (`X`) lets you select a structure on the map and review its refund before removal. Demolition confirmation pauses the simulation so its preview stays accurate; closing the dialog restores the previous speed.

- **Water planning:** Use Flow (`F`) for the strongest expected outgoing transfer per tile on the next tick; arrow thickness indicates transfer amount, and flows below 0.001 depth-units per tick are hidden. Arrows share the simulation’s surface-pressure, donor-volume, and floodgate rules and exclude weather. Elevation (`E`) shades ground blue to gold from the map’s lowest to highest ground. Hover or tap tiles in a water planning overlay for ground height, water depth, surface level, and strongest outflow. These are gameplay units. The Water management view links to each completed baray’s chart and exact daily readings. Up to 60 observed simulation days are kept per reservoir, including overflow above nominal storage. Pausing and speed changes do not add readings; new reservoirs start when completed, demolished reservoirs lose their history, and older saves begin at their current day. History travels with local saves and exports.
- **Water:** Excavate a baray, then connect it to an existing canal or river. Reservoirs collect monsoon rain. Water moves by elevation and surface pressure; during the dry season, evaporation drains the network. Floodgates must occupy an existing canal tile.
- **Agriculture and drought:** Paddies need water within two tiles of their footprint. Irrigation below 25% adds 12 drought stress per day; 25–50% adds four. At 70% stress, the crop fails and stops producing. Irrigation of at least 50% removes ten stress per day; a failed field replants at 20%. Stress reduces yield before failure. Already harvested rice and dispatched cargo remain available. Workers deliver rice and timber to dwellings over dry land.
- **Logistics and storage:** A quarry sends sandstone on a navigable waterway to a staffed river landing. Other materials travel over dry land to a dwelling or staffed warehouse. Each producer can send one shipment at a time: carts carry up to 12 units and barges up to 40 blocks. The city starts with four cart slots (limited by available working population) and 1,200 storage for each material. A staffed warehouse adds two carts and up to 1,200 storage per material; a staffed landing adds one barge. Storage capacity falls with warehouse damage. Stock already above capacity is kept, while new deliveries wait for space. Cargo from a blocked route or closed destination returns to its worksite. The People & logistics view names blocked sites and gives specific remedies for full storage, busy transport, missing receivers, shallow canals, closed gates, flooded paths, and ruined crossings.
- **Finite deposits and laterite:** Forest tiles carry harvestable timber, and sandstone and laterite deposits lie below land tiles. A woodcutter harvests trees within six tiles; a quarry extracts sandstone within three tiles; a dedicated laterite pit extracts laterite within three tiles. Extraction depletes shared deposits, and exhausted trees become grass. Demolishing and rebuilding cannot restore a deposit. The resource overlay (`R`) marks sandstone in gold, laterite in clay, and timber in green; hover or tap a tile to see its remaining amount. Quarries no longer grant laterite automatically.
- **Roads and bridges:** The Paths & bridges category contains village roads and timber bridges. Workers prefer roads and travel faster on them. A bridge spans one river or completed canal tile; adjoining bridge tiles span wider water. Water and barges continue underneath. Removing a bridge or floodgate restores its original canal, when present.
- **Flood damage:** Each day, the deepest water on a completed building’s footprint can reduce condition by up to 12 points. Ordinary buildings tolerate 0.8 water depth, paddies 1.2, and bridges, docks, and floodgates six. Canals and reservoirs tolerate stored water. Condition scales production; zero condition stops operations, frees workers, disables crossings and floodgate resistance, and reduces habitable housing. Water and barges still pass below ruined bridges.
- **Repairs:** After floodwater recedes, inspect a damaged structure to start a timed repair project. Materials cost 40% of the original building cost, scaled by damage and rounded up. Builders and production share labor; production pauses during repairs. Renewed flooding suspends repair work. Completion restores 100% condition, while cancellation refunds unused materials and retains damage. Repair materials are consumed upkeep and do not increase demolition investment.
- **Food and survival:** Residents eat daily: one rice for every 18 people, rounded up. Partial meals add proportional hunger; missed meals add 14 hunger, while a fully fed day removes ten. Hunger slows production, deliveries, and all builder work, down to 35% productivity. After three consecutive shortage days and at least 40 hunger, 2% of residents (rounded up) leave each day. Regular meals restore productivity. Once hunger is gone, spare housing and five days of rice reserves allow one resident to return every three days after five healthy days. The Food & resilience view shows reserves, hunger, productivity, drought stress, damaged sites, and recovery actions.
- **Construction:** Projects start with a suggested crew when labor is available. Assign up to eight builders to one project to finish sooner. Pausing releases its crew; a project with zero builders waits for a manual assignment. New sites reserve their footprints but do not produce resources, house residents, excavate canals, or regulate water until complete.
- **Workforce:** Builders and production share the same pool. Dwellings bring eight residents when construction finishes; 65% of residents form the workforce. Finishing production buildings or removing housing can reduce construction crews to keep assignments within the population limit. Pausing production frees labor for construction.
- **Demolition and refunds:** Completed structures return 50% of invested materials, scaled by remaining condition and rounded down per resource. Unfinished projects return 100% at zero progress, decreasing linearly to 50% at completion. Stored goods and dispatched cargo are recovered when their producer is removed, subject to the absolute resource limit of 99,999. Removing a receiving warehouse or landing returns in-flight cargo to its producer. Canceling a temple upgrade preserves the existing sanctuary. Demolishing an intact dwelling removes up to eight residents. Removing a ruined dwelling only displaces any residents still above the remaining housing capacity, so already displaced residents are not removed twice. Ruined homes gradually displace up to two residents per day; repairing them restores space for resettlement. The starting settlement includes housing for 60 people plus eight per intact dwelling.
- **Water conservation:** Removing a canal or reservoir restores the terrain elevation while retaining its current water. Reclaiming filled waterways can flood neighboring land; the confirmation preview explains this effect.
- **Temple engineering:** Sanctuaries progress through a laterite foundation, sandstone towers, and sculpted reliefs, with named construction phases and distinct artwork. New temples require level ground (at most 0.5 elevation difference). Inspect a temple to plan a surrounding moat as paid excavation projects, or place individual moat tiles within two tiles of it. Four causeways and existing roads stay clear; bridges can cross moats. Connect the excavated ring to a filled waterway. At least half the ring must hold 0.45 water depth to restore two foundation stability per day. Dry foundations lose 0.8 per day, uneven ground loses two, and a flooded temple loses four. Upgrades need 60% stability; work slows below 60%, stops below 40%, and stability below 30% causes two condition damage per day. Repairs still work at low stability, but water management is needed for lasting recovery. Merit production pauses during an upgrade.
- **Bas-relief carving:** The final temple stage pauses at 80% until its nine stone panels match the artisan’s reference. Select “Carve the bas-relief” at the construction site and rotate each panel clockwise using a mouse, touch, or keyboard. The city pauses while you carve; closing restores the previous speed. Partial work persists in saves. Completing the puzzle grants 40 merit once, then builders can finish the sanctuary. Canceling and restarting that temple’s upgrade preserves the carving and cannot repeat the reward. Existing completed temples remain complete when older saves migrate.
- **Player feedback:** Resource bars show goods actually received per simulation minute, based on the last 30 simulation seconds. Returned cargo, stock waiting at worksites, rewards, refunds, and food consumption do not inflate delivery rates. Potential production remains visible in building details and resource tooltips. Idle-worker badges link to labor management; low-water alerts identify fields below 50% irrigation and reservoirs below 17% full. Placement shows a translucent building, its footprint, material costs, and the current validation result; temple previews also outline the potential moat ring.
- **Royal campaign:** Five linked commissions take the city from hydraulic foundations through connected neighborhoods, dry-season resilience, food supply, and a completed temple city. The overview shows the current commission; Royal commissions shows all chapters and their rewards. Rewards are granted automatically while the simulation runs, once every objective in the active chapter is met. Completed projects count toward building goals; starting structures and canceled sites do not. Population, rice reserves, healthy irrigation, and an operational temple are checked against the current city. Sustained objectives count consecutive daily checks in their own chapter and reset when conditions lapse.
- **Merit unlocks:** At 200 merit, the Great barays era unlocks the royal granary. A staffed, completed granary reduces daily rice needs by up to 25%. At 600 merit, the Temple city era unlocks the architect’s workshop and final temple stage. A staffed workshop increases builder work by up to 20%, including repairs and temple upgrades. Damage reduces support benefits; paused, ruined, unstaffed, or unfinished support buildings provide no benefit. Multiple copies use the strongest active benefit and do not stack. Earlier temple stages and basic infrastructure remain available from the start. Existing buildings and projects keep working.
- **Permanent progression:** Era unlocks use the highest merit reached, so they remain available if the current balance falls. Commission rewards can be earned only once. Delivery objectives count actual rice or sandstone received from couriers, up to available storage space; starting resources, refunds, returned shipments, and rewards do not count. After all five chapters, the city continues in free play.

| Controls                    | Action                                             |
| --------------------------- | -------------------------------------------------- |
| Drag / middle-drag / arrows | Pan (primary drag builds selected roads/canals)    |
| Road/canal drag             | Preview route and total cost; release to build     |
| Scroll / `+` / `-`          | Zoom                                               |
| `Space`                     | Pause or resume                                    |
| `1` to `6`                  | Select the first six buildings                     |
| `Escape`                    | Cancel placement                                   |
| `X`                         | Toggle demolition tool                             |
| `W` / `L` / `R` / `G`       | Water / delivery / deposits / construction overlay |
| `F` / `E`                   | Water flow / ground elevation overlays             |
| `H` / `?`                   | Builder’s guide                                    |

The speed controls run the simulation at 1×, 2×, or 4×. A day lasts six fixed simulation ticks; wet and dry seasons last 90 days each.

## Scenarios

| Scenario             | Terrain and timing                                                                              | Starting rice / timber / sandstone / laterite | Opening commission                                     |
| -------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| Roluos foundations   | Level grasslands, broad waterways; wet day 12                                                   | 680 / 420 / 340 / 210                         | Complete a canal, a paddy, and a baray                 |
| Tonlé Sap floodplain | Wider rivers, fertile low outer banks, raised settlement core; wet day 35                       | 900 / 500 / 200 / 160                         | Complete a floodgate and two paddies; receive 100 rice |
| Kulen foothills      | Wooded northwestern slopes, narrow rivers, level central sites; wet day 76, approaching drought | 480 / 320 / 520 / 300                         | Complete six canals, a baray, and a paddy              |

All scenarios begin with 84 residents and 48 merit. Floodplain chapter two requires two bridges, a warehouse, and two homes. Foothills chapter two requires 120 delivered sandstone, eight roads, and a warehouse. Each scenario then tests dry-season resilience and progresses toward a thriving temple city. Build goals count new completed projects and delivery goals exclude starting supplies. After five commissions, play continues freely.

Save slots, JSON import/export, and autosaves preserve the scenario, terrain, depleted deposits, and campaign progress. Older saves without a scenario retain the original Roluos campaign. In-game Settings also offers a scenario picker; its final replacement action changes only the active slot and returns to the main menu, where Continue enters it. Choose Play on the main menu to create another kingdom in an empty slot instead.

## Royal campaign

The table below describes the original Roluos campaign. Scenario-specific objectives appear in Royal commissions in the game.

| Chapter                        | Objectives                                                                                                                                                                | Reward                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| A city sustained by water      | Complete a new canal, paddy, and baray                                                                                                                                    | 50 merit                       |
| Bring the settlement together  | Complete two dwellings, five road tiles, and one bridge                                                                                                                   | 100 merit, 40 timber, 100 rice |
| Carry the city through drought | Three healthy irrigated fields, 150 rice in reserve, and five consecutive fully fed dry-season days with at least two healthy irrigated fields and no hunger              | 200 merit, 50 laterite         |
| A kingdom well supplied        | Complete a granary, receive 200 rice deliveries, and maintain 100 residents                                                                                               | 150 merit, 60 timber           |
| An enduring temple city        | Complete a workshop and an operational stage-three temple, receive 100 sandstone, maintain 120 residents, and sustain seven fully fed days with no hunger or ruined homes | 250 merit, 40 sandstone        |

Delivered cargo totals accumulate from the beginning of the campaign; daily streaks begin only when their chapter becomes active. Historic construction goals remain fulfilled after demolition. Live conditions can regress before a commission is awarded. Rewards respect the absolute resource limit of 99,999; they can temporarily place stock above the current warehouse capacity.

## Architecture

```text
src/
├── audio/         # Procedural Web Audio, device preferences and lifecycle
├── core/          # Typed world, commands, construction state, save slots and migration
├── simulation/    # Water, survival, campaign progression, A*, logistics, repairs, workforce
├── rendering/     # PixiJS scene, texture atlas, scaffolding, isometric mapping, camera
├── ui/            # HUD, survival warnings, project controls, refunds, responsive styles
├── data/          # Balance, buildings, royal commissions, objectives and era unlocks
└── main.ts        # Initialization and lifecycle
tests/             # Deterministic simulation and state validation tests
```

`Game` owns authoritative state. Commands validate placement and affordability before reserving materials and creating a construction project. Crew assignment enforces the shared workforce budget. `Construction` advances builder work at the current hunger productivity, activates completed buildings, repairs damage, and records construction investment. `Survival` applies drought and flood exposure on daily boundaries, then consumes food after delivery arrivals and reconciles population and crews. Consequences use simulation ticks, so speed changes and pause do not change the rules. `Progression` evaluates the active commission after construction, deliveries, and daily survival, grants rewards once, and records merit milestones. Production and support services share one canonical whole-building staffing order. `GameLoop` advances the simulation in 500 ms fixed steps and renders independently with interpolation. Simulation modules have no dependency on PixiJS or the DOM.

Each building retains a terrain snapshot and its actual completed investment. Floodgates and bridges can retain a completed canal as an underlay; removal restores that original structure and ID. Project costs remain separate from completed investment so cancellation and demolition refunds cannot double count materials. Demolition restores terrain without deleting water, removes source delivery jobs, and reconciles builder assignments after population changes.

The water automaton reads the old state and accumulates pressure-driven flux in a second buffer. Each donor is limited to half its water per tick, so multiple neighbors cannot overspend its volume. Volume is conserved with weather disabled. Rain, river inflow, and evaporation are explicit sources and sinks. Closed gates reduce permeability and block barge paths. This is an intentionally lightweight 2D approximation, not a physically calibrated hydraulic model.

A* uses a binary min-heap, Manhattan distance, and mode-specific traversal. The worker heuristic is scaled to the minimum traversal cost to remain admissible with roads: roads and bridges cost 0.65, open land costs 1, and forests cost 2. Worker movement uses the same cost to speed up travel on paths. Barges need a water depth of at least 0.45. Delivery jobs carry actual cargo, which enters the global resource pool only on arrival. Rice consumption happens each simulation day. Rates in the resource bar share the production calculation: staffing, irrigation, crop stress, condition, flooding, and hunger all reduce output. Delivery connectivity and travel time determine when cargo reaches the granary. Production stock retains fractional output so impaired workers can still make gradual progress.

The three deterministic 32 × 32 scenario worlds use one procedural canvas texture atlas shared by PixiJS sprites. All artwork is local. Tiles, trees, and buildings are created once and sorted by depth; changing overlays and water tint does not rebuild the scene. The UI uses self-hosted Fredoka and DM Sans, plus Phosphor icons and a custom prasat emblem. Floating cream panels, leafy green controls, a collapsible construction dock, and closable information panels keep the kingdom map central. Terrain grain, shaded foliage, architectural lighting, and motion-aware ambient particles are generated locally. The menu uses bundled cartoon Angkor artwork; in-game temples, homes, and civic buildings share the same locally drawn isometric palette, lighting, and staged architecture. Tall buildings and trees fade when they obscure a targeted tile; see [design notes and asset provenance](docs/REDESIGN.md).

## Kingdom guidance and celebrations

The compact issue banner and Kingdom overview offer actionable warnings. “Locate” centers an affected field, reservoir, worksite, damaged structure, or unstable temple and opens its details; repeat it to cycle through affected sites. Food warnings link to the food outlook. Rice reserves show how long the current stock lasts without deliveries, alongside a separate estimate using recent actual receipts. Reservoir outlooks extrapolate up to five daily readings, cover at most 30 days within the current season, and identify low storage at one average depth unit. Estimates are labeled and can change with weather, routes, gates, staffing, and population; observations remain available below them.

A dismissible celebration marks the first received harvest, a fed kingdom reaching the returning monsoon, a completed sculpted sanctuary, and royal commissions. One-time milestones are saved and do not replay on loading. Older saves silently remember existing harvest, sanctuary, and campaign achievements. Completing the campaign opens a paused kingdom summary with commission progress, population, merit, deliveries, completed projects, and standing sanctuaries. Continue returns to the prior simulation speed; the summary can be reopened from the completed campaign.

## Saves

Six independent save slots hold named kingdoms. Play selects a scenario, kingdom name, and destination slot; it defaults to an empty slot. Your kingdoms opens the slot library to load, rename, or recover a city. Continue opens the last played valid slot, or the most recently saved kingdom when that selection is unavailable. In-game Settings shows the active slot and can rename it. New kingdoms are saved before entering the map.

Every 30 seconds while playing, the active slot receives an autosave in IndexedDB with a LocalStorage fallback. Each slot keeps four rolling checkpoints, plus a separate synchronous recovery backup when leaving or hiding the page. Unchanged autosaves do not rotate useful history away while paused. The slot manager lists save type, time, scenario, day, and population. Recovery promotes a selected checkpoint to the latest save while keeping the previous head in rolling history. Starting a scenario or importing a JSON save changes only the active/destination slot and preserves recent checkpoints until they rotate out. Download a JSON save for a permanent archive; rolling recovery is bounded. Kingdom names belong to slots and importing a save keeps the destination slot name.

Each checkpoint is validated independently. Loading merges valid local and database copies, chooses the newest valid checkpoint, and skips damaged ones; the library flags unreadable checkpoint data. Local exit backups remain eligible even when an older database write finishes afterward. Existing single-save installations migrate their newest valid save into slot 1 as “My first kingdom”; legacy copies remain untouched. When either IndexedDB or LocalStorage is unavailable, the other can save. If both fail, saving reports an error and existing durable data remains untouched.

Version 5 saves add tile deposit quantities, shipment destinations, delivery warnings, and the transport dispatch cursor. Version 1 through 4 saves and JSON exports migrate automatically, preserving city stock, repairs, and campaign progress. Version 4 saves introduced merit milestones and royal commission progress. An already awarded first commission remains complete without paying its reward again; unavailable historic delivery totals begin at zero. Version 3 survival damage, hunger, and ongoing repairs are preserved. Older versions receive healthy buildings and no starting hunger; existing infrastructure becomes editable without resetting the economy.

Version 6 adds temple engineering, partial carving and its completion flag, and a bounded receipt history for actual delivery rates. Versions 1 through 5 migrate automatically. Existing deposit depletion, deliveries, construction progress, and campaign rewards are preserved; unavailable receipt history starts empty. Completed older temples receive completed carvings without another reward.

Save validation checks schemas, grid dimensions, numeric bounds, resources, building and underlay IDs, footprints and terrain snapshots, fractional project progress and crew budgets, survival counters, condition, crop data, courier destinations, deposits, delivery warnings, temple stability, carving rotations, receipt timestamps, chronicle records, ordered campaign claims, delivery totals, merit milestones, and daily streak bounds. If IndexedDB is unavailable, LocalStorage can still save the game.

Settings supports downloading and importing JSON saves, the evening colors, starting a fresh settlement, and saving back to the main menu. Opening Settings or the builder’s guide pauses the simulation; closing it restores the prior speed. Importing and resetting reloads the application after a successful save. Saves are local to this browser and origin; clearing site data removes them. There is no cloud sync in this initial codebase.

## Scope and next steps

This prototype includes temple moats, foundation stability, staged temple construction, a bas-relief rotation puzzle, delivered-rate feedback, warehouses, transport capacity, finite deposits, dedicated laterite production, delivery diagnostics, three scenario campaigns of five chapters each, permanent merit unlocks, working granary and workshop benefits, the resource loop, drought-driven crop failures and recovery, flood damage and timed repairs, food shortages and population consequences, timed construction and temple upgrades, shared builder assignment, demolition and refunds, buildable roads and bridges, hydraulic simulation, routing, rendering, and local persistence. Builder labor is pooled; the crews drawn at sites do not yet travel there as individual agents. Erosion and silt and cloud saves are future work. Historical themes guide the visual language, while map dimensions, units, dates, resource rates, and progression are game balance abstractions.

The design document also envisions regional campaigns from the Tonlé Sap floodplain to the Kulen foothills, Khmer kbach ornament, and a soundscape inspired by pinpeat music.

## Documentation

- [Game Design Document (PDF)](docs/Angkor_Architect_Game_Design_Document.pdf)

## Author

**Rithy Bondeth** — Full Stack Developer & AI Engineer

[![Portfolio](https://img.shields.io/badge/Portfolio-0A0A0A?style=for-the-badge&logo=vercel&logoColor=white)](https://bondeth.dev)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/RithyBondeth)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/rithy-bondeth-484073282/)

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.

## Interactive tutorial

New settlements open a six-lesson tutorial: read the water overlay, complete a canal that fills with water, plan a paddy, inspect its assigned builders, finish and irrigate the field, and receive rice from that field. The book button in Kingdom views reopens the current lesson. Site suggestions outline a valid location and move the camera there; the player still places and pays for every project normally. Inspecting a project exposes its crew controls, and delivery lessons show transport problems and remedies.

Progress, tracked sites, and completion or skip choices travel with local saves and JSON exports. Removed sites return the lesson to the relevant building step. Skip at any time, or start/restart from the builder’s guide. Existing saves without tutorial progress remain opted out until the player starts it. Lessons award no resources and do not pause or change simulation speed.

## Sound and atmosphere

Successful placements play a short construction cue; canals, moats, and barays use a water tone. A dragged route produces one cue. Actual cargo arrivals play distinct worker and barge chimes; failed deliveries, refunds, and loading saves stay silent. Effects are rate limited at high simulation speeds. A locally generated water texture accompanies the kingdom, becoming softer and darker in the dry season. No external audio files or services are required.

Settings in the welcome screen and game provide separate master, sound effects, and water ambience volumes, a mute toggle, and a test effects button. The header also offers quick mute. Preferences persist on this browser and origin, independently of kingdom saves. Audio starts after a click, tap, or key press, suspends when the page is hidden, and resumes on return when the browser permits it. Unsupported or blocked audio does not prevent playing.

## Offline play and installation

The production build is a progressive web app. Open Settings (from the main menu or a kingdom) and wait for **Ready for offline play** after the first online visit. The service worker downloads the complete game shell, artwork, fonts, manifest, and icons. After that, supported browsers can reopen the game and play all scenarios without a connection. All six save slots, autosaves, recovery, and procedural sound remain local. If files are evicted, Settings reports incomplete offline files and offers a download to repair the cache; reconnect first. Clearing browser site data removes both cached files and kingdoms, so download JSON saves for permanent backups.

When the browser supplies an installation prompt, Settings shows **Install Angkor Architect**. Other browsers may offer Install app or Add to Home Screen in their own menus; on iPhone or iPad use Safari’s Share menu, then Add to Home Screen. The manifest provides standalone display and regular/maskable PNG icons derived from the existing prasat favicon. Installation is optional and platform dependent; it does not provide cloud sync or transfer browser saves to another browser profile. See [MDN’s installation guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) for platform requirements.

Updates download in the background and wait. Settings offers **Save & reload update**; an active kingdom must save successfully before activation. Other open tabs are not reloaded automatically, and the previous build cache remains available for their hashed assets. New cache versions include hashes of the generated worker, bundled assets, and public files. An incomplete download cannot replace the working offline build. Service workers only handle application files and do not cache or delete kingdom save data.

Offline caching requires HTTPS (or localhost). `npm run dev` leaves the service worker disabled so development files do not get cached. To verify a production build locally, run `npm run build` and `npm run preview` on its separate origin, then check Settings. The build currently targets deployment at the site root (`/`). Browser storage policies, private browsing, embedded web views, and device space can limit installation or offline caching.

Regular Chrome offline reopening and native installation were verified on macOS, including a cold installed-app launch with the game server stopped. See [verification results and regression coverage](docs/OFFLINE_VERIFICATION.md).
