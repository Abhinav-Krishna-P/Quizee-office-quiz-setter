import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../../socket/index.js';
import { SpotlightCard, ShinyText, CountUp } from '../../components/animations.jsx';
import { API_BASE_URL } from '../../config.js';
import { ArrowRight, Trophy, Sparkles, Volume2, VolumeX, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function HostLiveControl() {
  const { code } = useParams();
  const upperCode = code.toUpperCase();
  const navigate = useNavigate();
  const token = localStorage.getItem('adminToken');

  // Game States
  // state: 'question' | 'reveal' | 'leaderboard' | 'ended'
  const [gameState, setGameState] = useState('question');
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [question, setQuestion] = useState(null);
  
  // Scoring / Submission trackers
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [answerCounts, setAnswerCounts] = useState({ 0: 0, 1: 0, 2: 0, 3: 0 });
  const [correctIndex, setCorrectIndex] = useState(-1);

  // Leaderboard / Podium state
  const [leaderboard, setLeaderboard] = useState([]);
  const [teamsLeaderboard, setTeamsLeaderboard] = useState([]);
  const [podium, setPodium] = useState([]);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeLimit, setTimeLimit] = useState(20);
  const timerRef = useRef(null);

  // Sound Config
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Connect Socket
  useEffect(() => {
    socket.connect();
    socket.emit('join-session', { partyCode: upperCode, isHost: true });

    // 1. Reconnect Sync
    socket.on('reconnect-state', (data) => {
      setGameState(data.state);
      setCurrentQIndex(data.questionIndex || 0);
      setTotalQuestions(data.totalQuestions || 0);
      if (data.state === 'question') {
        setQuestion({ text: data.text, options: data.options });
        setTimeLimit(data.timeLimit);
        syncTimer(data.questionStartedAt, data.timeLimit);
      } else if (data.state === 'reveal') {
        setQuestion({ options: data.options });
        setCorrectIndex(data.correctIndex);
      }
    });

    // 2. Question Started
    socket.on('question-start', (data) => {
      setGameState('question');
      setCurrentQIndex(data.questionIndex);
      setTotalQuestions(data.totalQuestions);
      setQuestion({ text: data.text, options: data.options });
      setTimeLimit(data.timeLimit);
      setAnsweredCount(0);
      setCorrectIndex(-1);
      setAnswerCounts({ 0: 0, 1: 0, 2: 0, 3: 0 });

      syncTimer(data.questionStartedAt, data.timeLimit);
      playTickSound(300); // startup note
    });

    // 3. Live Submissions Count Update
    socket.on('answer-count-update', (data) => {
      setAnsweredCount(data.answeredCount);
      setTotalParticipants(data.totalConnected);
      if (data.answerCounts) {
        setAnswerCounts(data.answerCounts);
      }
    });

    // 4. Reveal Answers
    socket.on('question-reveal', (data) => {
      setGameState('reveal');
      setCorrectIndex(data.correctIndex);
      if (timerRef.current) clearInterval(timerRef.current);
      playChime(true);
    });

    // 5. Leaderboard Update
    socket.on('leaderboard-update', (data) => {
      setGameState('leaderboard');
      setLeaderboard(data.leaderboard || []);
      setTeamsLeaderboard(data.teamsLeaderboard || []);
    });

    // 6. Game Ended
    socket.on('quiz-ended', (data) => {
      setGameState('ended');
      setPodium(data.podium || []);
      triggerConfettiShow();
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      socket.off('reconnect-state');
      socket.off('question-start');
      socket.off('answer-count-update');
      socket.off('question-reveal');
      socket.off('leaderboard-update');
      socket.off('quiz-ended');
      socket.disconnect();
    };
  }, [upperCode, soundEnabled]);

  // Sycned Timer calculator
  const syncTimer = (startedAtMs, limitSec) => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    const updateTimer = () => {
      const elapsedMs = Date.now() - startedAtMs;
      const remainingSec = Math.max(0, Math.ceil((limitSec * 1000 - elapsedMs) / 1000));
      setTimeLeft(remainingSec);

      if (remainingSec <= 0) {
        clearInterval(timerRef.current);
        // Force reveal if server hasn't already sent it
      } else if (remainingSec <= 5 && soundEnabled) {
        // Play final 5 seconds count-down tick
        playTickSound(400);
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 200);
  };

  // Sound generator
  const playTickSound = (frequency) => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  };

  const playChime = (isSuccess) => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;
      // Arpeggio chime
      const notes = isSuccess ? [523.25, 659.25, 783.99, 1046.50] : [220.00, 207.65, 196.00]; // major chord / sad minor
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + i * 0.08);
        gain.gain.setValueAtTime(0.05, now + i * 0.08);
        osc.start(now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.4);
        osc.stop(now + i * 0.08 + 0.45);
      });
    } catch (e) {}
  };

  const triggerConfettiShow = () => {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    const randomInRange = (min, max) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      // since particles fall down, start a bit higher than random
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  // Next round trigger
  const handleAdvance = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${upperCode}/next`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Failed to advance game state');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Kahoot details
  const colors = ['bg-rose-600', 'bg-blue-600', 'bg-yellow-500', 'bg-emerald-600'];
  const shapes = ['▲', '◆', '●', '■'];

  return (
    <div className="flex-1 p-6 md:p-12 max-w-6xl mx-auto w-full flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex justify-between items-center pb-6 border-b border-white/5 shrink-0">
        <div>
          <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">Live Presenter Screen</span>
          <h2 className="text-xl font-display font-bold">Party Code: <span className="text-white select-all font-mono uppercase">{upperCode}</span></h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          
          <button
            onClick={handleAdvance}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-2.5 px-6 rounded-lg shadow-lg active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer text-sm"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col justify-center my-8">
        
        {/* State 1: Active Question Round */}
        {gameState === 'question' && question && (
          <div className="space-y-8 max-w-4xl mx-auto w-full">
            {/* Question Text */}
            <h1 className="text-3xl md:text-5xl font-display font-black text-center leading-snug">
              {question.text}
            </h1>

            {/* Middle Circle: Countdown and Answer Counters */}
            <div className="flex items-center justify-center gap-12 md:gap-24 my-10">
              {/* Synced Timer */}
              <div className="relative w-36 h-36 rounded-full border-8 border-white/10 flex flex-col items-center justify-center shadow-2xl bg-black/20">
                <span className={`text-4xl md:text-5xl font-display font-black ${timeLeft <= 5 ? 'text-rose-500 animate-pulse' : 'text-violet-400'}`}>
                  {timeLeft}
                </span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Seconds</span>
              </div>

              {/* Counter */}
              <div className="text-center">
                <h3 className="text-5xl md:text-6xl font-display font-black text-white">
                  {answeredCount}
                </h3>
                <p className="text-xs text-slate-400 uppercase tracking-widest mt-2">Answers</p>
                <p className="text-[10px] text-slate-500 mt-1">out of {totalParticipants} players</p>
              </div>
            </div>

            {/* Answer Options Cards */}
            <div className="grid md:grid-cols-2 gap-4">
              {question.options.map((opt, idx) => (
                <div
                  key={idx}
                  className={`p-5 rounded-2xl flex items-center gap-4 text-lg font-bold text-white shadow-lg ${colors[idx]} border border-white/10`}
                >
                  <span className="text-2xl bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center font-display">
                    {shapes[idx]}
                  </span>
                  <span>{opt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* State 2: Answer Reveal Block */}
        {gameState === 'reveal' && question && (
          <div className="space-y-8 max-w-4xl mx-auto w-full">
            <h1 className="text-2xl md:text-4xl font-display font-bold text-center text-slate-400">
              Answers Distribution
            </h1>

            {/* Histogram Bars */}
            <div className="space-y-4 max-w-2xl mx-auto">
              {question.options.map((opt, idx) => {
                const isCorrect = idx === correctIndex;
                const count = answerCounts[idx] || 0;
                
                // Calculate percentage
                const total = Object.values(answerCounts).reduce((a, b) => a + b, 0) || 1;
                const pct = Math.round((count / total) * 100);

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl flex items-center justify-between gap-4 border transition-all duration-500 ${
                      isCorrect 
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/5' 
                        : 'border-white/5 bg-white/5 opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className={`text-xl w-8 h-8 rounded-lg flex items-center justify-center text-white ${colors[idx]}`}>
                        {shapes[idx]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-sm md:text-base truncate block">{opt}</span>
                        {/* Progress Bar background */}
                        <div className="w-full h-2 bg-black/40 rounded-full mt-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${isCorrect ? 'bg-emerald-500' : 'bg-slate-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-lg font-black font-mono">{pct}%</span>
                      <span className="text-[10px] text-slate-500 block">{count} players</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center font-display text-lg font-bold text-emerald-400 mt-6">
              Correct Answer Revealed!
            </div>
          </div>
        )}

        {/* State 3: Round Leaderboard */}
        {gameState === 'leaderboard' && (
          <div className="max-w-xl mx-auto w-full">
            <h1 className="text-3xl font-display font-black text-center mb-8 flex items-center justify-center gap-2">
              <Trophy className="text-yellow-400 w-8 h-8" /> Leaderboard
            </h1>

            {leaderboard.length === 0 ? (
              <p className="text-center text-slate-400">Waiting for first points...</p>
            ) : (
              <div className="space-y-3">
                {leaderboard.map((player, idx) => (
                  <div
                    key={player.id}
                    className="glass-panel border border-white/5 rounded-xl p-4 flex items-center justify-between gap-4 animate-fade-in"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                        idx === 0 ? 'bg-yellow-400 text-black' : idx === 1 ? 'bg-slate-300 text-black' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-white/10 text-slate-300'
                      }`}>
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-bold text-sm md:text-base">{player.nickname}</p>
                        {player.team_name && (
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                            {player.team_name}
                          </p>
                        )}
                      </div>
                    </div>

                    <span className="font-mono font-black text-violet-400 text-lg">
                      <CountUp to={player.total_score} /> pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* State 4: End of Quiz Podium */}
        {gameState === 'ended' && podium.length > 0 && (
          <div className="max-w-3xl mx-auto w-full flex flex-col items-center">
            <h1 className="text-4xl md:text-5xl font-display font-black text-center mb-16 flex items-center gap-3 text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-300">
              <Sparkles className="text-violet-400 w-10 h-10 fill-current" /> Podium Standings <Sparkles className="text-fuchsia-400 w-10 h-10 fill-current" />
            </h1>

            {/* Rising Columns */}
            <div className="flex items-end justify-center gap-4 md:gap-8 h-64 w-full max-w-lg mt-8">
              {/* 2nd Place */}
              {podium[1] && (
                <div className="flex flex-col items-center w-28 md:w-36">
                  <div className="text-center mb-2">
                    <p className="font-black font-display text-sm truncate w-24 md:w-32">{podium[1].nickname}</p>
                    <p className="text-xs text-violet-300 font-bold">{podium[1].total_score} pts</p>
                  </div>
                  <div className="w-full bg-slate-300/20 border-t-4 border-slate-300 rounded-t-lg h-36 flex flex-col items-center justify-center shadow-lg">
                    <span className="text-4xl font-display font-black text-slate-300">2</span>
                  </div>
                </div>
              )}

              {/* 1st Place */}
              {podium[0] && (
                <div className="flex flex-col items-center w-28 md:w-36">
                  <div className="text-center mb-2">
                    <p className="font-black font-display text-base truncate w-24 md:w-32 text-yellow-400">{podium[0].nickname}</p>
                    <p className="text-xs text-yellow-500 font-bold">{podium[0].total_score} pts</p>
                  </div>
                  <div className="w-full bg-yellow-400/20 border-t-4 border-yellow-400 rounded-t-lg h-48 flex flex-col items-center justify-center shadow-lg shadow-yellow-500/10">
                    <span className="text-5xl font-display font-black text-yellow-400">1</span>
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {podium[2] && (
                <div className="flex flex-col items-center w-28 md:w-36">
                  <div className="text-center mb-2">
                    <p className="font-black font-display text-xs truncate w-24 md:w-32">{podium[2].nickname}</p>
                    <p className="text-xs text-amber-500 font-bold">{podium[2].total_score} pts</p>
                  </div>
                  <div className="w-full bg-amber-600/20 border-t-4 border-amber-600 rounded-t-lg h-28 flex flex-col items-center justify-center shadow-lg">
                    <span className="text-3xl font-display font-black text-amber-600">3</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="text-center text-xs text-slate-500 shrink-0 uppercase tracking-widest">
        {gameState === 'ended' ? 'Trivia Showdown Completed' : `Question ${currentQIndex + 1} of ${totalQuestions}`}
      </div>
    </div>
  );
}
