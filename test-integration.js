const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:5000';
const PLAYER_COUNT = 45; // Test with 45 concurrent players
const clients = [];
let adminSocket = null;
let roomPin = '';
let totalQuestions = 0;
let currentQuestionIndex = 0;

console.log('🏁 Starting General Knowledge Quizee Integration & Load Simulation...');

// 1. Initialize Admin Client
adminSocket = io(SERVER_URL);

adminSocket.on('connect', () => {
  console.log('🖥️ Admin connected to game server.');
  // Create room for seeded general trivia quiz
  adminSocket.emit('admin-create-room', { quizId: 'general-trivia' });
});

adminSocket.on('room-created', (data) => {
  roomPin = data.pin;
  totalQuestions = data.quiz.questions.length;
  console.log(`🏠 Room created successfully! PIN: ${roomPin} | Quiz: "${data.quiz.title}" (${totalQuestions} Questions)`);
  
  // 2. Spawn Mock Players
  spawnPlayers(roomPin);
});

adminSocket.on('admin-question-start', (q) => {
  currentQuestionIndex = q.currentQuestionIndex;
  console.log(`\n⚽ Question ${currentQuestionIndex + 1}/${totalQuestions} Started: "${q.text}"`);
});

adminSocket.on('admin-question-reveal', (data) => {
  console.log(`📊 Question Finished! Correct Index: [${data.correctAnswerIndex}]`);
  console.log(`📊 Distribution: Option 1: ${data.answersDistribution[0]} | Option 2: ${data.answersDistribution[1]} | Option 3: ${data.answersDistribution[2]} | Option 4: ${data.answersDistribution[3]}`);
  
  setTimeout(() => {
    console.log('⏭️ Admin advancing to Scoreboard...');
    adminSocket.emit('admin-next-event', { pin: roomPin });
  }, 1000);
});

adminSocket.on('show-leaderboard', (data) => {
  console.log('🏆 --- LOBBY LEADERBOARD ---');
  data.leaderboard.slice(0, 3).forEach((p) => {
    console.log(`   Rank #${p.rank}: ${p.name} | Score: ${p.score} PTS | Streak: ${p.streak}`);
  });
  
  setTimeout(() => {
    if (currentQuestionIndex + 1 < totalQuestions) {
      console.log('⏭️ Admin advancing to Next Question...');
      adminSocket.emit('admin-next-event', { pin: roomPin });
    } else {
      console.log('⏭️ Admin advancing to Final Podium Ceremony...');
      adminSocket.emit('admin-next-event', { pin: roomPin });
    }
  }, 1500);
});

adminSocket.on('show-podium', (data) => {
  console.log('\n👑 ====================================');
  console.log('👑   QUIZEE LIVE FINAL CHAMPIONS');
  console.log('👑 ====================================');
  data.winners.forEach((w) => {
    console.log(`🏆 CHAMPION RANK #${w.rank}: ${w.name} with ${w.score} PTS!`);
  });
  console.log('👑 ====================================');
  
  console.log('\n🎉 Simulation completed successfully! Disconnecting clients...');
  shutdown();
});

adminSocket.on('error-msg', (msg) => {
  console.error('❌ Admin Error:', msg);
  shutdown();
});

function spawnPlayers(pin) {
  let joinedCount = 0;
  console.log(`👥 Spawning ${PLAYER_COUNT} players...`);

  for (let i = 1; i <= PLAYER_COUNT; i++) {
    const name = `Player_${i}`;
    const pSocket = io(SERVER_URL);

    pSocket.on('connect', () => {
      pSocket.emit('player-join', { pin, name });
    });

    pSocket.on('join-success', () => {
      joinedCount++;
      if (joinedCount === PLAYER_COUNT) {
        console.log(`👥 All ${PLAYER_COUNT} players successfully joined the waiting list!`);
        setTimeout(() => {
          console.log('\n🚀 Kick-off! Admin starting the game...');
          adminSocket.emit('admin-start-game', { pin: roomPin });
        }, 1000);
      }
    });

    pSocket.on('question-start', (q) => {
      const delay = Math.floor(Math.random() * 2000) + 200;
      
      // Seed general quiz correct index mappings: Q1: index 2, Q2: index 1, Q3: index 1
      const answersMap = [2, 1, 1];
      const correctAns = answersMap[q.currentQuestionIndex];
      const answerIndex = Math.random() > 0.4 ? correctAns : Math.floor(Math.random() * 4);

      setTimeout(() => {
        pSocket.emit('player-submit-answer', { pin, answerIndex });
      }, delay);
    });

    pSocket.on('join-error', (err) => {
      console.error(`❌ ${name} Join Error:`, err);
    });

    clients.push(pSocket);
  }
}

function shutdown() {
  clients.forEach(c => c.disconnect());
  if (adminSocket) adminSocket.disconnect();
  console.log('👋 Goodbye!');
  process.exit(0);
}
