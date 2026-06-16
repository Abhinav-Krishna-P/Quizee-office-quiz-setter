import React, { useEffect, useState } from 'react';
import { Play, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { socket } from '../socket';

interface LobbyPlayer {
  id: string;
  name: string;
  score: number;
}

interface LobbyProps {
  pin: string;
  quizTitle: string;
  theme: 'pitch' | 'gold' | 'neon' | 'sunset';
  isAdmin: boolean;
  onGameStart: () => void;
  players: LobbyPlayer[];
}

export const Lobby: React.FC<LobbyProps> = ({
  pin,
  quizTitle,
  theme,
  isAdmin,
  onGameStart,
  players
}) => {
  const [joinUrl, setJoinUrl] = useState('');

  useEffect(() => {
    const url = `${window.location.origin}/?pin=${pin}`;
    setJoinUrl(url);
  }, [pin]);

  const handleStart = () => {
    if (isAdmin) {
      socket.emit('admin-start-game', { pin });
      onGameStart();
    }
  };

  return (
    <div className={`theme-container theme-${theme} min-h-screen text-gray-100 flex flex-col p-6`}>
      {/* Top Banner */}
      <div className="w-full flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/60 backdrop-blur-md border border-white/10 p-5 rounded-2xl mb-8">
        <div>
          <h2 className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-1">
            Live Quiz Lobby
          </h2>
          <h1 className="text-2xl md:text-3xl font-extrabold uppercase text-white leading-tight">
            {quizTitle}
          </h1>
        </div>

        {isAdmin ? (
          <button
            onClick={handleStart}
            className="btn-primary text-xl px-8 py-4 flex items-center gap-3"
            disabled={players.length === 0}
          >
            <Play className="w-6 h-6 fill-current" /> START GAME
          </button>
        ) : (
          <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 px-5 py-3 rounded-xl">
            <div className="w-3.5 h-3.5 bg-yellow-500 rounded-full animate-ping"></div>
            <span className="text-yellow-500 font-bold uppercase tracking-wide">
              Waiting for host to start...
            </span>
          </div>
        )}
      </div>

      {/* Main Room Lobby Details */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* PIN & QR Code panel */}
        <div className="glass-panel p-6 flex flex-col items-center text-center space-y-6">
          <div>
            <h3 className="text-gray-400 font-bold uppercase tracking-wider text-xs mb-1">
              Join Link or Scan QR
            </h3>
            <p className="text-sm font-semibold text-yellow-500">
              {window.location.hostname === 'localhost' ? 'localhost:5173' : window.location.host}
            </p>
          </div>

          {joinUrl && (
            <div className="bg-white p-3 rounded-xl shadow-lg">
              <QRCodeSVG value={joinUrl} size={160} level="M" includeMargin={false} />
            </div>
          )}

          <div className="w-full border-t border-white/10 pt-4">
            <h3 className="text-gray-400 font-bold uppercase tracking-wider text-xs mb-2">
              GAME PIN
            </h3>
            <p className="text-6xl font-extrabold text-gold tracking-widest winning-text-glow">
              {pin}
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
            <Users className="w-5 h-5 text-yellow-500" />
            <span>{players.length} Players Connected</span>
          </div>
        </div>

        {/* Players List in Grid */}
        <div className="lg:col-span-2 glass-panel p-6 min-h-[400px] flex flex-col">
          <h3 className="text-white text-lg font-bold uppercase tracking-wider border-b border-white/10 pb-3 mb-6 flex items-center gap-2">
            👥 Participant Roster ({players.length} / 50)
          </h3>

          {players.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <Users className="w-16 h-16 mb-4 opacity-30 animate-pulse" />
              <p className="text-lg font-bold">Waiting for players to connect...</p>
              <p className="text-sm">Scan the QR code or enter the 6-digit PIN on the home page.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 justify-items-center">
              {players.map((p) => {
                return (
                  <div
                    key={p.id}
                    className="participant-card"
                  >
                    {/* Circle avatar */}
                    <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 mb-2">
                      <span className="text-base font-bold uppercase text-yellow-500">
                        {p.name.substring(0, 2)}
                      </span>
                    </div>
                    <div className="fut-card-name text-center w-full">{p.name}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
