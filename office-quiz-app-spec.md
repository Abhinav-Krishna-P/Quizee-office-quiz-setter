# Office Quiz Arena — Product & Technical Specification

> A live, Kahoot-style quiz platform built for internal office use (~50 participants). Two roles: **Host (Admin)** and **Participant**. Real-time synced gameplay, AI-assisted question creation from PDFs, live leaderboards, and a final podium with winners.
>
> This document is written to be handed directly to a developer, IDE, or AI coding agent (e.g. Claude Code, Cursor) to build the full project end-to-end.

---

## 1. Project Summary

| | |
|---|---|
| **Purpose** | Internal office quiz / trivia tool for team events |
| **Scale** | ~50 concurrent participants per session |
| **Roles** | Host/Admin (creates & runs quizzes), Participant (joins & plays) |
| **Platform** | Responsive web app (desktop for host display/projector, mobile for participants) |
| **Core inspiration** | Kahoot! 360 |
| **Tech stack** | React (frontend) + Node.js/Express + Socket.io (backend) + PostgreSQL (self-hosted, already provisioned) + Gemini API (PDF → quiz generation) |

---

## 2. Recommended Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + Vite, React Router | Fast dev loop, simple SPA routing for Home / Host / Join flows |
| Styling | Tailwind CSS | Rapid, consistent, easy to make it look "fantastic" quickly |
| Animation | Framer Motion + `canvas-confetti` | Countdown rings, card flips, podium reveal, confetti |
| QR Code | `qrcode` (server-side generation), `html5-qrcode` (client-side camera scanning) | Generate + scan party codes |
| Backend | Node.js + Express | Hosts secure endpoints (scoring, Gemini calls, code generation) — never trust the client for scoring |
| Real-time engine | **Socket.io**, mounted on the same Express server | Pushes live state to all connected clients: lobby presence, countdown sync, live answer counts, leaderboard updates — the standard approach for Kahoot-style games when you're not using a managed real-time database |
| Data persistence | **PostgreSQL** (your existing self-hosted instance) | Quizzes, questions, sessions, participants, answers, final results — all durable, relational data |
| Auth | JWT-based admin login (`admins` table + bcrypt password hashing) for Hosts; lightweight generated `participantId` (no password) for Participants, stored in `sessionStorage` | Admin accounts are real office logins; participants just need a session identity, no signup friction |
| AI / PDF parsing | **Google Gemini API** (e.g. `gemini-1.5-flash` or `gemini-2.0-flash`) | Upload PDF directly to Gemini (multimodal file input), prompt it to return strict JSON of questions/options — call this **only from the backend**, never expose the API key in the frontend |
| File handling | In-memory / temp folder on the server (e.g. `multer`) | PDFs only need to exist briefly during the upload → Gemini → discard round trip, no permanent storage needed |
| Hosting | Frontend → Vercel/Netlify. Backend (Express + Socket.io) → wherever your Postgres-hosting SSH box lives, or any Node host that can keep a persistent process + WebSocket connections open | Keep frontend and backend on separate, simple deploy targets |

**Why Socket.io instead of a managed real-time database?** Since you're self-hosting Postgres (a request/response database, not a live-push one), the backend needs to actively broadcast state changes to all connected clients itself. Socket.io runs right alongside your existing Express server, keeps a live WebSocket connection per participant, and pushes countdown ticks, answer counts, and leaderboard updates the moment they happen — no external service, no extra cost, full control.

---

## 3. User Roles

- **Host / Admin** — an office staff member with a real login. Creates quizzes, configures settings, builds/imports questions, publishes, runs the live session, controls pacing.
- **Participant** — anyone in the office. No account needed. Joins with a party code, QR scan, or shared link, picks a nickname (and team, if team mode is on), and plays.

---

## 4. Core User Flows

### 4.1 Home Page

Single clean landing page, two big boxes/cards:

1. **Join a Quiz**
   - Input field for **Party Code**
   - "Scan QR" button → opens camera scanner
   - Also supports deep-link join: visiting `/join/:partyCode` skips straight to nickname entry
2. **Host a Quiz**
   - If not logged in as admin → simple login screen
   - If logged in → "Create Quiz" button + list of "My Quizzes" (drafts, published, past results)

### 4.2 Host Flow (step by step)

1. **Create Quiz** button → routes to **Quiz Settings**
2. **Quiz Settings screen**
   - Quiz title
   - Default timer per question (e.g. 10s / 20s / 30s / 60s, custom)
   - Team mode toggle:
     - Off → solo/individual play
     - On → define number of teams, team names, team colors
   - Max participants (default 50)
   - Randomize question order (toggle)
   - Randomize answer order (toggle)
   - Continue → **Question Builder**
