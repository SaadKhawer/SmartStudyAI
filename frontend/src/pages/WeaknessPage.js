import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Target, Lightbulb, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import AppLayout from '../components/Layout/AppLayout';
import { weaknessAPI } from '../services/api';

const TREND_ICONS = { improving: TrendingUp, declining: TrendingDown, stable: Minus };
const TREND_COLORS = { improving: '#4ade80', declining: '#f87171', stable: '#fb923c' };
const URGENCY_COLORS = { critical: '#f87171', high: '#fb923c', medium: '#facc15', low: '#4ade80' };

export default function WeaknessPage() {
  const [analysis, setAnalysis] = useState(null);
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    weaknessAPI.getAnalysis()
      .then(r => setAnalysis(r.data))
      .catch(() => toast.error('Failed to load analysis'))
      .finally(() => setLoading(false));
  }, []);

  const loadStrategies = async () => {
    setLoadingStrategies(true);
    try {
      const { data } = await weaknessAPI.getStrategies();
      setStrategies(data.strategies);
      setActiveTab('strategies');
    } catch { toast.error('Failed to load strategies'); }
    finally { setLoadingStrategies(false); }
  };

  if (loading) return <AppLayout><div className="app-loading"><div className="spinner" /></div></AppLayout>;

  const hasData = analysis && analysis.topicScores && analysis.topicScores.length > 0;
  const maxScore = 100;

  return (
    <AppLayout>
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 className="page-title">📊 Weakness Analyzer</h1>
            <p className="page-subtitle">Track performance, identify gaps, and get AI improvement strategies</p>
          </div>
          <button className="btn btn-primary" onClick={loadStrategies} disabled={loadingStrategies}>
            {loadingStrategies ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Loading...</> : <><Lightbulb size={14} /> Get AI Strategies</>}
          </button>
        </div>

        {/* Stats Overview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
          {[
            { label: 'Overall Accuracy', value: `${analysis?.overallAccuracy || 0}%`, icon: '🎯', color: '#6c8ef5' },
            { label: 'Total Quizzes', value: analysis?.totalQuizzes || 0, icon: '🧠', color: '#4ade80' },
            { label: 'Total Exams', value: analysis?.totalExams || 0, icon: '🎓', color: '#fb923c' },
            { label: 'Weak Areas', value: analysis?.weakAreas?.length || 0, icon: '⚠️', color: '#f87171' }
          ].map((s, i) => (
            <div key={i} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -15, right: -15, width: 50, height: 50, borderRadius: '50%', background: s.color, filter: 'blur(25px)', opacity: 0.2 }} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, letterSpacing: '-1px' }}>{s.value}</div>
              <div style={{ fontSize: 20, position: 'absolute', top: 16, right: 16 }}>{s.icon}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {['overview', 'topics', 'strategies'].map(tab => (
            <button key={tab} className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { if (tab === 'strategies' && strategies.length === 0) loadStrategies(); else setActiveTab(tab); }}>
              {tab === 'overview' ? '📊 Overview' : tab === 'topics' ? '📈 Topic Scores' : '💡 Strategies'}
            </button>
          ))}
        </div>

        {!hasData && activeTab !== 'strategies' && (
          <div className="card empty-state">
            <div className="empty-icon">📊</div>
            <h3>No Performance Data Yet</h3>
            <p>Take quizzes and exams to see your weakness analysis here!</p>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && hasData && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Weak Areas */}
            <div className="card">
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} color="#f87171" /> Weak Areas
              </h2>
              {(analysis.weakAreas || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 32 }}>💪</div><p style={{ fontSize: 13 }}>No weak areas detected!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {analysis.weakAreas.map((w, i) => {
                    const TrendIcon = TREND_ICONS[w.trend] || Minus;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                        background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: URGENCY_COLORS[w.urgency], flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{w.topic}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Avg: {Math.round(w.avgScore)}%</div>
                        </div>
                        <TrendIcon size={14} color={TREND_COLORS[w.trend]} />
                        <span className={`badge badge-${w.urgency === 'critical' ? 'danger' : w.urgency === 'high' ? 'warning' : 'muted'}`}>
                          {w.urgency}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Strong Areas */}
            <div className="card">
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={16} color="#4ade80" /> Strong Areas
              </h2>
              {(analysis.strongAreas || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 32 }}>📈</div><p style={{ fontSize: 13 }}>Keep studying to build strengths!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {analysis.strongAreas.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                      background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{s.topic}</div></div>
                      <span style={{ fontWeight: 700, color: '#4ade80', fontSize: 14 }}>{Math.round(s.avgScore)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Topics Tab */}
        {activeTab === 'topics' && hasData && (
          <div className="card">
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={16} /> Topic-Wise Performance
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {analysis.topicScores.sort((a, b) => a.avgScore - b.avgScore).map((t, i) => {
                const barColor = t.avgScore >= 80 ? '#4ade80' : t.avgScore >= 60 ? '#fb923c' : '#f87171';
                const TrendIcon = TREND_ICONS[t.trend] || Minus;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{t.topic}</span>
                        <TrendIcon size={12} color={TREND_COLORS[t.trend]} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{t.totalAttempts} attempts</span>
                        <span style={{ fontWeight: 700, color: barColor }}>{Math.round(t.avgScore)}%</span>
                      </div>
                    </div>
                    <div style={{ height: 8, background: 'var(--bg-hover)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, t.avgScore)}%`, background: barColor, borderRadius: 99,
                        transition: 'width 0.8s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Strategies Tab */}
        {activeTab === 'strategies' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {strategies.map((s, i) => (
              <div key={i} className="card" style={{ borderLeft: `3px solid ${s.priority === 'high' || s.priority === 'critical' ? '#f87171' : s.priority === 'medium' ? '#fb923c' : '#4ade80'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700 }}>{s.topic}</h3>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {s.currentScore !== undefined && <span className="badge badge-danger">{s.currentScore}% → {s.targetScore}%</span>}
                    <span className={`badge badge-${s.priority === 'high' || s.priority === 'critical' ? 'danger' : 'warning'}`}>{s.priority}</span>
                  </div>
                </div>
                {s.strategies && (
                  <div style={{ marginBottom: 10 }}>
                    {s.strategies.map((str, j) => (
                      <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                        <span style={{ color: '#6c8ef5', fontWeight: 700, flexShrink: 0 }}>→</span>
                        <span>{str}</span>
                      </div>
                    ))}
                  </div>
                )}
                {s.quickWin && (
                  <div style={{ background: 'var(--accent-dim)', borderRadius: 8, padding: '8px 12px', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Lightbulb size={14} color="var(--accent)" />
                    <span><strong>Quick Win:</strong> {s.quickWin}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
