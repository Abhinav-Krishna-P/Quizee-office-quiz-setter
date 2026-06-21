import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SpotlightCard, ShinyText, BlurText } from '../components/animations.jsx';
import { QrCode, Play, LogIn, Camera, X } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function Home() {
  const [partyCode, setPartyCode] = useState('');
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const navigate = useNavigate();

  const handleJoin = (e) => {
    if (e) e.preventDefault();
    if (!partyCode || partyCode.trim().length !== 6) {
      setError('Please enter a valid 6-character code.');
      return;
    }
    navigate(`/join/${partyCode.toUpperCase().trim()}`);
  };

  const handleHostClick = () => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      navigate('/admin/quizzes');
    } else {
      navigate('/admin/login');
    }
  };

  // Setup HTML5 QR Code Scanner when scanner modal opens
  useEffect(() => {
    let scanner = null;
    if (showScanner) {
      scanner = new Html5QrcodeScanner(
        'qr-reader',
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0 
        },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText) => {
          // Success callback
          // Typical URL: https://yourapp.com/join/ABCDEF or plain code ABCDEF
          console.log('QR Code detected:', decodedText);
          let code = decodedText.trim();
          if (code.includes('/join/')) {
            const parts = code.split('/join/');
            code = parts[parts.length - 1];
          }
          // Remove trailing slashes or parameters
          code = code.split('?')[0].split('/')[0].toUpperCase();
          if (code.length === 6) {
            scanner.clear().then(() => {
              setShowScanner(false);
              navigate(`/join/${code}`);
            }).catch(err => {
              console.error('Failed to clear scanner:', err);
              navigate(`/join/${code}`);
            });
          } else {
            setError('Invalid QR code format. Must contain a 6-character party code.');
            scanner.clear();
            setShowScanner(false);
          }
        },
        (error) => {
          // Silent error - scanning continues
        }
      );
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(err => console.error('Cleanup scanner error:', err));
      }
    };
  }, [showScanner, navigate]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-4xl mx-auto w-full">
      {/* Title / Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-6xl font-display font-black tracking-tight mb-4">
          <BlurText text="Office Quiz Arena" />
        </h1>
        <p className="text-lg text-slate-400 max-w-lg mx-auto">
          Host live trivia showdowns with your colleagues. Fast, competitive, and AI-powered.
        </p>
      </div>

      {/* Landing Blocks */}
      <div className="grid md:grid-cols-2 gap-8 w-full">
        {/* Participant Join Card */}
        <SpotlightCard className="flex flex-col justify-between min-h-[300px]">
          <div>
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 mb-6 shadow-md shadow-violet-500/5">
              <Play className="w-6 h-6 fill-current" />
            </div>
            <h2 className="text-2xl font-display font-bold mb-2">Join a Live Quiz</h2>
            <p className="text-slate-400 text-sm mb-6">
              Enter your room's party code or scan the host's QR code to join the lobby.
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="ENTER 6-CHAR CODE"
                maxLength={6}
                value={partyCode}
                onChange={(e) => {
                  setPartyCode(e.target.value.toUpperCase());
                  setError('');
                }}
                className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-3 px-4 text-center font-mono font-bold tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all uppercase placeholder:text-slate-600 placeholder:tracking-normal"
              />
              {error && <p className="text-xs text-rose-500 mt-1 text-center font-medium">{error}</p>}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3 rounded-lg shadow-lg hover:shadow-violet-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                Join Game
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setShowScanner(true);
                }}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold px-4 rounded-lg active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer"
                title="Scan QR Code"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>
          </form>
        </SpotlightCard>

        {/* Host Admin Card */}
        <SpotlightCard className="flex flex-col justify-between min-h-[300px]" spotlightColor="rgba(236,72,153,0.07)">
          <div>
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 mb-6 shadow-md shadow-pink-500/5">
              <LogIn className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-display font-bold mb-2">Host / Create Quizzes</h2>
            <p className="text-slate-400 text-sm mb-6">
              Create your own trivia session, customize parameters, or generate quiz questions from a PDF with Gemini AI.
            </p>
          </div>

          <div>
            <button
              onClick={handleHostClick}
              className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold py-3 rounded-lg shadow-lg hover:shadow-pink-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Host Portal
            </button>
          </div>
        </SpotlightCard>
      </div>

      {/* QR Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-2xl overflow-hidden p-6 relative">
            <button
              onClick={() => setShowScanner(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-xl font-display font-bold mb-4 flex items-center gap-2">
              <QrCode className="text-violet-400 w-5 h-5" /> Scan Game QR Code
            </h3>
            <div id="qr-reader" className="w-full rounded-lg overflow-hidden border border-white/10 bg-black/40"></div>
            <p className="text-xs text-slate-500 mt-4 text-center">
              Align the QR code inside the box to automatically join.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
