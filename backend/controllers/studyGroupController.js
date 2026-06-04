/**
 * Study Group Controller
 * Group management, quiz battles, challenges, AI discussion questions
 */

const StudyGroup = require('../models/StudyGroup');
const OpenAI = require('openai');
const logger = require('../utils/logger');

const groq = new OpenAI({ apiKey: process.env.GROK_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });
const MODEL = process.env.GROK_MODEL || 'llama-3.3-70b-versatile';

const createGroup = async (req, res) => {
  try {
    const { name, description, topics } = req.body;
    if (!name) return res.status(400).json({ error: 'Group name is required.' });

    const group = await StudyGroup.create({
      name, description, topics: topics || [],
      creator: req.user._id,
      members: [{ user: req.user._id, role: 'admin' }]
    });

    res.json({ group, message: `Group "${name}" created! Share code: ${group.code}` });
  } catch (error) {
    logger.error(`Create group error: ${error.message}`);
    res.status(500).json({ error: 'Failed to create group.' });
  }
};

const joinGroup = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Join code is required.' });

    const group = await StudyGroup.findOne({ code: code.toUpperCase(), isActive: true });
    if (!group) return res.status(404).json({ error: 'Group not found.' });
    if (group.members.some(m => m.user.toString() === req.user._id.toString())) {
      return res.status(400).json({ error: 'Already a member.' });
    }
    if (group.members.length >= group.maxMembers) {
      return res.status(400).json({ error: 'Group is full.' });
    }

    group.members.push({ user: req.user._id, role: 'member' });
    group.lastActivity = new Date();
    await group.save();

    res.json({ group, message: `Joined "${group.name}"!` });
  } catch (error) {
    logger.error(`Join group error: ${error.message}`);
    res.status(500).json({ error: 'Failed to join group.' });
  }
};

const getMyGroups = async (req, res) => {
  try {
    const groups = await StudyGroup.find({ 'members.user': req.user._id, isActive: true })
      .populate('members.user', 'name avatar')
      .populate('creator', 'name')
      .sort({ lastActivity: -1 });

    res.json({ groups });
  } catch (error) {
    logger.error(`My groups error: ${error.message}`);
    res.status(500).json({ error: 'Failed to load groups.' });
  }
};

const getGroupDetail = async (req, res) => {
  try {
    const group = await StudyGroup.findById(req.params.id)
      .populate('members.user', 'name email avatar')
      .populate('creator', 'name')
      .populate('quizBattles.participants.user', 'name')
      .populate('quizBattles.createdBy', 'name')
      .populate('challenges.createdBy', 'name')
      .populate('challenges.participants.user', 'name');

    if (!group) return res.status(404).json({ error: 'Group not found.' });
    if (!group.members.some(m => m.user._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ error: 'Not a member of this group.' });
    }

    res.json({ group });
  } catch (error) {
    logger.error(`Group detail error: ${error.message}`);
    res.status(500).json({ error: 'Failed to load group.' });
  }
};

