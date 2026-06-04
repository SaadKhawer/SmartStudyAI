/**
 * SocketContext
 * Global Socket.IO connection for real-time features
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const SOCKET_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    newSocket.on('connect', () => {
      setConnected(true);
      console.log('⚡ Socket connected');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('🔌 Socket disconnected');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user]);

  const joinGroup = (groupId) => {
    if (socket) socket.emit('join-group', groupId);
  };

  const leaveGroup = (groupId) => {
    if (socket) socket.emit('leave-group', groupId);
  };

  const emitBattleStart = (data) => {
    if (socket) socket.emit('battle-start', data);
  };

  const emitBattleJoin = (data) => {
    if (socket) socket.emit('battle-join', data);
  };

  const emitBattleAnswer = (data) => {
    if (socket) socket.emit('battle-answer', data);
  };

  const emitBattleComplete = (data) => {
    if (socket) socket.emit('battle-complete', data);
  };

  const emitXPEarned = (data) => {
    if (socket) socket.emit('xp-earned', data);
  };

  return (
    <SocketContext.Provider value={{
      socket, connected, joinGroup, leaveGroup,
      emitBattleStart, emitBattleJoin, emitBattleAnswer,
      emitBattleComplete, emitXPEarned
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
};
