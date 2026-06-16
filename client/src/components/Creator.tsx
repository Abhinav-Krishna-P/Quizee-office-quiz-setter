import React, { useState, useEffect } from 'react';
import { Plus, Trash, Save, Play, ArrowLeft, Clock, Layers } from 'lucide-react';
import { socket } from '../socket';

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswerIndex: number;
  timeLimit: number;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  theme: 'pitch' | 'gold' | 'neon' | 'sunset';
  questions: Question[];
}

interface CreatorProps {
  onBackToHome: () => void;
  onLaunchQuiz: (pin: string) => void;
}

const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000' 
  : window.location.origin;

export const Creator: React.FC<CreatorProps> = ({ onBackToHome, onLaunchQuiz }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Fetch quizzes on mount
  useEffect(() => {
    fetchQuizzes();

    socket.connect();
    socket.on('room-created', (data: { pin: string }) => {
      onLaunchQuiz(data.pin);
    });

    return () => {
      socket.off('room-created');
    };
  }, [onLaunchQuiz]);

  const fetchQuizzes = async () => {
    try {
      const res = await fetch(`${API_URL}/api/quizzes`);
      const data = await res.json();
      setQuizzes(data);
    } catch (err) {
      console.error('Error fetching quizzes:', err);
      setMessage({ text: 'Failed to load quizzes from server.', type: 'error' });
    }
  };

  const handleCreateNewQuiz = () => {
    const newQuiz: Quiz = {
      id: 'quiz-' + Date.now(),
      title: 'New FIFA Quiz',
      description: 'FIFA 2026 World Cup trivia questions!',
      theme: 'pitch',
      questions: [
        {
          id: 'q-' + Date.now() + '-0',
          text: 'Who won the last FIFA World Cup?',
          options: ['France', 'Argentina', 'Croatia', 'Morocco'],
          correctAnswerIndex: 1,
          timeLimit: 20
        }
      ]
    };
    setSelectedQuiz(newQuiz);
    setActiveQuestionIdx(0);
  };

  const handleAddQuestion = () => {
    if (!selectedQuiz) return;
    const newQuestion: Question = {
      id: 'q-' + Date.now() + '-' + selectedQuiz.questions.length,
      text: 'New FIFA Trivia Question',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswerIndex: 0,
      timeLimit: 20
    };
    const updated = {
      ...selectedQuiz,
      questions: [...selectedQuiz.questions, newQuestion]
    };
    setSelectedQuiz(updated);
    setActiveQuestionIdx(updated.questions.length - 1);
  };

  const handleDeleteQuestion = (indexToDelete: number) => {
    if (!selectedQuiz) return;
    if (selectedQuiz.questions.length <= 1) {
      alert('A quiz must have at least one question!');
      return;
    }
    const filtered = selectedQuiz.questions.filter((_, idx) => idx !== indexToDelete);
    setSelectedQuiz({
      ...selectedQuiz,
      questions: filtered
    });
    // Adjust active index
    if (activeQuestionIdx >= filtered.length) {
      setActiveQuestionIdx(filtered.length - 1);
    }
  };

  const handleQuestionChange = (field: keyof Question, value: any) => {
    if (!selectedQuiz) return;
    const questionsCopy = [...selectedQuiz.questions];
    questionsCopy[activeQuestionIdx] = {
      ...questionsCopy[activeQuestionIdx],
      [field]: value
    };
    setSelectedQuiz({
      ...selectedQuiz,
      questions: questionsCopy
    });
  };

  const handleOptionChange = (optionIdx: number, value: string) => {
    if (!selectedQuiz) return;
    const questionsCopy = [...selectedQuiz.questions];
    const optionsCopy = [...questionsCopy[activeQuestionIdx].options];
    optionsCopy[optionIdx] = value;
    questionsCopy[activeQuestionIdx] = {
      ...questionsCopy[activeQuestionIdx],
      options: optionsCopy
    };
    setSelectedQuiz({
      ...selectedQuiz,
      questions: questionsCopy
    });
  };

  const handleSaveQuiz = async () => {
    if (!selectedQuiz) return;
    if (!selectedQuiz.title.trim()) {
      alert('Quiz title is required');
      return;
    }
    
    // Validate all questions have content
    const invalidQuestion = selectedQuiz.questions.some(q => !q.text.trim() || q.options.some(opt => !opt.trim()));
    if (invalidQuestion) {
      alert('All questions and options must have text filled out!');
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const res = await fetch(`${API_URL}/api/quizzes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(selectedQuiz)
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: 'Quiz saved successfully!', type: 'success' });
        fetchQuizzes();
        // Clear selection after a short delay or stay editing
      } else {
        setMessage({ text: 'Failed to save quiz.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Error contacting backend server.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleHostQuiz = (quizId: string) => {
    socket.emit('admin-create-room', { quizId });
  };

  return (
    <div className="theme-container theme-pitch min-h-screen text-gray-100 flex flex-col">
      {/* Header bar */}
      <header className="bg-slate-900/80 border-b border-white/10 px-6 py-4 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={onBackToHome} className="btn-secondary py-2 px-3 text-sm flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> HOME
          </button>
          <h1 className="text-xl font-bold font-serif text-gold tracking-wide">
            🏆 FIFA QUIZ CREATOR HUB
          </h1>
        </div>

        {selectedQuiz && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleHostQuiz(selectedQuiz.id)}
              className="btn-primary py-2 px-4 text-sm flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" /> HOST LIVE
            </button>
            <button
              onClick={handleSaveQuiz}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-all"
              disabled={loading}
            >
              <Save className="w-4 h-4" /> {loading ? 'SAVING...' : 'SAVE QUIZ'}
            </button>
            <button
              onClick={() => setSelectedQuiz(null)}
              className="btn-secondary py-2 px-4 text-sm"
            >
              EXIT EDITOR
            </button>
          </div>
        )}
      </header>

      {message.text && (
        <div className={`p-3 text-center text-sm font-semibold ${message.type === 'success' ? 'bg-emerald-500/20 text-emerald-200 border-b border-emerald-500/40' : 'bg-red-500/20 text-red-200 border-b border-red-500/40'}`}>
          {message.text}
        </div>
      )}

      {/* Main Area */}
      {!selectedQuiz ? (
        <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold font-serif text-white uppercase tracking-wider">Your FIFA Quizzes</h2>
              <p className="text-gray-400 text-sm">Select a quiz to host live or edit it.</p>
            </div>
            <button onClick={handleCreateNewQuiz} className="btn-primary">
              <Plus className="w-5 h-5" /> CREATE NEW QUIZ
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="glass-panel p-6 flex flex-col justify-between hover:border-yellow-500/50 transition-all group">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-white group-hover:text-yellow-500 transition-colors uppercase font-serif">
                      {quiz.title}
                    </h3>
                    <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-full bg-slate-800 text-yellow-500 border border-yellow-500/20">
                      {quiz.theme} Theme
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2">{quiz.description}</p>
                  <p className="text-xs text-gray-500 font-semibold mb-4">
                    {quiz.questions.length} Questions | Max time per question: {Math.max(...quiz.questions.map(q => q.timeLimit))}s
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleHostQuiz(quiz.id)}
                    className="btn-primary flex-1 justify-center py-2 text-sm"
                  >
                    <Play className="w-4 h-4 fill-current" /> HOST ROOM
                  </button>
                  <button
                    onClick={() => {
                      setSelectedQuiz(quiz);
                      setActiveQuestionIdx(0);
                    }}
                    className="btn-secondary flex-1 justify-center py-2 text-sm"
                  >
                    EDIT
                  </button>
                </div>
              </div>
            ))}

            {quizzes.length === 0 && (
              <div className="col-span-full glass-panel p-12 text-center text-gray-400">
                <Layers className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                <p className="text-lg font-semibold">No quizzes found.</p>
                <p className="text-sm text-gray-500 mb-6">Create your first quiz to challenge participants!</p>
                <button onClick={handleCreateNewQuiz} className="btn-primary">
                  <Plus className="w-4 h-4" /> Create First Quiz
                </button>
              </div>
            )}
          </div>
        </main>
      ) : (
        /* Quiz Editor UI */
        <main className="flex-1 creator-container">
          {/* Questions Sidebar list */}
          <aside className="bg-slate-900/50 border-r border-white/10 p-4 flex flex-col gap-3 overflow-y-auto">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Quiz Config</h3>
            <div className="space-y-3 mb-6 bg-slate-950/40 p-3 rounded-lg border border-white/5">
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1">QUIZ TITLE</label>
                <input
                  type="text"
                  value={selectedQuiz.title}
                  onChange={(e) => setSelectedQuiz({ ...selectedQuiz, title: e.target.value })}
                  className="input-field py-2 px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1">THEME BACKDROP</label>
                <select
                  value={selectedQuiz.theme}
                  onChange={(e) => setSelectedQuiz({ ...selectedQuiz, theme: e.target.value as any })}
                  className="input-field py-2 px-3 text-sm bg-slate-900"
                >
                  <option value="pitch">Grass Soccer Pitch</option>
                  <option value="gold">Golden Trophy</option>
                  <option value="neon">Neon Night Stadium</option>
                  <option value="sunset">Qatar Sunset</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Questions</h3>
              <button
                onClick={handleAddQuestion}
                className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 p-1 rounded-md transition-colors"
                title="Add Question"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 flex-1">
              {selectedQuiz.questions.map((q, idx) => (
                <div
                  key={q.id}
                  onClick={() => setActiveQuestionIdx(idx)}
                  className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between group transition-all ${activeQuestionIdx === idx ? 'bg-yellow-500/15 border-yellow-500/60' : 'bg-slate-950/20 border-white/5 hover:bg-slate-800/40'}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-yellow-500 font-bold">Question {idx + 1}</p>
                    <p className="text-sm font-semibold truncate text-white">{q.text || '(Empty question)'}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteQuestion(idx);
                    }}
                    className="text-gray-500 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete Question"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </aside>

          {/* Active Question Editor Area */}
          <section className="p-6 overflow-y-auto space-y-6 max-w-3xl mx-auto w-full">
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-lg font-bold font-serif text-yellow-500 uppercase tracking-wide">
                Editing Question {activeQuestionIdx + 1}
              </h3>
              
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1 uppercase">Question Text</label>
                <input
                  type="text"
                  value={selectedQuiz.questions[activeQuestionIdx].text}
                  onChange={(e) => handleQuestionChange('text', e.target.value)}
                  className="input-field text-lg font-bold"
                  placeholder="Enter the FIFA trivia question..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1 uppercase flex items-center gap-1">
                    <Clock className="w-4 h-4" /> Time Limit (seconds)
                  </label>
                  <select
                    value={selectedQuiz.questions[activeQuestionIdx].timeLimit}
                    onChange={(e) => handleQuestionChange('timeLimit', Number(e.target.value))}
                    className="input-field py-3 bg-slate-900"
                  >
                    <option value="5">5 seconds</option>
                    <option value="10">10 seconds</option>
                    <option value="15">15 seconds</option>
                    <option value="20">20 seconds</option>
                    <option value="30">30 seconds</option>
                    <option value="60">60 seconds</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Options Panel */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Answer Options & Correct Selection</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 0 - Red */}
                <div className="p-4 rounded-xl border border-red-500/20 bg-red-950/10 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-400 uppercase">Option 1 (Red / Triangle)</span>
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="correct-answer"
                        checked={selectedQuiz.questions[activeQuestionIdx].correctAnswerIndex === 0}
                        onChange={() => handleQuestionChange('correctAnswerIndex', 0)}
                        className="accent-red-500"
                      />
                      Correct Answer
                    </label>
                  </div>
                  <input
                    type="text"
                    value={selectedQuiz.questions[activeQuestionIdx].options[0]}
                    onChange={(e) => handleOptionChange(0, e.target.value)}
                    className="input-field border-red-500/20 focus:border-red-500 py-2.5"
                    placeholder="Enter choice option..."
                  />
                </div>

                {/* Option 1 - Blue */}
                <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-950/10 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-400 uppercase">Option 2 (Blue / Diamond)</span>
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="correct-answer"
                        checked={selectedQuiz.questions[activeQuestionIdx].correctAnswerIndex === 1}
                        onChange={() => handleQuestionChange('correctAnswerIndex', 1)}
                        className="accent-blue-500"
                      />
                      Correct Answer
                    </label>
                  </div>
                  <input
                    type="text"
                    value={selectedQuiz.questions[activeQuestionIdx].options[1]}
                    onChange={(e) => handleOptionChange(1, e.target.value)}
                    className="input-field border-blue-500/20 focus:border-blue-500 py-2.5"
                    placeholder="Enter choice option..."
                  />
                </div>

                {/* Option 2 - Yellow */}
                <div className="p-4 rounded-xl border border-yellow-500/20 bg-yellow-950/10 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-yellow-400 uppercase">Option 3 (Yellow / Circle)</span>
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="correct-answer"
                        checked={selectedQuiz.questions[activeQuestionIdx].correctAnswerIndex === 2}
                        onChange={() => handleQuestionChange('correctAnswerIndex', 2)}
                        className="accent-yellow-500"
                      />
                      Correct Answer
                    </label>
                  </div>
                  <input
                    type="text"
                    value={selectedQuiz.questions[activeQuestionIdx].options[2]}
                    onChange={(e) => handleOptionChange(2, e.target.value)}
                    className="input-field border-yellow-500/20 focus:border-yellow-500 py-2.5"
                    placeholder="Enter choice option..."
                  />
                </div>

                {/* Option 3 - Green */}
                <div className="p-4 rounded-xl border border-green-500/20 bg-green-950/10 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-green-400 uppercase">Option 4 (Green / Square)</span>
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="correct-answer"
                        checked={selectedQuiz.questions[activeQuestionIdx].correctAnswerIndex === 3}
                        onChange={() => handleQuestionChange('correctAnswerIndex', 3)}
                        className="accent-green-500"
                      />
                      Correct Answer
                    </label>
                  </div>
                  <input
                    type="text"
                    value={selectedQuiz.questions[activeQuestionIdx].options[3]}
                    onChange={(e) => handleOptionChange(3, e.target.value)}
                    className="input-field border-green-500/20 focus:border-green-500 py-2.5"
                    placeholder="Enter choice option..."
                  />
                </div>
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  );
};