3. **Question Builder screen** — two ways to add questions, can mix both:
   - **Manual entry**: question text, 4 options, mark correct option, optional per-question timer override, optional image upload
   - **PDF Import (AI-assisted)**: upload a PDF → backend sends it to Gemini → Gemini returns up to 30 questions, each with 4 options and the correct answer marked → host reviews and edits every auto-generated question before saving (never auto-publish ungenerated content)
   - Drag-and-drop reorder
   - Hard cap: **30 questions max** (≈ 30 slides, 1 question + 4 options each)
4. **Publish**
   - Generates a unique **6-character Party Code** and a **QR code** (encodes a join link like `https://yourapp.com/join/AB12CD`)
   - Quiz status changes to `lobby`
   - Host is shown the QR code + party code full-screen (designed to be projected/shared on a TV screen)
5. **Host Lobby screen**
   - Live list of joined participants (and teams, if enabled), updating in real time as people join
   - Participant counter
   - "Start Quiz" button (host clicks **Enter** to lock the lobby and kick off the game)
6. **Host Live Control screen**
   - Shows current question + live countdown
   - Live "X / Y answered" counter
   - Auto-advances to reveal once timer hits zero (or host can force-advance)
   - "Next Question" control between rounds
7. **Leaderboard** — shown automatically after each question's reveal (top 5 + movement indicators)
8. **Final Results screen**
   - Animated **podium** for 1st / 2nd / 3rd place (with confetti)
   - Full final leaderboard
   - Optional: export results (CSV) for record-keeping/prizes

### 4.3 Participant Flow (step by step)

1. Home page → enter **Party Code**, scan **QR**, or open shared **link**
2. Enter **nickname** (+ choose avatar color; pick a **team** if team mode is on)
3. Enter **Lobby** — sees other participants joining live, a "waiting for host to start" animation
4. Host clicks Start → all participants are redirected together to the **Live Quiz screen**
5. **Each round:**
   - Question text + image (if any) shown
   - 4 large colored answer tiles (Kahoot-style: red/blue/yellow/green with triangle/diamond/circle/square icons, for accessibility and instant recognition)
   - Countdown ring/bar synced to server time (not the device's local clock)
   - Tapping an option locks it in immediately; can't change the answer
6. **Reveal** — correct answer highlighted, "Correct!"/"Wrong" feedback, points earned this round (faster + correct = more points), current rank shown
7. **Leaderboard** shown between questions — top 5 plus "you are #N"
8. **End of quiz** — final podium animation, personal stats (accuracy %, average answer speed, final rank), confetti for top 3

---

## 5. Scoring Algorithm

Speed-weighted scoring, calculated **server-side only** (never trust client-submitted scores):

```
BASE_POINTS = 1000

if answer is correct:
    speed_ratio = timeTakenMs / timeLimitMs        // 0 (instant) to 1 (used all the time)
    points = round(BASE_POINTS * (1 - speed_ratio * 0.5))   // floor at 50% of base points
else:
    points = 0
```

Optional toggle: **streak bonus** — +50 points per consecutive correct answer, reset on a miss.

In team mode, a team's score = sum (or average, host's choice) of its members' scores.

---

## 6. Data Model

### 6.1 PostgreSQL Schema (persistent data)

```sql
CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE quizzes (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES admins(id),
  title TEXT NOT NULL,
  status TEXT CHECK (status IN ('draft','published','ended')) DEFAULT 'draft',
  party_code TEXT UNIQUE,
  settings JSONB,              -- { timerDefault, teamMode, numTeams, teamNames,
                                --   randomizeOrder, randomizeOptions, maxParticipants }
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,             -- order within the quiz, 0-29
  text TEXT NOT NULL,
  image_url TEXT,
  options JSONB NOT NULL,                -- ["opt A", "opt B", "opt C", "opt D"]
  correct_index SMALLINT NOT NULL,       -- 0-3
  time_limit INTEGER,                    -- seconds, falls back to quiz settings.timerDefault
  points INTEGER DEFAULT 1000
);

CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER REFERENCES quizzes(id),
  party_code TEXT UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('lobby','live','ended')) DEFAULT 'lobby',
  current_question_index INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ
);

CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  total_score INTEGER DEFAULT 0
);

CREATE TABLE participants (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  avatar_color TEXT,
  team_id INTEGER REFERENCES teams(id),
  total_score INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE answers (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id),
  option_index SMALLINT,
  time_taken_ms INTEGER,
  correct BOOLEAN,
  points_earned INTEGER
);
```

