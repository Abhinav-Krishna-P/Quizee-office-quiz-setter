import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../../socket/index.js';
import { SpotlightCard, CountUp } from '../../components/animations.jsx';
import { API_BASE_URL } from '../../config.js';
import { AlertCircle, Flame, Trophy, Award, Loader2 } from 'lucide-react';

export default function LiveQuiz() {
  const navigate = useNavigate();

  // Participant identity
  const participantId = parseInt(sessionStorage.getItem('participantId'), 10);
  const nickname = sessionStorage.getItem('nickname');
  const avatarColor = sessionStorage.getItem('avatarColor');
  const partyCode = sessionStorage.getItem('partyCode');

  // Game states: 'waiting' | 'question' | 'locked' | 'reveal' | 'leaderboard'
  const [gameState, setGameState] = useState('waiting');
  
  // Question detail
  const [questionId, setQuestionId] = useState(null);
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQIdx, setCurrentQIdx] = useState(0);

  // Answering state
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Result state
  const [isCorrect, setIsCorrect] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [rank, setRank] = useState(0);
  const [totalTimeMs, setTotalTimeMs] = useState(0);
  const [correctIdx, setCorrectIdx] = useState(-1);

  // Timer sync
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeLimit, setTimeLimit] = useState(20);
  const timerRef = useRef(null);
  const selectedIdxRef = useRef(-1);
  const questionIdRef = useRef(null);

  useEffect(() => {
    if (!partyCode || !participantId) {
      navigate('/join');
      return;
    }

    socket.connect();
    
    // Join socket
    socket.emit('join-session', {
      participantId,
      nickname,
      partyCode,
      isHost: false
    });

    // 1. Reconnect Sync
    socket.on('reconnect-state', (data) => {
      setTotalQuestions(data.totalQuestions || 0);
      setCurrentQIdx(data.questionIndex || 0);

      if (data.state === 'question') {
        setQuestionId(data.questionId);
        questionIdRef.current = data.questionId;
        setQuestionText(data.text);
        setOptions(data.options || []);

        if (data.hasSubmitted) {
          setGameState('locked');
          const subOpt = data.submittedOptionIndex !== undefined ? data.submittedOptionIndex : -1;
          setSelectedIdx(subOpt);
          selectedIdxRef.current = subOpt;
        } else {
          setGameState('question');
          setSelectedIdx(-1);
          selectedIdxRef.current = -1;
          setTimeLimit(data.timeLimit || 15);
          syncTimer(data.questionStartedAt, data.timeLimit);
        }
      } else if (data.state === 'reveal') {
        setGameState('reveal');
        setCorrectIdx(data.correctIndex);
        setOptions(data.options || []);
        fetchScoreAndRank(); // update final numbers
      } else if (data.state === 'leaderboard') {
        setGameState('leaderboard');
        fetchScoreAndRank();
      } else if (data.state === 'ended') {
        navigate('/podium');
      } else {
        setGameState('waiting');
      }
    });

    // 2. Question Start
    socket.on('question-start', (data) => {
      setGameState('question');
      setQuestionId(data.questionId);
      questionIdRef.current = data.questionId;
      setQuestionText(data.text);
      setOptions(data.options);
      setCurrentQIdx(data.questionIndex);
      setTotalQuestions(data.totalQuestions);
      setSelectedIdx(-1);
      selectedIdxRef.current = -1;
      setError('');
      setCorrectIdx(-1);
      setTimeLimit(data.timeLimit || 15);

      syncTimer(data.questionStartedAt, data.timeLimit);
    });

    // 3. Question Reveal
    socket.on('question-reveal', (data) => {
      setGameState('reveal');
      setCorrectIdx(data.correctIndex);
      if (timerRef.current) clearInterval(timerRef.current);
      
      // Fetch score and check if correct
      fetchScoreAndRank(data.correctIndex);
    });

    // 4. Leaderboard Screen
    socket.on('leaderboard-update', (data) => {
      setGameState('leaderboard');
      fetchScoreAndRank();
    });

    // 5. Ended Screen
    socket.on('quiz-ended', () => {
      navigate('/podium');
    });

    // 6. Aborted Screen
    socket.on('quiz-aborted', (data) => {
      navigate('/join', { state: { message: data.message || 'Quiz ended by the admin' } });
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      socket.off('reconnect-state');
      socket.off('question-start');
      socket.off('question-reveal');
      socket.off('leaderboard-update');
      socket.off('quiz-ended');
      socket.off('quiz-aborted');
      socket.disconnect();
    };
  }, [partyCode, participantId, navigate]);

  // Sync clock locally with server Date.now() reference
  const syncTimer = (startedAtMs, limitSec) => {
    if (timerRef.current) clearInterval(timerRef.current);

    const updateTimer = () => {
      const elapsedMs = Date.now() - startedAtMs;
      const remainingSec = Math.max(0, Math.ceil((limitSec * 1000 - elapsedMs) / 1000));
      setTimeLeft(remainingSec);

      if (remainingSec <= 0) {
        clearInterval(timerRef.current);
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 200);
  };

  // Fetch points, streak, and rankings for participant
  const fetchScoreAndRank = async (revealedCorrectIdx = -1) => {
    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${partyCode}/results`);
      const data = await res.json();
      
      if (res.ok && data.participants) {
        const index = data.participants.findIndex(p => p.id === participantId);
        if (index !== -1) {
          const self = data.participants[index];
          setTotalScore(self.total_score);
          setRank(index + 1);
          setTotalTimeMs(self.total_time_ms || 0);

          // Get answer details from DB for this question
          if (revealedCorrectIdx !== -1 && questionIdRef.current) {
            const answersRes = await fetch(`${API_BASE_URL}/sessions/${partyCode}/results`); // we can query answers or calculate from score diff
            // For simplicity, let's fetch points earned from our DB answers logs
            // But we can check if the player chose correctIdx by comparing selectedIdx
            // Wait, we can fetch all results and since we have selectedIdx:
            const correct = selectedIdxRef.current === revealedCorrectIdx;
            setIsCorrect(correct);
            
            // To get points earned, we can count the difference or just calculate based on correctness
            // Better: we can trust the points we calculate since the server computes it.
            // Let's compute local points or just show success/wrong feedback
          }
        }
      }
    } catch (e) {
      console.error('Fetch score error:', e);
    }
  };

  // Submit Answer
  const handleAnswerClick = async (idx) => {
    if (gameState !== 'question' || selectedIdx !== -1 || submitting) return;
    
    setSelectedIdx(idx);
    selectedIdxRef.current = idx;
    setSubmitting(true);
    setGameState('locked');
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${partyCode}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          questionId,
          optionIndex: idx
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit answer');
      }
    } catch (err) {
      setError(err.message);
      // rollback state
      setGameState('question');
      setSelectedIdx(-1);
      selectedIdxRef.current = -1;
    } finally {
      setSubmitting(false);
    }
  };

  // Styles
  const bgClasses = ['btn-red', 'btn-blue', 'btn-yellow', 'btn-green'];
  const shapes = ['▲', '◆', '●', '■'];
  const colorsName = ['Red option', 'Blue option', 'Yellow option', 'Green option'];

  return (
    <div className="flex-1 flex flex-col justify-between p-4 max-w-lg mx-auto w-full select-none">
      
      {/* Top Header stats */}
      <div className="grid grid-cols-3 gap-2 bg-white/5 border border-white/5 p-3 rounded-xl shrink-0">
        <div>
          <span className="text-[10px] text-slate-400 uppercase tracking-widest block">Score</span>
          <span className="font-mono font-black text-violet-400 text-base md:text-lg">
            <CountUp to={totalScore} /> pts
          </span>
        </div>
        <div className="text-center">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest block">Correct Time</span>
          <span className="font-mono font-black text-emerald-400 text-base md:text-lg">
            {totalTimeMs ? `${(totalTimeMs / 1000).toFixed(2)}s` : '-'}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest block">Rank</span>
          <span className="font-display font-black text-white text-base md:text-lg">
            #{rank || '-'}
          </span>
        </div>
      </div>

      {/* Main Game Screen */}
      <div className="flex-1 flex flex-col justify-center my-6">

        {/* State 1: Waiting for host / Sync state */}
        {gameState === 'waiting' && (
          <SpotlightCard className="text-center py-12">
            <Loader2 className="w-10 h-10 border-violet-500 animate-spin mx-auto mb-4" />
            <h3 className="text-2xl font-display font-bold">Get Ready!</h3>
            <p className="text-slate-400 text-sm mt-1">Look at the presenter screen. The next question is preparing...</p>
          </SpotlightCard>
        )}

        {/* State 2: Question active */}
        {gameState === 'question' && (
          <div className="space-y-6 w-full">
            {/* Timer bar */}
            <div className="w-full bg-white/10 h-3.5 rounded-full overflow-hidden relative">
              <div 
                className={`h-full transition-all duration-300 ${timeLeft <= 5 ? 'bg-rose-500' : 'bg-violet-500'}`}
                style={{ width: `${(timeLeft / (timeLeft > timeLimit ? timeLeft : timeLimit)) * 100}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold font-mono text-white">
                {timeLeft}s remaining
              </span>
            </div>

            {/* Question Text */}
            <h2 className="text-xl md:text-2xl font-display font-bold text-center leading-snug">
              {questionText || 'Choose the correct answer!'}
            </h2>

            {/* Interactive Grid of Buttons */}
            <div className="grid grid-cols-2 gap-4 h-64">
              {options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAnswerClick(idx)}
                  className={`rounded-2xl flex flex-col items-center justify-center p-4 text-white text-center font-bold text-lg cursor-pointer ${bgClasses[idx]}`}
                >
                  <span className="text-4xl bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mb-3">
                    {shapes[idx]}
                  </span>
                  <span className="text-sm truncate w-full">{opt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* State 3: Locked in state */}
        {gameState === 'locked' && (
          <SpotlightCard className="text-center py-12" spotlightColor="rgba(16,185,129,0.07)">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4 relative">
              <div className="absolute inset-0 rounded-full border border-emerald-400/30 animate-ping opacity-75"></div>
              <span className="text-2xl text-emerald-400 font-bold">✓</span>
            </div>
            <h3 className="text-2xl font-display font-bold text-emerald-400">Answer Locked!</h3>
            <p className="text-slate-400 text-sm mt-1">Check the presenter screen for live counts. Waiting for others...</p>
            {selectedIdx !== -1 && options[selectedIdx] && (
              <span className="inline-block mt-4 text-xs font-bold uppercase tracking-wider bg-white/5 border border-white/5 px-3 py-1.5 rounded-full text-slate-300">
                You chose: {shapes[selectedIdx]} {options[selectedIdx]}
              </span>
            )}
          </SpotlightCard>
        )}

        {/* State 4: Answers Reveal feedback */}
        {gameState === 'reveal' && (
          <SpotlightCard 
            className="text-center py-12" 
            spotlightColor={isCorrect ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)'}
          >
            {isCorrect ? (
              <div className="space-y-4">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                  <Flame className="w-10 h-10 text-emerald-400 fill-current animate-bounce" />
                </div>
                <h3 className="text-3xl font-display font-black text-emerald-400">Correct!</h3>
                <p className="text-sm text-slate-400">Awesome job! Keep the momentum going.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-20 h-20 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
                  <span className="text-4xl text-rose-400 font-bold font-mono">✗</span>
                </div>
                <h3 className="text-3xl font-display font-black text-rose-400">
                  {selectedIdx === -1 ? "Time's Up!" : 'Incorrect'}
                </h3>
                <p className="text-sm text-slate-400">
                  {selectedIdx === -1 ? 'Be faster on the next round!' : 'You will get the next one!'}
                </p>
              </div>
            )}

            {correctIdx !== -1 && (
              <div className="mt-6 inline-flex items-center gap-2 text-xs font-bold bg-white/5 border border-white/5 py-2 px-4 rounded-full text-slate-300">
                <span>Correct Option:</span>
                <span className={`w-5 h-5 rounded flex items-center justify-center text-white ${bgClasses[correctIdx]}`}>
                  {shapes[correctIdx]}
                </span>
                <span>{options[correctIdx] || ''}</span>
              </div>
            )}
          </SpotlightCard>
        )}

        {/* State 5: Between rounds Leaderboard */}
        {gameState === 'leaderboard' && (
          <SpotlightCard className="text-center py-12" spotlightColor="rgba(245,158,11,0.07)">
            <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
              <Trophy className="w-10 h-10 text-amber-400" />
            </div>
            
            <h3 className="text-xl font-display font-bold text-amber-400 mb-2">Round Over</h3>
            <p className="text-sm text-slate-400">You are currently ranked</p>
            <h2 className="text-5xl font-display font-black text-white my-3">
              #{rank || '-'}
            </h2>
            <p className="text-xs text-slate-500 uppercase tracking-widest">out of all participants</p>
          </SpotlightCard>
        )}
      </div>

      {/* Footer Info */}
      <div className="text-center text-xs text-slate-500 uppercase tracking-widest shrink-0">
        Question {currentQIdx + 1} of {totalQuestions}
      </div>
    </div>
  );
}
