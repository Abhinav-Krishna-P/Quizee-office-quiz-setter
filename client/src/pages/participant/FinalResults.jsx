import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SpotlightCard, ShinyText, CountUp } from '../../components/animations.jsx';
import { API_BASE_URL } from '../../config.js';
import { Trophy, Home, Sparkles, Award, Star } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function FinalResults() {
  const navigate = useNavigate();

  const participantId = parseInt(sessionStorage.getItem('participantId'), 10);
  const nickname = sessionStorage.getItem('nickname');
  const partyCode = sessionStorage.getItem('partyCode');

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [selfStats, setSelfStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!partyCode || !participantId) {
      navigate('/');
      return;
    }

    const fetchFinalResults = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/sessions/${partyCode}/results`);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Failed to fetch final results');
        
        setResults(data.participants || []);
        
        const idx = data.participants.findIndex(p => p.id === participantId);
        if (idx !== -1) {
          const stats = data.participants[idx];
          const rankPos = idx + 1;
          setSelfStats({ ...stats, rank: rankPos });

          // Explode confetti if finished in the top 3!
          if (rankPos <= 3) {
            triggerConfettiCelebration();
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFinalResults();
  }, [partyCode, participantId, navigate]);

  const triggerConfettiCelebration = () => {
    // Standard quick burst
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 }
    });

    // Fireworks effect for 3 seconds
    const end = Date.now() + 3 * 1000;
    const interval = setInterval(() => {
      if (Date.now() > end) {
        return clearInterval(interval);
      }
      confetti({
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        origin: { x: Math.random(), y: Math.random() - 0.2 }
      });
    }, 200);
  };

  const handleReturnHome = () => {
    sessionStorage.clear(); // Wipe game state
    navigate('/');
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 text-sm">Collating final scores...</p>
      </div>
    );
  }

  const isPodium = selfStats && selfStats.rank <= 3;

  return (
    <div className="flex-1 flex flex-col justify-center px-4 py-8 max-w-md mx-auto w-full my-auto">
      {selfStats ? (
        <div className="space-y-6">
          
          {/* Card Head: Victory/Podium block */}
          <SpotlightCard 
            className="text-center py-10 relative overflow-hidden"
            spotlightColor={isPodium ? 'rgba(245,158,11,0.07)' : 'rgba(139,92,246,0.07)'}
          >
            {isPodium ? (
              <div className="space-y-4">
                <div className="w-20 h-20 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
                  <Trophy className="w-10 h-10 text-amber-400 fill-current animate-bounce" />
                </div>
                <h2 className="text-3xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-300">
                  Podium Finish!
                </h2>
                <p className="text-sm text-slate-400">Incredible trivia skills, you took home a trophy!</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-20 h-20 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto">
                  <Star className="w-10 h-10 text-violet-400 fill-current" />
                </div>
                <h2 className="text-3xl font-display font-black text-violet-300">
                  Great Game!
                </h2>
                <p className="text-sm text-slate-400">Thanks for playing. Better luck next time!</p>
              </div>
            )}

            <div className="my-8 py-4 border-y border-white/5 flex justify-around">
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Final Rank</span>
                <span className={`text-4xl font-display font-black block ${isPodium ? 'text-yellow-400' : 'text-white'}`}>
                  #{selfStats.rank}
                </span>
              </div>
              <div className="w-px h-12 bg-white/5"></div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Total Score</span>
                <span className="text-4xl font-mono font-black text-violet-400 block">
                  <CountUp to={selfStats.total_score} />
                </span>
              </div>
              <div className="w-px h-12 bg-white/5"></div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Correct Time</span>
                <span className="text-4xl font-mono font-black text-emerald-400 block">
                  {selfStats.total_time_ms ? `${(selfStats.total_time_ms / 1000).toFixed(2)}s` : '-'}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-500 uppercase tracking-wider">
              Nickname: <span className="text-white font-bold">{selfStats.nickname}</span>
              {selfStats.team_name && (
                <span className="block mt-1 font-semibold text-violet-300">Team: {selfStats.team_name}</span>
              )}
            </div>
          </SpotlightCard>

          {/* Full Standings List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center flex items-center gap-1.5 justify-center">
              <Award className="w-4 h-4 text-violet-400" /> Full Arena Standings
            </h3>
            
            <div className="max-h-[220px] overflow-y-auto bg-black/20 rounded-2xl p-4 border border-white/5 space-y-2">
              {results.map((player, idx) => (
                <div 
                  key={player.id}
                  className={`flex items-center justify-between gap-3 p-2 rounded-xl text-xs ${
                    player.id === participantId 
                      ? 'bg-violet-500/10 border border-violet-500/20 text-white' 
                      : 'bg-white/5 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                      idx === 0 ? 'bg-yellow-400 text-black' : idx === 1 ? 'bg-slate-300 text-black' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-white/10 text-slate-400'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="font-bold truncate">{player.nickname}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono font-bold shrink-0">
                    <span className="text-violet-400">{player.total_score} pts</span>
                    {player.total_time_ms ? (
                      <>
                        <span className="text-white/10 text-[10px]">•</span>
                        <span className="text-emerald-400">{(player.total_time_ms / 1000).toFixed(2)}s</span>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Return Home Button */}
          <button
            onClick={handleReturnHome}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-3 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            <Home className="w-4 h-4" /> Return to Home
          </button>

        </div>
      ) : (
        <div className="text-center py-10 glass-panel rounded-2xl">
          <p className="text-rose-500 text-sm font-semibold">Stats not found. Did you play this session?</p>
          <button onClick={handleReturnHome} className="mt-4 bg-white/10 px-4 py-2 rounded-lg text-xs">Return Home</button>
        </div>
      )}
    </div>
  );
}
