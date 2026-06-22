import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { socket } from '../../socket/index.js';
import { SpotlightCard } from '../../components/animations.jsx';
import { API_BASE_URL } from '../../config.js';
import { Play, Users, QrCode, ArrowLeft, Loader2, Volume2, VolumeX } from 'lucide-react';

export default function HostLobby() {
  const { code } = useParams();
  const upperCode = code.toUpperCase();
  const navigate = useNavigate();
  const token = localStorage.getItem('adminToken');

  const [quizTitle, setQuizTitle] = useState('');
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrUrl, setQrUrl] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [error, setError] = useState('');
  const [showAbortModal, setShowAbortModal] = useState(false);

  // 1. Fetch current quiz title
  useEffect(() => {
    const fetchQuizByCode = async () => {
      try {
        // We look up quizzes to find matching code (or get from session)
        const res = await fetch(`${API_BASE_URL}/quizzes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const quiz = data.find(q => q.party_code === upperCode);
        if (quiz) {
          setQuizTitle(quiz.title);
        } else {
          setQuizTitle('Office Trivia Showdown');
        }
      } catch (err) {
        console.error('Fetch quiz by code error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuizByCode();

    // 2. Generate QR Code
    const joinUrl = `${window.location.origin}/join/${upperCode}`;
    QRCode.toDataURL(joinUrl, { width: 300, margin: 2, color: { dark: '#000000', light: '#ffffff' } }, (err, url) => {
      if (err) console.error('QR code generation failed:', err);
      else setQrUrl(url);
    });
  }, [upperCode, token]);

  // 3. Connect Socket.io
  useEffect(() => {
    socket.connect();
    
    // Join as Host
    socket.emit('join-session', {
      partyCode: upperCode,
      isHost: true
    });

    // Listen for participant updates
    socket.on('lobby-update', ({ participants: joinedPlayers }) => {
      setParticipants(joinedPlayers);
      if (soundEnabled) {
        // play subtle join sound/ping
        try {
          const context = new (window.AudioContext || window.webkitAudioContext)();
          const osc = context.createOscillator();
          const gain = context.createGain();
          osc.connect(gain);
          gain.connect(context.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, context.currentTime); // high pitch ping
          gain.gain.setValueAtTime(0.05, context.currentTime);
          osc.start();
          gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.3);
          osc.stop(context.currentTime + 0.3);
        } catch (e) {
          console.log('Audio contextual play blocked:', e);
        }
      }
    });

    socket.on('error', (err) => {
      setError(err.message || 'Lobby error');
    });

    return () => {
      socket.off('lobby-update');
      socket.off('error');
      socket.disconnect();
    };
  }, [upperCode, soundEnabled]);

  // Start the quiz game loop
  const handleStartQuiz = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${upperCode}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start quiz');
      }

      navigate(`/admin/host/${upperCode}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAbortQuiz = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${upperCode}/abort`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error('Failed to abort quiz');
      }

      setShowAbortModal(false);
      navigate('/admin/quizzes');
    } catch (err) {
      console.error(err);
      setError('Failed to abort quiz session.');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 border-violet-500 animate-spin mb-4" />
        <p className="text-slate-400 text-sm">Preparing lobby display...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-12 max-w-6xl mx-auto w-full flex flex-col justify-between">
      {/* Top Header Controls */}
      <div className="flex justify-between items-center mb-8 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin/quizzes')}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors cursor-pointer font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Exit Lobby
          </button>
          <button 
            type="button"
            onClick={() => setShowAbortModal(true)}
            className="text-xs font-bold uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/30 text-rose-400 px-3 py-1.5 rounded-lg cursor-pointer transition-all font-semibold"
          >
            Abort Quiz
          </button>
        </div>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title={soundEnabled ? 'Mute lobby sound' : 'Unmute lobby sound'}
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
      </div>

      {/* Main Lobby Visual (Projector View) */}
      <div className="grid lg:grid-cols-5 gap-8 items-center flex-1 my-auto">
        {/* Left Side: Party Code and QR Code */}
        <div className="lg:col-span-2 flex flex-col items-center text-center">
          <h3 className="text-xl text-slate-400 uppercase tracking-widest font-bold font-display mb-2">Join at</h3>
          <h4 className="text-sm font-mono text-violet-400 mb-6 bg-violet-500/10 border border-violet-500/20 px-4 py-1.5 rounded-full">
            {window.location.origin}/join/{upperCode}
          </h4>

          {/* QR Display */}
          <div className="bg-white p-4 rounded-2xl shadow-2xl border-4 border-violet-500/20 mb-8 max-w-[260px]">
            {qrUrl ? (
              <img src={qrUrl} alt="Join Game QR Code" className="w-full h-auto rounded-lg" />
            ) : (
              <div className="w-[220px] h-[220px] bg-slate-100 flex items-center justify-center text-slate-400">
                <QrCode className="w-12 h-12 animate-pulse" />
              </div>
            )}
          </div>

          <span className="text-xs text-slate-500 uppercase tracking-wider mb-2">Party Code</span>
          <h1 className="text-6xl md:text-7xl font-display font-black tracking-wider text-white bg-white/5 border border-white/10 px-8 py-3 rounded-2xl select-all select-none">
            {upperCode}
          </h1>
        </div>

        {/* Right Side: Joined Players Arena */}
        <div className="lg:col-span-3 h-full flex flex-col min-h-[350px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-display font-bold flex items-center gap-2">
              <Users className="text-violet-400 w-6 h-6" /> Connected Players
            </h2>
            <span className="text-sm font-bold bg-violet-600/20 border border-violet-500/30 text-violet-300 px-3 py-1 rounded-full">
              {participants.length} Players
            </span>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 text-sm mb-4">
              {error}
            </div>
          )}

          {/* Grid of Players */}
          <div className="flex-1 glass-panel border border-white/5 rounded-2xl p-6 overflow-y-auto max-h-[400px]">
            {participants.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
                <Users className="w-12 h-12 opacity-30 mb-4 animate-bounce" />
                <p className="text-sm">Waiting for players to scan QR or enter code...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {participants.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 animate-fade-in"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-inner"
                      style={{ backgroundColor: player.avatar_color }}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{player.nickname}</p>
                      {player.team_name && (
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          {player.team_name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Start Button Drawer */}
      <div className="mt-8 border-t border-white/5 pt-6 flex items-center justify-between shrink-0">
        <div className="text-sm text-slate-400">
          Quiz: <span className="text-white font-semibold font-display">{quizTitle}</span>
        </div>
        <button
          onClick={handleStartQuiz}
          disabled={participants.length === 0}
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-violet-600/20 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
        >
          <Play className="w-5 h-5 fill-current" /> Start Quiz Game
        </button>
      </div>

      {/* Abort Confirmation Modal */}
      {showAbortModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200 text-left">
            <h3 className="text-xl font-display font-bold text-white mb-2">Abort Quiz?</h3>
            <p className="text-slate-400 text-sm mb-6">
              Are you sure you want to abort this quiz? This will instantly disconnect all participants and end the session.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowAbortModal(false)}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold text-sm cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAbortQuiz}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm cursor-pointer transition-colors shadow-lg shadow-rose-600/20"
              >
                Yes, Abort Quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
