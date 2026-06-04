/**
 * Vision Route
 * Handles image + text messages using Groq's vision model
 */
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const OpenAI  = require('openai');
const ChatSession = require('../models/ChatSession');
const { retrieveRelevantChunks } = require('../services/ragService');

const groq = new OpenAI({
  apiKey:  process.env.GROK_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
});

// POST /api/chat/vision
router.post('/vision', authenticate, async (req, res) => {
  try {
    const { message, imageBase64, sessionId, useDocuments = true } = req.body;
    const userId = req.user._id;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data missing.' });
    }

    // Get or create session
    let session;
    if (sessionId) {
      session = await ChatSession.findOne({ _id: sessionId, user: userId });
    }
    if (!session) {
      session = new ChatSession({ user: userId, messages: [] });
    }

    // Add user message to session
    session.messages.push({
      role: 'user',
      content: message || '📸 [Image uploaded for analysis]'
    });

    // Optionally retrieve RAG context
    let ragContext = '';
    if (useDocuments && message) {
      try {
        const chunks = await retrieveRelevantChunks(userId.toString(), message, 3);
        if (chunks.length > 0) {
          ragContext = '\n\nRelevant context from student documents:\n' +
            chunks.map(c => c.content).join('\n---\n');
        }
      } catch (_) {}
    }

    // System prompt for vision
    const systemPrompt = `You are StudyAI, an expert academic tutor with vision capabilities.
A student has shared an image with you. Analyze it thoroughly in an educational context.

Your job:
- If it is a math problem or equation → solve it step by step
- If it is a diagram or chart → explain what it shows clearly  
- If it is handwritten notes → transcribe and summarize the key points
- If it is a textbook page → explain the concepts shown
- If it is a graph → analyze the data and trends
- Always relate your analysis to learning and understanding
- Be encouraging and pedagogically effective
${ragContext ? ragContext : ''}`;

    // Call Groq vision model (llama-4-scout supports vision)
    const completion = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      temperature: 0.3,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            },
            {
              type: 'text',
              text: message || 'Please analyze this image and explain it in an educational context.'
            }
          ]
        }
      ]
    });

    const aiAnswer = completion.choices[0].message.content;

    // Save AI response
    session.messages.push({ role: 'assistant', content: aiAnswer });
    await session.save();

    res.json({
      sessionId: session._id,
      message: {
        role: 'assistant',
        content: aiAnswer,
        sources: [],
        hasContext: !!ragContext,
        timestamp: new Date()
      }
    });

  } catch (err) {
    console.error('Vision error:', err.message);

    // Fallback if vision model not available
    if (err.message?.includes('model') || err.status === 404) {
      return res.status(400).json({
        error: 'Vision model not available on this Groq plan. Try llama-4-scout or upgrade your plan.'
      });
    }
    res.status(500).json({ error: 'Failed to analyze image. Try again.' });
  }
});

module.exports = router;