### 6.2 Live State (in-memory + Socket.io, not persisted to Postgres)

Ephemeral, fast-changing state that doesn't need a permanent row lives in a simple in-memory object on the server per active `party_code`, and is pushed to clients over Socket.io rather than read from the database:

```js
liveSessions[partyCode] = {
  state: "lobby" | "question" | "reveal" | "leaderboard" | "ended",
  currentQuestionIndex: 0,
  questionStartedAt: <server Date.now()>,
  connectedParticipantIds: Set(),
  answerCounts: { 0: 0, 1: 0, 2: 0, 3: 0 }
}
```

**Socket.io rooms & events:**

| Event | Direction | Purpose |
|---|---|---|
| `join-session` | client → server | Participant/host socket joins the `partyCode` room |
| `lobby-update` | server → room | Broadcast updated participant list as people join |
| `quiz-started` | server → room | Tells all clients to move to the first question |
| `question-start` | server → room | New question payload + `questionStartedAt` timestamp for synced countdown |
| `answer-count-update` | server → room | Live "X / Y answered" tally for the host screen |
| `question-reveal` | server → room | Correct answer + per-client score/rank |
| `leaderboard-update` | server → room | Top 5 + each client's own rank |
| `quiz-ended` | server → room | Final results payload, triggers podium screen |
| `participant-disconnected` | server → room | Updates presence list on drop |

Clients receive live updates purely via these Socket.io events. All **writes that affect scoring or game state** still go through validated backend logic (either the REST endpoints below or a Socket.io event handler that performs the same server-side checks) — never trust the client.

---

## 7. Backend API (Express + Socket.io)

REST endpoints handle anything request/response (CRUD, auth, scoring writes); Socket.io handles anything that needs to push to many clients instantly (see Section 6.2 event table).

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/admin-login` | Admin email/password login, returns a JWT |
| `POST /api/quizzes` | Create a new quiz (draft) |
| `PUT /api/quizzes/:id` | Update settings / questions |
| `POST /api/quizzes/:id/extract-pdf` | Upload PDF → calls Gemini → returns extracted question JSON for host review |
| `POST /api/quizzes/:id/publish` | Generates party code + QR, sets status to `lobby`, creates a `sessions` row |
| `POST /api/sessions/:partyCode/join` | Validates code, creates a `participants` row, returns a `participantId` |
| `POST /api/sessions/:partyCode/start` | Host starts the quiz; flips live state, emits `quiz-started` |
| `POST /api/sessions/:partyCode/next` | Advances question → reveal → leaderboard → next question, emits the matching Socket.io event |
| `POST /api/sessions/:partyCode/answer` | Participant submits an answer; **server computes score**, writes to `answers` table, emits `answer-count-update` |
| `GET /api/sessions/:partyCode/results` | Final leaderboard + per-participant stats, pulled from Postgres |

---

## 8. Gemini PDF → Quiz Extraction

Backend sends the uploaded PDF (as file bytes, using Gemini's multimodal/document input) along with an instruction prompt. Example prompt template:

```
You will receive a PDF document. Extract up to 30 multiple-choice quiz
questions from its content. Each question must have exactly 4 answer
options with exactly one correct answer.

Return ONLY valid JSON, no markdown formatting, no commentary, in this
exact shape:

[
  {
    "question": "string",
    "options": ["string", "string", "string", "string"],
    "correctIndex": 0
  }
]

