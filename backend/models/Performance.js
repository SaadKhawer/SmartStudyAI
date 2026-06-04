/**
 * Performance Model
 * Tracks quiz/exam results and topic-wise performance for weakness analysis
 */

const mongoose = require('mongoose');

const quizResultSchema = new mongoose.Schema({
  topic: { type: String, required: true },
  score: { type: Number, required: true },
  total: { type: Number, required: true },
  percentage: { type: Number, required: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  date: { type: Date, default: Date.now },
  questionsData: [{
    question: String,
    correct: Boolean,
    topic: String
  }]
}, { _id: true });

const examResultSchema = new mongoose.Schema({
  topic: { type: String, required: true },
  score: { type: Number, required: true },
  grade: { type: String },
  totalQuestions: { type: Number },
  feedback: { type: String },
  strengths: [String],
  weaknesses: [String],
  date: { type: Date, default: Date.now }
}, { _id: true });

const topicScoreSchema = new mongoose.Schema({
  topic: { type: String, required: true },
  totalAttempts: { type: Number, default: 0 },
  totalCorrect: { type: Number, default: 0 },
  avgScore: { type: Number, default: 0 },
  scores: [{ value: Number, date: Date }],       // last 10 scores for trend
  trend: { type: String, enum: ['improving', 'declining', 'stable'], default: 'stable' },
  lastAttempted: { type: Date },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' }
}, { _id: true });

const performanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  quizResults: [quizResultSchema],
  examResults: [examResultSchema],
  topicScores: [topicScoreSchema],
  weakAreas: [{
    topic: String,
    avgScore: Number,
    trend: String,
    urgency: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    lastAttempted: Date
  }],
  strongAreas: [{
    topic: String,
    avgScore: Number,
    trend: String,
    lastAttempted: Date
  }],
  overallAccuracy: { type: Number, default: 0 },
  totalQuizzes: { type: Number, default: 0 },
  totalExams: { type: Number, default: 0 },
  lastAnalyzed: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Index already created by unique: true on user field

// Method to recalculate weak/strong areas
performanceSchema.methods.recalculateAreas = function() {
  this.weakAreas = [];
  this.strongAreas = [];

  for (const ts of this.topicScores) {
    if (ts.totalAttempts < 1) continue;
    
    const entry = {
      topic: ts.topic,
      avgScore: ts.avgScore,
      trend: ts.trend,
      lastAttempted: ts.lastAttempted
    };

    if (ts.avgScore < 60) {
      entry.urgency = ts.avgScore < 40 ? 'critical' : ts.trend === 'declining' ? 'high' : 'medium';
      this.weakAreas.push(entry);
    } else if (ts.avgScore >= 80) {
      this.strongAreas.push(entry);
    }
  }

  // Sort weak areas by urgency
  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  this.weakAreas.sort((a, b) => (urgencyOrder[a.urgency] || 3) - (urgencyOrder[b.urgency] || 3));

  // Calculate overall accuracy
  if (this.topicScores.length > 0) {
    this.overallAccuracy = Math.round(
      this.topicScores.reduce((s, t) => s + t.avgScore, 0) / this.topicScores.length
    );
  }

  this.lastAnalyzed = new Date();
};

module.exports = mongoose.model('Performance', performanceSchema);
