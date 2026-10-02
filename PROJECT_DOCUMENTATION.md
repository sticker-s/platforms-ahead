# Platforms Ahead — Comprehensive Project Documentation

## 1. Executive Summary & Architecture Overview

**Platforms Ahead** is a full-stack, arcade-style 2D vertical platformer web application. Players climb procedurally generated platforms, defeat roaming enemy creatures, execute double jumps, dodge dangerous spikes and crumbling glass, and compete on a global leaderboard.

The project follows a modern decoupled architecture:
- **Frontend**: Built with **React** (Vite), featuring custom CSS Modules, Google Fonts (*Orbitron* and *Inter*), HTML5 Canvas 2D Rendering Engine, dynamic sprite animations, particle particle physics, and an adaptive audio engine.
- **Backend**: Built with **Node.js** and **Express.js**, connecting to a **MongoDB** database via **Mongoose**. It handles user authentication, password hashing, score submission, and aggregate leaderboard queries.

```
┌─────────────────────────────────────────────────────────────────┐
│                       PLATFORMS AHEAD                           │
├────────────────────────────────┬────────────────────────────────┤
│       FRONTEND (Vite/React)    │      BACKEND (Node/Express)     │
│  - AuthPage / HomePage         │  - Express REST API             │
│  - GamePage & HTML5 Canvas     │  - SHA-256 Auth & Salting      │
│  - HTML5 Canvas Engine (game.js)│  - MongoDB Mongoose Models      │
│  - Dynamic Audio Manager       │  - Aggregate Leaderboard API   │
└────────────────────────────────┴────────────────────────────────┘
```

---

## 2. Facilities & Core Features

### 👤 User Authentication & Session Management
- **Signup & Login**: Secure account creation with username validation (2–24 characters) and min 4-character password requirement.
- **Password Security**: Passwords are hashed on the backend using SHA-256 with a unique salt (`platformer_salt_2024`).
- **Session Persistence**: User credentials/session token are stored in `sessionStorage` (`pa_user`), allowing automatic re-login on refresh.

### 🏆 Global Leaderboard & Personal Best Tracking
- **Aggregation Pipeline**: The backend groups scores by `userId`, calculating each player's highest altitude reached (`bestHeight`), maximum platforms cleared (`bestPlatforms`), and total `gamesPlayed`.
- **Top 20 Rankings**: Real-time display on the home screen with medal badges (🥇, 🥈, 🥉) for top 3 players and special highlighting for the logged-in user.
- **Auto Score Saving**: Scores automatically sync to the backend database upon game over (`window.__onGameOver`).

### 🕹️ HTML5 Canvas 2D Game Engine (`/public/game.js`)
- **60 FPS Game Loop**: Uses `requestAnimationFrame` for physics updates and rendering.
- **Procedural Generation**: Infinite vertical platform generation (`spawnY`) and automatic off-screen culling (`cullPlatforms`) to keep memory footprint minimal.
- **Dynamic Camera System**: Smooth vertical camera tracking (`cameraY`) following the player's upward ascent.
- **Parallax Starfield & Gradient Background**: Deep space gradient that smoothly darkens with altitude (`depth`) and interactive twinkling star particles.

### 🎵 Adaptive Dynamic Audio Manager (`audioManager.js`)
- **Dual-Track Music System**:
  - **Phase 1 (< 600m)**: Plays upbeat track `fm_fun.flac`.
  - **Phase 2 (≥ 600m)**: Seamlessly transitions to intense track `the_big_fight.mp3`.
- **Global Mute & State Sync**: Mute status is saved in `localStorage` (`music_muted`), accessible via UI toggle buttons on both Home and Game pages.

