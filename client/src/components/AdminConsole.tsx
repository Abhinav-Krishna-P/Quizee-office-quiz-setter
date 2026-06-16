import React, { useEffect, useRef } from 'react';
import { Trophy, ArrowRight, CheckCircle, Users, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';
import { socket } from '../socket';

interface Question {
  text: string;
  options: string[];
  timeLimit: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  correctAnswerIndex?: number;
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

interface AdminConsoleProps {
  pin: string;
  theme: 'pitch' | 'gold' | 'neon' | 'sunset';
  activeQuestion: Question | null;
  countdown: number;
  answersCount: { answersReceived: number; totalPlayers: number };
  correctAnswerIndex: number | null;
  answersDistribution: { [key: number]: number };
  leaderboard: LeaderboardEntry[];
  winners: Winner[];
  onGameOver: () => void;
}

// Web Audio API Synthesizer for clean retro game sounds
class QuizSoundSynth {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  playStartSound() {
    this.init();
    if (!this.ctx) return;
    
    // Play a nice clean rising synthesizer chime chord
    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 major chord
    
    notes.forEach((freq, index) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * 0.08);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + index * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.6);
      
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      
      osc.start(now + index * 0.08);
      osc.stop(now + index * 0.08 + 0.6);
    });
  }

  playRevealSound() {
    this.init();
    if (!this.ctx) return;

    // Clean positive double-tone alert
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.12); // E5

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(now + 0.4);
  }

  playCelebrationSound() {
    this.init();
    if (!this.ctx) return;

    // Rising celebratory arpeggio
    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C major extended arpeggio
    
    notes.forEach((freq, index) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * 0.12);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + index * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.12 + 0.8);
      
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      
      osc.start(now + index * 0.12);
      osc.stop(now + index * 0.12 + 0.8);
    });
  }
}

