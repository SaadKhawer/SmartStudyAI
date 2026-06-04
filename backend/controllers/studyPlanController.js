/**
 * Study Plan Controller
 * AI-powered personalized timetable generation and dynamic adjustment
 */

const StudyPlan = require('../models/StudyPlan');
const Performance = require('../models/Performance');
const OpenAI = require('openai');
const logger = require('../utils/logger');

const groq = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});
const MODEL = process.env.GROK_MODEL || 'llama-3.3-70b-versatile';

const SUBJECT_COLORS = ['#6c8ef5', '#4ade80', '#fb923c', '#f472b6', '#a78bfa', '#38bdf8', '#facc15', '#f87171'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * POST /api/study-plan/generate
 */
const generatePlan = async (req, res) => {
  try {
    const { subjects, studyHoursPerDay, preferredStartTime, preferredEndTime, sessionDuration, breakDuration, includeRevision } = req.body;
    const userId = req.user._id;

    if (!subjects || subjects.length === 0) {
      return res.status(400).json({ error: 'At least one subject is required.' });
    }

    // Deactivate old plans
    await StudyPlan.updateMany({ user: userId, isActive: true }, { isActive: false });

    // Get weakness data to prioritize
    let weakTopics = [];
    const perf = await Performance.findOne({ user: userId });
    if (perf) {
      weakTopics = perf.weakAreas.map(w => w.topic.toLowerCase());
    }

    // Assign colors
    const coloredSubjects = subjects.map((s, i) => ({
      ...s,
      color: s.color || SUBJECT_COLORS[i % SUBJECT_COLORS.length],
      topics: s.topics.map(t => ({
        ...t,
        difficulty: t.difficulty || 'medium',
        completed: false,
        confidence: weakTopics.includes(t.name?.toLowerCase()) ? 20 : (t.confidence || 50)
      }))
    }));

    // Use AI to generate optimized schedule
    const prompt = `Generate an optimized weekly study timetable as JSON. Input:
Subjects: ${JSON.stringify(coloredSubjects.map(s => ({ name: s.name, topics: s.topics.map(t => t.name), hoursPerWeek: s.hoursPerWeek, deadline: s.deadline, priority: s.priority || 5 })))}
Study hours per day: ${studyHoursPerDay || 4}
Preferred time: ${preferredStartTime || '09:00'} to ${preferredEndTime || '21:00'}
Session duration: ${sessionDuration || 45} minutes
Break duration: ${breakDuration || 15} minutes
Include revision: ${includeRevision !== false}
Weak topics needing priority: ${weakTopics.join(', ') || 'none'}

Rules:
1. Prioritize weak/difficult topics with more time slots
2. Include revision sessions every 2-3 days
3. Add 10% buffer time
4. Alternate between difficult and easy subjects
5. Place difficult topics earlier in the day when focus is high

Return ONLY this JSON (no extra text):
{
  "weeklySchedule": [
    {
      "day": "Monday",
      "slots": [
        { "time": "09:00-09:45", "subject": "Math", "topic": "Calculus", "type": "study", "duration": 45, "difficulty": "hard", "priority": 8 },
        { "time": "10:00-10:45", "subject": "Physics", "topic": "Mechanics", "type": "revision", "duration": 45, "difficulty": "medium", "priority": 5 }
      ]
    }
  ]
}`;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    });

    let schedule;
    try {
      const raw = completion.choices[0].message.content.replace(/```json|```/g, '').trim();
      schedule = JSON.parse(raw);
    } catch {
      // Fallback: generate a basic schedule
      schedule = { weeklySchedule: generateBasicSchedule(coloredSubjects, studyHoursPerDay || 4, sessionDuration || 45, breakDuration || 15) };
    }

    // Generate daily plans for 2 weeks
    const dailyPlans = [];
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 14; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dayName = DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1];
      const daySchedule = schedule.weeklySchedule.find(d => d.day === dayName);

      dailyPlans.push({
        date,
        dayOfWeek: dayName,
        slots: daySchedule?.slots || [],
        totalMinutes: (daySchedule?.slots || []).reduce((s, sl) => s + (sl.duration || 45), 0),
        completedMinutes: 0
      });
    }

    const plan = await StudyPlan.create({
      user: userId,
      name: `Study Plan — ${new Date().toLocaleDateString()}`,
      subjects: coloredSubjects,
      studyHoursPerDay: studyHoursPerDay || 4,
      preferredStartTime: preferredStartTime || '09:00',
      preferredEndTime: preferredEndTime || '21:00',
      sessionDuration: sessionDuration || 45,
      breakDuration: breakDuration || 15,
      includeRevision: includeRevision !== false,
      weeklySchedule: schedule.weeklySchedule.map(d => ({
        day: d.day,
        available: true,
        slots: d.slots
      })),
      dailyPlans,
      isActive: true
    });

    res.json({
      plan,
      message: 'Study plan generated successfully!'
    });

  } catch (error) {
    logger.error(`Generate plan error: ${error.message}`);
    res.status(500).json({ error: 'Failed to generate study plan.' });
  }
};

/**
 * GET /api/study-plan/current
 */