### ⚔️ Warrior Sprite Engine & Combat System
- **Sprite Sheet Animation Engine**: Custom frame-buffered sprite animation supporting 14 sprite variants (`Idle`, `Run`, `Jump`, `Fall`, `Attack1-3`, `Death`, left-facing mirrors).
- **Melee Attack System**: Hitting <kbd>E</kbd> swings a sword (3-hit combo cycle `Attack1` → `Attack2` → `Attack3`), casting a radial attack arc and killing any enemy creature within `ATTACK_RANGE` (150px).
- **Double Jump Capability**: Players can perform a mid-air jump with custom particle puff visual feedback.

---

## 3. Game Mechanics & Platform Types

### Platform Classifications

| Platform Type | Visual Style | Mechanic / Behavior |
| :--- | :--- | :--- |
| **Normal** | 🟢 Green Gradient (`#5dce9e`) | Standard solid platform with top highlight reflection. Safe to land on. |
| **Glass** | 🟦 Semi-transparent Blue (`rgba(140,220,255,0.5)`) | Crack timer triggers upon contact (55 frames). Shatters into glass debris particles after landing. |
| **Moving** | 🟧 Orange Gradient (`#f0933a`) | Horizontal back-and-forth oscillation with direction indicator arrows (`▶ ▶` / `◀ ◀`). |
| **Danger** | 🟥 Red Gradient with Spikes (`#d63031`) | Lethal hazard spikes! Instant death upon touching. *Always spawns with a safe normal companion platform beside it.* |

### Enemy Creature Mechanics
- **Roaming Red Orbs**: Pulsing crimson tentacles (`ellipse` rendering with dynamic leg movement).
- **Behavior**: Horizontal patrol across platforms with wall bounce detection.
- **Combat**: Contact causes player death unless the player executes an attack with <kbd>E</kbd> first.
- **Death Effects**: Explosion of yellow (`#ffcc00`) and red (`#ff4060`) particle bursts on defeat.

### Milestones
- Floating visual milestone announcements trigger when reaching key height benchmarks: **5m, 10m, 20m, 50m, 100m, 200m, 500m, 1000m**.

---

## 4. Full File & Directory Structure

```
platforms-ahead/
├── backend/
│   ├── models/
│   │   ├── User.js          # Mongoose schema for user registration & credentials
│   │   └── Score.js         # Mongoose schema for game run history & indexed height scores
│   ├── routes/
│   │   ├── auth.js          # Signup & Login REST API endpoints
│   │   └── scores.js        # Score submission, personal history, & Leaderboard aggregation API
│   ├── .env                 # Environment variables (PORT, MONGO_URI)
│   ├── package.json         # Node dependencies (express, mongoose, cors, dotenv)
│   └── server.js            # Express app entry point & MongoDB connection setup
│
└── frontend/
    ├── public/
    │   ├── img/warrior/     # 14 PNG Sprite sheets for warrior animations
    │   ├── game.js          # Complete 2D Canvas Engine, physics, game loop, rendering & AI
    │   ├── favicon.svg      # App favicon icon
    │   └── icons.svg        # UI icons
    ├── src/
    │   ├── audio/
    │   │   ├── fm_fun.flac       # Phase 1 background music track (< 600m)
    │   │   └── the_big_fight.mp3 # Phase 2 background music track (≥ 600m)
    │   ├── pages/
    │   │   ├── AuthPage.jsx          # Login/Signup UI component
    │   │   ├── AuthPage.module.css   # Auth portal styling (glassmorphism & glowing orbs)
    │   │   ├── HomePage.jsx          # Dashboard, Control Guide, & Leaderboard component
    │   │   ├── HomePage.module.css   # Home screen styling & platform floating decor
    │   │   ├── GamePage.jsx          # Canvas container, HUD, Legend, Overlays
    │   │   └── GamePage.module.css   # Canvas layout & HUD styling
    │   ├── api.js           # Centralized API fetch helper for backend requests
    │   ├── App.jsx          # Master React state router & auth session manager
    │   ├── audioManager.js  # Singleton class for audio tracks, volume, altitude switching, mute
    │   ├── index.css        # Global CSS variables, reset, fonts, animations
    │   └── main.jsx         # React application root entry point
    ├── index.html           # Main HTML document with Orbitron & Inter Google Fonts
    ├── package.json         # Frontend dependencies (React 19, Vite, oxlint)
    └── vite.config.js       # Vite development & build configuration
```

