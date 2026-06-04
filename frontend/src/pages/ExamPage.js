// pages/ExamPage.js
import React, { useState, useRef, useEffect } from 'react';
import {
  GraduationCap, Send, Lightbulb, ChevronRight,
  Trophy, Target, AlertTriangle, CheckCircle,
  XCircle, BookOpen, Clock, BarChart2, RefreshCw,
  Mic, MicOff, Star
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';
import axios from 'axios';
import AppLayout from '../components/Layout/AppLayout';

// ─── API instance ─────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api'
});
api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('studyai_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// ─── Grade Color ──────────────────────────────────────────────────────────────
function gradeColor(g) {
  if (['A+','A'].includes(g)) return 'var(--success)';
  if (['B+','B'].includes(g)) return 'var(--accent)';
  if (g === 'C') return 'var(--warning)';
  return 'var(--danger)';
}

// ─── Score Circle ─────────────────────────────────────────────────────────────
function ScoreCircle({ score, max = 100, size = 120 }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score / max;
  const color = score >= 70 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)';
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="var(--bg-hover)" strokeWidth="8"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth="8"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 1s ease' }}/>
      <text x={size/2} y={size/2 - 6} textAnchor="middle"
        fill={color} fontSize="22" fontWeight="700">{score}%</text>
      <text x={size/2} y={size/2 + 14} textAnchor="middle"
        fill="var(--text-muted)" fontSize="11">Score</text>
    </svg>
  );
}

