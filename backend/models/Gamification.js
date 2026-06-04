/**
 * Gamification Model
 * XP, levels, badges, achievements, and leaderboard tracking
 */

const mongoose = require('mongoose');

// ─── Badge Definitions ──────────────────────────────────────────────────────
const ALL_BADGES = [
  { id: 'first_quiz',      name: 'Quiz Starter',      description: 'Complete your first quiz',          icon: '🧠', xpReward: 25 },
  { id: 'quiz_master',     name: 'Quiz Master',        description: 'Complete 25 quizzes',               icon: '🏆', xpReward: 100 },
  { id: 'perfect_score',   name: 'Perfect Score',      description: 'Get 100% on a quiz',                icon: '💯', xpReward: 75 },
  { id: 'first_exam',      name: 'Exam Rookie',        description: 'Complete your first exam',           icon: '🎓', xpReward: 30 },
  { id: 'exam_ace',        name: 'Exam Ace',           description: 'Score A+ on an exam',                icon: '⭐', xpReward: 150 },
  { id: 'streak_3',        name: 'On Fire',            description: 'Maintain a 3-day study streak',      icon: '🔥', xpReward: 30 },
  { id: 'streak_7',        name: 'Week Warrior',       description: 'Maintain a 7-day study streak',      icon: '⚡', xpReward: 75 },
  { id: 'streak_30',       name: 'Monthly Legend',     description: 'Maintain a 30-day study streak',     icon: '👑', xpReward: 300 },
  { id: 'night_owl',       name: 'Night Owl',          description: 'Study after midnight',               icon: '🦉', xpReward: 15 },
  { id: 'early_bird',      name: 'Early Bird',         description: 'Study before 7 AM',                  icon: '🐦', xpReward: 15 },
  { id: 'bookworm',        name: 'Bookworm',           description: 'Upload 10 documents',                icon: '📚', xpReward: 50 },
  { id: 'social_learner',  name: 'Social Learner',     description: 'Join a study group',                 icon: '👥', xpReward: 25 },
  { id: 'challenger',      name: 'Challenger',         description: 'Complete 5 quiz battles',            icon: '⚔️', xpReward: 60 },
  { id: 'voice_learner',   name: 'Voice Learner',      description: 'Complete 10 voice sessions',         icon: '🎤', xpReward: 40 },
  { id: 'study_marathon',  name: 'Study Marathon',     description: 'Study for 5+ hours in one day',      icon: '🏃', xpReward: 100 },
  { id: 'improvement',     name: 'Rising Star',        description: 'Improve a weak topic by 30%+',       icon: '📈', xpReward: 80 },
  { id: 'planner',         name: 'Master Planner',     description: 'Complete a full week study plan',     icon: '📅', xpReward: 60 },
  { id: 'century',         name: 'Centurion',          description: 'Reach 1000 XP',                      icon: '💎', xpReward: 0 },
];

// ─── Level Titles ────────────────────────────────────────────────────────────
const LEVEL_TITLES = [
  'Beginner',           // 1
  'Novice',             // 2
  'Apprentice',         // 3
  'Student',            // 4
  'Scholar',            // 5
  'Advanced Scholar',   // 6
  'Expert',             // 7
  'Master',             // 8
  'Grandmaster',        // 9
  'Legend',             // 10+
];

const badgeSchema = new mongoose.Schema({
  badgeId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  icon: { type: String },
  earnedAt: { type: Date, default: Date.now }
}, { _id: false });

const xpEventSchema = new mongoose.Schema({
  action: { type: String, required: true },
  xp: { type: Number, required: true },
  description: { type: String },
  date: { type: Date, default: Date.now }
}, { _id: true });

const gamificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  title: { type: String, default: 'Beginner' },
  badges: [badgeSchema],
  xpHistory: [xpEventSchema],      // last 50 events
  
  // Stats
  streakDays: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  lastActiveDate: { type: Date },
  quizzesCompleted: { type: Number, default: 0 },
  examsCompleted: { type: Number, default: 0 },
  perfectScores: { type: Number, default: 0 },
  studyMinutes: { type: Number, default: 0 },
  documentsUploaded: { type: Number, default: 0 },
  voiceSessions: { type: Number, default: 0 },
  quizBattlesWon: { type: Number, default: 0 },
  
  // Daily tracking
  dailyXP: { type: Map, of: Number },   // "2026-04-28" -> 150
  weeklyXP: { type: Number, default: 0 }
}, {
  timestamps: true
});

// user index already created by unique: true
gamificationSchema.index({ xp: -1 });  // for leaderboard

// XP needed per level: level * 500
gamificationSchema.methods.getXPForNextLevel = function() {
  return this.level * 500;
};

gamificationSchema.methods.getXPProgress = function() {
  const xpForLevel = this.level * 500;
  const prevLevelXP = (this.level - 1) * 500;
  const totalXPNeeded = xpForLevel - prevLevelXP;
  const currentProgress = this.xp - prevLevelXP;
  return Math.min(100, Math.round((currentProgress / totalXPNeeded) * 100));
};

// Award XP and handle leveling
gamificationSchema.methods.awardXP = function(amount, action, description) {
  this.xp += amount;
  
  // Add to history (keep last 50)
  this.xpHistory.push({ action, xp: amount, description, date: new Date() });
  if (this.xpHistory.length > 50) {
    this.xpHistory = this.xpHistory.slice(-50);
  }
  
  // Track daily XP
  const today = new Date().toISOString().split('T')[0];
  const currentDaily = this.dailyXP?.get(today) || 0;
  this.dailyXP.set(today, currentDaily + amount);
  
  // Check level up
  const newLevel = Math.floor(this.xp / 500) + 1;
  const leveledUp = newLevel > this.level;
  this.level = newLevel;
  this.title = LEVEL_TITLES[Math.min(newLevel - 1, LEVEL_TITLES.length - 1)];
  
  return { leveledUp, newLevel: this.level, newTitle: this.title, totalXP: this.xp };
};

// Check and award badge
gamificationSchema.methods.checkAndAwardBadge = function(badgeId) {
  if (this.badges.some(b => b.badgeId === badgeId)) return null;
  
  const badgeDef = ALL_BADGES.find(b => b.id === badgeId);
  if (!badgeDef) return null;
  
  this.badges.push({
    badgeId: badgeDef.id,
    name: badgeDef.name,
    description: badgeDef.description,
    icon: badgeDef.icon,
    earnedAt: new Date()
  });
  
  // Award badge XP
  if (badgeDef.xpReward > 0) {
    this.awardXP(badgeDef.xpReward, 'badge', `Earned badge: ${badgeDef.name}`);
  }
  
  return badgeDef;
};

// Update streak
gamificationSchema.methods.updateStreak = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (this.lastActiveDate) {
    const lastDate = new Date(this.lastActiveDate);
    lastDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      this.streakDays++;
    } else if (diffDays > 1) {
      this.streakDays = 1;
    }
    // diffDays === 0 means same day, streak unchanged
  } else {
    this.streakDays = 1;
  }
  
  this.lastActiveDate = today;
  if (this.streakDays > this.longestStreak) {
    this.longestStreak = this.streakDays;
  }
};

// Static: Get all badge definitions
gamificationSchema.statics.getAllBadges = function() {
  return ALL_BADGES;
};

gamificationSchema.statics.LEVEL_TITLES = LEVEL_TITLES;

module.exports = mongoose.model('Gamification', gamificationSchema);
