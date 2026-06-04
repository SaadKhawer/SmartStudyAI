// routes/quiz.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const OpenAI = require('openai');
const Document = require('../models/Document');

const groq = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
});

// POST /api/quiz/generate
router.post('/generate', authenticate, async (req, res) => {
  try {
    const { topic, difficulty = 'medium', count = 5, documentId } = req.body;

    let context = '';
    if (documentId) {
      const doc = await Document.findOne({ _id: documentId, user: req.user._id });
      if (doc) context = doc.textContent?.substring(0, 3000) || '';
    }

    const prompt = context
      ? `Based on this study material, generate ${count} multiple choice questions at ${difficulty} difficulty level:

${context}

Return ONLY a JSON array like this (no extra text):
[
  {
    "question": "Question here?",
    "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
    "correct": "A",
    "explanation": "Why this answer is correct"
  }
]`
      : `Generate ${count} multiple choice questions about "${topic}" at ${difficulty} difficulty.

Return ONLY a JSON array like this (no extra text):
[
  {
    "question": "Question here?",
    "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
    "correct": "A",
    "explanation": "Why this answer is correct"
  }
]`;

    const completion = await groq.chat.completions.create({
      model: process.env.GROK_MODEL || 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000
    });

    let responseText = completion.choices[0].message.content;
    // Clean JSON response
    responseText = responseText.replace(/```json|```/g, '').trim();
    const questions = JSON.parse(responseText);

    res.json({ questions, topic, difficulty, count: questions.length });
  } catch (error) {
    console.error('Quiz generation error:', error.message);
    res.status(500).json({ error: 'Failed to generate quiz. Try again.' });
  }
});

module.exports = router;