const synth = new QuizSoundSynth();

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  pin,
  theme,
  activeQuestion,
  countdown,
  answersCount,
  correctAnswerIndex,
  answersDistribution,
  leaderboard,
  winners,
  onGameOver
}) => {
  // Determine state locally from props
  let gameState: 'QUESTION' | 'REVEAL' | 'LEADERBOARD' | 'PODIUM' = 'QUESTION';
  if (winners.length > 0) {
    gameState = 'PODIUM';
  } else if (leaderboard.length > 0 && correctAnswerIndex !== null) {
    gameState = 'LEADERBOARD';
  } else if (correctAnswerIndex !== null) {
    gameState = 'REVEAL';
  }

  const prevGameState = useRef<'QUESTION' | 'REVEAL' | 'LEADERBOARD' | 'PODIUM' | ''>('');

  // Audio & celebration effects triggered by game state changes
  useEffect(() => {
    if (gameState === prevGameState.current) return;

    if (gameState === 'QUESTION') {
      synth.playStartSound();
    } else if (gameState === 'REVEAL') {
      synth.playRevealSound();
    } else if (gameState === 'PODIUM' && winners.length > 0) {
      synth.playCelebrationSound();
      
      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
    }

    prevGameState.current = gameState;
  }, [gameState, winners]);

  const handleNext = () => {
    socket.emit('admin-next-event', { pin });
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

  if (!activeQuestion) {
    return (
      <div className="theme-container theme-charcoal min-h-screen flex items-center justify-center p-6 text-center text-white">
        <div className="glass-panel p-12 max-w-md">
          <h2 className="text-2xl text-gold uppercase tracking-wider mb-4 animate-pulse">Initializing Board...</h2>
          <p className="text-gray-400">Loading questions and syncing player states.</p>
        </div>
      </div>
    );
  }

  const strokeDashoffset = activeQuestion ? 251.2 - (countdown / activeQuestion.timeLimit) * 251.2 : 0;

  return (
    <div className={`theme-container theme-${theme} min-h-screen text-gray-100 flex flex-col p-6`}>
      {/* Top Console Stats Bar */}
      <div className="w-full flex justify-between items-center bg-slate-900/70 border border-white/10 p-4 rounded-xl mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded-full uppercase border border-yellow-500/20">
            PIN: {pin}
          </span>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest hidden md:inline">
            Question {activeQuestion.currentQuestionIndex + 1} of {activeQuestion.totalQuestions}
          </span>
        </div>

        {gameState !== 'QUESTION' && gameState !== 'PODIUM' && (
          <button
            onClick={handleNext}
            className="btn-primary py-2 px-5 text-sm flex items-center gap-1.5"
          >
            NEXT EVENT <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {gameState === 'PODIUM' && (
          <button
            onClick={onGameOver}
            className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-5 rounded-lg text-sm transition-colors"
          >
            END GAME
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-5xl w-full mx-auto">
        
        {/* --- 1. ACTIVE QUESTION RUNNING STATE --- */}
        {gameState === 'QUESTION' && (
          <div className="w-full space-y-8 text-center">
            {/* Header Question Text */}
            <div className="glass-panel p-8">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-wide uppercase text-white">
                {activeQuestion.text}
              </h2>
            </div>

            {/* Countdown & Answers Counter grid */}
            <div className="flex justify-center items-center gap-12">
              <div className="timer-circle-container glass-panel p-2 rounded-full">
                <div className="timer-circle-svg">
                  <svg className="timer-circle-svg" viewBox="0 0 90 90">
                    <circle className="timer-circle-bg" cx="45" cy="45" r="40" />
                    <circle 
                      className="timer-circle-bar" 
                      cx="45" 
                      cy="45" 
                      r="40" 
                      style={{ strokeDashoffset }}
                    />
                  </svg>
                </div>
                <div className="timer-circle-text text-white">{countdown}</div>
              </div>

              <div className="glass-panel px-8 py-4 flex flex-col items-center">
                <span className="text-4xl font-black text-yellow-500">
                  {answersCount.answersReceived}
                </span>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Answers Locked
                </span>
                <span className="text-xs text-gray-500">
                  out of {answersCount.totalPlayers} players
                </span>
              </div>
            </div>

            {/* 4 Options Grid (Disabled layout for projecting) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              {activeQuestion.options.map((opt, idx) => (
                <div
                  key={idx}
                  className={`option-btn ${getOptionColorClass(idx)} cursor-default py-6 px-8 flex items-center gap-4`}
                >
                  <span className="shape-icon text-xl">{getOptionShapeText(idx)}</span>
                  <span className="text-xl font-bold truncate">{opt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- 2. ANSWER REVEAL STATE --- */}
        {gameState === 'REVEAL' && (
          <div className="w-full space-y-8">
            <div className="glass-panel p-6 text-center">
              <h2 className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-1">
                RESPONSE STATISTICS
              </h2>
              <h2 className="text-xl md:text-2xl font-bold text-white uppercase">
                {activeQuestion.text}
              </h2>
            </div>

            {/* Chart + Correct option reveal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* Left: Answer distribution bar chart */}
              <div className="glass-panel p-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-1">
                  <Users className="w-4 h-4 text-yellow-500" /> Answer Distributions
                </h3>
                <div className="chart-bar-container">
                  {Object.keys(answersDistribution).map((key) => {
                    const idx = Number(key);
                    const count = answersDistribution[idx];
                    const percent = answersCount.answersReceived > 0 
                      ? (count / answersCount.answersReceived) * 100 
                      : 0;
                    return (
                      <div key={idx} className="chart-bar-col">
                        <span className="text-xs font-bold mb-2">{count}</span>
                        <div
                          className={`chart-bar-fill ${getOptionColorClass(idx)}`}
                          style={{ height: `${percent * 1.5 + 5}px` }}
                        ></div>
                        <span className="shape-icon text-sm mt-3 w-8 h-8 rounded-full">{getOptionShapeText(idx)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Correct Answer text block */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Correct Option</h3>
                {activeQuestion.options.map((opt, idx) => {
                  const isCorrect = idx === correctAnswerIndex;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-5 rounded-xl border transition-all ${isCorrect ? 'border-emerald-500 bg-emerald-950/20 text-white font-bold' : 'border-white/5 bg-white/5 opacity-40 text-gray-400'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-gray-400'}`}>
                          {getOptionShapeText(idx)}
                        </span>
                        <span className="text-lg">{opt}</span>
                      </div>
                      {isCorrect && <CheckCircle className="w-6 h-6 text-emerald-500" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* --- 3. INTERMEDIATE LEADERBOARD STATE --- */}
        {gameState === 'LEADERBOARD' && (
          <div className="w-full max-w-2xl space-y-6">
            <div className="text-center">
              <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-2 winner-bounce" />
              <h2 className="text-title text-gold text-3xl font-black winning-text-glow">
                LEADERBOARD STANDINGS
              </h2>
              <p className="text-gray-400 text-sm uppercase tracking-widest mt-1">
                Current Rankings
              </p>
            </div>

            <div className="glass-panel p-6 space-y-3">
              {leaderboard.slice(0, 5).map((player, idx) => (
                <div
                  key={player.name}
                  className="flex items-center justify-between p-4 bg-slate-950/25 border border-white/5 rounded-xl hover:border-yellow-500/30 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-full font-black text-sm ${idx === 0 ? 'bg-yellow-500 text-slate-900' : idx === 1 ? 'bg-slate-300 text-slate-900' : 'bg-slate-800 text-gray-400'}`}>
                      {idx + 1}
                    </span>
                    <span className="text-lg font-bold uppercase">{player.name}</span>
                  </div>

                  <div className="flex items-center gap-6">
                    {player.streak >= 2 && (
                      <span className="text-xs font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 py-1 px-2.5 rounded-full flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 fill-current" /> {player.streak} Streak
                      </span>
                    )}
                    <span className="text-xl font-bold text-yellow-500">{player.score} PTS</span>
                  </div>
                </div>
              ))}

              {leaderboard.length === 0 && (
                <p className="text-center text-gray-500 py-8">No responses received yet.</p>
              )}
            </div>
          </div>
        )}

        {/* --- 4. PODIUM STATE (FINAL CHAMPIONS) --- */}
        {gameState === 'PODIUM' && (
          <div className="w-full max-w-2xl space-y-8 text-center">
            <div>
              <div className="bg-yellow-500/20 p-4 rounded-full border border-yellow-500/40 winner-bounce inline-block mb-3">
                <Trophy className="w-16 h-16 text-yellow-500 winning-text-glow" />
              </div>
              <h1 className="text-gold text-5xl font-black uppercase tracking-widest winning-text-glow">
                THE WINNERS
              </h1>
              <p className="text-gray-400 text-sm tracking-widest uppercase mt-2">
                Quizee Ceremony
              </p>
            </div>

            {/* Podium columns */}
            <div className="podium-container">
              {/* 1st Place */}
              {winners.find((w) => w.rank === 1) && (
                <div className="podium-step first">
                  <div className="winner-bounce text-center mb-2">
                    <p className="text-yellow-500 font-black text-3xl">🥇 1st</p>
                    <p className="font-extrabold text-2xl uppercase mt-1">
                      {winners.find((w) => w.rank === 1)?.name}
                    </p>
                    <p className="text-xs text-yellow-500 font-semibold mt-1">
                      {winners.find((w) => w.rank === 1)?.score} PTS
                    </p>
                  </div>
                  <div className="podium-block">
                    <span className="podium-number">1</span>
                  </div>
                </div>
              )}

              {/* 2nd Place */}
              {winners.find((w) => w.rank === 2) && (
                <div className="podium-step second">
                  <div className="text-center mb-2">
                    <p className="text-slate-300 font-black text-2xl">🥈 2nd</p>
                    <p className="font-bold text-xl uppercase mt-1">
                      {winners.find((w) => w.rank === 2)?.name}
                    </p>
                    <p className="text-xs text-slate-300 font-semibold mt-1">
                      {winners.find((w) => w.rank === 2)?.score} PTS
                    </p>
                  </div>
                  <div className="podium-block">
                    <span className="podium-number">2</span>
                  </div>
                </div>
              )}
            </div>

            {winners.length === 0 && (
              <p className="text-gray-500">No winners declared.</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
