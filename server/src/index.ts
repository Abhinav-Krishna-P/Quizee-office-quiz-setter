import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

// Types
interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswerIndex: number;
  timeLimit: number;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  theme: 'pitch' | 'gold' | 'neon' | 'sunset';
  questions: Question[];
}

interface Player {
  id: string; // socket id
  name: string;
  score: number;
  streak: number;
  totalCorrectTime: number; // accumulated time taken for correct answers (in ms)
  lastAnswerTime: number; // time taken for the last question (in ms)
  lastAnswerCorrect: boolean;
  answeredThisQuestion: boolean;
  answerIndexThisQuestion: number | null;
}

interface Room {
  pin: string;
  quiz: Quiz;
  adminSocketId: string;
  status: 'LOBBY' | 'QUESTION' | 'REVEAL' | 'LEADERBOARD' | 'PODIUM';
  currentQuestionIndex: number;
  players: Map<string, Player>;
  questionStartTime: number;
  answersReceived: number;
  countdown: number;
  timer: NodeJS.Timeout | null;
}

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;
const QUIZZES_FILE_PATH = path.join(__dirname, '../data/quizzes.json');

// Helper to read quizzes
function readQuizzes(): Quiz[] {
  try {
    if (!fs.existsSync(QUIZZES_FILE_PATH)) {
      // Create folder if not exists
      const dir = path.dirname(QUIZZES_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(QUIZZES_FILE_PATH, JSON.stringify([]));
      return [];
    }
    const data = fs.readFileSync(QUIZZES_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading quizzes file:', err);
    return [];
  }
}

// Helper to write quizzes
function writeQuizzes(quizzes: Quiz[]) {
  try {
    const dir = path.dirname(QUIZZES_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(QUIZZES_FILE_PATH, JSON.stringify(quizzes, null, 2));
  } catch (err) {
    console.error('Error writing quizzes file:', err);
  }
}

// REST Routes
app.get('/api/quizzes', (req, res) => {
  res.json(readQuizzes());
});

app.post('/api/quizzes', (req, res) => {
  const newQuiz: Quiz = req.body;
  if (!newQuiz.id || !newQuiz.title || !newQuiz.questions || !newQuiz.questions.length) {
    return res.status(400).json({ error: 'Invalid quiz format' });
  }
  const quizzes = readQuizzes();
  const index = quizzes.findIndex(q => q.id === newQuiz.id);
  if (index !== -1) {
    quizzes[index] = newQuiz;
  } else {
    quizzes.push(newQuiz);
  }
  writeQuizzes(quizzes);
  res.json({ success: true, quiz: newQuiz });
});

// Socket state
const rooms = new Map<string, Room>();

// Helper to generate a 6-digit room PIN
function generatePIN(): string {
  let pin = '';
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms.has(pin));
  return pin;
}

// Helper to calculate leaderboard sorted array
function getSortedLeaderboard(room: Room) {
  const playersArr = Array.from(room.players.values());
  // Sort by score descending, then by totalCorrectTime ascending (faster answers first)
  return playersArr.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.totalCorrectTime - b.totalCorrectTime;
  });
}

