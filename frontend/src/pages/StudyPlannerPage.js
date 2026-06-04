import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, Clock, CheckCircle, RefreshCw, Zap, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import AppLayout from '../components/Layout/AppLayout';
import { studyPlanAPI, gamificationAPI } from '../services/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const COLORS = ['#6c8ef5', '#4ade80', '#fb923c', '#f472b6', '#a78bfa', '#38bdf8', '#facc15', '#f87171'];
const TYPE_COLORS = { study: '#6c8ef5', revision: '#a78bfa', buffer: '#555d75', break: '#4ade80' };

export default function StudyPlannerPage() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [selectedDay, setSelectedDay] = useState(DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
  const [adjusting, setAdjusting] = useState(false);

  // Setup form state
  const [subjects, setSubjects] = useState([{ name: '', topics: [{ name: '', difficulty: 'medium' }], hoursPerWeek: 5, deadline: '', priority: 5 }]);
  const [studyHours, setStudyHours] = useState(4);
  const [sessionDuration, setSessionDuration] = useState(45);
  const [breakDuration, setBreakDuration] = useState(15);

  useEffect(() => {
    studyPlanAPI.getCurrent()
      .then(r => { if (r.data.plan) setPlan(r.data.plan); else setShowSetup(true); })
      .catch(() => setShowSetup(true))
      .finally(() => setLoading(false));
  }, []);

  const addSubject = () => {
    setSubjects([...subjects, { name: '', topics: [{ name: '', difficulty: 'medium' }], hoursPerWeek: 5, deadline: '', priority: 5 }]);
  };

  const removeSubject = (i) => {
    if (subjects.length <= 1) return;
    setSubjects(subjects.filter((_, idx) => idx !== i));
  };

  const updateSubject = (i, field, value) => {
    const s = [...subjects];
    s[i][field] = value;
    setSubjects(s);
  };

  const addTopic = (si) => {
    const s = [...subjects];
    s[si].topics.push({ name: '', difficulty: 'medium' });
    setSubjects(s);
  };

  const removeTopic = (si, ti) => {
    const s = [...subjects];
    if (s[si].topics.length <= 1) return;
    s[si].topics = s[si].topics.filter((_, idx) => idx !== ti);
    setSubjects(s);
  };

  const updateTopic = (si, ti, field, value) => {
    const s = [...subjects];
    s[si].topics[ti][field] = value;
    setSubjects(s);
  };

  const generatePlan = async () => {
    const valid = subjects.every(s => s.name && s.topics.some(t => t.name));
    if (!valid) { toast.error('Fill in all subject names and at least one topic each'); return; }
    setGenerating(true);
    try {
      const { data } = await studyPlanAPI.generate({
        subjects: subjects.map((s, i) => ({ ...s, color: COLORS[i % COLORS.length] })),
        studyHoursPerDay: studyHours,
        sessionDuration, breakDuration, includeRevision: true
      });
      setPlan(data.plan);
      setShowSetup(false);
      toast.success('Study plan generated! 🎉');
      try { await gamificationAPI.awardXP({ action: 'plan_complete', description: 'Generated a study plan' }); } catch {}
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate plan');
    } finally { setGenerating(false); }
  };

  const toggleSlot = async (slotId, dailyPlanId, completed) => {
    try {
      const { data } = await studyPlanAPI.updateProgress({ slotId, dailyPlanId, completed: !completed });
      setPlan(data.plan);
      if (!completed) {
        toast.success('Task completed! ✅');
        try { await gamificationAPI.awardXP({ action: 'study_session', amount: 25, description: 'Completed study slot' }); } catch {}
      }
    } catch { toast.error('Failed to update progress'); }
  };

  const handleAdjust = async () => {
    setAdjusting(true);
    try {
      const { data } = await studyPlanAPI.adjust();
      setPlan(data.plan);
      toast.success(data.message || 'Plan adjusted!');
    } catch { toast.error('Failed to adjust plan'); }
    finally { setAdjusting(false); }
  };

  const todayPlan = plan?.dailyPlans?.find(dp => {
    const dpDate = new Date(dp.date);
    const today = new Date();
    return dpDate.toDateString() === today.toDateString();
  });

  const selectedDaySchedule = plan?.weeklySchedule?.find(d => d.day === selectedDay);
  const overallProgress = plan?.progress?.overallCompletion || 0;

  if (loading) return <AppLayout><div className="app-loading"><div className="spinner" /></div></AppLayout>;

  return (
    <AppLayout>
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 className="page-title">📅 Smart Study Planner</h1>
            <p className="page-subtitle">AI-powered personalized timetable with priority scheduling</p>
          </div>
          {plan && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={handleAdjust} disabled={adjusting}>
                {adjusting ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Adjusting...</> : <><RefreshCw size={14} /> Auto-Adjust</>}
              </button>
              <button className="btn btn-primary" onClick={() => setShowSetup(true)}>
                <Plus size={14} /> New Plan
              </button>
            </div>
          )}
        </div>

        {/* Setup Form */}
        {showSetup && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={18} /> Configure Your Study Plan
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div className="form-group">
                <label className="form-label">Hours/Day</label>
                <input className="form-input" type="number" min="1" max="16" value={studyHours} onChange={e => setStudyHours(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Session (min)</label>
                <input className="form-input" type="number" min="15" max="120" value={sessionDuration} onChange={e => setSessionDuration(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Break (min)</label>
                <input className="form-input" type="number" min="5" max="30" value={breakDuration} onChange={e => setBreakDuration(Number(e.target.value))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={addSubject} style={{ width: '100%' }}>
                  <Plus size={14} /> Add Subject
                </button>
              </div>
            </div>

            {subjects.map((sub, si) => (
              <div key={si} style={{ background: 'var(--bg-hover)', borderRadius: 14, padding: 16, marginBottom: 12, border: `2px solid ${COLORS[si % COLORS.length]}22` }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: COLORS[si % COLORS.length], marginTop: 10, flexShrink: 0 }} />
                  <div className="form-group" style={{ flex: 1 }}>
                    <input className="form-input" placeholder="Subject name (e.g. Mathematics)" value={sub.name} onChange={e => updateSubject(si, 'name', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ width: 100 }}>
                    <input className="form-input" type="number" min="1" max="40" placeholder="Hrs/wk" value={sub.hoursPerWeek} onChange={e => updateSubject(si, 'hoursPerWeek', Number(e.target.value))} />
                  </div>
                  <div className="form-group" style={{ width: 160 }}>
                    <input className="form-input" type="date" value={sub.deadline} onChange={e => updateSubject(si, 'deadline', e.target.value)} />
                  </div>
                  {subjects.length > 1 && (
                    <button className="btn btn-ghost btn-icon" onClick={() => removeSubject(si)} style={{ marginTop: 2 }}>
                      <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                    </button>
                  )}
                </div>
                <div style={{ paddingLeft: 22 }}>
                  {sub.topics.map((t, ti) => (
                    <div key={ti} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <input className="form-input" placeholder={`Topic ${ti + 1}`} value={t.name} onChange={e => updateTopic(si, ti, 'name', e.target.value)} style={{ flex: 1 }} />
                      <select className="form-input" value={t.difficulty} onChange={e => updateTopic(si, ti, 'difficulty', e.target.value)} style={{ width: 110 }}>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                      {sub.topics.length > 1 && <button className="btn btn-ghost btn-icon" onClick={() => removeTopic(si, ti)}><Trash2 size={12} /></button>}
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" onClick={() => addTopic(si)} style={{ marginTop: 4 }}>
                    <Plus size={12} /> Add Topic
                  </button>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-primary btn-lg" onClick={generatePlan} disabled={generating} style={{ flex: 1 }}>
                {generating ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Generating with AI...</> : <><Zap size={16} /> Generate Smart Plan</>}
              </button>
              {plan && <button className="btn btn-secondary btn-lg" onClick={() => setShowSetup(false)}>Cancel</button>}
            </div>
          </div>
        )}

        {/* Plan Display */}
        {plan && !showSetup && (
          <>
            {/* Progress Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
              {[
                { label: 'Overall Progress', value: `${overallProgress}%`, icon: '📊', color: '#6c8ef5' },
                { label: 'Subjects', value: plan.subjects?.length || 0, icon: '📚', color: '#4ade80' },
                { label: 'Hours/Day', value: plan.studyHoursPerDay, icon: '⏰', color: '#fb923c' },
                { label: 'Sessions/Day', value: selectedDaySchedule?.slots?.length || 0, icon: '📖', color: '#f472b6' }
              ].map((s, i) => (
                <div key={i} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: -15, right: -15, width: 50, height: 50, borderRadius: '50%', background: s.color, filter: 'blur(25px)', opacity: 0.2 }} />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>{s.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color: 'var(--text-primary)', letterSpacing: '-1px' }}>{s.value}</div>
                  <div style={{ fontSize: 20, position: 'absolute', top: 16, right: 16 }}>{s.icon}</div>
                </div>
              ))}
            </div>

            {/* Today's Plan */}
            {todayPlan && (
              <div className="card" style={{ marginBottom: 20, borderColor: '#6c8ef522', background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6c8ef5' }} />
                    Today's Study Tasks
                  </h2>
                  <span className="badge badge-accent">{todayPlan.slots?.filter(s => s.completed).length || 0}/{todayPlan.slots?.length || 0} done</span>
                </div>
                {/* Progress bar */}
                <div className="progress-bar" style={{ marginBottom: 14 }}>
                  <div className="progress-fill" style={{ width: `${todayPlan.totalMinutes > 0 ? Math.round((todayPlan.completedMinutes / todayPlan.totalMinutes) * 100) : 0}%` }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(todayPlan.slots || []).map((slot, i) => (
                    <div key={slot._id || i} onClick={() => toggleSlot(slot._id, todayPlan._id, slot.completed)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12,
                        background: slot.completed ? 'rgba(74,222,128,0.08)' : 'var(--bg-hover)',
                        border: `1px solid ${slot.completed ? 'rgba(74,222,128,0.3)' : 'var(--border)'}`,
                        cursor: 'pointer', transition: 'all 0.2s'
                      }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${slot.completed ? '#4ade80' : TYPE_COLORS[slot.type] || '#6c8ef5'}`,
                        background: slot.completed ? '#4ade80' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {slot.completed && <CheckCircle size={14} color="white" />}
                      </div>
                      <div style={{ width: 4, height: 28, borderRadius: 4, background: TYPE_COLORS[slot.type] || '#6c8ef5', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, textDecoration: slot.completed ? 'line-through' : 'none', opacity: slot.completed ? 0.6 : 1 }}>
                          {slot.subject} — {slot.topic}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 10, marginTop: 2 }}>
                          <span><Clock size={10} /> {slot.time}</span>
                          <span>{slot.duration}min</span>
                          <span className={`badge badge-${slot.type === 'revision' ? 'warning' : slot.type === 'buffer' ? 'muted' : 'accent'}`} style={{ padding: '1px 6px', fontSize: 9 }}>
                            {slot.type}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!todayPlan.slots || todayPlan.slots.length === 0) && (
                    <div className="empty-state" style={{ padding: 20 }}>
                      <div style={{ fontSize: 32 }}>📅</div>
                      <p style={{ fontSize: 13 }}>No sessions scheduled for today</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Weekly Schedule */}
            <div className="card">
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={16} /> Weekly Schedule
              </h2>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {DAYS.map(d => (
                  <button key={d} onClick={() => setSelectedDay(d)}
                    className={`btn btn-sm ${selectedDay === d ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, fontSize: 11 }}>
                    {d.slice(0, 3)}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(selectedDaySchedule?.slots || []).map((slot, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10,
                    background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                    <div style={{ width: 4, height: 32, borderRadius: 4, background: TYPE_COLORS[slot.type] || '#6c8ef5' }} />
                    <div style={{ minWidth: 80, fontSize: 12, color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>{slot.time}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{slot.subject}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{slot.topic}</div>
                    </div>
                    <span className={`badge badge-${slot.difficulty === 'hard' ? 'danger' : slot.difficulty === 'easy' ? 'success' : 'warning'}`}>
                      {slot.difficulty}
                    </span>
                    <span className="badge badge-muted">{slot.duration}m</span>
                  </div>
                ))}
                {(!selectedDaySchedule?.slots || selectedDaySchedule.slots.length === 0) && (
                  <div className="empty-state" style={{ padding: 30 }}>
                    <div style={{ fontSize: 32 }}>🏖️</div>
                    <p style={{ fontSize: 13 }}>No sessions on {selectedDay}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
