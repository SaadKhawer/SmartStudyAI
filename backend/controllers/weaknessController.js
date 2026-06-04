/**
 * Weakness Controller
 * Analyzes performance, identifies weak/strong areas, generates AI strategies
 */

const Performance = require('../models/Performance');
const OpenAI = require('openai');
const logger = require('../utils/logger');

const groq = new OpenAI({ apiKey: process.env.GROK_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });
const MODEL = process.env.GROK_MODEL || 'llama-3.3-70b-versatile';

const getAnalysis = async (req, res) => {
  try {
    let perf = await Performance.findOne({ user: req.user._id });
    if (!perf) perf = await Performance.create({ user: req.user._id });
    perf.recalculateAreas();
    await perf.save();

    res.json({
      overallAccuracy: perf.overallAccuracy,
      totalQuizzes: perf.totalQuizzes,
      totalExams: perf.totalExams,
      weakAreas: perf.weakAreas,
      strongAreas: perf.strongAreas,
      topicScores: perf.topicScores.map(t => ({
        topic: t.topic, avgScore: t.avgScore, totalAttempts: t.totalAttempts,
        trend: t.trend, lastAttempted: t.lastAttempted, difficulty: t.difficulty,
        scores: t.scores.slice(-10)
      })),
      recentQuizzes: perf.quizResults.slice(-10).reverse(),
      recentExams: perf.examResults.slice(-5).reverse(),
      lastAnalyzed: perf.lastAnalyzed
    });
  } catch (error) {
    logger.error(`Weakness analysis error: ${error.message}`);
    res.status(500).json({ error: 'Failed to analyze performance.' });
  }
};

const getStrategies = async (req, res) => {
  try {
    const perf = await Performance.findOne({ user: req.user._id });
    if (!perf || perf.topicScores.length === 0) {
      return res.json({ strategies: [{ topic: 'Getting Started', advice: 'Take some quizzes first!', resources: ['Start with the Quiz page'], priority: 'low' }] });
    }

    const prompt = `Based on this student's performance, generate improvement strategies.
Weak areas: ${JSON.stringify(perf.weakAreas.slice(0, 5))}
Strong areas: ${JSON.stringify(perf.strongAreas.slice(0, 3))}
Overall accuracy: ${perf.overallAccuracy}%

Return ONLY JSON array:
[{"topic":"name","currentScore":45,"targetScore":80,"priority":"high","strategies":["strategy1","strategy2"],"resources":["resource"],"estimatedTime":"2h","quickWin":"do this now"}]`;

    const completion = await groq.chat.completions.create({
      model: MODEL, temperature: 0.5, max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    let strategies;
    try {
      strategies = JSON.parse(completion.choices[0].message.content.replace(/```json|```/g, '').trim());
    } catch {
      strategies = perf.weakAreas.map(w => ({
        topic: w.topic, currentScore: w.avgScore, targetScore: 80, priority: w.urgency,
        strategies: ['Review core concepts', 'Practice with quizzes'], resources: ['Take a quiz'],
        estimatedTime: '1-2h', quickWin: 'Take a quiz now'
      }));
    }
    res.json({ strategies });
  } catch (error) {
    logger.error(`Strategies error: ${error.message}`);
    res.status(500).json({ error: 'Failed to generate strategies.' });
  }
};

const recordResult = async (req, res) => {
  try {
    const { type, topic, score, total, percentage, difficulty, grade, feedback, strengths, weaknesses, questionsData } = req.body;
    let perf = await Performance.findOne({ user: req.user._id });
    if (!perf) perf = await Performance.create({ user: req.user._id });

    const pct = percentage || (total > 0 ? Math.round((score / total) * 100) : 0);

    if (type === 'quiz') {
      perf.quizResults.push({ topic, score, total, percentage: pct, difficulty: difficulty || 'medium', date: new Date(), questionsData: questionsData || [] });
      perf.totalQuizzes++;
    } else if (type === 'exam') {
      perf.examResults.push({ topic, score, grade, totalQuestions: total, feedback, strengths, weaknesses, date: new Date() });
      perf.totalExams++;
    }

    // Update topic score
    let ts = perf.topicScores.find(t => t.topic.toLowerCase() === topic.toLowerCase());
    if (!ts) {
      perf.topicScores.push({ topic, totalAttempts: 0, totalCorrect: 0, avgScore: 0, scores: [], trend: 'stable', lastAttempted: new Date(), difficulty: difficulty || 'medium' });
      ts = perf.topicScores[perf.topicScores.length - 1];
    }

    ts.totalAttempts++;
    ts.totalCorrect += score;
    ts.scores.push({ value: pct, date: new Date() });
    if (ts.scores.length > 10) ts.scores = ts.scores.slice(-10);
    ts.avgScore = Math.round(ts.scores.reduce((s, sc) => s + sc.value, 0) / ts.scores.length);
    ts.lastAttempted = new Date();

    if (ts.scores.length >= 3) {
      const recent = ts.scores.slice(-3).map(s => s.value);
      const avgR = recent.reduce((s, v) => s + v, 0) / recent.length;
      const older = ts.scores.slice(0, -3).map(s => s.value);
      const avgO = older.length > 0 ? older.reduce((s, v) => s + v, 0) / older.length : avgR;
      ts.trend = avgR > avgO + 5 ? 'improving' : avgR < avgO - 5 ? 'declining' : 'stable';
    }

    perf.recalculateAreas();
    await perf.save();
    res.json({ message: 'Result recorded!', topicScore: ts, overallAccuracy: perf.overallAccuracy });
  } catch (error) {
    logger.error(`Record result error: ${error.message}`);
    res.status(500).json({ error: 'Failed to record result.' });
  }
};

module.exports = { getAnalysis, getStrategies, recordResult };