If the document does not contain enough extractable content for 30
questions, return as many high-quality questions as possible (minimum
quality over quantity). Do not invent facts not present or implied in
the document.
```

The backend parses the JSON response, strips any accidental code-fence wrapping, and hands the array to the frontend Question Builder for the host to **review and edit before saving** — auto-generated content is never published unreviewed.

---

## 9. UI/UX & Animation Guidelines

- **Visual language**: bold, high-contrast, Kahoot-inspired — 4 answer tiles each with a distinct color (red/blue/yellow/green) and shape icon (triangle/diamond/circle/square) so options are recognizable at a glance, even on small phone screens
- **Motion** (Framer Motion):
  - Countdown ring that visibly drains as time runs out
  - Card-flip or fade transition on answer reveal
  - Podium "rise up" animation for 1st/2nd/3rd at the end, with `canvas-confetti`
  - Smooth page transitions between lobby → question → leaderboard
- **Typography**: large, bold, highly legible — host screen is meant to be projected on a TV/screen for the whole room to see
- **Mobile-first** for the participant view (most people will join by scanning a QR on their phone); desktop-first for the host control screen
- **Optional sound**: countdown tick, correct/wrong chime, lobby waiting music — with a mute toggle
- **Empty/loading states**: friendly, on-brand loading animations rather than blank screens (especially in the lobby while waiting for the host)

---

## 10. Non-Functional Requirements

- Comfortably support **50 concurrent participants** per session — trivial load for a single Node/Express + Socket.io process and a Postgres database
- Countdown timers synced via **server timestamp** (`questionStartedAt`), not each device's local clock, to keep all 50 phones in sync
- **Reconnect handling**: if a participant refreshes or loses connection, the client re-emits `join-session` with its stored `participantId` + `partyCode` (kept in `sessionStorage`) and the server re-attaches the existing socket to the right room and replays current state
- Admin/host area gated behind JWT login; participant area requires no signup
- Scoring is always computed server-side to prevent cheating via browser devtools
- If you ever run multiple simultaneous quiz sessions on the same server, keep `liveSessions` keyed by `partyCode` so they don't interfere with each other

---

## 11. Suggested Folder Structure

```
office-quiz-arena/
├── client/                       # React + Vite frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── admin/
│   │   │   │   ├── Login.jsx
│   │   │   │   ├── MyQuizzes.jsx
│   │   │   │   ├── QuizSettings.jsx
│   │   │   │   ├── QuestionBuilder.jsx
│   │   │   │   ├── HostLobby.jsx
│   │   │   │   └── HostLiveControl.jsx
│   │   │   └── participant/
│   │   │       ├── Join.jsx
│   │   │       ├── Lobby.jsx
│   │   │       ├── LiveQuiz.jsx
│   │   │       └── FinalResults.jsx
│   │   ├── components/           # AnswerTile, CountdownRing, Leaderboard, Podium, QRDisplay, QRScanner...
│   │   ├── socket/                 # socket.io-client setup + hooks (useSocketEvent, etc.)
│   │   ├── hooks/
│   │   └── App.jsx
│   └── package.json
├── server/                       # Node.js + Express + Socket.io backend
│   ├── src/
│   │   ├── routes/                # quizzes.js, sessions.js, auth.js
│   │   ├── services/              # geminiService.js, scoringService.js, qrService.js
│   │   ├── sockets/                # socket.io event handlers (lobby, question, reveal, leaderboard)
│   │   ├── db/                     # pg connection pool + query helpers, migrations
│   │   └── index.js
│   └── package.json
└── README.md
```

---

## 12. Environment Variables

```
# client/.env
VITE_API_BASE_URL=               # points to the Express backend
VITE_SOCKET_URL=                 # usually the same host as the API, Socket.io upgrades the connection

# server/.env
DATABASE_URL=                    # postgres://user:password@host:port/dbname  (your existing SSH-hosted instance)
JWT_SECRET=                      # for signing admin login tokens
GEMINI_API_KEY=                  # NEVER expose this to the frontend
PORT=4000
```

---

## 13. Build Roadmap

1. **Phase 1** — Project scaffold, Postgres schema/migrations, Express + Socket.io server boot, admin JWT auth, basic quiz CRUD
2. **Phase 2** — Manual Question Builder, Publish flow (party code + QR generation)
3. **Phase 3** — Join flow + Lobby with real-time presence
4. **Phase 4** — Live gameplay loop: synced countdown, answer submission, server-side scoring, per-question leaderboard
5. **Phase 5** — Gemini PDF import for AI-assisted question generation
6. **Phase 6** — Final results/podium screen, animations, confetti, sound
7. **Phase 7** — Polish pass + test with a real office group at ~50 users, then deploy

---

## 14. Stretch Goals (optional, post-MVP)

- Reusable quiz templates / quiz history & analytics dashboard
- Scheduled quizzes (publish now, go live at a set time)
- Export results to Excel/CSV for prize-giving records
- Emoji reactions / light team chat during live play
- Host moderation tools (kick/rename a participant mid-game)
- Dark mode
- Multi-language question support

---

## 15. How to Hand This to a Coding Agent

Suggested first prompt to give an AI coding agent (e.g. Claude Code):

> "Build the project described in `office-quiz-app-spec.md`. Start with Phase 1 of the Build Roadmap: scaffold the `client/` (React + Vite + Tailwind) and `server/` (Node + Express + Socket.io) folders as described in the Folder Structure section, run the Postgres schema in Section 6.1 against the existing database (`DATABASE_URL`), and implement admin JWT login plus basic quiz CRUD. Don't move to Phase 2 until Phase 1 is working end-to-end."

Then proceed phase by phase, referencing the relevant section number each time.
