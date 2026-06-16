import React, { useState, useEffect } from 'react';
import { Trophy, Play } from 'lucide-react';
import { socket } from '../socket';

interface HomeProps {
  onJoinSuccess: (pin: string, name: string) => void;
  onAdminSelect: () => void;
}

export const Home: React.FC<HomeProps> = ({ onJoinSuccess, onAdminSelect }) => {
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<1 | 2>(1); // 1: PIN, 2: Name
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    socket.connect();

    socket.on('join-success', (data: { pin: string; name: string }) => {
      setLoading(false);
      onJoinSuccess(data.pin, data.name);
    });

    socket.on('join-error', (msg: string) => {
      setLoading(false);
      setError(msg);
    });

    return () => {
      socket.off('join-success');
      socket.off('join-error');
    };
  }, [onJoinSuccess]);

  const handlePINSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (pin.length !== 6 || isNaN(Number(pin))) {
      setError('Please enter a valid 6-digit Game PIN.');
      return;
    }
    setStep(2);
  };

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Please enter a username.');
      return;
    }
    setLoading(true);
    socket.emit('player-join', { pin: pin.trim(), name: name.trim() });
  };

  return (
    <div className="theme-container theme-charcoal min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md glass-panel p-8 text-center relative overflow-hidden">
        <div className="flex justify-center mb-4">
          <div className="bg-yellow-500/10 p-4 rounded-full border border-yellow-500/20 winner-bounce">
            <Trophy className="w-12 h-12 text-yellow-500" />
          </div>
        </div>

        <h1 className="text-title text-gold text-4xl font-black mb-2 tracking-wide winning-text-glow">
          QUIZEE LIVE
        </h1>
        <p className="text-gray-400 text-sm mb-8 uppercase tracking-wider">
          Multiplayer Quiz Platform
        </p>

        {error && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-200 p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handlePINSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                maxLength={6}
                placeholder="GAME PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="input-field text-center text-3xl font-extrabold tracking-widest"
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full justify-center text-lg py-3">
              <Play className="w-5 h-5 fill-current" /> ENTER GAME
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoinGame} className="space-y-4">
            <div>
              <p className="text-yellow-500 font-bold mb-2">Room PIN: {pin}</p>
              <input
                type="text"
                placeholder="YOUR USERNAME"
                maxLength={15}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field text-center text-xl font-bold uppercase"
                required
                disabled={loading}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-secondary flex-1 justify-center"
                disabled={loading}
              >
                BACK
              </button>
              <button
                type="submit"
                className="btn-primary flex-1 justify-center text-lg"
                disabled={loading}
              >
                {loading ? 'JOINING...' : 'JOIN LOBBY'}
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col gap-2">
          <button
            onClick={onAdminSelect}
            className="text-gray-400 hover:text-yellow-500 text-sm font-semibold transition-colors flex items-center justify-center gap-1"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> CREATOR HUB / HOST DASHBOARD
          </button>
        </div>
      </div>

      <div className="absolute bottom-4 text-center text-gray-500 text-xs">
        &copy; Quizee Live - Custom Dark Theme
      </div>
    </div>
  );
};
