/**
 * Gamification Controller
 * XP awards, level ups, badge checks, leaderboard
 */

const Gamification = require('../models/Gamification');
const logger = require('../utils/logger');

// Get or create gamification profile
async function getOrCreateProfile(userId) {
  let profile = await Gamification.findOne({ user: userId });
  if (!profile) {
    profile = await Gamification.create({ user: userId, dailyXP: new Map() });
  }
  return profile;
}

const getProfile = async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.user._id);
    const allBadges = Gamification.getAllBadges();
    const earnedIds = profile.badges.map(b => b.badgeId);

    res.json({
      xp: profile.xp,
      level: profile.level,
      title: profile.title,
      xpForNextLevel: profile.getXPForNextLevel(),
      xpProgress: profile.getXPProgress(),
      badges: profile.badges,
      allBadges: allBadges.map(b => ({ ...b, earned: earnedIds.includes(b.id) })),
      stats: {
        streakDays: profile.streakDays,
        longestStreak: profile.longestStreak,
        quizzesCompleted: profile.quizzesCompleted,
        examsCompleted: profile.examsCompleted,
        perfectScores: profile.perfectScores,
        studyMinutes: profile.studyMinutes,
        voiceSessions: profile.voiceSessions,
        quizBattlesWon: profile.quizBattlesWon
      },
      xpHistory: profile.xpHistory.slice(-20).reverse()
    });
  } catch (error) {
    logger.error(`Get profile error: ${error.message}`);
    res.status(500).json({ error: 'Failed to get gamification profile.' });
  }
};

const awardXP = async (req, res) => {
  try {
    const { action, amount, description } = req.body;
    const profile = await getOrCreateProfile(req.user._id);

    // Update streak
    profile.updateStreak();

    const result = profile.awardXP(amount || getDefaultXP(action), action, description || action);

    // Update stat counters
    if (action === 'quiz_complete') profile.quizzesCompleted++;
    if (action === 'exam_complete') profile.examsCompleted++;
    if (action === 'perfect_score') profile.perfectScores++;
    if (action === 'voice_session') profile.voiceSessions++;
    if (action === 'battle_won') profile.quizBattlesWon++;
    if (action === 'study_session') profile.studyMinutes += (amount || 30);

    // Check badge unlocks
    const newBadges = [];
    if (profile.quizzesCompleted === 1) { const b = profile.checkAndAwardBadge('first_quiz'); if (b) newBadges.push(b); }
    if (profile.quizzesCompleted >= 25) { const b = profile.checkAndAwardBadge('quiz_master'); if (b) newBadges.push(b); }
    if (action === 'perfect_score') { const b = profile.checkAndAwardBadge('perfect_score'); if (b) newBadges.push(b); }
    if (profile.examsCompleted === 1) { const b = profile.checkAndAwardBadge('first_exam'); if (b) newBadges.push(b); }
    if (action === 'exam_ace') { const b = profile.checkAndAwardBadge('exam_ace'); if (b) newBadges.push(b); }
    if (profile.streakDays >= 3) { const b = profile.checkAndAwardBadge('streak_3'); if (b) newBadges.push(b); }
    if (profile.streakDays >= 7) { const b = profile.checkAndAwardBadge('streak_7'); if (b) newBadges.push(b); }
    if (profile.streakDays >= 30) { const b = profile.checkAndAwardBadge('streak_30'); if (b) newBadges.push(b); }
    if (profile.voiceSessions >= 10) { const b = profile.checkAndAwardBadge('voice_learner'); if (b) newBadges.push(b); }
    if (profile.xp >= 1000) { const b = profile.checkAndAwardBadge('century'); if (b) newBadges.push(b); }

    // Time-based badges
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) { const b = profile.checkAndAwardBadge('night_owl'); if (b) newBadges.push(b); }
    if (hour >= 5 && hour < 7) { const b = profile.checkAndAwardBadge('early_bird'); if (b) newBadges.push(b); }

    await profile.save();

    res.json({
      ...result,
      xp: profile.xp,
      xpProgress: profile.getXPProgress(),
      newBadges,
      streakDays: profile.streakDays
    });
  } catch (error) {
    logger.error(`Award XP error: ${error.message}`);
    res.status(500).json({ error: 'Failed to award XP.' });
  }
};

const getLeaderboard = async (req, res) => {
  try {
    const leaders = await Gamification.find()
      .sort({ xp: -1 })
      .limit(20)
      .populate('user', 'name email avatar');

    res.json({
      leaderboard: leaders.map((l, i) => ({
        rank: i + 1,
        name: l.user?.name || 'Unknown',
        avatar: l.user?.avatar,
        xp: l.xp,
        level: l.level,
        title: l.title,
        badges: l.badges.length,
        streakDays: l.streakDays
      }))
    });
  } catch (error) {
    logger.error(`Leaderboard error: ${error.message}`);
    res.status(500).json({ error: 'Failed to load leaderboard.' });
  }
};

const getBadges = async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.user._id);
    const allBadges = Gamification.getAllBadges();
    const earnedIds = profile.badges.map(b => b.badgeId);

    res.json({
      badges: allBadges.map(b => ({
        ...b,
        earned: earnedIds.includes(b.id),
        earnedAt: profile.badges.find(eb => eb.badgeId === b.id)?.earnedAt || null
      }))
    });
  } catch (error) {
    logger.error(`Badges error: ${error.message}`);
    res.status(500).json({ error: 'Failed to load badges.' });
  }
};

function getDefaultXP(action) {
  const xpMap = {
    quiz_complete: 50, exam_complete: 100, perfect_score: 75,
    daily_study: 25, study_session: 30, voice_session: 20,
    battle_won: 60, document_upload: 15, plan_complete: 40,
    exam_ace: 150
  };
  return xpMap[action] || 10;
}

module.exports = { getProfile, awardXP, getLeaderboard, getBadges, getOrCreateProfile };
