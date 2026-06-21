import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SpotlightCard } from '../../components/animations.jsx';
import { Plus, LogOut, FileText, Play, ChevronRight, Settings, Calendar } from 'lucide-react';
import { API_BASE_URL } from '../../config.js';

export default function MyQuizzes() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const email = localStorage.getItem('adminEmail');

  const fetchQuizzes = async () => {
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`${API_BASE_URL}/quizzes`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        if (res.status === 401) {
          handleLogout();
          return;
        }
        throw new Error('Failed to fetch quizzes');
      }
      const data = await res.json();
      setQuizzes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminEmail');
    localStorage.removeItem('adminId');
    navigate('/admin/login');
  };

  const handleCreateQuiz = async () => {
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch(`${API_BASE_URL}/quizzes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: 'Untitled Quiz'
        })
      });
      if (!res.ok) throw new Error('Failed to create quiz');
      const newQuiz = await res.json();
      navigate(`/admin/quiz/${newQuiz.id}`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex-1 p-6 md:p-12 max-w-6xl mx-auto w-full flex flex-col">
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/5">
        <div>
          <h2 className="text-3xl font-display font-bold">Host Dashboard</h2>
          <p className="text-slate-400 text-sm mt-1">Logged in as <span className="text-pink-400 font-medium">{email}</span></p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleCreateQuiz}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-2.5 px-4 rounded-lg shadow-lg active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer text-sm"
          >
            <Plus className="w-4 h-4" /> Create New Quiz
          </button>
          <button
            onClick={handleLogout}
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-medium py-2.5 px-4 rounded-lg active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer text-sm"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-4 mb-6 font-medium text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-400 text-sm">Loading your quizzes...</p>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 glass-panel rounded-2xl border border-white/5 p-8 text-center max-w-md mx-auto w-full my-auto">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-6">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-display font-bold mb-2">No Quizzes Yet</h3>
          <p className="text-slate-400 text-sm mb-6">Create your first quiz manual builder or upload a PDF to extract questions automatically with AI.</p>
          <button
            onClick={handleCreateQuiz}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-2.5 px-6 rounded-lg shadow-lg active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-5 h-5" /> Start Building
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map((quiz) => {
            const dateStr = new Date(quiz.created_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });

            return (
              <SpotlightCard 
                key={quiz.id} 
                className="flex flex-col justify-between h-[220px] relative overflow-hidden"
                spotlightColor={quiz.status === 'published' ? 'rgba(34,197,94,0.07)' : 'rgba(139,92,246,0.07)'}
              >
                <div>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      quiz.status === 'published' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : quiz.status === 'ended'
                        ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                        : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                    }`}>
                      {quiz.status}
                    </span>
                    {quiz.party_code && (
                      <span className="font-mono text-xs font-bold bg-white/5 border border-white/10 px-2 py-0.5 rounded text-pink-400 uppercase">
                        Code: {quiz.party_code}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-display font-bold leading-snug line-clamp-2 hover:text-violet-300 transition-colors cursor-pointer" onClick={() => navigate(`/admin/quiz/${quiz.id}`)}>
                    {quiz.title}
                  </h3>
                </div>

                <div className="border-t border-white/5 pt-4 mt-4 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{dateStr}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/admin/quiz/${quiz.id}`)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors cursor-pointer"
                      title="Edit Quiz"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    {quiz.status === 'published' && quiz.party_code && (
                      <button
                        onClick={() => navigate(`/admin/lobby/${quiz.party_code}`)}
                        className="py-1.5 px-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" /> Play Lobby
                      </button>
                    )}
                  </div>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
