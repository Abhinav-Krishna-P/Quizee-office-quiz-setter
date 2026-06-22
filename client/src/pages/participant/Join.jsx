import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { SpotlightCard } from '../../components/animations.jsx';
import { API_BASE_URL } from '../../config.js';
import { AlertCircle, User, ArrowLeft, Loader2 } from 'lucide-react';

export default function Join() {
  const { code } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [partyCode, setPartyCode] = useState(code ? code.toUpperCase() : '');
  const [nickname, setNickname] = useState('');
  const [avatarColor, setAvatarColor] = useState('#3B82F6');
  const [teamId, setTeamId] = useState('');
  
  // Game session properties
  const [teamMode, setTeamMode] = useState(false);
  const [teams, setTeams] = useState([]);
  const [checkingSession, setCheckingSession] = useState(false);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  // Check for redirected messages from aborted quizzes
  useEffect(() => {
    if (location.state?.message) {
      setError(location.state.message);
      // Clear location state from history
      window.history.replaceState(null, '');
    }
  }, [location]);

  const colorsList = [
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#10B981', // Green
    '#F59E0B', // Yellow
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#F97316'  // Orange
  ];

  // If party code is present or changes, check if session is active and check team details
  useEffect(() => {
    if (partyCode && partyCode.length === 6) {
      checkSessionTeams();
    }
  }, [partyCode]);

  const checkSessionTeams = async () => {
    setCheckingSession(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${partyCode.toUpperCase()}/teams`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Active quiz lobby not found');
      }

      setTeamMode(data.teamMode);
      setTeams(data.teams);
      if (data.teamMode && data.teams.length > 0) {
        setTeamId(data.teams[0].id.toString());
      }
    } catch (err) {
      setError(err.message);
      setTeamMode(false);
      setTeams([]);
    } finally {
      setCheckingSession(false);
    }
  };

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    if (!partyCode || partyCode.trim().length !== 6) {
      setError('Please enter a 6-character room code.');
      return;
    }
    if (!nickname.trim()) {
      setError('Please choose a nickname.');
      return;
    }

    setJoining(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${partyCode.toUpperCase().trim()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname,
          avatarColor,
          teamId: teamMode ? parseInt(teamId, 10) : null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to join game lobby');
      }

      // Store participant details in sessionStorage (survives page refreshes but not tab closes)
      sessionStorage.setItem('participantId', data.participantId);
      sessionStorage.setItem('nickname', data.nickname);
      sessionStorage.setItem('avatarColor', data.avatarColor);
      sessionStorage.setItem('partyCode', data.partyCode);
      sessionStorage.setItem('sessionId', data.sessionId);
      if (data.teamId) {
        sessionStorage.setItem('teamId', data.teamId);
      }

      navigate('/lobby');
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      {/* Back Button */}
      <button 
        onClick={() => navigate('/')} 
        className="mb-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors cursor-pointer text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </button>

      <SpotlightCard className="w-full max-w-md">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-display font-bold">Join Quiz</h2>
          <p className="text-slate-400 text-sm mt-2">Enter your nickname and choose your avatar color</p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 flex items-start gap-3 mb-6">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-300 font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleJoinSubmit} className="space-y-6">
          {/* Party Code */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Party Code
            </label>
            <input
              type="text"
              placeholder="ABCDEF"
              maxLength={6}
              value={partyCode}
              onChange={(e) => setPartyCode(e.target.value.toUpperCase())}
              disabled={!!code}
              className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-3 px-4 text-center font-mono font-bold tracking-widest text-lg uppercase focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
            />
          </div>

          {/* Nickname */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Nickname
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <User className="w-5 h-5" />
              </span>
              <input
                type="text"
                placeholder="e.g. SpeedRunner"
                maxLength={15}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all font-semibold"
              />
            </div>
          </div>

          {/* Avatar Color Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Choose Avatar Color
            </label>
            <div className="grid grid-cols-8 gap-2">
              {colorsList.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatarColor(color)}
                  className={`w-8 h-8 rounded-full cursor-pointer transition-all ${
                    avatarColor === color 
                      ? 'ring-4 ring-offset-2 ring-violet-500 ring-offset-slate-900 scale-110' 
                      : 'hover:scale-105 opacity-80'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Optional Team Picker */}
          {checkingSession ? (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-violet-400" /> Checking team settings...
            </div>
          ) : teamMode && teams.length > 0 && (
            <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Choose Team
              </label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-100 font-semibold"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={joining || checkingSession}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3 rounded-lg shadow-lg hover:shadow-violet-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {joining ? 'Joining lobby...' : 'Enter Arena'}
          </button>
        </form>
      </SpotlightCard>
    </div>
  );
}