---

## 5. Exhaustive Function & Module Reference

### 5.1. Backend (`/backend`)

#### `server.js`
- **Express Middleware**: `express.json()`, `cors({ origin: 'http://localhost:5173', credentials: true })`.
- **`app.get('/api/health')`**: Health check route returning `{ status: 'ok' }`.
- **`mongoose.connect(MONGO_URI)`**: Asynchronously connects to MongoDB database before starting listener on `PORT` (default: 3001).

#### `routes/auth.js`
- **`hashPassword(password)`**: Hashes password using Node.js native `crypto.createHash('sha256')` with `platformer_salt_2024`.
- **`POST /api/auth/signup`**: Validates input length, checks existing usernames, creates new `User` model document.
- **`POST /api/auth/login`**: Finds user by username, compares SHA-256 password hash, returns user object on success.

#### `routes/scores.js`
- **`GET /api/scores/leaderboard?limit=20`**: Aggregates top scores grouped by `userId`, computing `$max` height and platform count per player.
- **`POST /api/scores`**: Validates user ID and score, rounded height/platform parameters, saves new `Score` entry.
- **`GET /api/scores/user/:userId`**: Retrieves top 10 personal runs for a specific user ID.

---

### 5.2. Frontend Infrastructure (`/frontend/src`)

#### `App.jsx`
- **`getStoredUser()`**: Reads `sessionStorage` item `pa_user`.
- **`handleLogin(userData)`**: Stores user data state and updates `sessionStorage`.
- **`handleLogout()`**: Clears user session and resets page to home.
- **`goToGame()` / `goToHome()`**: Controls active view rendering.

#### `api.js`
- **`apiFetch(path, options)`**: Wrapper function around `fetch` targeting `http://localhost:3001/api`.
- **`api.signup(username, password)`**: Invokes signup endpoint.
- **`api.login(username, password)`**: Invokes login endpoint.
- **`api.getLeaderboard(limit)`**: Fetches leaderboard data.
- **`api.submitScore(userId, height, platforms)`**: Posts game score.
- **`api.getUserScores(userId)`**: Fetches user score history.

#### `audioManager.js`
- **`initAudio()`**: Instantiates Audio elements for `fm_fun.flac` and `the_big_fight.mp3` with loop enabling and volume set to 0.45.
- **`toggleMute()`**: Flips `muted` state, persists in `localStorage`, pauses/resumes audio.
- **`updateHeight(heightMeters)`**: Switches track from Track 1 (`fm_fun`) to Track 2 (`the_big_fight`) when height reaches 600m.
- **`playTrack(trackNum)`**: Handles audio switching and currentTime reset.
- **`pauseAll()` / `resumeCurrent()`**: Pauses all playback or resumes active track.

---

### 5.3. Core Canvas Game Engine (`/public/game.js`)

