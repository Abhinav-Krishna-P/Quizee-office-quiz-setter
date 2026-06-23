import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SpotlightCard } from '../../components/animations.jsx';
import { ArrowLeft, Save, Trash2, ArrowUp, ArrowDown, Plus, Sparkles, Upload, Loader2, Play, Users } from 'lucide-react';
import { API_BASE_URL } from '../../config.js';

export default function QuizSettings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('adminToken');

  // Quiz state
  const [title, setTitle] = useState('');
  const [settings, setSettings] = useState({
    timerDefault: 15,
    teamMode: false,
    numTeams: 2,
    teamNames: ['Team Red', 'Team Blue'],
    randomizeOrder: false,
    randomizeOptions: false,
    maxParticipants: 50
  });
  const [questions, setQuestions] = useState([]);

  // Editor states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeSession, setActiveSession] = useState(null); // { partyCode, status }

  // AI Import state
  const [pdfFile, setPdfFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedQuestions, setExtractedQuestions] = useState([]);
  const [showAiModal, setShowAiModal] = useState(false);

  // New question form state
  const [newQText, setNewQText] = useState('');
  const [newQOptions, setNewQOptions] = useState(['', '', '', '']);
  const [newQCorrect, setNewQCorrect] = useState(0);
  const [newQTimer, setNewQTimer] = useState(15);

  // Fetch quiz details
  useEffect(() => {
    if (id) {
      fetchQuizDetails();
    }
  }, [id]);

  const fetchQuizDetails = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/quizzes/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 404) throw new Error('Quiz not found');
        throw new Error('Failed to fetch quiz');
      }
      const data = await res.json();
      setTitle(data.title);
      setSettings(data.settings || {});
      setQuestions(data.questions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Save changes to backend
  const handleSave = async (e, shouldPublish = false) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_BASE_URL}/quizzes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          settings,
          questions
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save quiz');
      }

      setSuccess('Quiz saved successfully!');

      if (shouldPublish) {
        // Publish and launch lobby
        const pubRes = await fetch(`${API_BASE_URL}/quizzes/${id}/publish`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const pubData = await pubRes.json();
        if (!pubRes.ok) {
          if (pubRes.status === 409 || pubData.error === 'ActiveSessionExists') {
            setActiveSession({
              partyCode: pubData.partyCode,
              status: pubData.status
            });
            setSaving(false);
            return;
          }
          throw new Error(pubData.error || 'Failed to publish quiz');
        }
        navigate(`/admin/lobby/${pubData.partyCode}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAbortAndPublish = async () => {
    setSaving(true);
    setError('');
    setActiveSession(null);

    try {
      const pubRes = await fetch(`${API_BASE_URL}/quizzes/${id}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ abortActive: true })
      });
      const pubData = await pubRes.json();
      if (!pubRes.ok) {
        throw new Error(pubData.error || 'Failed to publish quiz');
      }
      navigate(`/admin/lobby/${pubData.partyCode}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleContinueSession = () => {
    if (!activeSession) return;
    if (activeSession.status === 'live') {
      navigate(`/admin/host/${activeSession.partyCode.toUpperCase()}`);
    } else {
      navigate(`/admin/lobby/${activeSession.partyCode.toUpperCase()}`);
    }
    setActiveSession(null);
  };

  // Add a new question manually
  const handleAddQuestion = () => {
    if (!newQText.trim()) {
      setError('Question text cannot be empty');
      return;
    }
    if (newQOptions.some(opt => !opt.trim())) {
      setError('All 4 options must be filled out');
      return;
    }

    if (questions.length >= 30) {
      setError('Quizzes are capped at 30 questions max.');
      return;
    }

    const newQ = {
      text: newQText.trim(),
      options: [...newQOptions],
      correct_index: newQCorrect,
      time_limit: parseInt(newQTimer, 10),
      points: 1000
    };

    setQuestions([...questions, newQ]);

    // Clear form
    setNewQText('');
    setNewQOptions(['', '', '', '']);
    setNewQCorrect(0);
    setNewQTimer(settings.timerDefault);
    setError('');
  };

  // Delete question
  const handleDeleteQuestion = (index) => {
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
  };

  // Move question order
  const handleMoveQuestion = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setQuestions(updated);
  };

  // Handle PDF Upload
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Only PDF documents are supported.');
      return;
    }
    setPdfFile(file);
    setError('');
  };

  // Trigger Gemini extraction
  const handleExtractPdf = async () => {
    if (!pdfFile) return;
    setExtracting(true);
    setError('');

    const formData = new FormData();
    formData.append('pdf', pdfFile);

    try {
      const res = await fetch(`${API_BASE_URL}/quizzes/${id}/extract-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to extract PDF');
      }

      setExtractedQuestions(data.questions || []);
      setShowAiModal(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setExtracting(false);
      setPdfFile(null);
    }
  };

  // Insert AI questions into builder
  const handleAcceptAiQuestions = () => {
    const availableSlots = 30 - questions.length;
    if (availableSlots <= 0) {
      setError('Quiz is already at the maximum capacity (30 questions).');
      setShowAiModal(false);
      return;
    }

    const questionsToAdd = extractedQuestions.slice(0, availableSlots).map(q => ({
      text: q.question || q.text,
      options: q.options,
      correct_index: q.correctIndex !== undefined ? q.correctIndex : q.correct_index,
      time_limit: settings.timerDefault,
      points: 1000
    }));

    setQuestions([...questions, ...questionsToAdd]);
    setExtractedQuestions([]);
    setShowAiModal(false);
    setSuccess(`Added ${questionsToAdd.length} questions from AI extraction!`);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 border-violet-500 animate-spin mb-4" />
        <p className="text-slate-400 text-sm">Loading quiz configuration...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-12 max-w-6xl mx-auto w-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/quizzes')}
            className="p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-2xl font-display font-bold">Quiz Editor</h2>
            <p className="text-slate-400 text-sm">Configure, build questions, and deploy live quiz</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={(e) => handleSave(e, false)}
            disabled={saving}
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold py-2.5 px-4 rounded-lg active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer text-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> Save Draft
          </button>
          <button
            onClick={(e) => handleSave(e, true)}
            disabled={saving || questions.length === 0}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-2.5 px-4 rounded-lg shadow-lg active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer text-sm disabled:opacity-50"
            title={questions.length === 0 ? 'Add questions to play' : ''}
          >
            <Play className="w-4 h-4 fill-current" /> Save & Launch Lobby
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-4 mb-6 font-medium text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg p-4 mb-6 font-medium text-sm">
          {success}
        </div>
      )}

      {/* Editor Body */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Quiz Settings */}
        <div className="space-y-6 lg:col-span-1">
          <SpotlightCard spotlightColor="rgba(139,92,246,0.07)">
            <h3 className="text-lg font-display font-bold mb-4 flex items-center gap-2 pb-3 border-b border-white/5">
              <Users className="w-5 h-5 text-violet-400" /> General Settings
            </h3>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Quiz Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  placeholder="Enter quiz name"
                />
              </div>

              {/* Default Timer */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Default Question Timer (seconds)</label>
                <select
                  value={settings.timerDefault}
                  onChange={(e) => setSettings({ ...settings, timerDefault: parseInt(e.target.value, 10) })}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-slate-100"
                >
                  <option value={10}>10 seconds</option>
                  <option value={15}>15 seconds</option>
                  <option value={20}>20 seconds</option>
                  <option value={30}>30 seconds</option>
                  <option value={60}>60 seconds</option>
                  <option value={90}>90 seconds</option>
                </select>
              </div>

              {/* Team Mode Toggle */}
              <div className="border-t border-white/5 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold uppercase tracking-wider text-slate-300">Team Mode</label>
                  <input
                    type="checkbox"
                    checked={settings.teamMode}
                    onChange={(e) => setSettings({ ...settings, teamMode: e.target.checked })}
                    className="w-5 h-5 rounded accent-violet-600 bg-slate-950 border border-white/10 cursor-pointer"
                  />
                </div>

                {settings.teamMode && (
                  <div className="space-y-3 mt-3 p-3 bg-white/5 rounded-lg border border-white/5">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">Number of Teams</label>
                      <input
                        type="number"
                        min={2}
                        max={6}
                        value={settings.numTeams}
                        onChange={(e) => {
                          const num = Math.min(6, Math.max(2, parseInt(e.target.value, 10) || 2));
                          const teamNames = [...settings.teamNames];
                          while (teamNames.length < num) teamNames.push(`Team ${teamNames.length + 1}`);
                          setSettings({ ...settings, numTeams: num, teamNames: teamNames.slice(0, num) });
                        }}
                        className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-slate-100 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5">Team Names</label>
                      <div className="space-y-2">
                        {settings.teamNames.slice(0, settings.numTeams).map((name, idx) => (
                          <input
                            key={idx}
                            type="text"
                            value={name}
                            onChange={(e) => {
                              const updatedNames = [...settings.teamNames];
                              updatedNames[idx] = e.target.value;
                              setSettings({ ...settings, teamNames: updatedNames });
                            }}
                            className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-100 text-xs"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Max Participants */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Max Players (max 50)</label>
                <input
                  type="number"
                  min={5}
                  max={50}
                  value={settings.maxParticipants}
                  onChange={(e) => setSettings({ ...settings, maxParticipants: Math.min(50, Math.max(5, parseInt(e.target.value, 10) || 50)) })}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
          </SpotlightCard>

          {/* AI Import Box */}
          <SpotlightCard spotlightColor="rgba(236,72,153,0.07)">
            <h3 className="text-lg font-display font-bold mb-3 flex items-center gap-2 pb-3 border-b border-white/5">
              <Sparkles className="w-5 h-5 text-pink-400" /> AI Question Generator
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Upload a document PDF. Gemini AI will analyze its text contents and extract up to 30 multiple-choice trivia questions automatically.
            </p>

            <div className="space-y-3">
              <div className="relative border-2 border-dashed border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col items-center justify-center bg-black/10 transition-colors">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-xs text-slate-400 font-medium">
                  {pdfFile ? pdfFile.name : 'Click or Drag PDF file'}
                </span>
              </div>

              {pdfFile && (
                <button
                  onClick={handleExtractPdf}
                  disabled={extracting}
                  className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold py-2 rounded-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-50"
                >
                  {extracting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Extracting with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 fill-current" /> Extract Questions
                    </>
                  )}
                </button>
              )}
            </div>
          </SpotlightCard>
        </div>

        {/* Right Column: Question Builder */}
        <div className="lg:col-span-2 space-y-6">
          {/* New Question Form */}
          <SpotlightCard>
            <h3 className="text-lg font-display font-bold mb-4 pb-3 border-b border-white/5">
              Add Question Manually
            </h3>

            <div className="space-y-4">
              {/* Question Text */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Question Text</label>
                <input
                  type="text"
                  value={newQText}
                  onChange={(e) => setNewQText(e.target.value)}
                  placeholder="e.g. What does API stand for?"
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Options & Correct Answer selection */}
              <div className="grid md:grid-cols-2 gap-4">
                {newQOptions.map((opt, idx) => {
                  const colors = ['border-red-500/30 focus:ring-red-500', 'border-blue-500/30 focus:ring-blue-500', 'border-yellow-500/30 focus:ring-yellow-500', 'border-emerald-500/30 focus:ring-emerald-500'];
                  const labelColors = ['text-red-400', 'text-blue-400', 'text-yellow-400', 'text-emerald-400'];
                  const labels = ['Red option (▲)', 'Blue option (◆)', 'Yellow option (●)', 'Green option (■)'];

                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className={`text-xs font-bold ${labelColors[idx]}`}>{labels[idx]}</label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                          <input
                            type="radio"
                            name="correctIndex"
                            checked={newQCorrect === idx}
                            onChange={() => setNewQCorrect(idx)}
                            className="accent-violet-500 w-3.5 h-3.5 cursor-pointer"
                          />
                          <span>Correct</span>
                        </label>
                      </div>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const updated = [...newQOptions];
                          updated[idx] = e.target.value;
                          setNewQOptions(updated);
                        }}
                        placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                        className={`w-full bg-slate-950/50 border ${colors[idx]} rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Question Level Timer */}
              <div className="flex items-center gap-4 border-t border-white/5 pt-4">
                <div className="w-1/2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Timer Override (sec)</label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={newQTimer}
                    onChange={(e) => setNewQTimer(parseInt(e.target.value, 10) || settings.timerDefault)}
                    className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  />
                </div>
                <div className="w-1/2 flex items-end">
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-2.5 rounded-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-5 text-sm"
                  >
                    <Plus className="w-4 h-4" /> Add to Quiz
                  </button>
                </div>
              </div>
            </div>
          </SpotlightCard>

          {/* Questions list */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-display font-bold">Questions List ({questions.length} / 30)</h3>
            </div>

            {questions.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-white/10 rounded-xl bg-white/5">
                <p className="text-slate-400 text-sm">No questions added yet. Build manually or upload a PDF above.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <div
                    key={idx}
                    className="glass-panel rounded-xl p-5 border border-white/5 flex gap-4 items-start"
                  >
                    <span className="w-6 h-6 rounded-full bg-white/10 text-slate-200 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="text-slate-100 font-medium mb-3 leading-snug">{q.text || q.question}</p>

                      <div className="grid md:grid-cols-2 gap-2 text-xs text-slate-400">
                        {q.options.map((opt, oIdx) => {
                          const isCorrect = oIdx === q.correct_index;
                          const bgClass = isCorrect
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold'
                            : 'bg-black/20 border border-white/5';
                          return (
                            <div key={oIdx} className={`py-1.5 px-3 rounded-lg truncate ${bgClass}`}>
                              {opt}
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 border-t border-white/5 pt-3">
                        <span>Timer: {q.time_limit || settings.timerDefault}s</span>
                        <span>Points: {q.points || 1000}</span>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => handleMoveQuestion(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveQuestion(idx, 'down')}
                        disabled={idx === questions.length - 1}
                        className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(idx)}
                        className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer mt-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Extraction Review Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 w-full max-w-3xl rounded-2xl overflow-hidden p-6 relative max-h-[85vh] flex flex-col">
            <h3 className="text-2xl font-display font-bold mb-2 flex items-center gap-2 text-pink-400 shrink-0">
              <Sparkles className="w-6 h-6 fill-current" /> AI Extracted Questions
            </h3>
            <p className="text-slate-400 text-sm mb-4 shrink-0">
              Review and modify the quiz questions generated by Gemini from your PDF before adding them to your question pool.
            </p>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-6">
              {extractedQuestions.map((q, idx) => (
                <div key={idx} className="bg-white/5 border border-white/5 p-4 rounded-xl space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="bg-pink-500/10 text-pink-400 font-bold px-2 py-0.5 rounded text-xs mt-0.5">Q{idx + 1}</span>
                    <input
                      type="text"
                      value={q.question || q.text}
                      onChange={(e) => {
                        const updated = [...extractedQuestions];
                        updated[idx].question = e.target.value;
                        setExtractedQuestions(updated);
                      }}
                      className="w-full bg-slate-950/40 border border-white/5 rounded-lg py-1 px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-pink-500"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-2 text-xs">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`aiCorrect-${idx}`}
                          checked={q.correctIndex === oIdx || q.correct_index === oIdx}
                          onChange={() => {
                            const updated = [...extractedQuestions];
                            updated[idx].correctIndex = oIdx;
                            setExtractedQuestions(updated);
                          }}
                          className="accent-pink-500 shrink-0 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const updated = [...extractedQuestions];
                            updated[idx].options[oIdx] = e.target.value;
                            setExtractedQuestions(updated);
                          }}
                          className="w-full bg-slate-950/40 border border-white/5 rounded py-1 px-2 focus:outline-none focus:ring-1 focus:ring-pink-500 text-slate-300"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end shrink-0 border-t border-white/5 pt-4">
              <button
                onClick={() => setShowAiModal(false)}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold py-2 px-4 rounded-lg active:scale-[0.98] transition-all cursor-pointer"
              >
                Discard AI Questions
              </button>
              <button
                onClick={handleAcceptAiQuestions}
                className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold py-2 px-6 rounded-lg shadow-lg active:scale-[0.98] transition-all cursor-pointer"
              >
                Accept and Add to Quiz
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Session Warning Modal */}
      {activeSession && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-2xl overflow-hidden p-6 relative flex flex-col shadow-2xl">
            <h3 className="text-xl font-display font-bold mb-3 flex items-center gap-2 text-violet-400">
              <Users className="w-6 h-6 text-violet-400" /> Active Session Exists
            </h3>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              There is already an active session (Party Code: <span className="font-mono font-bold text-white select-all">{activeSession.partyCode}</span>) in progress for this quiz.
              <br /><br />
              Would you like to continue the existing session or abort it to start a new one?
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleContinueSession}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-2.5 px-4 rounded-lg shadow-lg active:scale-[0.98] transition-all cursor-pointer text-center"
              >
                Continue Existing Session
              </button>
              <button
                onClick={handleAbortAndPublish}
                className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-500/20 text-red-400 font-bold py-2.5 px-4 rounded-lg active:scale-[0.98] transition-all cursor-pointer text-center"
              >
                Abort &amp; Start New Session
              </button>
              <button
                onClick={() => setActiveSession(null)}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold py-2.5 px-4 rounded-lg active:scale-[0.98] transition-all cursor-pointer text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
