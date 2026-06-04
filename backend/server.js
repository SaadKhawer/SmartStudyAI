require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');
const { Server: SocketIO } = require('socket.io');
const logger = require('./utils/logger');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const documentRoutes = require('./routes/documents');
const dashboardRoutes = require('./routes/dashboard');
const visionRoutes = require('./routes/vision');
const examRoutes = require('./routes/exam');
const quizRoutes = require('./routes/quiz');
const reminderRoutes = require('./routes/reminders');
const studyPlanRoutes = require('./routes/studyPlan');
const weaknessRoutes = require('./routes/weakness');
const gamificationRoutes = require('./routes/gamification');
const studyGroupRoutes = require('./routes/studyGroup');
const voiceRoutes = require('./routes/voice');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// ─── Socket.IO Setup ───────────────────────────────────────────────────────────
const io = new SocketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`⚡ Socket connected: ${socket.id}`);

  // Join a study group room
  socket.on('join-group', (groupId) => {
    socket.join(`group-${groupId}`);
    logger.info(`Socket ${socket.id} joined group-${groupId}`);
  });

  // Leave a study group room
  socket.on('leave-group', (groupId) => {
    socket.leave(`group-${groupId}`);
  });

  // Quiz battle events
  socket.on('battle-start', (data) => {
    io.to(`group-${data.groupId}`).emit('battle-started', {
      battleId: data.battleId,
      topic: data.topic,
      startedBy: data.userName
    });
  });

  socket.on('battle-join', (data) => {
    io.to(`group-${data.groupId}`).emit('battle-player-joined', {
      battleId: data.battleId,
      userName: data.userName
    });
  });

  socket.on('battle-answer', (data) => {
    io.to(`group-${data.groupId}`).emit('battle-progress', {
      battleId: data.battleId,
      userName: data.userName,
      questionsAnswered: data.questionsAnswered
    });
  });

  socket.on('battle-complete', (data) => {
    io.to(`group-${data.groupId}`).emit('battle-score-update', {
      battleId: data.battleId,
      userName: data.userName,
      score: data.score,
      total: data.total
    });
  });

  // Challenge progress update
  socket.on('challenge-progress', (data) => {
    io.to(`group-${data.groupId}`).emit('challenge-updated', {
      challengeId: data.challengeId,
      userName: data.userName,
      progress: data.progress
    });
  });

  // XP notification
  socket.on('xp-earned', (data) => {
    socket.broadcast.emit('user-xp-update', {
      userName: data.userName,
      xp: data.xp,
      level: data.level
    });
  });

  socket.on('disconnect', () => {
    logger.info(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// Make io accessible to routes
app.set('io', io);

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests. Please try again later.' }
});
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'AI rate limit exceeded. Please wait a moment.' }
});

app.use('/api/', limiter);
app.use('/api/chat', aiLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chat', visionRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/study-plan', studyPlanRoutes);
app.use('/api/weakness', weaknessRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/groups', studyGroupRoutes);
app.use('/api/voice', voiceRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('✅ MongoDB connected successfully');

    server.on('error', async (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.info(`⚠️ Port ${PORT} is busy. Killing old process...`);
        try {
          const { execSync } = require('child_process');
          // Find and kill the process using the port
          const result = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf8' });
          const lines = result.trim().split('\n');
          const pids = new Set();
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0' && pid !== String(process.pid)) pids.add(pid);
          }
          for (const pid of pids) {
            try { execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf8' }); } catch {}
          }
          logger.info('✅ Old process killed. Retrying in 2 seconds...');
          setTimeout(() => {
            server.listen(PORT, () => {
              logger.info(`🚀 StudyAI server running on port ${PORT}`);
              logger.info(`⚡ Socket.IO enabled`);
            });
          }, 2000);
        } catch (killErr) {
          logger.error(`❌ Could not free port ${PORT}. Stop the other process manually.`);
          process.exit(1);
        }
      } else {
        logger.error(`❌ Server error: ${err.message}`);
        process.exit(1);
      }
    });

    server.listen(PORT, () => {
      logger.info(`🚀 StudyAI server running on port ${PORT}`);
      logger.info(`⚡ Socket.IO enabled`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error(`❌ Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

startServer();

module.exports = app;