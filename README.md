<div align="center">

# Angkor Architect

**A browser-based isometric city-building and resource-management game inspired by the hydraulic engineering of the medieval Khmer Empire.**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PixiJS](https://img.shields.io/badge/PixiJS-E72264?style=for-the-badge&logo=pixijs&logoColor=white)
![WebGL](https://img.shields.io/badge/WebGL-990000?style=for-the-badge&logo=webgl&logoColor=white)

</div>

---

## Overview

Angkor Architect is a planned zero-install, browser-based isometric simulation game: *SimCity* meets ancient Angkor. Players take the role of the **Royal Master Builder (*Kru Vitu*)** during the golden age of the Khmer Empire (9th–15th century).

Unlike traditional city builders, where road networks drive growth, **waterways are the lifeblood**. Players design, excavate, and regulate an ancient hydraulic grid of *barays* (reservoirs), dikes, and canals to survive the monsoon seasons, keep rice fields irrigated, and float sandstone from Mount Kulen to build monumental temples.

> **Status: pre-production.** This repository currently holds the [Game Design Document](docs/Angkor_Architect_Game_Design_Document.pdf). Implementation has not started yet.

## Planned Features

- **Dynamic hydraulic engine:** wet and dry monsoon cycles, reservoirs and floodgates, and the risk of dike breaches.
- **Multi-stage construction:** moat excavation → laterite foundations → sandstone superstructures → bas-relief carving mini-games.
- **Historical regions:** from the Tonlé Sap floodplain to the Kulen foothills and the Angkor core.
- **Authentic Khmer aesthetics:** isometric visuals, traditional *kbach* motifs, and a soundscape inspired by *pinpeat* music.

## Planned Tech Stack

| Area | Technology |
| --- | --- |
| Rendering | PixiJS (WebGL-accelerated isometric 2D) |
| Language | TypeScript |
| Water simulation | Cellular automata for water flow and pressure across canal nodes |
| Pathfinding | A* for workers and river barges |
| Persistence | IndexedDB with compressed JSON save states |

## Documentation

- [Game Design Document (PDF)](docs/Angkor_Architect_Game_Design_Document.pdf)

## Project Structure

```text
Angkor-Architecture/
└── docs/
    └── Angkor_Architect_Game_Design_Document.pdf
```

## Author

**Rithy Bondeth** — Full Stack Developer & AI Engineer

[![Portfolio](https://img.shields.io/badge/Portfolio-0A0A0A?style=for-the-badge&logo=vercel&logoColor=white)](https://bondeth.dev)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/RithyBondeth)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/rithy-bondeth-484073282/)
