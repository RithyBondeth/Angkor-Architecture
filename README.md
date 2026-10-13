# 🏛️ Angkor Architect

> *SimCity* meets ancient Angkor Wat—manage water grids, feed millions, carve sandstone, and build the greatest hydraulic empire in Southeast Asian history.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PixiJS](https://img.shields.io/badge/PixiJS-E72264?style=flat&logo=pixi.js&logoColor=white)](https://pixijs.com/)
[![WebGl](https://img.shields.io/badge/WebGL-990000?style=flat&logo=webgl&logoColor=white)](https://www.khronos.org/webgl/)

---

## 🌟 Overview

**Angkor Architect** is a zero-install, browser-based isometric simulation game. Players take on the role of the **Royal Master Builder (*Kru Vitu*)** during the golden age of the Khmer Empire (9th–15th century). 

Unlike traditional city builders where road networks dictate growth, **waterways are your primary lifeblood**. You must design, excavate, and regulate the ancient hydraulic grid (*Barays*, dikes, and canals) to survive seasonal monsoon shifts, sustain agriculture, and transport heavy stone blocks from Mount Kulên to construct monumental temple complexes.

---

## ✨ Core Features

* 🌊 **Dynamic Hydraulic Engine:** Experience a seasonal cycle (Wet vs. Dry monsoons). Manage reservoirs (*Barays*) and floodgates to prevent catastrophic dike breaches while keeping rice fields irrigated.
* 🏗️ **Multi-Tiered Construction Pipeline:** Build monumental structures in realistic historical phases: Moat excavation $\rightarrow$ Laterite foundations $\rightarrow$ Sandstone superstructures $\rightarrow$ Bas-relief carving mini-games.
* 🗺️ **Historical Eras & Biomes:** Progress through distinct ecological regions from the Tonlé Sap floodplain to the Kulên foothills and the Angkor core city grid.
* 🎨 **Authentic Khmer Aesthetics:** Isometric visual styling paired with traditional architectural motifs (*Kbach*) and an atmospheric soundscape blending ancient *Pinpeat* melodies.

---

## 🛠️ Tech Stack & Architecture

Engineered for high performance (60 FPS) directly in modern web browsers:

* **Rendering Engine:** [PixiJS](https://pixijs.com/) (WebGL-accelerated 2D isometric grid rendering)
* **Language:** [TypeScript](https://www.typescriptlang.org/) for robust, type-safe simulation logic
* **Simulation Logic:** Custom **Cellular Automata** algorithm for fluid pressure and water propagation across canal nodes
* **Pathfinding:** **A* Pathfinding** for worker navigation and river barge routing
* **State Management & Storage:** Local state persistence via `IndexedDB` with compressed JSON states

---

## 🚀 Getting Started (Local Development)

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (v18+) and npm installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone [https://github.com/Rithybondeth/angkor-architect.git](https://github.com/Rithybondeth/angkor-architect.git)
   cd angkor-architect
