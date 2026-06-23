# Office Quiz Arena 🎮

A live, Kahoot-style quiz platform built for office team-building events and trivia tournaments. It supports up to 50 concurrent participants, real-time multiplayer gameplay synced via Socket.io, server-side speed-ranked scoring with tie-breaker by correct answer speed, and AI-assisted quiz question generation from PDFs using the Google Gemini API.

## Features

- **Double-Screen Layout**:
  - **Host View**: Projected display showing the room QR code, live answer count, countdown ring, per-question leaderboards, and a 3D-podium finish with confetti.
  - **Participant View**: Mobile-first interface with four big color-coded accessible shapes matching the projector screen.
- **Speed-Ranked Scoring**: Points are distributed dynamically based on response speed:
  - **1st Correct**: 20 pts
  - **2nd Correct**: 15 pts
  - **3rd Correct**: 10 pts
  - **Others Correct**: 5 pts
- **Tie-Breaking Rankings**: If players have the same total score, they are ranked based on the speed of their most recent correct answer. Leaderboards and podiums display points and times cleanly on a single line (`20 pts • 2.50s`).
- **AI-Assisted Builder**: Upload any PDF document to parse and extract up to 30 multiple-choice trivia questions automatically using Google Gemini AI, which you can review and edit before publishing.
- **Micro-Animations**: Shimmering text, fade-ins, and radial card spotlights inspired by **React Bits** powered by Framer Motion.
- **Resilient Real-time Sync**: Synced countdown clocks using server timestamps to prevent client-side clock drifts, with automatic reconnection handling.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS v4, Framer Motion, HTML5-QRCode, Canvas-Confetti |
| **Backend** | Node.js, Express, Socket.io, Multer |
| **Database** | PostgreSQL (`pg` connection pool, auto-migration on start) |
| **Containerization** | Docker, Docker Compose, Nginx |
| **AI Integration** | Google Gemini API SDK (`@google/generative-ai`) |

---

## Folder Structure

```
office-quiz-arena/
├── client/                       # React + Vite + Tailwind v4 Frontend
│   ├── src/
│   │   ├── components/           # Custom animations (React Bits-style)
│   │   ├── pages/
│   │   │   ├── admin/            # Host views (Lobby, Control, Dashboard)
│   │   │   └── participant/      # Player views (Join, Lobby, LiveQuiz, Results)
│   │   ├── socket/               # Socket.io Client Setup
│   │   ├── App.jsx               # Routes Definition
│   │   └── main.jsx
│   ├── Dockerfile
│   └── nginx.conf
├── server/                       # Node.js + Express Backend
│   ├── src/
│   │   ├── db/                   # Database client & schema migration script
│   │   ├── routes/               # API endpoints (Auth, Quizzes, Sessions)
│   │   ├── services/             # Scoring and Gemini API extractors
│   │   ├── sockets/              # Socket.io connection handlers
│   │   └── index.js              # Server entry point
│   └── Dockerfile
├── docker-compose.yml            # Production Compose config
├── self_hosting_guide.md         # Full VPS deployment guide
├── package.json                  # Root runner configurations
└── README.md
```

---

## Prerequisites

Make sure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [PostgreSQL](https://www.postgresql.org/) (Service running locally or remotely)
- *Or [Docker](https://www.docker.com/) for containerized deployment*

---

## Setup Instructions (Local Development)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/Quizee-office-quiz-setter.git
cd Quizee-office-quiz-setter
```

### 2. Install dependencies
Run the installation script in the root directory to set up the root runner, backend, and frontend packages:
```bash
npm run install:all
```

### 3. Database & Secrets Setup
1. Duplicate the template configuration file in the server folder:
   ```bash
   cp server/.env.example server/.env
   ```
2. Open `server/.env` and update the variables:
   - `DATABASE_URL`: Connection string pointing to your PostgreSQL instance (e.g. `postgresql://postgres:password@localhost:5432/postgres`).
   - `GEMINI_API_KEY`: Your Gemini Developer key from Google AI Studio.
   - `JWT_SECRET`: A secure key used for signing admin JWT logins.

*Note: The database tables and a default administrator account (`admin@officequiz.com` / `admin123`) will be automatically initialized and seeded in the database upon launching the backend server.*

---

## Running the Application (Local Development)

In the root directory, start both the client and server concurrently:
```bash
npm run dev
```

- **Frontend Client**: runs on [http://localhost:5173](http://localhost:5173)
- **Backend API Server**: runs on [http://localhost:4000](http://localhost:4000)

---

## Docker & Self-Hosting (Production Deployment)

The project is fully dockerized for hosting on a VPS. See [self_hosting_guide.md](self_hosting_guide.md) for full setup instructions.

### Quick Start:
1. Create a `.env` file in the root directory:
   ```env
   POSTGRES_PASSWORD=your_secure_db_password
   JWT_SECRET=your_jwt_secret
   GEMINI_API_KEY=your_gemini_api_key
   ```
2. Build and start the services:
   ```bash
   docker compose up -d --build
   ```
3. Open `http://your-server-ip/` in your browser.

