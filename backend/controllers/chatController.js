/**
 * Chat Controller
 * Manages chat sessions and AI responses via RAG
 */

const ChatSession = require('../models/ChatSession');
const User = require('../models/User');
const { generateRAGResponse } = require('../services/ragService');
const logger = require('../utils/logger');

/**
 * POST /api/chat/message
 * Send a message and get AI response
 */
const sendMessage = async (req, res) => {
  try {
    const { message, sessionId, useDocuments = true } = req.body;
    const userId = req.user._id;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    // Find or create chat session
    let session;
    if (sessionId) {
      session = await ChatSession.findOne({ _id: sessionId, user: userId });
      if (!session) {
        return res.status(404).json({ error: 'Chat session not found.' });
      }
    } else {
      session = new ChatSession({ user: userId, messages: [] });
    }

    // Add user message to session
    session.messages.push({ role: 'user', content: message.trim() });

    // Get chat history (exclude the message we just added)
    const chatHistory = session.messages.slice(0, -1).map(m => ({
      role: m.role,
      content: m.content
    }));

    // Generate AI response using RAG
    let aiResponse;
    try {
      aiResponse = await generateRAGResponse(
        userId.toString(),
        message.trim(),
        chatHistory,
        useDocuments
      );
    } catch (aiError) {
      logger.error(`AI generation failed: ${aiError.message}`);
      // Fallback response
      aiResponse = {
        answer: "I'm having trouble connecting to the AI service right now. Please check your API configuration and try again.",
        sources: [],
        hasContext: false
      };
    }

    // Add assistant message
    session.messages.push({
      role: 'assistant',
      content: aiResponse.answer,
      imageUrl: aiResponse.imageUrl || null,
      sources: aiResponse.sources || []
    });

    await session.save();

    // Update user stats
    await User.findByIdAndUpdate(userId, {
      $inc: { 'stats.totalChats': sessionId ? 0 : 1 },
      'stats.lastStudied': new Date()
    });

    res.json({
      sessionId: session._id,
      message: {
        role: 'assistant',
        content: aiResponse.answer,
        imageUrl: aiResponse.imageUrl || null,
        sources: aiResponse.sources,
        hasContext: aiResponse.hasContext,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error(`Send message error: ${error.message}`);
    res.status(500).json({ error: 'Failed to process message.' });
  }
};

/**
 * GET /api/chat/sessions
 * Get all chat sessions for a user
 */
const getSessions = async (req, res) => {
  try {
    const sessions = await ChatSession.find({
      user: req.user._id,
      isActive: true
    })
    .select('title messageCount createdAt updatedAt')
    .sort({ updatedAt: -1 })
    .limit(50);

    res.json({ sessions });
  } catch (error) {
    logger.error(`Get sessions error: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch sessions.' });
  }
};

/**
 * GET /api/chat/sessions/:id
 * Get a specific chat session with messages
 */
const getSession = async (req, res) => {
  try {
    const session = await ChatSession.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    res.json({ session });
  } catch (error) {
    logger.error(`Get session error: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch session.' });
  }
};

/**
 * DELETE /api/chat/sessions/:id
 * Delete a chat session
 */
const deleteSession = async (req, res) => {
  try {
    const session = await ChatSession.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isActive: false },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    res.json({ message: 'Session deleted.' });
  } catch (error) {
    logger.error(`Delete session error: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete session.' });
  }
};

/**
 * POST /api/chat/new
 * Create a new empty chat session
 */
const createSession = async (req, res) => {
  try {
    const session = new ChatSession({
      user: req.user._id,
      title: req.body.title || 'New Conversation',
      messages: []
    });
    await session.save();
    res.status(201).json({ session });
  } catch (error) {
    logger.error(`Create session error: ${error.message}`);
    res.status(500).json({ error: 'Failed to create session.' });
  }
};

module.exports = { sendMessage, getSessions, getSession, deleteSession, createSession };
