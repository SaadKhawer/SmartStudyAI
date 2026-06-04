/**
 * Dashboard Controller
 * User stats, activity, and AI-powered recommendations
 */

const User = require('../models/User');
const ChatSession = require('../models/ChatSession');
const Document = require('../models/Document');
const logger = require('../utils/logger');

/**
 * GET /api/dashboard/stats
 * Returns aggregate stats for the dashboard
 */
const getStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const [user, chatCount, documentCount, recentSessions] = await Promise.all([
      User.findById(userId),
      ChatSession.countDocuments({ user: userId, isActive: true }),
      Document.countDocuments({ user: userId, embeddingStatus: 'completed' }),
      ChatSession.find({ user: userId, isActive: true })
        .select('title messageCount updatedAt')
        .sort({ updatedAt: -1 })
        .limit(5)
    ]);

    // Calculate study streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastStudied = user.stats.lastStudied;
    const isStudiedToday = lastStudied && lastStudied >= today;

    res.json({
      stats: {
        totalChats: chatCount,
        totalDocuments: documentCount,
        studyStreak: user.stats.studyStreak || 0,
        isStudiedToday,
        lastStudied: user.stats.lastStudied
      },
      recentActivity: recentSessions,
      user: {
        name: user.name,
        preferences: user.preferences
      }
    });
  } catch (error) {
    logger.error(`Dashboard stats error: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch dashboard data.' });
  }
};

/**
 * GET /api/dashboard/recommendations
 * AI-powered study recommendations based on user activity
 */
const getRecommendations = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user's recent topics from chat history
    const recentChats = await ChatSession.find({ user: userId, isActive: true })
      .select('messages title')
      .sort({ updatedAt: -1 })
      .limit(5);

    const recentTopics = recentChats
      .map(s => s.title)
      .filter(t => t !== 'New Conversation');

    const documents = await Document.find({ user: userId })
      .select('name subject summary')
      .limit(10);

    // Generate contextual recommendations
    const recommendations = generateRecommendations(recentTopics, documents, req.user);

    res.json({ recommendations });
  } catch (error) {
    logger.error(`Recommendations error: ${error.message}`);
    res.status(500).json({ error: 'Failed to generate recommendations.' });
  }
};

/**
 * Simple recommendation engine based on user data
 * In production: use collaborative filtering or ML model
 */
function generateRecommendations(topics, documents, user) {
  const suggestions = [];

  if (documents.length === 0) {
    suggestions.push({
      type: 'action',
      icon: '📚',
      title: 'Upload your first document',
      description: 'Upload study materials to enable AI-powered contextual answers.',
      action: 'upload'
    });
  }

  if (topics.length > 0) {
    suggestions.push({
      type: 'study',
      icon: '🔍',
      title: `Continue studying: ${topics[0]}`,
      description: 'Pick up where you left off in your last study session.',
      action: 'chat'
    });
  }

  suggestions.push({
    type: 'tip',
    icon: '💡',
    title: 'Practice with flashcard questions',
    description: 'Ask StudyAI to quiz you on your uploaded materials.',
    action: 'quiz',
    prompt: 'Quiz me with 5 questions about my study materials'
  });

  if (documents.length > 0) {
    suggestions.push({
      type: 'review',
      icon: '📝',
      title: 'Generate a study summary',
      description: `Summarize your ${documents[0].name} document into key points.`,
      action: 'summarize',
      prompt: `Create a comprehensive summary of ${documents[0].name}`
    });
  }

  suggestions.push({
    type: 'learning',
    icon: '🧠',
    title: 'Explain a complex concept',
    description: 'Ask StudyAI to explain any difficult topic in simple terms.',
    action: 'explain',
    prompt: 'Explain this concept to me like I\'m a beginner: '
  });

  return suggestions.slice(0, 4);
}

module.exports = { getStats, getRecommendations };