| Function Name | Description & Purpose |
| :--- | :--- |
| `resizeCanvas()` | Dynamically resizes the HTML5 canvas width (capped at 720px) and height to fill the screen view. |
| `switchSprite(key)` | Changes active warrior sprite sheet and resets frame counters. |
| `drawPlayer()` | Renders scaled warrior sprite frame on canvas, managing animation frame rate timing. |
| `createPlatform(worldY, forceType)` | Instantiates platform objects with randomly selected types (`normal`, `glass`, `moving`, `danger`), width, horizontal positions, and edge margins. |
| `spawnInitialPlatforms()` | Generates the starting ground platform and initial platform stack above the player. |
| `spawnMorePlatforms()` | Continually generates platforms as camera moves upward. Guarantees safe companion platforms next to danger platforms. |
| `cullPlatforms()` | Removes platforms that have fallen off-screen below `CULL_BELOW` boundary. |
| `getClimbedHeight()` | Calculates vertical height climbed in meters relative to starting Y coordinate. |
| `createCreature(worldY)` | Spawns enemy red orb creatures at canvas edges. |
| `spawnCreatureIfNeeded()` | Periodically spawns creatures at regular frame intervals (max 2 active creatures). |
| `doAttack()` | Triggers player sword attack, plays attack animation sequence, builds `ATTACK_RANGE` hitbox, and kills overlapping creatures. |
| `spawnParticles(x, y, color, count)` | Emits radial explosion particles for impacts or creature deaths. |
| `spawnLandingPixels(x, y, color)` | Generates glowing cyan/purple dust pixel particles on landing. |
| `spawnDoubleJumpPuff(x, y)` | Spawns a ring puff of smoke particles when executing a double jump. |
| `initStars()` | Generates initial star field coordinates with twinkling opacity parameters. |
| `updateCamera()` | Locks camera position to follow player when ascending past 38% screen height. |
| `updateHUD()` | Updates DOM elements for cleared platform count, height meter, and high score. |
| `updatePlayer()` | Core physics processor: applies horizontal velocity, gravity, jump, double jump, platform landing collision detection, glass shattering, hazard damage, and creature contact. |
| `killPlayer()` | Triggers death animation state, particle explosion, audio pause, and invokes `showGameOver()`. |
| `updatePlatforms()` | Animates moving platforms horizontally and decrements glass cracking timers. |
| `updateCreatures()` | Updates enemy creature position, edge bounces, and animation phases. |
| `updateParticles()` | Moves particle coordinates, applies light gravity, and decays particle lifespans. |
| `drawBackground()` | Renders procedural deep space background gradient, twinkling stars, and altitude fog bands. |
| `drawPlatform(p)` | Canvas drawing routine for normal, glass, moving, and spiked hazard platforms. |
| `drawCreature(cr)` | Canvas drawing routine for enemy red orb creatures, pulse effect, tentacles, eyes, and health bar. |
| `drawParticles()` | Renders active particles (both circle and pixel shapes). |
| `drawAttackArc()` | Visualizes the sword swing slash arc and tip glow particle. |
| `checkMilestone()` / `drawMilestoneBanner()` | Detects height milestones and draws glowing banner text overlays. |
| `showGameOver()` | Displays game over modal overlay and fires `window.__onGameOver` callback to React. |
| `startGame()` | Resets score, player position, platforms, creatures, particles, audio, and starts game loop. |
| `gameLoop()` | Master requestAnimationFrame loop executing physics update and drawing stages. |

---

## 6. Technologies & Libraries Used

- **React 19**: Component-based UI framework for state management and DOM rendering.
- **Vite**: Ultra-fast build tool and frontend development server.
- **HTML5 Canvas 2D API**: High-performance 2D rendering for game graphics and particle systems.
- **Node.js & Express 5**: Asynchronous event-driven web backend framework.
- **MongoDB & Mongoose 9**: NoSQL document database and schema object modeling.
- **Crypto API**: SHA-256 security hashing for user passwords.
- **CORS**: Cross-Origin Resource Sharing middleware enabling secure frontend-backend integration.
- **Dotenv**: Environment variable configuration management.
- **CSS Modules**: Scoped CSS styling preventing class name collisions.
- **Google Fonts**: Custom web typography (*Orbitron* for sci-fi headers & *Inter* for body text).

---

## 7. How to Run the Application

### 1. Prerequisites
- **Node.js** (v18+)
- **MongoDB** (running locally on port `27017` or via MongoDB Atlas URI in `backend/.env`)

### 2. Start the Backend Server
```bash
cd backend
npm install
npm run dev
```
*Backend runs on:* `http://localhost:3001`

### 3. Start the Frontend Development Server
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on:* `http://localhost:5173`

---

*Documentation generated for Platforms Ahead project.*
