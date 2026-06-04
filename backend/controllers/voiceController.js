/**
 * Voice Controller
 * Voice-friendly AI tutor with conversational responses and follow-up questions
 * Uses browser Web Speech API (free) on frontend for TTS/STT
 */

const OpenAI = require('openai');
const logger = require('../utils/logger');

const groq = new OpenAI({ apiKey: process.env.GROK_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });
const MODEL = process.env.GROK_MODEL || 'llama-3.3-70b-versatile';

// In-memory voice sessions
const voiceSessions = new Map();

const VOICE_SYSTEM_PROMPT = `You are a friendly, voice-first tutor. Your responses will be READ ALOUD to the student.

Rules:
1. Keep sentences SHORT and CLEAR (max 15-20 words each)
2. Use SIMPLE language — explain like talking to a friend
3. Avoid bullet points, markdown, or complex formatting
4. Use natural speech patterns: "So basically...", "Think of it like...", "Here's the key thing..."
5. Break complex topics into small, digestible chunks
6. Use examples and analogies the student can relate to
7. Be encouraging and enthusiastic: "Great question!", "That's a really smart thing to ask!"
8. After explaining, ALWAYS ask a follow-up question to test understanding
9. Keep total response under 150 words — this is SPOKEN, not written
10. Use pauses: add "..." between ideas for natural speech flow`;

const askQuestion = async (req, res) => {
  try {
    const { question, topic, sessionId } = req.body;
    if (!question) return res.status(400).json({ error: 'Question is required.' });

    const userId = req.user._id.toString();
    let session = sessionId ? voiceSessions.get(sessionId) : null;

    if (!session) {
      const newId = Date.now().toString(36) + Math.random().toString(36).slice(2);
      session = {
        id: newId,
        userId,
        topic: topic || 'General',
        messages: [{ role: 'system', content: VOICE_SYSTEM_PROMPT }],
        questionCount: 0
      };
      voiceSessions.set(newId, session);
    }

    session.messages.push({ role: 'user', content: question });
    session.questionCount++;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      max_tokens: 400,
      messages: session.messages
    });

    const reply = completion.choices[0].message.content;
    session.messages.push({ role: 'assistant', content: reply });

    // Keep session manageable (last 20 messages)
    if (session.messages.length > 22) {
      session.messages = [session.messages[0], ...session.messages.slice(-20)];
    }

    res.json({
      sessionId: session.id,
      answer: reply,
      topic: session.topic,
      questionCount: session.questionCount
    });
  } catch (error) {
    logger.error(`Voice ask error: ${error.message}`);
    res.status(500).json({ error: 'Failed to process question.' });
  }
};

const getFollowUp = async (req, res) => {
  try {
    const { sessionId, studentAnswer } = req.body;
    const session = voiceSessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found. Start a new conversation.' });

    session.messages.push({
      role: 'user',
      content: `Student answered the follow-up: "${studentAnswer}". 
Evaluate if they understood correctly. If yes, praise them and ask a slightly harder follow-up. If no, explain gently what they missed and re-ask. Keep it conversational and SHORT.`
    });

    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      max_tokens: 300,
      messages: session.messages
    });

    const reply = completion.choices[0].message.content;
    session.messages.push({ role: 'assistant', content: reply });

    res.json({
      sessionId,
      answer: reply,
      questionCount: session.questionCount
    });
  } catch (error) {
    logger.error(`Voice follow-up error: ${error.message}`);
    res.status(500).json({ error: 'Failed to process follow-up.' });
  }
};

const endSession = async (req, res) => {
  const { sessionId } = req.body;
  if (sessionId) voiceSessions.delete(sessionId);
  res.json({ message: 'Voice session ended.' });
};

module.exports = { askQuestion, getFollowUp, endSession };
