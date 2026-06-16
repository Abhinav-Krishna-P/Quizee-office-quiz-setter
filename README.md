# 🏆 FIFA 2026 Quizee - Real-Time Multiplayer Trivia (Kahoot Replica)

FIFA 2026 Quizee is a premium, real-time multiplayer Kahoot! replica themed around the upcoming **FIFA World Cup 2026**. Built with React, Vite, Node, Express, and Socket.io, it provides a high-fidelity gamified experience for host presenters and players alike. 

---

## ✨ Features

- **🎮 Host Console / Creator Dashboard**:
  - Add, edit, or delete custom trivia questions (1 question with 4 options).
  - Configure individual timers (5s to 60s).
  - Select from 4 premium FIFA theme backdrops:
    - ⚽ **Grass Soccer Pitch** (Classic Green with chalk pitch markings)
    - 🏆 **Golden Trophy** (Elegant Navy and Gold with floating dust particles)
    - 🌌 **Neon Night Stadium** (Cyberpunk Cyan and Purple lights)
    - 🌅 **Qatar Sunset** (Warm crimson and orange gradient)
- **👥 Stadium Waiting Lobby**:
  - Live participant counters supporting 30-50+ concurrent users.
  - Interactive QR Code and join link generation.
  - Players are rendered on screen as dynamic **FIFA Ultimate Team (FUT) Player Cards**. Cards automatically assign a Gold/Silver/Bronze tier, a player rating (85-99), and a field position (ST, CAM, CB, etc.) hashed consistently from the player's username.
- **📱 Responsive Player Controllers**:
  - Touch-friendly layout representing option cards (Red Triangle, Blue Diamond, Yellow Circle, Green Square).
  - Selection lock-in and real-time response feedback (correctness, response speed, active streak, and current rank).
- **🏟️ Projection Screens & Animations**:
  - Smooth SVG circular countdown timers.
  - Dynamic answer distribution bar charts.
  - 🥇 Celebrating winners on a rising podium with physics-based confetti bursts.
  - **Synthesized Stadium Audio**: Built-in sound generator using the browser's Web Audio API to play referee whistles and cheering crowd noise without requiring external audio files.

---

## ⚡ Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Vanilla CSS (Premium glassmorphism and animations)
- **Backend**: NodeJS, Express, Socket.io, TypeScript
- **Database**: Local JSON File Database (for fast, zero-config setups)
- **Visuals & Audio**: HTML Canvas, `canvas-confetti`, Web Audio API, `qrcode.react`, `lucide-react`

---

## ⚙️ Project Structure

```text
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # Home, Creator, Lobby, Admin, Player Views
│   │   ├── App.tsx         # Central Socket.io routing & state controller
│   │   ├── index.css       # FIFA Stylesheets & Animations
│   │   └── socket.ts       # Socket.io Client Setup
│   └── package.json
│
├── server/                 # Express + Socket.io Server
│   ├── src/
│   │   └── index.ts        # Real-time Game State Engine & REST APIs
│   ├── data/
│   │   └── quizzes.json    # JSON Persistence Database
│   └── package.json
│
├── test-integration.js     # Concurrency load simulation test
├── package.json            # Root command orchestration
└── README.md               # This file
```

---

## 🚀 Quick Start

### 1. Install Dependencies
Open terminal inside the root directory and run:
```bash
npm run install-all
```
This commands installs packages in the root, client, and server folders concurrently.

### 2. Launch Dev Servers
Start the server and client concurrently:
```bash
npm run dev
```
- **Backend Server** launches on `http://localhost:5000`
- **React Frontend** launches on `http://localhost:5173`

---

## 🧪 Simulation & Load Testing

To verify the app's capability to support 30-50 concurrent participants, you can run the automated player simulator:

1. Launch the app dev servers (`npm run dev`).
2. Go to `http://localhost:5173/creator` and click **Host Room** on any quiz to create a live lobby.
3. Note the **6-digit room PIN** displayed on the lobby projection banner.
4. Open a separate terminal window at the root and run the simulator script:
   ```bash
   node test-integration.js <ROOM_PIN>
   ```
   *(Replace `<ROOM_PIN>` with the active room PIN, e.g. `node test-integration.js 123456`)*.

The script will spawn **45 concurrent player clients**, join the lobby, lock in answers automatically with random thinking delays, calculate tie-breakers, output real-time leaderboards, and print the final podium ranks when the quiz concludes.

---

## 📏 Game Scoring & Tie-breakers

To make the competition exciting, the application implements the following scoring mechanism:
1. **Base Points**: Answering correctly awards `1000` points.
2. **Speed Tiebreaker**: If two players have the same score, the ranking displays the faster responder higher on the scoreboard. The server tracks the cumulative time taken (in milliseconds) for correct answers and sorts the leaderboard in ascending order of time for matching scores.

---

## 🛡️ License
Distributed under the MIT License.
🏆 *Quizee 2026 is an independent fan replica game. All football branding is utilized for conceptual styling.*
