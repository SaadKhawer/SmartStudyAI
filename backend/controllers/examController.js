/**
 * examController.js
 * AI Oral Examiner — conducts real exams, evaluates answers,
 * asks follow-ups, generates detailed report at the end.
 */

const OpenAI  = require('openai');
const Document = require('../models/Document');
const mongoose = require('mongoose');

const groq = new OpenAI({
  apiKey:  process.env.GROK_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

const MODEL = process.env.GROK_MODEL || 'llama-3.3-70b-versatile';

// ─── In-memory exam sessions (use Redis in production) ────────────────────────
// Structure: { [sessionId]: { userId, topic, difficulty, questions:[],
//               answers:[], currentQ:0, stage:'questioning'|'complete' } }
const examSessions = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// START EXAM
// POST /api/exam/start
// ─────────────────────────────────────────────────────────────────────────────
const startExam = async (req, res) => {
  try {
    const { topic, difficulty = 'medium', totalQuestions = 5, documentId } = req.body;
    const userId = req.user._id.toString();

    if (!topic && !documentId) {
      return res.status(400).json({ error: 'Topic or document is required.' });
    }

    // Build context from document if provided
    let context = '';
    let examTopic = topic;
    if (documentId) {
      const doc = await Document.findOne({ _id: documentId, user: req.user._id });
      if (doc) {
        context = doc.textContent?.substring(0, 4000) || '';
        examTopic = examTopic || doc.name;
      }
    }

    // Generate first question from AI
    const systemPrompt = `You are a strict but fair university examiner conducting an oral exam on "${examTopic}".
Difficulty: ${difficulty}. Total questions: ${totalQuestions}.
${context ? `Study material context:\n${context}\n` : ''}

Your job:
1. Ask ONE clear exam question at a time
2. After student answers, evaluate and ask follow-up if needed
3. Be professional and encouraging
4. Ask questions that test real understanding, not just memorization

Return ONLY valid JSON, no extra text.`;

    const firstQCompletion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      max_tokens: 500,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Generate question 1 of ${totalQuestions} for the oral exam on "${examTopic}" at ${difficulty} difficulty.
Return ONLY this JSON:
{
  "question": "the exam question here",
  "questionNumber": 1,
  "topic": "sub-topic this question covers",
  "hint": "optional hint if student is completely stuck"
}`
        }
      ]
    });

    let firstQ;
    try {
      const raw = firstQCompletion.choices[0].message.content
        .replace(/```json|```/g, '').trim();
      firstQ = JSON.parse(raw);
    } catch {
      firstQ = {
        question: `Explain the core concept of ${examTopic} in your own words.`,
        questionNumber: 1,
        topic: examTopic,
        hint: 'Think about the fundamental principles.'
      };
    }

    // Create exam session
    const sessionId = new mongoose.Types.ObjectId().toString();
    examSessions.set(sessionId, {
      userId,
      topic: examTopic,
      difficulty,
      totalQuestions,
      context,
      systemPrompt,
      questions: [firstQ],
      answers: [],
      evaluations: [],
      currentQuestion: 1,
      followUpCount: 0,
      stage: 'questioning',
      startTime: new Date(),
    });

    res.json({
      sessionId,
      examiner: {
        message: `Welcome to your oral exam on **${examTopic}**! I will ask you ${totalQuestions} questions. Take your time and answer thoroughly. Let's begin! 🎓`,
        question: firstQ.question,
        questionNumber: 1,
        totalQuestions,
        topic: firstQ.topic,
      }
    });

  } catch (err) {
    console.error('Start exam error:', err.message);
    res.status(500).json({ error: 'Failed to start exam. Try again.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBMIT ANSWER
// POST /api/exam/answer
// ─────────────────────────────────────────────────────────────────────────────
const submitAnswer = async (req, res) => {
  try {
    const { sessionId, answer } = req.body;
    const userId = req.user._id.toString();

    const session = examSessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return res.status(404).json({ error: 'Exam session not found.' });
    }
    if (session.stage === 'complete') {
      return res.status(400).json({ error: 'This exam is already completed.' });
    }
    if (!answer || answer.trim().length < 3) {
      return res.status(400).json({ error: 'Answer is too short.' });
    }

    const currentQ = session.questions[session.currentQuestion - 1];
    session.answers.push({ question: currentQ.question, answer: answer.trim() });

    // Evaluate the answer
    const evalCompletion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      max_tokens: 800,
      messages: [
        { role: 'system', content: session.systemPrompt },
        {
          role: 'user',
          content: `Evaluate this student answer for the oral exam.

Question: "${currentQ.question}"
Student's Answer: "${answer.trim()}"

Evaluate strictly but fairly. Return ONLY this JSON:
{
  "score": <number 0-10>,
  "quality": "excellent|good|partial|poor",
  "feedback": "specific feedback on this answer (2-3 sentences)",
  "correctPoints": ["point student got right"],
  "missedPoints": ["important point student missed"],
  "needsFollowUp": <true if answer is partial and follow-up would help>,
  "followUpQuestion": "follow-up question if needed, else null"
}`
        }
      ]
    });

    let evaluation;
    try {
      const raw = evalCompletion.choices[0].message.content
        .replace(/```json|```/g, '').trim();
      evaluation = JSON.parse(raw);
    } catch {
      evaluation = {
        score: 5, quality: 'partial',
        feedback: 'Answer received. Let\'s continue.',
        correctPoints: [], missedPoints: [],
        needsFollowUp: false, followUpQuestion: null
      };
    }

    session.evaluations.push({ ...evaluation, questionNumber: session.currentQuestion });

    // Decide: follow-up or next question or end exam
    const canFollowUp = evaluation.needsFollowUp && session.followUpCount < 1;
    const isLastQuestion = session.currentQuestion >= session.totalQuestions;

    let response = {
      sessionId,
      evaluation: {
        score: evaluation.score,
        quality: evaluation.quality,
        feedback: evaluation.feedback,
        correctPoints: evaluation.correctPoints,
        missedPoints: evaluation.missedPoints,
      },
      isComplete: false,
      isFollowUp: false,
    };

    if (canFollowUp && evaluation.followUpQuestion) {
      // Ask follow-up question
      session.followUpCount++;
      response.isFollowUp = true;
      response.examiner = {
        message: `Interesting answer! Let me probe a bit deeper...`,
        question: evaluation.followUpQuestion,
        questionNumber: session.currentQuestion,
        totalQuestions: session.totalQuestions,
        isFollowUp: true,
      };
      // Add follow-up to questions list
      session.questions.push({
        question: evaluation.followUpQuestion,
        questionNumber: session.currentQuestion,
        topic: currentQ.topic,
        isFollowUp: true
      });

    } else if (isLastQuestion) {
      // Generate final report
      session.stage = 'complete';
      session.endTime = new Date();

      const report = await generateFinalReport(session);
      response.isComplete = true;
      response.report = report;
      response.examiner = {
        message: `Exam complete! Here is your detailed performance report. Well done for completing the exam! 🎓`
      };

    } else {
      // Next question
      session.currentQuestion++;
      session.followUpCount = 0;

      const nextQCompletion = await groq.chat.completions.create({
        model: MODEL,
        temperature: 0.7,
        max_tokens: 400,
        messages: [
          { role: 'system', content: session.systemPrompt },
          {
            role: 'user',
            content: `Generate question ${session.currentQuestion} of ${session.totalQuestions} for oral exam on "${session.topic}".
Previous questions asked: ${session.questions.filter(q => !q.isFollowUp).map(q => q.question).join(' | ')}
Make sure this question covers a DIFFERENT aspect. Return ONLY JSON:
{
  "question": "the exam question",
  "questionNumber": ${session.currentQuestion},
  "topic": "sub-topic covered",
  "hint": "hint if stuck"
}`
          }
        ]
      });

      let nextQ;
      try {
        const raw = nextQCompletion.choices[0].message.content
          .replace(/```json|```/g, '').trim();
        nextQ = JSON.parse(raw);
      } catch {
        nextQ = {
          question: `Describe another key aspect of ${session.topic}.`,
          questionNumber: session.currentQuestion,
          topic: session.topic,
          hint: null
        };
      }

      session.questions.push(nextQ);
      response.examiner = {
        message: getTransitionMessage(evaluation.quality),
        question: nextQ.question,
        questionNumber: session.currentQuestion,
        totalQuestions: session.totalQuestions,
        topic: nextQ.topic,
      };
    }

    res.json(response);

  } catch (err) {
    console.error('Submit answer error:', err.message);
    res.status(500).json({ error: 'Failed to process answer. Try again.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE FINAL REPORT
// ─────────────────────────────────────────────────────────────────────────────
async function generateFinalReport(session) {
  const avgScore = session.evaluations.reduce((s, e) => s + e.score, 0) / session.evaluations.length;
  const duration = Math.round((session.endTime - session.startTime) / 1000 / 60);

  const reportCompletion = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: `Generate a detailed oral exam report based on this data:

Topic: ${session.topic}
Difficulty: ${session.difficulty}
Duration: ${duration} minutes
Average Score: ${avgScore.toFixed(1)}/10

Questions & Evaluations:
${session.evaluations.map((e, i) => `
Q${i + 1}: ${session.questions[i]?.question}
Score: ${e.score}/10 (${e.quality})
Correct: ${e.correctPoints?.join(', ') || 'none'}
Missed: ${e.missedPoints?.join(', ') || 'none'}
`).join('\n')}

Return ONLY this JSON:
{
  "overallScore": <0-100 percentage>,
  "grade": "A+|A|B+|B|C|D|F",
  "summary": "2-3 sentence overall performance summary",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weakAreas": ["weak area 1", "weak area 2"],
  "improvementPlan": [
    { "area": "topic to improve", "action": "specific thing to do", "resource": "how to study it" }
  ],
  "topicsToRevise": ["topic1", "topic2"],
  "examinerComment": "encouraging final comment from examiner",
  "readyForRealExam": <true|false>
}`
    }]
  });

  let report;
  try {
    const raw = reportCompletion.choices[0].message.content
      .replace(/```json|```/g, '').trim();
    report = JSON.parse(raw);
  } catch {
    report = {
      overallScore: Math.round(avgScore * 10),
      grade: avgScore >= 9 ? 'A+' : avgScore >= 8 ? 'A' : avgScore >= 7 ? 'B+' : avgScore >= 6 ? 'B' : 'C',
      summary: `You completed the exam on ${session.topic}. Keep practicing!`,
      strengths: ['Attempted all questions', 'Showed understanding'],
      weakAreas: ['Needs more detail in answers'],
      improvementPlan: [{ area: session.topic, action: 'Review core concepts', resource: 'Textbook chapter review' }],
      topicsToRevise: [session.topic],
      examinerComment: 'Good effort! Keep studying and you will improve.',
      readyForRealExam: avgScore >= 6
    };
  }

  report.duration = duration;
  report.avgScore = parseFloat(avgScore.toFixed(1));
  report.questionsAnswered = session.evaluations.length;
  report.questionBreakdown = session.evaluations.map((e, i) => ({
    question: session.questions[i]?.question,
    score: e.score,
    quality: e.quality,
    feedback: e.feedback
  }));

  return report;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET HINT
// POST /api/exam/hint
// ─────────────────────────────────────────────────────────────────────────────
const getHint = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = examSessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const currentQ = session.questions[session.currentQuestion - 1];
    const hint = currentQ.hint || `Think about the fundamental principles of ${currentQ.topic || session.topic}.`;

    res.json({ hint, penaltyNote: '(-1 point for using hint)' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get hint.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET DOCUMENTS LIST (for exam setup)
// GET /api/exam/documents
// ─────────────────────────────────────────────────────────────────────────────
const getExamDocuments = async (req, res) => {
  try {
    const docs = await Document.find({
      user: req.user._id,
      embeddingStatus: 'completed'
    }).select('name subject chunkCount createdAt');
    res.json({ documents: docs });
  } catch (err) {
    res.status(500).json({ error: 'Documents not found.' });
  }
};

// Helper
function getTransitionMessage(quality) {
  const messages = {
    excellent: ['Excellent answer! 🌟 Next question:', 'Perfect! Moving on:', 'Outstanding! 🎯'],
    good:      ['Good answer! Next question:', 'Well done! Continuing:', 'Nice work! 👍'],
    partial:   ['Partially correct. Let\'s continue:', 'Some good points. Next:', 'Okay, moving forward:'],
    poor:      ['Let\'s move on:', 'Next question:', 'Continuing with the exam:']
  };
  const arr = messages[quality] || messages.partial;
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = { startExam, submitAnswer, getHint, getExamDocuments };
