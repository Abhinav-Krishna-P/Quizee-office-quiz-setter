CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quizzes (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT CHECK (status IN ('draft','published','ended')) DEFAULT 'draft',
  party_code TEXT UNIQUE,
  settings JSONB,              -- { timerDefault, teamMode, numTeams, teamNames,
                                --   randomizeOrder, randomizeOptions, maxParticipants }
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
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

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
  party_code TEXT UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('lobby','live','ended')) DEFAULT 'lobby',
  current_question_index INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  total_score INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS participants (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  avatar_color TEXT,
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  total_score INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS answers (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  option_index SMALLINT,
  time_taken_ms INTEGER,
  correct BOOLEAN,
  points_earned INTEGER
);
