import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Join from './pages/participant/Join.jsx';
import Lobby from './pages/participant/Lobby.jsx';
import LiveQuiz from './pages/participant/LiveQuiz.jsx';
import FinalResults from './pages/participant/FinalResults.jsx';

import Login from './pages/admin/Login.jsx';
import MyQuizzes from './pages/admin/MyQuizzes.jsx';
import QuizSettings from './pages/admin/QuizSettings.jsx';
import HostLobby from './pages/admin/HostLobby.jsx';
import HostLiveControl from './pages/admin/HostLiveControl.jsx';

// Simple Route Guard for Admin Panel
function AdminRoute({ children }) {
  const token = localStorage.getItem('adminToken');
  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}

function App() {
  return (
    <Router>
      <div className="min-h-screen text-slate-100 flex flex-col">
        {/* Navigation Header */}
        <header className="py-4 px-6 border-b border-white/5 bg-black/20 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-fuchsia-500 flex items-center justify-center font-bold text-lg text-white shadow-lg">
              Q
            </div>
            <span className="font-display font-bold text-xl tracking-wide bg-gradient-to-r from-violet-400 to-fuchsia-300 bg-clip-text text-transparent">
              Office Quiz Arena
            </span>
          </div>
          <div className="text-xs text-white/40 font-mono">v1.0.0</div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col">
          <Routes>
            {/* Participant Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/join" element={<Join />} />
            <Route path="/join/:code" element={<Join />} />
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/play" element={<LiveQuiz />} />
            <Route path="/podium" element={<FinalResults />} />

            {/* Admin Routes */}
            <Route path="/admin/login" element={<Login />} />
            <Route 
              path="/admin/quizzes" 
              element={
                <AdminRoute>
                  <MyQuizzes />
                </AdminRoute>
              } 
            />
            <Route 
              path="/admin/quiz/new" 
              element={
                <AdminRoute>
                  <QuizSettings />
                </AdminRoute>
              } 
            />
            <Route 
              path="/admin/quiz/:id" 
              element={
                <AdminRoute>
                  <QuizSettings />
                </AdminRoute>
              } 
            />
            <Route 
              path="/admin/lobby/:code" 
              element={
                <AdminRoute>
                  <HostLobby />
                </AdminRoute>
              } 
            />
            <Route 
              path="/admin/host/:code" 
              element={
                <AdminRoute>
                  <HostLiveControl />
                </AdminRoute>
              } 
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
