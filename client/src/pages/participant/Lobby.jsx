import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../../socket/index.js';
import { SpotlightCard } from '../../components/animations.jsx';
import { Users, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../../config.js';

export default function Lobby() {
  const navigate = useNavigate();
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState('');
  const [showExitModal, setShowExitModal] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [isBackNavigation, setIsBackNavigation] = useState(false);
  const [modalMessage, setModalMessage] = useState(
    'Are you sure you want to leave the lobby? You will be removed from the game and will need to enter your details again to re-join.'
  );

  const nickname = sessionStorage.getItem('nickname');
  const avatarColor = sessionStorage.getItem('avatarColor');
  const partyCode = sessionStorage.getItem('partyCode');
  const participantId = sessionStorage.getItem('participantId');

  useEffect(() => {
    if (!partyCode || !participantId) {
      navigate('/join');
      return;
    }

    // Connect to Socket.io
    socket.connect();

    // Emit join event
    socket.emit('join-session', {
      participantId: parseInt(participantId, 10),
      nickname,
      partyCode,
      isHost: false
    });

    // Listen for room updates
    socket.on('lobby-update', ({ participants: joinedPlayers }) => {
      setParticipants(joinedPlayers);
    });

    // Listen for quiz-started event
    socket.on('quiz-started', () => {
      navigate('/play');
    });

    // Listen for quiz-aborted event
    socket.on('quiz-aborted', (data) => {
      navigate('/join', { state: { message: data.message || 'Quiz ended by the admin' } });
    });

    // Replay state checks (in case game was already started when joining)
    socket.on('reconnect-state', (data) => {
      if (data.state !== 'lobby') {
        navigate('/play');
      }
    });

    socket.on('error', (err) => {
      setError(err.message || 'Lobby connection error');
    });

    return () => {
      socket.off('lobby-update');
      socket.off('quiz-started');
      socket.off('quiz-aborted');
      socket.off('reconnect-state');
      socket.off('error');
      socket.disconnect();
    };
  }, [partyCode, participantId, navigate]);

  // Intercept browser back button and reload/close tab
  useEffect(() => {
    // Push dummy state to intercept back button
    window.history.pushState(null, null, window.location.pathname);

    const handlePopState = () => {
      // Restore dummy state
      window.history.pushState(null, null, window.location.pathname);
      
      setModalMessage("By going back, the current user will be deleted from the database. Are you sure you want to proceed?");
      setIsBackNavigation(true);
      setShowExitModal(true);
    };

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleExitLobby = async () => {
    setExiting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${partyCode}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId })
      });

      if (!res.ok) {
        throw new Error('Failed to leave lobby');
      }

      sessionStorage.clear();
      
      if (isBackNavigation) {
        // Go back 2 steps to bypass the dummy states and land on /join
        window.history.go(-2);
      } else {
        navigate('/join');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to exit lobby.');
      setExiting(false);
    }
  };

  return (
    <div className="flex-1 p-6 max-w-2xl mx-auto w-full flex flex-col justify-center my-auto">
      <SpotlightCard className="w-full text-center relative overflow-hidden" spotlightColor="rgba(139,92,246,0.07)">
        <button
          type="button"
          onClick={() => {
            setModalMessage('Are you sure you want to leave the lobby? You will be removed from the game and will need to enter your details again to re-join.');
            setIsBackNavigation(false);
            setShowExitModal(true);
          }}
          className="absolute top-4 right-4 text-xs font-bold uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/30 text-rose-400 px-3 py-1.5 rounded-lg cursor-pointer transition-all font-semibold"
        >
          Exit Lobby
        </button>

        {/* Sync Ping animation */}
        <div className="w-20 h-20 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-6 relative">
          <div className="absolute inset-0 rounded-full border border-violet-400/30 animate-ping opacity-75"></div>
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>

        <h2 className="text-3xl font-display font-black mb-1">Joined!</h2>
        <p className="text-sm text-slate-400">Waiting for host to start the game...</p>

        <div className="my-8 py-4 border-y border-white/5 flex items-center justify-around">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Nickname</span>
            <div className="flex items-center gap-2 justify-center">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: avatarColor }} />
              <span className="font-bold text-lg">{nickname}</span>
            </div>
          </div>
          <div className="w-px h-10 bg-white/5"></div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Party Code</span>
            <span className="font-mono font-black text-lg text-violet-400 uppercase tracking-wider">{partyCode}</span>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 text-xs mb-4">
            {error}
          </div>
        )}

        {/* List of joined players */}
        <div className="text-left mt-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 justify-center">
            <Users className="w-4 h-4 text-violet-400" /> Joined Players ({participants.length})
          </h3>
          <div className="max-h-[160px] overflow-y-auto bg-black/20 rounded-xl p-3 border border-white/5">
            <div className="flex flex-wrap gap-2 justify-center">
              {participants.map((player) => (
                <div 
                  key={player.id} 
                  className={`py-1 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 border border-white/5 ${
                    player.id.toString() === participantId ? 'bg-violet-500/20 text-violet-300 border-violet-500/30' : 'bg-white/5 text-slate-300'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: player.avatar_color }} />
                  <span>{player.nickname}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SpotlightCard>

      {/* Exit Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200 text-left">
            <h3 className="text-xl font-display font-bold text-white mb-2">Exit Lobby?</h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              {modalMessage}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold text-sm cursor-pointer transition-colors"
                disabled={exiting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExitLobby}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm cursor-pointer transition-colors shadow-lg shadow-rose-600/20 flex items-center gap-1.5"
                disabled={exiting}
              >
                {exiting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Yes, Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
