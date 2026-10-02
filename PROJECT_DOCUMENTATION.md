# 🎮 PLATFORMS AHEAD — TECHNICAL PROJECT DOCUMENTATION

> **Full-Stack 2D Vertical Platformer Game with Real-Time Physics, Adaptive Audio, and Global Leaderboards**

---

## 📌 Executive Summary

**Platforms Ahead** is a modern, high-performance 2D vertical platformer web application built from the ground up using a full-stack JavaScript architecture. The game features real-time 60 FPS Canvas rendering, dynamic procedural platform generation, enemy creature AI with melee combat mechanics, adaptive multi-phase audio based on altitude, user authentication, and real-time global leaderboards.

---

## 🛠️ Complete Technology Stack

| Layer | Technology Used | Description & Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 18 + Vite** | High-speed Single-Page Application (SPA) UI layer with hot module replacement (HMR). |
| **Game Engine** | **HTML5 2D Canvas API** | Custom 60 FPS physics engine, AABB collision detection, dynamic camera Y-tracking. |
| **Styling & Design** | **Vanilla CSS Modules** | Modern Glassmorphism aesthetic, custom CSS variable tokens, Google Fonts (*Orbitron* & *Inter*). |
| **Audio Engine** | **HTML5 Audio + Web Audio API** | Dual-phase audio system with dynamic height-based track crossfading and Web Audio synth fallback. |
| **Backend API** | **Node.js + Express.js** | RESTful API server handling authentication requests and leaderboard data endpoints. |
| **Database** | **MongoDB + Mongoose ODM** | Document-oriented database for storing encrypted user accounts and game scores. |
| **Authentication** | **Bcrypt.js Password Hashing** | Secure user password hashing and persistent login state management. |

---

## 👥 3-Student Team Workload & Module Division

This project was developed by a team of **3 Students**, with responsibilities divided across Backend Development, Core Game Physics & Engine, and Frontend UI/UX & Audio Engineering.

```
                             ┌─────────────────────────────────────────┐
                             │             PLATFORMS AHEAD             │
                             └────────────────────┬────────────────────┘
                                                  │
         ┌────────────────────────────────────────┼────────────────────────────────────────┐
         │                                        │                                        │
┌────────▼────────┐                      ┌────────▼────────┐                      ┌────────▼────────┐
│    STUDENT 1    │                      │    STUDENT 2    │                      │    STUDENT 3    │
│ Backend & DB    │                      │ Game Engine & AI│                      │ Frontend & Audio│
└────────┬────────┘                      └────────┬────────┘                      └────────┬────────┘
         │                                        │                                        │
 ├── Node.js / Express                    ├── 2D Canvas Physics                    ├── React SPA Layout
 ├── MongoDB / Mongoose                   ├── Platform Generator                   ├── CSS Modules Design
 ├── Auth & Hashing                       ├── Enemy AI & Combat                    ├── Dynamic Audio System
 └── Leaderboard Aggregation              └── Sprite Animations                    └── API Integration Layer
```

---

### 👨‍💻 Student 1: Backend Architecture & Database Engineer
**Primary Focus:** Database Schemas, Express REST API, Authentication Security, and Leaderboard Data Processing.

#### Key Modules & Files Created:
1. **`backend/server.js`**:
   - Configured Express server middleware (CORS, JSON parser).
   - Managed MongoDB database connection lifecycle and environment configs.
   - Set up API routes (`/api/auth`, `/api/scores`, `/api/health`).

2. **`backend/models/User.js` & `Score.js`**:
   - **User Schema**: Unique username indexing, password hash storage, registration timestamps.
   - **Score Schema**: Foreign key reference to `User`, height reached (meters), platforms cleared count, timestamp.

3. **`backend/routes/auth.js`**:
   - `POST /api/auth/register`: Validates user inputs, hashes passwords using `bcrypt.js`, creates user records.
   - `POST /api/auth/login`: Verifies user credentials against stored hashes and returns user session objects.

4. **`backend/routes/scores.js`**:
   - `POST /api/scores`: Saves new game scores.
   - `GET /api/scores/user/:id`: Retrieves personal score history.
   - `GET /api/scores/leaderboard`: Executes MongoDB aggregation pipeline to compute each player's **personal best height**, ranking players for the global leaderboard.

---

### 👨‍💻 Student 2: Core Game Engine, Physics & AI Developer
**Primary Focus:** HTML5 Canvas Rendering, Sub-Pixel Physics, Procedural Platform Spawning, Enemy AI, and Combat Mechanics.