const getCurrentPlan = async (req, res) => {
  try {
    const plan = await StudyPlan.findOne({ user: req.user._id, isActive: true }).sort({ createdAt: -1 });
    if (!plan) return res.json({ plan: null });
    res.json({ plan });
  } catch (error) {
    logger.error(`Get plan error: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch study plan.' });
  }
};

/**
 * PUT /api/study-plan/progress
 */
const updateProgress = async (req, res) => {
  try {
    const { slotId, dailyPlanId, completed } = req.body;
    const plan = await StudyPlan.findOne({ user: req.user._id, isActive: true });
    if (!plan) return res.status(404).json({ error: 'No active study plan.' });

    // Find and update the slot
    let updated = false;
    for (const dp of plan.dailyPlans) {
      if (dailyPlanId && dp._id.toString() !== dailyPlanId) continue;
      for (const slot of dp.slots) {
        if (slot._id.toString() === slotId) {
          slot.completed = completed;
          if (completed) dp.completedMinutes += slot.duration;
          else dp.completedMinutes = Math.max(0, dp.completedMinutes - slot.duration);
          updated = true;
          break;
        }
      }
      if (updated) break;
    }

    // Recalculate overall progress
    const totalSlots = plan.dailyPlans.reduce((s, d) => s + d.slots.length, 0);
    const completedSlots = plan.dailyPlans.reduce((s, d) => s + d.slots.filter(sl => sl.completed).length, 0);
    plan.progress.overallCompletion = totalSlots > 0 ? Math.round((completedSlots / totalSlots) * 100) : 0;
    plan.progress.lastUpdated = new Date();

    await plan.save();
    res.json({ plan, message: 'Progress updated!' });
  } catch (error) {
    logger.error(`Update progress error: ${error.message}`);
    res.status(500).json({ error: 'Failed to update progress.' });
  }
};

/**
 * POST /api/study-plan/adjust
 */
const adjustPlan = async (req, res) => {
  try {
    const plan = await StudyPlan.findOne({ user: req.user._id, isActive: true });
    if (!plan) return res.status(404).json({ error: 'No active study plan.' });

    const perf = await Performance.findOne({ user: req.user._id });
    const weakTopics = perf ? perf.weakAreas.map(w => ({ topic: w.topic, score: w.avgScore })) : [];

    const prompt = `Adjust this study plan based on student's progress and weaknesses.

Current plan completion: ${plan.progress.overallCompletion}%
Weak areas: ${JSON.stringify(weakTopics)}
Current subjects: ${JSON.stringify(plan.subjects.map(s => s.name))}

Suggest specific adjustments. Return ONLY JSON:
{
  "adjustments": [
    { "action": "increase_time", "subject": "Math", "topic": "Calculus", "reason": "Low scores, need more practice" },
    { "action": "add_revision", "subject": "Physics", "topic": "Mechanics", "reason": "Not reviewed recently" }
  ],
  "message": "Summary of adjustments made"
}`;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.5,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    });

    let adjustments;
    try {
      const raw = completion.choices[0].message.content.replace(/```json|```/g, '').trim();
      adjustments = JSON.parse(raw);
    } catch {
      adjustments = { adjustments: [], message: 'Plan reviewed — currently on track!' };
    }

    plan.adjustmentHistory.push({
      date: new Date(),
      reason: 'Dynamic adjustment based on progress',
      changes: adjustments.message
    });
    await plan.save();

    res.json({ adjustments: adjustments.adjustments, message: adjustments.message, plan });
  } catch (error) {
    logger.error(`Adjust plan error: ${error.message}`);
    res.status(500).json({ error: 'Failed to adjust plan.' });
  }
};

// Fallback basic schedule generator
function generateBasicSchedule(subjects, hoursPerDay, sessionDuration, breakDuration) {
  const schedule = [];
  for (const day of DAYS) {
    const slots = [];
    let currentTime = 9 * 60; // 9:00 AM in minutes
    const maxTime = currentTime + hoursPerDay * 60;

    let subjectIndex = 0;
    while (currentTime + sessionDuration <= maxTime && subjectIndex < subjects.length * 2) {
      const subject = subjects[subjectIndex % subjects.length];
      const topic = subject.topics[Math.floor(subjectIndex / subjects.length) % subject.topics.length];
      const startH = String(Math.floor(currentTime / 60)).padStart(2, '0');
      const startM = String(currentTime % 60).padStart(2, '0');
      const endTime = currentTime + sessionDuration;
      const endH = String(Math.floor(endTime / 60)).padStart(2, '0');
      const endM = String(endTime % 60).padStart(2, '0');

      slots.push({
        time: `${startH}:${startM}-${endH}:${endM}`,
        subject: subject.name,
        topic: topic?.name || subject.name,
        type: subjectIndex % 4 === 3 ? 'revision' : 'study',
        duration: sessionDuration,
        difficulty: topic?.difficulty || 'medium',
        priority: 5
      });

      currentTime = endTime + breakDuration;
      subjectIndex++;
    }
    schedule.push({ day, slots });
  }
  return schedule;
}

module.exports = { generatePlan, getCurrentPlan, updateProgress, adjustPlan };
