import React from 'react';
import { ShieldCheck, XCircle, Flame, Trophy, Award, Lock, Hourglass } from 'lucide-react';
import { socket } from '../socket';

interface QuestionData {
  text: string;
  options: string[];
  timeLimit: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  theme: 'pitch' | 'gold' | 'neon' | 'sunset';
}

interface FeedbackData {
  isCorrect: boolean;
  pointsEarned: number;
  score: number;
  streak: number;
  rank: number;
  timeTaken: number;
  correctOptionText: string;
  correctOptionIndex: number;
}

interface LeaderboardData {
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

interface PlayerConsoleProps {
  pin: string;
  playerName: string;
  activeQuestion: QuestionData | null;
  playerLockedIndex: number | null;
  playerFeedback: FeedbackData | null;
  playerScore: number;
  playerRank: number;
  playerStreak: number;
  winners: Winner[];
  leaderboard: LeaderboardData[];
}

export const PlayerConsole: React.FC<PlayerConsoleProps> = ({
  pin,
  playerName,
  activeQuestion,
  playerLockedIndex,
  playerFeedback,
  playerScore,
  playerRank,
  playerStreak,
  winners,
  leaderboard
}) => {
  let gameState: 'LOBBY' | 'QUESTION' | 'LOCKED' | 'REVEAL' | 'LEADERBOARD' | 'PODIUM' = 'LOBBY';
  if (winners.length > 0) {
    gameState = 'PODIUM';
  } else if (leaderboard.length > 0 && playerFeedback !== null) {
    gameState = 'LEADERBOARD';
  } else if (playerFeedback !== null) {
    gameState = 'REVEAL';
  } else if (playerLockedIndex !== null) {
    gameState = 'LOCKED';
  } else if (activeQuestion !== null) {
    gameState = 'QUESTION';
  }

  const handleSubmit = (idx: number) => {
    if (gameState !== 'QUESTION') return;
    socket.emit('player-submit-answer', { pin, answerIndex: idx });
  };

  const getOptionColorClass = (idx: number) => {
    switch (idx) {
      case 0: return 'red';
      case 1: return 'blue';
      case 2: return 'yellow';
      case 3: return 'green';
      default: return '';
    }
  };

  const getOptionShapeText = (idx: number) => {
    switch (idx) {
      case 0: return '▲';
      case 1: return '◆';
      case 2: return '●';
      case 3: return '■';
      default: return '';
    }
  };

  return (
    <div className={`theme-container theme-${activeQuestion?.theme || 'charcoal'} min-h-screen text-gray-100 flex flex-col p-4`}>
      {/* HUD Info Header */}
      <div className="w-full bg-slate-900/60 border border-white/10 p-3 rounded-xl flex justify-between items-center mb-6">
        <div>
          <span className="text-xs text-yellow-500 font-bold block uppercase">PLAYER</span>
          <span className="text-base font-extrabold text-white uppercase">{playerName}</span>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-400 block uppercase font-mono">PTS: {playerScore}</span>
          <span className="text-xs text-gray-400 block uppercase font-mono">RANK: #{playerRank || '-'}</span>
        </div>
      </div>

      {/* Main interactive state machine */}
      <div className="flex-1 flex flex-col justify-center items-center w-full max-w-sm mx-auto">
        
        {/* 1. LOBBY WAITING STATE */}
        {gameState === 'LOBBY' && (
          <div className="text-center space-y-6 w-full glass-panel p-8">
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-full inline-block animate-pulse">
              <Trophy className="w-12 h-12 text-yellow-500" />
            </div>
            <h2 className="text-xl font-bold uppercase text-white">Connected!</h2>
            <p className="text-gray-400 text-sm">
              You are in the room lobby. Wait for the host to start the game!
            </p>
            <div className="border-t border-white/10 pt-4 flex justify-center items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
              <Hourglass className="w-4 h-4 animate-spin text-yellow-500" /> Waiting for Host
            </div>
          </div>
        )}

        {/* 2. QUESTION ACTIVE SELECTION STATE */}
        {gameState === 'QUESTION' && activeQuestion && (
          <div className="w-full flex flex-col gap-4">
            <div className="glass-panel p-4 text-center mb-2">
              <span className="text-xs text-yellow-500 font-bold uppercase">
                Question {activeQuestion.currentQuestionIndex + 1} of {activeQuestion.totalQuestions}
              </span>
              <h3 className="text-lg font-bold text-white uppercase line-clamp-3 mt-1">
                {activeQuestion.text}
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-3 w-full">
              {activeQuestion.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSubmit(idx)}
                  className={`option-btn ${getOptionColorClass(idx)} py-5 px-4 flex items-center justify-start gap-4 active:scale-[0.98] w-full text-left`}
                >
                  <span className="shape-icon text-lg">{getOptionShapeText(idx)}</span>
                  <span className="text-lg font-bold truncate">{opt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. ANSWER LOCKED STATE */}
        {gameState === 'LOCKED' && (
          <div className="text-center space-y-4 w-full glass-panel p-8">
            <Lock className="w-16 h-16 text-yellow-500 mx-auto animate-bounce" />
            <h3 className="text-xl font-bold text-white uppercase">Answer Locked!</h3>
            <p className="text-gray-400 text-sm">
              Your choice has been submitted. Waiting for other players to lock in...
            </p>
          </div>
        )}

        {/* 4. RESPONSE FEEDBACK STATE */}
        {gameState === 'REVEAL' && playerFeedback && (
          <div className={`w-full glass-panel p-8 text-center border-2 ${playerFeedback.isCorrect ? 'border-emerald-500 bg-emerald-950/20' : 'border-red-500 bg-red-950/20'}`}>
            <div className="mb-4">
              {playerFeedback.isCorrect ? (
                <ShieldCheck className="w-16 h-16 text-emerald-500 mx-auto winner-bounce" />
              ) : (
                <XCircle className="w-16 h-16 text-red-500 mx-auto" />
              )}
            </div>

            <h2 className="text-2xl font-black uppercase tracking-wider mb-2">
              {playerFeedback.isCorrect ? 'Correct!' : 'Incorrect'}
            </h2>

            <p className="text-sm text-gray-400 mb-6">
              {playerFeedback.isCorrect 
                ? `Fast! You answered in ${(playerFeedback.timeTaken / 1000).toFixed(2)}s.`
                : `Correct answer was: "${playerFeedback.correctOptionText}"`
              }
            </p>

            <div className="flex justify-around items-center border-t border-white/10 pt-6">
              <div>
                <span className="text-xs text-gray-400 block uppercase">Points</span>
                <span className="text-xl font-extrabold text-white">+{playerFeedback.pointsEarned}</span>
              </div>

              {playerStreak >= 2 && (
                <div className="text-orange-400">
                  <Flame className="w-6 h-6 fill-current mx-auto animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider block">{playerStreak} Streak</span>
                </div>
              )}

              <div>
                <span className="text-xs text-gray-400 block uppercase">Rank</span>
                <span className="text-xl font-extrabold text-white">#{playerRank}</span>
              </div>
            </div>
          </div>
        )}

        {/* 5. INTERMEDIATE LEADERBOARD STATE */}
        {gameState === 'LEADERBOARD' && (
          <div className="text-center space-y-6 w-full glass-panel p-8">
            <Award className="w-16 h-16 text-yellow-500 mx-auto winner-bounce" />
            <h2 className="text-2xl font-bold uppercase text-gold text-center">
              Lobby Standing
            </h2>
            <div className="flex justify-center gap-8 py-3 border-y border-white/10 my-2">
              <div>
                <p className="text-xs text-gray-400 uppercase">RANK</p>
                <p className="text-2xl font-extrabold text-white">#{playerRank || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase">SCORE</p>
                <p className="text-2xl font-extrabold text-yellow-500">{playerScore} PTS</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Get ready! The next question will start shortly.
            </p>
          </div>
        )}

        {/* 6. PODIUM FINAL RESULTS STATE */}
        {gameState === 'PODIUM' && (
          <div className="text-center space-y-6 w-full glass-panel p-8 border-2 border-yellow-500/40">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto winning-text-glow winner-bounce" />
            <h2 className="text-2xl font-bold uppercase text-gold">Final standings</h2>
            
            <div className="space-y-3">
              {winners.map((w) => (
                <div key={w.name} className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                  <span className="font-bold uppercase text-sm">{w.rank}. {w.name}</span>
                  <span className="text-sm font-semibold text-yellow-500">{w.score} PTS</span>
                </div>
              ))}
            </div>

            <p className="text-sm font-semibold text-gray-400 pt-4 border-t border-white/10">
              {winners.slice(0, 2).some(w => w.name.toLowerCase() === playerName.toLowerCase())
                ? "🏆 Congratulations! You finished on the podium!"
                : "Thank you for playing!"
              }
            </p>
          </div>
        )}

      </div>
    </div>
  );
};