#### Key Modules & Files Created:
1. **`frontend/public/game.js`**:
   - **Physics & Camera System**:
     - Sub-pixel velocity vectors (`vx`, `vy`), gravity acceleration (`GRAVITY = 0.28`), jump forces (`JUMP_FORCE = -10`), and double-jumping mechanics.
     - Smooth camera Y-tracking (`cameraY`), continuously centering the viewport as the player climbs upward.
   - **Procedural Platform Generation**:
     - Dynamic height-based platform generator producing 4 distinct platform types:
       - 🟢 **Normal**: Solid landing surface.
       - 🟦 **Glass**: Shatters shortly after player contact.
       - 🟠 **Moving**: Oscillates horizontally across the screen.
       - 🔴 **Danger**: Spikes that kill player on contact.
     - **Safety Rules**: Enforces strict `edgeMargin = 48px` to prevent platforms from bleeding into boundary voids. Automatically spawns a normal safe companion platform whenever a Danger platform is generated so the game is always beatable.
   - **Enemy AI & Combat Engine**:
     - Spawns red creature zombies off-screen (`x = -cw` or `canvas.width`) walking smoothly onto the screen at controlled speeds (`0.4 - 0.7`).
     - Implements wall bounce detection (`vx` flipping) when touching screen boundaries.
     - **Melee Combat**: Generous 360°/wide slash hitbox (`ATTACK_RANGE = 150px`, `hbH = player.h + 80px`) allowing single-hit kills on attack key press (`E`).
     - **Particle Explosion System**: Triggers multi-colored particle bursts on creature death, platform landing, and double jumps.
   - **Sprite Sheet Animation Manager**:
     - Custom sprite renderer handling state transitions (`Idle`, `Run`, `Jump`, `Fall`, `Attack1-3`, `Death`) with directional flipping.

---

### 👨‍💻 Student 3: Frontend UI/UX, Dynamic Audio & Integration Engineer
**Primary Focus:** React SPA Architecture, Responsive Glassmorphic CSS System, Dual-Phase Audio Engine, and API Service Layer.

#### Key Modules & Files Created:
1. **`frontend/src/audioManager.js`**:
   - **Dual-Phase Adaptive Audio Controller**:
     - 🎵 **Phase 1 (< 600m)**: Plays **`fm_fun.flac`** (chill climbing theme).
     - ⚡ **Phase 2 (≥ 600m)**: Automatically switches to **`the_big_fight.mp3`** (intense fight theme) as altitude increases!
   - **Mute Persistence**: Synchronizes mute/unmute state with `localStorage` across page navigations.
   - **Web Audio Fallback**: Synthesizes retro chiptune audio via Web Audio API if audio files fail to load.

2. **`frontend/src/pages/HomePage.jsx` & `HomePage.module.css`**:
   - Built the main dashboard with hero section, controls guide card, floating 3D-styled platform previews, user rank badge, and real-time refreshable global leaderboard table with rank medals (🥇 🥈 🥉).
   - Added persistent **Music Mute/Unmute Toggle Button** in header.

3. **`frontend/src/pages/GamePage.jsx` & `GamePage.module.css`**:
   - Game canvas viewport wrapper, top controls bar (`← HOME` button & Music toggle button), and real-time HUD displaying **Platforms Cleared**, **Current Height (m)**, and **Best Score**.
   - Integrated React-to-Canvas bridge (`window.__onGameOver`) to seamlessly send scores to the database upon death.

4. **`frontend/src/pages/AuthPage.jsx` & `AuthPage.module.css`**:
   - Tabbed login/signup authentication modal with form validation and animated error/success feedback toasts.

5. **`frontend/src/api.js`**:
   - Centralized Fetch API abstraction layer communicating cleanly between React frontend and Node.js backend.

---

## 🎯 Key Technical Features Highlighted

1. **60 FPS Canvas Game Loop**: Driven by `requestAnimationFrame` with delta camera offsets.
2. **Procedural Level Design**: Infinite height climbing with progressive difficulty curves.
3. **Adaptive Audio System**: Real-time crossfading based on player altitude thresholds.
4. **Secure Full-Stack Pipeline**: Password hashing -> MongoDB storage -> Aggregated Leaderboard -> React UI.
5. **Modern Glassmorphic UI**: High-end cyberpunk design system with smooth CSS micro-animations.

---

## 🚀 How to Run the Project Locally

```bash
# 1. Start Backend Server
cd backend
npm install
npm start   # Runs on http://localhost:3001

# 2. Start Frontend App (in a separate terminal)
cd frontend
npm install
npm run dev # Runs on http://localhost:5173
```

---
*Documentation compiled for academic project submission.*
