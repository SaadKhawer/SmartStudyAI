// pages/QuizPage.js
import React, { useState, useEffect } from 'react';
import { Brain, CheckCircle, XCircle, RefreshCw, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import AppLayout from '../components/Layout/AppLayout';
import { documentAPI, weaknessAPI, gamificationAPI } from '../services/api';

const api = axios.create({ baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api' });
api.interceptors.request.use(config => {
  const token = localStorage.getItem('studyai_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function QuizPage() {
  const [topic, setTopic]           = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [count, setCount]           = useState(5);
  const [documents, setDocuments]   = useState([]);
  const [selectedDoc, setSelectedDoc] = useState('');
  const [questions, setQuestions]   = useState([]);
  const [answers, setAnswers]       = useState({});
  const [submitted, setSubmitted]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [score, setScore]           = useState(0);

  useEffect(() => {
    documentAPI.getAll()
      .then(r => setDocuments(r.data.documents?.filter(d => d.embeddingStatus === 'completed') || []))
      .catch(() => {});
  }, []);

  const generateQuiz = async () => {
    if (!topic && !selectedDoc) {
      toast.error('Enter a topic or select a document!');
      return;
    }
    setLoading(true);
    setSubmitted(false);
    setAnswers({});
    setQuestions([]);
    try {
      const { data } = await api.post('/quiz/generate', {
        topic, difficulty, count,
        documentId: selectedDoc || null
      });
      setQuestions(data.questions);
      toast.success(`${data.questions.length} questions ready!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate quiz');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (qIndex, option) => {
    if (submitted) return;
    setAnswers(a => ({ ...a, [qIndex]: option[0] })); // Store "A", "B" etc
  };

  const submitQuiz = async () => {
    if (Object.keys(answers).length < questions.length) {
      toast.error('Answer all questions!');
      return;
    }
    let correct = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correct) correct++;
    });
    setScore(correct);
    setSubmitted(true);
    if (correct === questions.length) toast.success('Perfect score! 🎉');
    else if (correct >= questions.length / 2) toast.success('Well done! 👍');
    else toast('Keep practicing! 💪');

    // Record result for weakness analysis
    try {
      await weaknessAPI.recordResult({
        type: 'quiz', topic: topic || 'General', score: correct,
        total: questions.length, difficulty,
        questionsData: questions.map((q, i) => ({ question: q.question, correct: answers[i] === q.correct, topic: topic || 'General' }))
      });
    } catch {}

    // Award XP
    try {
      await gamificationAPI.awardXP({ action: 'quiz_complete', description: `Quiz: ${correct}/${questions.length} on ${topic || 'document'}` });
      if (correct === questions.length) {
        await gamificationAPI.awardXP({ action: 'perfect_score', description: 'Perfect quiz score!' });
      }
    } catch {}
  };

  const percentage = submitted ? Math.round((score / questions.length) * 100) : 0;

  return (
    <AppLayout>
      <div style={{ padding: '28px 32px', flex: 1, overflowY: 'auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 className="page-title">🧠 AI Quiz Generator</h1>
          <p className="page-subtitle">Generate a quiz from documents or any topic</p>
        </div>

        {/* Quiz Settings */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Topic (or select a document)</label>
              <input className="form-input" placeholder="e.g. Newton's Laws, Photosynthesis..."
                value={topic} onChange={e => setTopic(e.target.value)} disabled={!!selectedDoc} />
            </div>
            <div className="form-group">
              <label className="form-label">Quiz from Document (Optional)</label>
              <select className="form-input" value={selectedDoc}
                onChange={e => { setSelectedDoc(e.target.value); setTopic(''); }}>
                <option value="">-- Select a document --</option>
                {documents.map(d => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Difficulty</label>
              <select className="form-input" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                <option value="easy">Easy 😊</option>
                <option value="medium">Medium 🤔</option>
                <option value="hard">Hard 🔥</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Number of Questions</label>
              <select className="form-input" value={count} onChange={e => setCount(Number(e.target.value))}>
                {[3, 5, 10, 15].map(n => <option key={n} value={n}>{n} Questions</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary" onClick={generateQuiz} disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Generating...</> : <><Brain size={16} /> Generate Quiz</>}
          </button>
        </div>

        {/* Score Card */}
        {submitted && (
          <div className="card" style={{ marginBottom: 24, textAlign: 'center', background: percentage >= 70 ? 'rgba(74,222,128,0.1)' : 'rgba(251,146,60,0.1)', borderColor: percentage >= 70 ? 'var(--success)' : 'var(--warning)' }}>
            <Trophy size={40} style={{ color: percentage >= 70 ? 'var(--success)' : 'var(--warning)', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 48, fontWeight: 700, color: percentage >= 70 ? 'var(--success)' : 'var(--warning)' }}>{percentage}%</div>
            <div style={{ fontSize: 16, marginTop: 4 }}>{score} / {questions.length} correct</div>
            <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => { setSubmitted(false); setAnswers({}); setQuestions([]); }}>
              <RefreshCw size={15} /> Try Again
            </button>
          </div>
        )}

        {/* Questions */}
        {questions.map((q, i) => (
          <div key={i} className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>
              Q{i + 1}. {q.question}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {q.options.map((opt, j) => {
                const letter = opt[0];
                const isSelected = answers[i] === letter;
                const isCorrect = submitted && letter === q.correct;
                const isWrong = submitted && isSelected && letter !== q.correct;
                return (
                  <div key={j} onClick={() => handleAnswer(i, opt)}
                    style={{
                      padding: '10px 14px', borderRadius: 'var(--radius-md)',
                      border: `1px solid ${isCorrect ? 'var(--success)' : isWrong ? 'var(--danger)' : isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      background: isCorrect ? 'rgba(74,222,128,0.1)' : isWrong ? 'rgba(248,113,113,0.1)' : isSelected ? 'var(--accent-dim)' : 'var(--bg-hover)',
                      cursor: submitted ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 10, fontSize: 14
                    }}>
                    {submitted && isCorrect && <CheckCircle size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />}
                    {submitted && isWrong && <XCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
                    {opt}
                  </div>
                );
              })}
            </div>
            {submitted && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--accent-dim)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-secondary)' }}>
                💡 {q.explanation}
              </div>
            )}
          </div>
        ))}

        {questions.length > 0 && !submitted && (
          <button className="btn btn-primary btn-lg" onClick={submitQuiz}>
            <CheckCircle size={16} /> Submit Quiz
          </button>
        )}
      </div>
    </AppLayout>
  );
}