// ─── Quality Badge ────────────────────────────────────────────────────────────
function QualityBadge({ q }) {
  const map = {
    excellent: { color: 'var(--success)', label: '⭐ Excellent' },
    good:      { color: 'var(--accent)',  label: '👍 Good' },
    partial:   { color: 'var(--warning)', label: '⚡ Partial' },
    poor:      { color: 'var(--danger)',  label: '❌ Poor' },
  };
  const s = map[q] || map.partial;
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 99,
      background: s.color + '22', color: s.color,
      fontSize: 12, fontWeight: 600
    }}>{s.label}</span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function ExamSetup({ onStart }) {
  const [topic, setTopic]           = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [count, setCount]           = useState(5);
  const [documents, setDocs]        = useState([]);
  const [selectedDoc, setDoc]       = useState('');
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    api.get('/exam/documents')
      .then(r => setDocs(r.data.documents || []))
      .catch(() => {});
  }, []);

  const handleStart = async () => {
    if (!topic.trim() && !selectedDoc) {
      toast.error('Enter a topic or select a document!'); return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/exam/start', {
        topic: topic.trim(),
        difficulty, totalQuestions: count,
        documentId: selectedDoc || null
      });
      onStart(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start exam');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 20px' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{
          width: 72, height: 72, background: 'var(--accent)',
          borderRadius: 20, display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 16px',
          boxShadow: 'var(--shadow-accent)', fontSize: 34
        }}>🎓</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>AI Oral Examiner</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 15 }}>
          Real exam experience — questions, follow-ups, detailed report
        </p>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Topic */}
        <div className="form-group">
          <label className="form-label">📚 Exam Topic *</label>
          <input className="form-input" placeholder="e.g. Newton's Laws, Photosynthesis, World War 2..."
            value={topic} onChange={e => { setTopic(e.target.value); setDoc(''); }} />
        </div>

        {/* OR document */}
        {documents.length > 0 && (
          <div className="form-group">
            <label className="form-label">📄 Or take an exam from your document</label>
            <select className="form-input" value={selectedDoc}
              onChange={e => { setDoc(e.target.value); setTopic(''); }}>
              <option value="">-- Select a document (optional) --</option>
              {documents.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
        )}

        {/* Settings row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">⚡ Difficulty</label>
            <select className="form-input" value={difficulty}
              onChange={e => setDifficulty(e.target.value)}>
              <option value="easy">Easy 😊</option>
              <option value="medium">Medium 🤔</option>
              <option value="hard">Hard 🔥</option>
              <option value="expert">Expert 💀</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">❓ Questions</label>
            <select className="form-input" value={count}
              onChange={e => setCount(Number(e.target.value))}>
              {[3, 5, 7, 10].map(n =>
                <option key={n} value={n}>{n} Questions</option>)}
            </select>
          </div>
        </div>

        {/* What to expect */}
        <div style={{
          background: 'var(--accent-dim)', borderRadius: 'var(--radius-md)',
          padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)'
        }}>
          <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>
            🎯 What to expect in this exam:
          </div>
          <div>• AI examiner will ask {count} questions</div>
          <div>• Incomplete answers will trigger follow-up questions</div>
          <div>• Every answer is evaluated in real-time</div>
          <div>• Get a detailed report with an improvement plan at the end</div>
        </div>

        <button className="btn btn-primary btn-lg btn-full"
          onClick={handleStart} disabled={loading}>
          {loading
            ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Setting up exam...</>
            : <><GraduationCap size={18} /> Start Exam</>}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXAM SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function ExamRoom({ initData, onComplete }) {
  const [sessionId]              = useState(initData.sessionId);
  const [currentQuestion, setQ]  = useState(initData.examiner);
  const [answer, setAnswer]      = useState('');
  const [loading, setLoading]    = useState(false);
  const [lastEval, setLastEval]  = useState(null);
  const [history, setHistory]    = useState([]);
  const [hintText, setHint]      = useState('');
  const [hintUsed, setHintUsed]  = useState(false);
  const [listening, setListening]= useState(false);
  const [elapsed, setElapsed]    = useState(0);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  // Timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const formatTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  // Voice input setup
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SR();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.onresult = e => {
        const transcript = e.results[0][0].transcript;
        setAnswer(a => a + (a ? ' ' : '') + transcript);
        setListening(false);
      };
      recognitionRef.current.onerror = () => setListening(false);
      recognitionRef.current.onend = () => setListening(false);
    }
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      toast.error('Voice input is not supported in this browser. Use Chrome!');
      return;
    }
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      recognitionRef.current.start();
      setListening(true);
      toast('🎤 Listening...', { duration: 3000 });
    }
  };

  const handleHint = async () => {
    if (hintUsed) return;
    try {
      const { data } = await api.post('/exam/hint', { sessionId });
      setHint(data.hint);
      setHintUsed(true);
      toast('💡 Hint used! -1 point deducted', { icon: '⚠️' });
    } catch { toast.error('Failed to get hint'); }
  };

  const handleSubmit = async () => {
    if (!answer.trim() || loading) return;
    setLoading(true);

    // Add to history
    const qRecord = { ...currentQuestion, myAnswer: answer.trim() };

    try {
      const { data } = await api.post('/exam/answer', {
        sessionId, answer: answer.trim()
      });

      setLastEval(data.evaluation);
      setHistory(h => [...h, { ...qRecord, evaluation: data.evaluation }]);
      setAnswer('');
      setHint('');
      setHintUsed(false);

      if (data.isComplete) {
        setTimeout(() => onComplete(data.report), 1500);
      } else {
        setQ(data.examiner);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  const progress = currentQuestion
    ? (currentQuestion.questionNumber / currentQuestion.totalQuestions) * 100
    : 100;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Left — Question History */}
      <div style={{
        width: 260, borderRight: '1px solid var(--border)',
        background: 'var(--bg-surface)', display: 'flex',
        flexDirection: 'column', overflowY: 'auto', padding: '16px 12px'
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          Answered Questions
        </div>
        {history.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 20 }}>
            No answers yet
          </div>
        )}
        {history.map((h, i) => (
          <div key={i} style={{
            padding: '10px 12px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)', marginBottom: 8,
            background: 'var(--bg-card)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Q{h.questionNumber}</span>
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: h.evaluation.score >= 7 ? 'var(--success)' :
                       h.evaluation.score >= 5 ? 'var(--warning)' : 'var(--danger)'
              }}>{h.evaluation.score}/10</span>
            </div>
            <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {h.question}
            </div>
            <QualityBadge q={h.evaluation.quality} />
          </div>
        ))}
      </div>

      {/* Main Exam Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          padding: '14px 24px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🎓</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>AI Oral Examiner</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Q{currentQuestion?.questionNumber || '?'} of {currentQuestion?.totalQuestions || '?'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 13, color: 'var(--text-secondary)' }}>
              <Clock size={14} /> {formatTime(elapsed)}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="progress-bar" style={{ height: 3, borderRadius: 0 }}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>

          {/* Welcome / Question Card */}
          {currentQuestion && (
            <div style={{ maxWidth: 680, margin: '0 auto' }}>

              {/* Examiner speaking */}
              <div style={{
                display: 'flex', gap: 14, marginBottom: 24, alignItems: 'flex-start'
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'var(--accent)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0
                }}>🎓</div>
                <div style={{ flex: 1 }}>
                  {currentQuestion.message && (
                    <div style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)', padding: '14px 18px',
                      marginBottom: 12, fontSize: 14
                    }}>
                      <ReactMarkdown>{currentQuestion.message}</ReactMarkdown>
                    </div>
                  )}
                  {currentQuestion.question && (
                    <div style={{
                      background: 'var(--accent-dim)',
                      border: '1px solid var(--border-focus)',
                      borderRadius: 'var(--radius-lg)', padding: '18px 20px',
                    }}>
                      {currentQuestion.isFollowUp && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                          textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                          🔍 Follow-up Question
                        </div>
                      )}
                      <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.6 }}>
                        {currentQuestion.question}
                      </div>
                      {currentQuestion.topic && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                          Topic: {currentQuestion.topic}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Last evaluation feedback */}
              {lastEval && (
                <div style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)', padding: '16px 18px',
                  marginBottom: 24
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Previous Answer Evaluation</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <QualityBadge q={lastEval.quality} />
                      <span style={{ fontSize: 14, fontWeight: 700,
                        color: lastEval.score >= 7 ? 'var(--success)' :
                               lastEval.score >= 5 ? 'var(--warning)' : 'var(--danger)' }}>
                        {lastEval.score}/10
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    {lastEval.feedback}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {lastEval.correctPoints?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)',
                          marginBottom: 4 }}>✅ Correct Points:</div>
                        {lastEval.correctPoints.map((p, i) => (
                          <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>• {p}</div>
                        ))}
                      </div>
                    )}
                    {lastEval.missedPoints?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)',
                          marginBottom: 4 }}>❌ Missed Points:</div>
                        {lastEval.missedPoints.map((p, i) => (
                          <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>• {p}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hint */}
              {hintText && (
                <div style={{
                  background: 'rgba(251,146,60,0.1)', border: '1px solid var(--warning)',
                  borderRadius: 'var(--radius-md)', padding: '12px 16px',
                  marginBottom: 16, fontSize: 13, color: 'var(--warning)'
                }}>
                  💡 Hint: {hintText}
                </div>
              )}

              {/* Answer Input */}
              <div style={{
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: '14px 16px',
                transition: 'border-color 0.2s'
              }}>
                <textarea
                  ref={textareaRef}
                  style={{
                    width: '100%', minHeight: 120, resize: 'vertical',
                    background: 'transparent', border: 'none', outline: 'none',
                    fontFamily: 'var(--font-sans)', fontSize: 14,
                    color: 'var(--text-primary)', lineHeight: 1.7
                  }}
                  placeholder="Type your answer here... (or use the mic button)"
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.ctrlKey) handleSubmit();
                  }}
                  disabled={loading}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginTop: 10, paddingTop: 10,
                  borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {/* Voice button */}
                    <button
                      onClick={toggleVoice}
                      className={`btn btn-sm ${listening ? 'btn-danger' : 'btn-secondary'}`}
                      title="Voice input"
                    >
                      {listening ? <><MicOff size={13} /> Stop</> : <><Mic size={13} /> Voice</>}
                    </button>
                    {/* Hint button */}
                    <button onClick={handleHint} disabled={hintUsed}
                      className="btn btn-secondary btn-sm">
                      <Lightbulb size={13} /> {hintUsed ? 'Hint used' : 'Hint'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Ctrl+Enter to submit
                    </span>
                    <button onClick={handleSubmit}
                      disabled={!answer.trim() || loading}
                      className="btn btn-primary">
                      {loading
                        ? <><div className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} /> Evaluating...</>
                        : <><Send size={14} /> Submit Answer</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function ExamReport({ report, onRetake }) {
  const gradeCol = gradeColor(report.grade);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px', overflowY: 'auto' }}>

      {/* Hero Score */}
      <div className="card" style={{ textAlign: 'center', marginBottom: 20, padding: '32px 24px' }}>
        <div style={{ marginBottom: 16 }}>
          <ScoreCircle score={report.overallScore} size={140} />
        </div>
        <div style={{ fontSize: 52, fontWeight: 800, color: gradeCol, lineHeight: 1 }}>
          {report.grade}
        </div>
        <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 8 }}>
          {report.summary}
        </div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 16,
          flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{report.questionsAnswered}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Questions</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{report.avgScore}/10</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Avg Score</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{report.duration}m</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Duration</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {report.readyForRealExam ? '✅' : '❌'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Exam Ready</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Strengths */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--success)' }}>
            💪 Your Strengths
          </div>
          {report.strengths?.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 13 }}>
              <CheckCircle size={14} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 1 }} />
              {s}
            </div>
          ))}
        </div>

        {/* Weak Areas */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--danger)' }}>
            🎯 Weak Areas
          </div>
          {report.weakAreas?.map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 13 }}>
              <AlertTriangle size={14} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
              {w}
            </div>
          ))}
        </div>
      </div>

      {/* Improvement Plan */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>
          📋 Improvement Plan
        </div>
        {report.improvementPlan?.map((plan, i) => (
          <div key={i} style={{
            padding: '12px 14px', background: 'var(--bg-hover)',
            borderRadius: 'var(--radius-md)', marginBottom: 10
          }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
              {i + 1}. {plan.area}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3 }}>
              🎯 Action: {plan.action}
            </div>
            <div style={{ fontSize: 12, color: 'var(--accent)' }}>
              📚 How: {plan.resource}
            </div>
          </div>
        ))}
      </div>

      {/* Question Breakdown */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>
          📊 Question by Question Breakdown
        </div>
        {report.questionBreakdown?.map((q, i) => (
          <div key={i} style={{
            padding: '12px 14px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)', marginBottom: 10
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                Q{i + 1}: {q.question}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <QualityBadge q={q.quality} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>{q.score}/10</span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{q.feedback}</div>
          </div>
        ))}
      </div>

      {/* Examiner comment */}
      <div style={{
        background: 'var(--accent-dim)', border: '1px solid var(--border-focus)',
        borderRadius: 'var(--radius-lg)', padding: '20px 24px',
        marginBottom: 24, textAlign: 'center'
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🎓</div>
        <div style={{ fontSize: 14, fontStyle: 'italic', color: 'var(--text-secondary)' }}>
          "{report.examinerComment}"
        </div>
        <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 6 }}>
          — AI Examiner
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button className="btn btn-primary btn-lg" onClick={onRetake}>
          <RefreshCw size={16} /> Retake Exam
        </button>
        <button className="btn btn-secondary btn-lg"
          onClick={() => window.print()}>
          🖨️ Print Report
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function ExamPage() {
  const [stage, setStage]     = useState('setup');   // setup | exam | report
  const [initData, setInit]   = useState(null);
  const [report, setReport]   = useState(null);

  const handleStart = (data) => { setInit(data); setStage('exam'); };
  const handleComplete = (r) => { setReport(r); setStage('report'); };
  const handleRetake = () => { setInit(null); setReport(null); setStage('setup'); };

  return (
    <AppLayout>
      <div style={{ flex: 1, overflowY: stage === 'exam' ? 'hidden' : 'auto' }}>
        {stage === 'setup'  && <ExamSetup onStart={handleStart} />}
        {stage === 'exam'   && <ExamRoom initData={initData} onComplete={handleComplete} />}
        {stage === 'report' && <ExamReport report={report} onRetake={handleRetake} />}
      </div>
    </AppLayout>
  );
}