const startQuizBattle = async (req, res) => {
  try {
    const { topic, difficulty, questionCount } = req.body;
    const group = await StudyGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found.' });

    const prompt = `Generate ${questionCount || 5} quiz battle questions about "${topic || group.topics[0] || 'General Knowledge'}" at ${difficulty || 'medium'} difficulty.
Return ONLY JSON array:
[{"question":"Q?","options":["A) opt1","B) opt2","C) opt3","D) opt4"],"correct":"A","explanation":"why"}]`;

    const completion = await groq.chat.completions.create({
      model: MODEL, temperature: 0.7, max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    let questions;
    try {
      questions = JSON.parse(completion.choices[0].message.content.replace(/```json|```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Failed to generate questions.' });
    }

    const battle = {
      title: `${topic || 'Quick'} Battle`,
      topic: topic || group.topics[0] || 'General',
      difficulty: difficulty || 'medium',
      questions,
      participants: [{ user: req.user._id, score: 0, answers: new Map() }],
      status: 'waiting',
      createdBy: req.user._id,
      startedAt: new Date()
    };

    group.quizBattles.push(battle);
    group.lastActivity = new Date();
    await group.save();

    const battleId = group.quizBattles[group.quizBattles.length - 1]._id;
    res.json({ battleId, battle: group.quizBattles[group.quizBattles.length - 1], message: 'Quiz battle started!' });
  } catch (error) {
    logger.error(`Quiz battle error: ${error.message}`);
    res.status(500).json({ error: 'Failed to start quiz battle.' });
  }
};

const submitBattleAnswer = async (req, res) => {
  try {
    const { battleId, answers, score } = req.body;
    const group = await StudyGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found.' });

    const battle = group.quizBattles.id(battleId);
    if (!battle) return res.status(404).json({ error: 'Battle not found.' });

    let participant = battle.participants.find(p => p.user.toString() === req.user._id.toString());
    if (!participant) {
      battle.participants.push({ user: req.user._id, score: 0, answers: new Map() });
      participant = battle.participants[battle.participants.length - 1];
    }

    participant.score = score;
    participant.answers = answers;
    participant.completedAt = new Date();

    // Check if all members have completed
    const memberCount = group.members.length;
    const completedCount = battle.participants.filter(p => p.completedAt).length;
    if (completedCount >= Math.min(memberCount, battle.participants.length) && completedCount >= 2) {
      battle.status = 'completed';
      battle.endedAt = new Date();
      const winner = battle.participants.reduce((a, b) => a.score > b.score ? a : b);
      battle.winnerId = winner.user;
    } else {
      battle.status = 'active';
    }

    group.lastActivity = new Date();
    await group.save();

    res.json({
      battle,
      yourScore: score,
      allScores: battle.participants.map(p => ({ user: p.user, score: p.score, completedAt: p.completedAt })),
      isComplete: battle.status === 'completed'
    });
  } catch (error) {
    logger.error(`Battle answer error: ${error.message}`);
    res.status(500).json({ error: 'Failed to submit answer.' });
  }
};

const createChallenge = async (req, res) => {
  try {
    const { title, description, type, topic, target, deadline, xpReward } = req.body;
    const group = await StudyGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found.' });

    group.challenges.push({
      title, description, type: type || 'quiz_score', topic, target: target || 80,
      deadline: deadline ? new Date(deadline) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdBy: req.user._id,
      participants: [{ user: req.user._id, progress: 0 }],
      xpReward: xpReward || 50
    });

    group.lastActivity = new Date();
    await group.save();
    res.json({ group, message: 'Challenge created!' });
  } catch (error) {
    logger.error(`Create challenge error: ${error.message}`);
    res.status(500).json({ error: 'Failed to create challenge.' });
  }
};

const getDiscussionQuestions = async (req, res) => {
  try {
    const group = await StudyGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found.' });

    const topics = group.topics.length > 0 ? group.topics.join(', ') : 'general study topics';
    const prompt = `Generate 5 thought-provoking group discussion questions about: ${topics}.
Return ONLY JSON array: [{"question":"Q?","topic":"topic"}]`;

    const completion = await groq.chat.completions.create({
      model: MODEL, temperature: 0.8, max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    });

    let questions;
    try {
      questions = JSON.parse(completion.choices[0].message.content.replace(/```json|```/g, '').trim());
    } catch {
      questions = [{ question: `What are the key concepts in ${topics}?`, topic: topics }];
    }

    group.discussionQuestions = questions.map(q => ({ ...q, generatedAt: new Date() }));
    group.lastActivity = new Date();
    await group.save();

    res.json({ questions: group.discussionQuestions });
  } catch (error) {
    logger.error(`Discussion questions error: ${error.message}`);
    res.status(500).json({ error: 'Failed to generate discussion questions.' });
  }
};

const leaveGroup = async (req, res) => {
  try {
    const group = await StudyGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found.' });
    group.members = group.members.filter(m => m.user.toString() !== req.user._id.toString());
    if (group.members.length === 0) group.isActive = false;
    await group.save();
    res.json({ message: 'Left the group.' });
  } catch (error) {
    logger.error(`Leave group error: ${error.message}`);
    res.status(500).json({ error: 'Failed to leave group.' });
  }
};

module.exports = { createGroup, joinGroup, getMyGroups, getGroupDetail, startQuizBattle, submitBattleAnswer, createChallenge, getDiscussionQuestions, leaveGroup };