// Socket IO Management
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Admin: Create room
  socket.on('admin-create-room', ({ quizId }) => {
    const quizzes = readQuizzes();
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz) {
      socket.emit('error-msg', 'Quiz not found');
      return;
    }

    const pin = generatePIN();
    const room: Room = {
      pin,
      quiz,
      adminSocketId: socket.id,
      status: 'LOBBY',
      currentQuestionIndex: -1,
      players: new Map(),
      questionStartTime: 0,
      answersReceived: 0,
      countdown: 0,
      timer: null
    };

    rooms.set(pin, room);
    socket.join(`room:${pin}`);
    
    socket.emit('room-created', { pin, quiz });
    console.log(`Room created: ${pin} for quiz ${quiz.title}`);
  });

  // Player: Join room
  socket.on('player-join', ({ pin, name }) => {
    const cleanPin = String(pin).trim();
    const room = rooms.get(cleanPin);
    if (!room) {
      socket.emit('join-error', 'Room not found. Check the PIN.');
      return;
    }
    if (room.status !== 'LOBBY') {
      socket.emit('join-error', 'Game has already started.');
      return;
    }
    // Check duplicate names
    const names = Array.from(room.players.values()).map(p => p.name.toLowerCase());
    if (names.includes(name.toLowerCase().trim())) {
      socket.emit('join-error', 'Username is already taken in this room.');
      return;
    }

    const player: Player = {
      id: socket.id,
      name: name.trim(),
      score: 0,
      streak: 0,
      totalCorrectTime: 0,
      lastAnswerTime: 0,
      lastAnswerCorrect: false,
      answeredThisQuestion: false,
      answerIndexThisQuestion: null
    };

    room.players.set(socket.id, player);
    socket.join(`room:${cleanPin}`);

    socket.emit('join-success', { pin: cleanPin, name: player.name });
    
    // Notify room of player list update
    const playersList = Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      score: p.score
    }));
    io.to(`room:${cleanPin}`).emit('player-list-update', playersList);
    console.log(`Player ${player.name} joined room ${cleanPin}`);
  });

  // Admin: Start game
  socket.on('admin-start-game', ({ pin }) => {
    const room = rooms.get(pin);
    if (!room || room.adminSocketId !== socket.id) return;

    room.currentQuestionIndex = 0;
    startQuestion(room);
  });

  // Admin: Next event (from REVEAL to LEADERBOARD, or LEADERBOARD to next QUESTION/PODIUM)
  socket.on('admin-next-event', ({ pin }) => {
    const room = rooms.get(pin);
    if (!room || room.adminSocketId !== socket.id) return;

    if (room.status === 'REVEAL') {
      // Show Leaderboard
      room.status = 'LEADERBOARD';
      const sortedLeaderboard = getSortedLeaderboard(room).map((p, idx) => ({
        name: p.name,
        score: p.score,
        streak: p.streak,
        rank: idx + 1
      }));
      io.to(`room:${pin}`).emit('show-leaderboard', { leaderboard: sortedLeaderboard });
    } else if (room.status === 'LEADERBOARD') {
      // Go to next question or podium
      const nextIndex = room.currentQuestionIndex + 1;
      if (nextIndex < room.quiz.questions.length) {
        room.currentQuestionIndex = nextIndex;
        startQuestion(room);
      } else {
        // Game Over - Show Podium
        room.status = 'PODIUM';
        const sorted = getSortedLeaderboard(room);
        const winners = sorted.slice(0, 3).map((p, idx) => ({
          name: p.name,
          score: p.score,
          rank: idx + 1
        }));
        io.to(`room:${pin}`).emit('show-podium', { winners });
      }
    }
  });

  // Player: Submit answer
  socket.on('player-submit-answer', ({ pin, answerIndex }) => {
    const room = rooms.get(pin);
    if (!room || room.status !== 'QUESTION') return;

    const player = room.players.get(socket.id);
    if (!player || player.answeredThisQuestion) return;

    const timeLimit = room.quiz.questions[room.currentQuestionIndex].timeLimit;
    const timeTaken = Date.now() - room.questionStartTime; // in ms
    
    player.answeredThisQuestion = true;
    player.answerIndexThisQuestion = answerIndex;
    player.lastAnswerTime = timeTaken;

    const correctIndex = room.quiz.questions[room.currentQuestionIndex].correctAnswerIndex;
    if (answerIndex === correctIndex) {
      player.lastAnswerCorrect = true;
      player.score += 1000; // 1000 base points for correct answer
      player.totalCorrectTime += timeTaken;
      player.streak += 1;
    } else {
      player.lastAnswerCorrect = false;
      player.streak = 0;
    }

    room.answersReceived += 1;
    
    // Tell player their answer is locked
    socket.emit('answer-locked', { answerIndex });
    
    // Update admin / room on answer count
    io.to(`room:${pin}`).emit('answer-count-update', { 
      answersReceived: room.answersReceived,
      totalPlayers: room.players.size 
    });

    // Check if all players answered
    if (room.answersReceived >= room.players.size && room.players.size > 0) {
      if (room.timer) {
        clearInterval(room.timer);
        room.timer = null;
      }
      revealAnswers(room);
    }
  });

  // Handle Disconnect
  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
    
    // Find rooms player or admin was in
    for (const [pin, room] of rooms.entries()) {
      if (room.adminSocketId === socket.id) {
        // Admin left, notify room and delete room after a small delay
        io.to(`room:${pin}`).emit('room-closed', 'The host has disconnected.');
        if (room.timer) clearInterval(room.timer);
        rooms.delete(pin);
        console.log(`Room ${pin} deleted because Admin disconnected.`);
      } else if (room.players.has(socket.id)) {
        const player = room.players.get(socket.id);
        room.players.delete(socket.id);
        console.log(`Player ${player?.name} left room ${pin}`);

        // Update active count / list
        const playersList = Array.from(room.players.values()).map(p => ({
          id: p.id,
          name: p.name,
          score: p.score
        }));
        io.to(`room:${pin}`).emit('player-list-update', playersList);

        // If in question phase, check if the remaining players have all answered
        if (room.status === 'QUESTION') {
          // Recalculate answers count
          let answeredCount = 0;
          room.players.forEach(p => {
            if (p.answeredThisQuestion) answeredCount++;
          });
          room.answersReceived = answeredCount;

          io.to(`room:${pin}`).emit('answer-count-update', { 
            answersReceived: room.answersReceived,
            totalPlayers: room.players.size 
          });

          if (room.answersReceived >= room.players.size && room.players.size > 0) {
            if (room.timer) {
              clearInterval(room.timer);
              room.timer = null;
            }
            revealAnswers(room);
          }
        }
      }
    }
  });
});

