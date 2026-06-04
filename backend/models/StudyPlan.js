/**
 * StudyPlan Model
 * Stores personalized study timetables with scheduling, revision, and progress
 */

const mongoose = require('mongoose');

const studySlotSchema = new mongoose.Schema({
  time: { type: String, required: true },        // e.g. "09:00-10:30"
  subject: { type: String, required: true },
  topic: { type: String, required: true },
  type: { type: String, enum: ['study', 'revision', 'buffer', 'break'], default: 'study' },
  duration: { type: Number, required: true },     // minutes
  completed: { type: Boolean, default: false },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  priority: { type: Number, default: 5 }          // 1-10, higher = more urgent
}, { _id: true });

const dailyPlanSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  dayOfWeek: { type: String, required: true },
  slots: [studySlotSchema],
  totalMinutes: { type: Number, default: 0 },
  completedMinutes: { type: Number, default: 0 }
}, { _id: true });

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  topics: [{ 
    name: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    completed: { type: Boolean, default: false },
    confidence: { type: Number, default: 50, min: 0, max: 100 }  // self-assessed
  }],
  hoursPerWeek: { type: Number, default: 5 },
  deadline: { type: Date },
  color: { type: String, default: '#6c8ef5' },
  priority: { type: Number, default: 5 }
}, { _id: true });

const studyPlanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, default: 'My Study Plan' },
  subjects: [subjectSchema],
  studyHoursPerDay: { type: Number, default: 4, min: 1, max: 16 },
  preferredStartTime: { type: String, default: '09:00' },
  preferredEndTime: { type: String, default: '21:00' },
  breakDuration: { type: Number, default: 15 },      // minutes between sessions
  sessionDuration: { type: Number, default: 45 },     // minutes per study block
  bufferPercentage: { type: Number, default: 10 },     // % extra time for flexibility
  includeRevision: { type: Boolean, default: true },
  weeklySchedule: [{
    day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    available: { type: Boolean, default: true },
    slots: [studySlotSchema]
  }],
  dailyPlans: [dailyPlanSchema],
  progress: {
    overallCompletion: { type: Number, default: 0 },
    subjectCompletion: { type: Map, of: Number },
    lastUpdated: { type: Date, default: Date.now }
  },
  isActive: { type: Boolean, default: true },
  generatedAt: { type: Date, default: Date.now },
  adjustmentHistory: [{
    date: { type: Date, default: Date.now },
    reason: { type: String },
    changes: { type: String }
  }]
}, {
  timestamps: true
});

studyPlanSchema.index({ user: 1, isActive: 1 });

module.exports = mongoose.model('StudyPlan', studyPlanSchema);
