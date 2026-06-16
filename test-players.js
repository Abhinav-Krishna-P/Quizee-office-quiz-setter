const { io } = require('socket.io-client');

// Read PIN from command line arguments
const pin = process.argv[2];
if (!pin) {
  console.error('Error: Please provide a room PIN. Example: node test-players.js 123456');
  process.exit(1);
}

const PLAYER_COUNT = 40;
const SERVER_URL = 'http://localhost:5000';
const clients = [];

console.log(`🚀 Starting load test: spawning ${PLAYER_COUNT} players to join room ${pin}...`);

for (let i = 1; i <= PLAYER_COUNT; i++) {
  const name = `Player_${i}`;
  const socket = io(SERVER_URL);

  socket.on('connect', () => {
    // Join room
    socket.emit('player-join', { pin, name });
  });

  socket.on('join-success', () => {
    console.log(`✅ ${name} successfully joined the room lobby.`);
  });

  socket.on('join-error', (err) => {
    console.error(`❌ ${name} failed to join: ${err}`);
    socket.disconnect();
  });

  socket.on('question-start', (questionData) => {
    const questionNum = questionData.currentQuestionIndex + 1;
    // Simulate player thinking speed: answer randomly between 500ms and 5000ms
    const delay = Math.floor(Math.random() * 4500) + 500;
    const answerIndex = Math.floor(Math.random() * 4); // Select random answer (0-3)

    setTimeout(() => {
      socket.emit('player-submit-answer', { pin, answerIndex });
      console.log(`⚡ ${name} submitted answer [${answerIndex}] for Q${questionNum} after ${delay}ms`);
    }, delay);
  });

  socket.on('question-feedback', (feedback) => {
    console.log(`ℹ️ ${name} Q feedback: correct=${feedback.isCorrect}, pts=${feedback.pointsEarned}, streak=${feedback.streak}, rank=${feedback.rank}`);
  });

  socket.on('show-podium', (podium) => {
    console.log(`🏆 Podium announced! Winners:`, JSON.stringify(podium.winners));
    socket.disconnect();
  });

  socket.on('room-closed', () => {
    console.log(`🔒 Room closed for ${name}. Disconnecting.`);
    socket.disconnect();
  });

  clients.push(socket);
}

// Handle exit cleanly
process.on('SIGINT', () => {
  console.log('\nStopping simulation. Disconnecting all clients.');
  clients.forEach(c => c.disconnect());
  process.exit();
});