// Start Question Phase
function startQuestion(room: Room) {
  if (room.timer) clearInterval(room.timer);

  room.status = 'QUESTION';
  room.answersReceived = 0;
  
  // Reset player answered flags
  room.players.forEach(p => {
    p.answeredThisQuestion = false;
    p.answerIndexThisQuestion = null;
    p.lastAnswerCorrect = false;
    p.lastAnswerTime = 0;
  });

  const question = room.quiz.questions[room.currentQuestionIndex];
  room.countdown = question.timeLimit;
  room.questionStartTime = Date.now();

  // Send question detail to players and admin
  // For players, we strip the correctAnswerIndex for security
  const playerQuestion = {
    text: question.text,
    options: question.options,
    timeLimit: question.timeLimit,
    currentQuestionIndex: room.currentQuestionIndex,
    totalQuestions: room.quiz.questions.length,
    theme: room.quiz.theme
  };

  const adminQuestion = {
    ...playerQuestion,
    correctAnswerIndex: question.correctAnswerIndex
  };

  // Emit to participants and admin
  room.players.forEach((_, socketId) => {
    io.to(socketId).emit('question-start', playerQuestion);
  });
  io.to(room.adminSocketId).emit('admin-question-start', adminQuestion);

  // Start countdown ticker
  room.timer = setInterval(() => {
    room.countdown -= 1;
    io.to(`room:${room.pin}`).emit('timer-tick', { countdown: room.countdown });

    if (room.countdown <= 0) {
      if (room.timer) {
        clearInterval(room.timer);
        room.timer = null;
      }
      revealAnswers(room);
    }
  }, 1000);
}

// Reveal Answers Phase
function revealAnswers(room: Room) {
  room.status = 'REVEAL';

  const question = room.quiz.questions[room.currentQuestionIndex];
  const correctIdx = question.correctAnswerIndex;

  // Compile statistics
  const answersDistribution = { 0: 0, 1: 0, 2: 0, 3: 0 };
  room.players.forEach(p => {
    if (p.answerIndexThisQuestion !== null) {
      const idx = p.answerIndexThisQuestion as 0 | 1 | 2 | 3;
      answersDistribution[idx]++;
    }
  });

  // Calculate ranks
  const sorted = getSortedLeaderboard(room);

  // Emit individual feedback to each player
  room.players.forEach((player, socketId) => {
    const rank = sorted.findIndex(p => p.id === socketId) + 1;
    io.to(socketId).emit('question-feedback', {
      isCorrect: player.lastAnswerCorrect,
      pointsEarned: player.lastAnswerCorrect ? 1000 : 0,
      score: player.score,
      streak: player.streak,
      rank,
      timeTaken: player.lastAnswerTime,
      correctOptionText: question.options[correctIdx],
      correctOptionIndex: correctIdx
    });
  });

  // Emit reveal results to admin
  io.to(room.adminSocketId).emit('admin-question-reveal', {
    correctAnswerIndex: correctIdx,
    answersDistribution,
    totalPlayers: room.players.size,
    answersReceived: room.answersReceived
  });
}

// Listen
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
