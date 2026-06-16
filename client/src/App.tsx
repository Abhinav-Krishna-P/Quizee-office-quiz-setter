import React, { useState, useEffect } from 'react';
import { Home } from './components/Home';
import { Creator } from './components/Creator';
import { Lobby } from './components/Lobby';
import { AdminConsole } from './components/AdminConsole';
import { PlayerConsole } from './components/PlayerConsole';
import { socket } from './socket';

interface LobbyPlayer {
  id: string;
  name: string;
  score: number;
}

interface Question {
  text: string;
  options: string[];
  timeLimit: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  correctAnswerIndex?: number;
  theme: 'pitch' | 'gold' | 'neon' | 'sunset';
}

interface LeaderboardEntry {
  name: string;
  score: number;
  streak: number;
  rank: number;
}

interface Winner {
  name: string;
  score: number;
  rank: number;
}

interface Feedback {
  isCorrect: boolean;
  pointsEarned: number;
  score: number;
  streak: number;
  rank: number;
  timeTaken: number;
  correctOptionText: string;
  correctOptionIndex: number;
}

type ViewState = 'home' | 'creator' | 'lobby' | 'admin-console' | 'player-console';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('home');
  const [pin, setPin] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [quizTitle, setQuizTitle] = useState('');
  const [theme, setTheme] = useState<'pitch' | 'gold' | 'neon' | 'sunset'>('pitch');
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Real-time Lists & Stats
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [countdown, setCountdown] = useState(20);
  const [answersCount, setAnswersCount] = useState({ answersReceived: 0, totalPlayers: 0 });
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState<number | null>(null);
  const [answersDistribution, setAnswersDistribution] = useState<{ [key: number]: number }>({ 0: 0, 1: 0, 2: 0, 3: 0 });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  
  // Player-specific state
  const [playerLockedIndex, setPlayerLockedIndex] = useState<number | null>(null);
  const [playerFeedback, setPlayerFeedback] = useState<Feedback | null>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [playerRank, setPlayerRank] = useState(0);
  const [playerStreak, setPlayerStreak] = useState(0);

  // Parse PIN from query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pinParam = params.get('pin');
    if (pinParam && pinParam.length === 6 && !isNaN(Number(pinParam))) {
      setPin(pinParam);
    }
  }, []);

  useEffect(() => {
    // 1. Host Session Created
    socket.on('room-created', (data: { pin: string; quiz: { title: string; theme: any } }) => {
      setPin(data.pin);
      setQuizTitle(data.quiz.title);
      setTheme(data.quiz.theme || 'pitch');
      setIsAdmin(true);
      setPlayers([]);
      setView('lobby');
    });

    // 2. Active Players update
    socket.on('player-list-update', (list: LobbyPlayer[]) => {
      setPlayers(list);
    });

    // 3. Player Joined Successfully
    socket.on('join-success', (data: { pin: string; name: string }) => {
      setPin(data.pin);
      setPlayerName(data.name);
      setIsAdmin(false);
      setPlayers([]);
      setView('lobby');
    });

    // 4. Question Started (Received by Players)
    socket.on('question-start', (data: Question) => {
      setActiveQuestion(data);
      setCountdown(data.timeLimit);
      setPlayerLockedIndex(null);
      setPlayerFeedback(null);
      setCorrectAnswerIndex(null);
      setView('player-console');
    });

    // 5. Question Started (Received by Admin)
    socket.on('admin-question-start', (data: Question) => {
      setActiveQuestion(data);
      setCountdown(data.timeLimit);
      setCorrectAnswerIndex(null);
      setAnswersCount({ answersReceived: 0, totalPlayers: players.length });
      setView('admin-console');
    });

    // 6. Countdown Timer tick
    socket.on('timer-tick', (data: { countdown: number }) => {
      setCountdown(data.countdown);
    });

    // 7. Answer Submissions update
    socket.on('answer-count-update', (data: { answersReceived: number; totalPlayers: number }) => {
      setAnswersCount(data);
    });

    // 8. Player Locks Answer
    socket.on('answer-locked', ({ answerIndex }) => {
      setPlayerLockedIndex(answerIndex);
    });

    // 9. Correct Choice reveal (Individual player feedback)
    socket.on('question-feedback', (data: Feedback) => {
      setPlayerFeedback(data);
      setPlayerScore(data.score);
      setPlayerStreak(data.streak);
      setPlayerRank(data.rank);
    });

    // 10. Correct Choice reveal (Admin projector chart stats)
    socket.on('admin-question-reveal', (data: {
      correctAnswerIndex: number;
      answersDistribution: { [key: number]: number };
      totalPlayers: number;
      answersReceived: number;
    }) => {
      setCorrectAnswerIndex(data.correctAnswerIndex);
      setAnswersDistribution(data.answersDistribution);
      setAnswersCount({ answersReceived: data.answersReceived, totalPlayers: data.totalPlayers });
    });

    // 11. Leaderboard panel trigger
    socket.on('show-leaderboard', (data: { leaderboard: LeaderboardEntry[] }) => {
      setLeaderboard(data.leaderboard);
      // Update individual standings
      const me = data.leaderboard.find(p => p.name.toLowerCase() === playerName.toLowerCase());
      if (me) {
        setPlayerRank(me.rank);
        setPlayerScore(me.score);
        setPlayerStreak(me.streak);
      }
    });

    // 12. Final Champions podium
    socket.on('show-podium', (data: { winners: Winner[] }) => {
      setWinners(data.winners);
    });

    // 13. Session Closed by Host
    socket.on('room-closed', (msg: string) => {
      alert(msg);
      handleExit();
    });

    return () => {
      socket.off('room-created');
      socket.off('player-list-update');
      socket.off('join-success');
      socket.off('question-start');
      socket.off('admin-question-start');
      socket.off('timer-tick');
      socket.off('answer-count-update');
      socket.off('answer-locked');
      socket.off('question-feedback');
      socket.off('admin-question-reveal');
      socket.off('show-leaderboard');
      socket.off('show-podium');
      socket.off('room-closed');
    };
  }, [players.length, playerName]);

  const handlePlayerJoinSuccess = (_joinedPin: string, _name: string) => {
    // Handled by join-success socket event
  };

  const handleExit = () => {
    setView('home');
    setPin('');
    setPlayerName('');
    setQuizTitle('');
    setIsAdmin(false);
    setPlayers([]);
    setActiveQuestion(null);
    setLeaderboard([]);
    setWinners([]);
    setPlayerLockedIndex(null);
    setPlayerFeedback(null);
    setPlayerScore(0);
    setPlayerRank(0);
    setPlayerStreak(0);
    socket.disconnect();
  };

  return (
    <>
      {view === 'home' && (
        <Home
          onJoinSuccess={handlePlayerJoinSuccess}
          onAdminSelect={() => setView('creator')}
        />
      )}

      {view === 'creator' && (
        <Creator
          onBackToHome={() => setView('home')}
          onLaunchQuiz={() => {
            // Handled by room-created socket listener
          }}
        />
      )}

      {view === 'lobby' && (
        <Lobby
          pin={pin}
          quizTitle={quizTitle || 'FIFA World Cup Quiz'}
          theme={theme}
          isAdmin={isAdmin}
          onGameStart={() => {
            // Handled by admin-question-start event
          }}
          players={players}
        />
      )}

      {view === 'admin-console' && (
        <AdminConsole
          pin={pin}
          theme={theme}
          activeQuestion={activeQuestion}
          countdown={countdown}
          answersCount={answersCount}
          correctAnswerIndex={correctAnswerIndex}
          answersDistribution={answersDistribution}
          leaderboard={leaderboard}
          winners={winners}
          onGameOver={handleExit}
        />
      )}

      {view === 'player-console' && (
        <PlayerConsole
          pin={pin}
          playerName={playerName}
          activeQuestion={activeQuestion}
          playerLockedIndex={playerLockedIndex}
          playerFeedback={playerFeedback}
          playerScore={playerScore}
          playerRank={playerRank}
          playerStreak={playerStreak}
          winners={winners}
          leaderboard={leaderboard}
        />
      )}
    </>
  );
};

export default App;
