/**
 * StudyGroup Model
 * Collaborative study groups with quiz battles, challenges, and discussions
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const memberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['admin', 'member'], default: 'member' },
  joinedAt: { type: Date, default: Date.now },
  xpInGroup: { type: Number, default: 0 }
}, { _id: false });

const quizBattleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  topic: { type: String, required: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  questions: [{
    question: String,
    options: [String],
    correct: String,
    explanation: String
  }],
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    score: { type: Number, default: 0 },
    answers: { type: Map, of: String },
    completedAt: Date
  }],
  status: { type: String, enum: ['waiting', 'active', 'completed'], default: 'waiting' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  startedAt: Date,
  endedAt: Date,
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: true, timestamps: true });

const challengeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  type: { type: String, enum: ['study_hours', 'quiz_score', 'streak', 'topic_mastery'], default: 'quiz_score' },
  topic: { type: String },
  target: { type: Number, required: true },          // target value to reach
  deadline: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    progress: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    completedAt: Date
  }],
  status: { type: String, enum: ['active', 'completed', 'expired'], default: 'active' },
  xpReward: { type: Number, default: 50 }
}, { _id: true, timestamps: true });

const studyGroupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 50 },
  description: { type: String, maxlength: 200 },
  code: { type: String, unique: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [memberSchema],
  topics: [{ type: String }],
  maxMembers: { type: Number, default: 20 },
  
  quizBattles: [quizBattleSchema],
  challenges: [challengeSchema],
  discussionQuestions: [{
    question: String,
    topic: String,
    generatedAt: { type: Date, default: Date.now }
  }],
  
  sharedGoals: [{
    title: String,
    description: String,
    target: Number,
    progress: { type: Number, default: 0 },
    deadline: Date,
    completed: { type: Boolean, default: false }
  }],
  
  isActive: { type: Boolean, default: true },
  lastActivity: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// code index already created by unique: true
studyGroupSchema.index({ 'members.user': 1 });

// Generate unique join code before save
studyGroupSchema.pre('save', function(next) {
  if (!this.code) {
    this.code = crypto.randomBytes(3).toString('hex').toUpperCase();
  }
  next();
});

module.exports = mongoose.model('StudyGroup', studyGroupSchema);
