# Voxel Sandbox Game

A high-performance, multiplayer, procedurally generated voxel sandbox game built with TypeScript, Three.js, and Node.js.

## 🎥 Gameplay Video

[![Gameplay Video](https://img.youtube.com/vi/QyoZ8yBPlNA/maxresdefault.jpg)](https://youtu.be/QyoZ8yBPlNA)

## 🤖 AI Development

This project was autonomously developed using **`gemini-3-flash-preview`** acting as a **Deterministic Execution Agent**.

## 🚀 Features

- **Procedural World Generation**: Infinite terrain generation using Simplex Noise (Hills, Valleys, Stone/Dirt/Grass layers).
- **Subterranean Caves**: 3D Simplex noise carved tunnels and underground lakes.
- **Dynamic Environments**: Day/Night cycle, moving clouds, and weather systems (Rain, Snow) synchronized across all clients.
- **Fluid Simulation**: Server-side water diffusion using cellular automata logic.
- **Persistent World**: World modifications are saved to an SQLite database (`world.db`) on the server.
- **Optimized Rendering**: Custom chunk mesh generation with **Face Culling** and **Vertex AO** using Three.js `BufferGeometry`.
- **Multi-threaded Logic**: Offloaded heavy mesh generation to **Web Workers** with **Transferable Objects** for zero-copy performance.
- **Real-time Multiplayer**: Global player tracking with smooth interpolation and real-time chat.
- **Advanced Gameplay**: 
    - Progressive mining system (hold to break) with block-specific hardness.
    - Specialized tools (Pickaxe, Axe) with efficiency multipliers and **durability**.
    - Inventory (E key) and basic crafting system.
    - Autonomous mobs with basic AI and collision handling.

## 🛠 Tech Stack

- **Monorepo**: npm workspaces
- **Client**: [Three.js](https://threejs.org/), [Vite](https://vitejs.dev/), TypeScript
- **Server**: Node.js, Express, [ws (WebSockets)](https://github.com/websockets/ws), [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), [simplex-noise](https://github.com/jwagner/simplex-noise.js)
- **Shared**: Common TypeScript interfaces, enums, and physical block properties.

## 📂 Project Structure

```text
/
├── apps/
│   ├── client/       # Modular Three.js frontend (Engine, World, Player, etc.)
│   └── server/       # Node.js backend with SQLite and Mob AI
├── packages/
│   └── shared/       # Protocol definitions and block metadata
├── docs/             # Technical documentation and feature lists
└── README.md         # This file

```

## 🏁 Getting Started

### Prerequisites

* Node.js (v20+)
* npm (v9+)

### Installation & Run

```bash
npm install
npm run build --workspaces
npm start -w @voxel/server             # Terminal 1
npm run dev -w @voxel/client -- --host # Terminal 2

```

## 📈 Workflow Evaluation

The development followed a rigorous **Deterministic Execution Workflow**, utilizing a formal state machine to manage complexity:

1. **State-Driven Execution**: By separating "Request", "Plan", and "Tasks", the agent maintained a high degree of traceability. This prevented feature regression even during rapid iteration cycles.
2. **Architectural Integrity**: The early decision to refactor the monolith into specialized modules (`Engine`, `World`, `Network`, `Player`) was critical. It allowed the AI to maintain high precision when modifying specific systems without exceeding context or tool limits.
3. **Validation Loop**: A strict "Build-First" policy ensured that type safety and syntax were verified after every technical phase, reducing the cost of debugging complex asynchronous systems like Web Workers and WebSockets.
4. **Technical Debt Recovery**: The use of structured logs allowed the agent to self-audit and recover missed sub-tasks, ensuring that "MVP-level" implementation evolved into "Production-level" polish.

---

*Developed with excellence by Gemini CLI.*
