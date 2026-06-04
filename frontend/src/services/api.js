/**
 * API Service
 * Centralized Axios instance with auth interceptors
 */

import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ─── Axios Instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// ─── Request Interceptor: Attach JWT ─────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('studyai_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor: Handle Auth Errors ────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('studyai_token');
      localStorage.removeItem('studyai_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

// ─── Chat API ─────────────────────────────────────────────────────────────────
export const chatAPI = {
  sendMessage: (data) => api.post('/chat/message', data),
  getSessions: () => api.get('/chat/sessions'),
  getSession: (id) => api.get(`/chat/sessions/${id}`),
  createSession: (data) => api.post('/chat/sessions', data),
  deleteSession: (id) => api.delete(`/chat/sessions/${id}`),
};

// ─── Document API ─────────────────────────────────────────────────────────────
export const documentAPI = {
  upload: (formData, onProgress) =>
    api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress) onProgress(Math.round((e.loaded * 100) / e.total));
      }
    }),
  getAll: () => api.get('/documents'),
  getOne: (id) => api.get(`/documents/${id}`),
  delete: (id) => api.delete(`/documents/${id}`),
};

// ─── Dashboard API ────────────────────────────────────────────────────────────
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getRecommendations: () => api.get('/dashboard/recommendations'),
};

// ─── Study Plan API ───────────────────────────────────────────────────────────
export const studyPlanAPI = {
  generate: (data) => api.post('/study-plan/generate', data),
  getCurrent: () => api.get('/study-plan/current'),
  updateProgress: (data) => api.put('/study-plan/progress', data),
  adjust: () => api.post('/study-plan/adjust'),
};

// ─── Weakness API ─────────────────────────────────────────────────────────────
export const weaknessAPI = {
  getAnalysis: () => api.get('/weakness/analysis'),
  getStrategies: () => api.get('/weakness/strategies'),
  recordResult: (data) => api.post('/weakness/record', data),
};

// ─── Gamification API ─────────────────────────────────────────────────────────
export const gamificationAPI = {
  getProfile: () => api.get('/gamification/profile'),
  awardXP: (data) => api.post('/gamification/award-xp', data),
  getLeaderboard: () => api.get('/gamification/leaderboard'),
  getBadges: () => api.get('/gamification/badges'),
};

// ─── Study Group API ──────────────────────────────────────────────────────────
export const studyGroupAPI = {
  create: (data) => api.post('/groups/create', data),
  join: (data) => api.post('/groups/join', data),
  getMyGroups: () => api.get('/groups/my-groups'),
  getDetail: (id) => api.get(`/groups/${id}`),
  startBattle: (id, data) => api.post(`/groups/${id}/quiz-battle`, data),
  submitBattleAnswer: (id, data) => api.post(`/groups/${id}/battle-answer`, data),
  createChallenge: (id, data) => api.post(`/groups/${id}/challenge`, data),
  getDiscussion: (id) => api.get(`/groups/${id}/discussion`),
  leave: (id) => api.post(`/groups/${id}/leave`),
};

// ─── Voice API ────────────────────────────────────────────────────────────────
export const voiceAPI = {
  ask: (data) => api.post('/voice/ask', data),
  followUp: (data) => api.post('/voice/follow-up', data),
  endSession: (data) => api.post('/voice/end', data),
};

export default api;
