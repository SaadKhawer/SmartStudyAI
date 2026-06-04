/**
 * AuthContext
 * Global authentication state using React Context
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken]     = useState(localStorage.getItem('studyai_token'));

  // Restore session on app load
  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = localStorage.getItem('studyai_token');
      if (!savedToken) { setLoading(false); return; }
      try {
        const { data } = await authAPI.getProfile();
        setUser(data.user);
      } catch {
        localStorage.removeItem('studyai_token');
        localStorage.removeItem('studyai_user');
        setToken(null);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    localStorage.setItem('studyai_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const signup = useCallback(async (name, email, password) => {
    const { data } = await authAPI.signup({ name, email, password });
    localStorage.setItem('studyai_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('studyai_token');
    localStorage.removeItem('studyai_user');
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
