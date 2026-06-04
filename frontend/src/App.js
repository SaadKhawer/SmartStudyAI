/**
 * App.js
 * Root component: routing, providers, protected routes
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SocketProvider } from './contexts/SocketContext';

import LoginPage    from './pages/LoginPage';
import SignupPage   from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import ChatPage     from './pages/ChatPage';
import DocumentsPage from './pages/DocumentsPage';
import SettingsPage from './pages/SettingsPage';
import QuizPage      from './pages/QuizPage';
import RemindersPage from './pages/RemindersPage';
import ExamPage from './pages/ExamPage';
import StudyPlannerPage from './pages/StudyPlannerPage';
import WeaknessPage from './pages/WeaknessPage';
import GamificationPage from './pages/GamificationPage';
import StudyGroupPage from './pages/StudyGroupPage';
import VoiceLearningPage from './pages/VoiceLearningPage';

import './styles/globals.css';

// ─── Protected Route Wrapper ──────────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading"><div className="spinner" /></div>;
  return user ? children : <Navigate to="/login" replace />;
};

// ─── Public Route (redirect if logged in) ────────────────────────────────────
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading"><div className="spinner" /></div>;
  return !user ? children : <Navigate to="/dashboard" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login"  element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/chat"      element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
      <Route path="/chat/:id"  element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
      <Route path="/settings"  element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/quiz"      element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
      <Route path="/reminders" element={<ProtectedRoute><RemindersPage /></ProtectedRoute>} />
      <Route path="/exam" element={<ProtectedRoute><ExamPage /></ProtectedRoute>} />
      <Route path="/study-planner" element={<ProtectedRoute><StudyPlannerPage /></ProtectedRoute>} />
      <Route path="/weakness" element={<ProtectedRoute><WeaknessPage /></ProtectedRoute>} />
      <Route path="/achievements" element={<ProtectedRoute><GamificationPage /></ProtectedRoute>} />
      <Route path="/groups" element={<ProtectedRoute><StudyGroupPage /></ProtectedRoute>} />
      <Route path="/voice" element={<ProtectedRoute><VoiceLearningPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <AppRoutes />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  fontSize: '14px'
                }
              }}
            />
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
