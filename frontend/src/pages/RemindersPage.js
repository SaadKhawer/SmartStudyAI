// pages/RemindersPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Plus, Trash2, Clock, CheckCircle } from 'lucide-react';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import toast from 'react-hot-toast';
import axios from 'axios';
import AppLayout from '../components/Layout/AppLayout';

const api = axios.create({ baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api' });
api.interceptors.request.use(config => {
  const token = localStorage.getItem('studyai_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function RemindersPage() {
  const [reminders, setReminders] = useState([]);
  const [showForm, setShowForm]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [form, setForm] = useState({
    title: '', message: '',
    reminderTime: '', repeat: 'none', subject: 'General'
  });

  const fetchReminders = useCallback(async () => {
    try {
      const { data } = await api.get('/reminders');
      setReminders(data.reminders || []);
    } catch { toast.error('Failed to load reminders'); }
  }, []);

  useEffect(() => {
    fetchReminders();
    // Browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [fetchReminders]);

  // Check reminders every minute for browser notifications
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      reminders.forEach(r => {
        const rTime = new Date(r.reminderTime);
        const diff = Math.abs(rTime - now) / 1000; // seconds difference
        if (diff < 60 && !isPast(rTime)) {
          if (Notification.permission === 'granted') {
            new Notification(`📚 StudyAI Reminder: ${r.title}`, {
              body: r.message || 'Study time!',
              icon: '📚'
            });
          }
          toast(`⏰ ${r.title}`, { duration: 8000 });
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [reminders]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title || !form.reminderTime) {
      toast.error('Title and time are required!');
      return;
    }
    setLoading(true);
    try {
      await api.post('/reminders', form);
      toast.success('Reminder set! ⏰');
      setForm({ title: '', message: '', reminderTime: '', repeat: 'none', subject: 'General' });
      setShowForm(false);
      fetchReminders();
    } catch { toast.error('Failed to create reminder'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/reminders/${id}`);
      setReminders(r => r.filter(x => x._id !== id));
      toast.success('Reminder deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const getTimeLabel = (time) => {
    const d = new Date(time);
    if (isPast(d)) return '⚠️ Past';
    if (isToday(d)) return `🔔 Today ${format(d, 'hh:mm a')}`;
    if (isTomorrow(d)) return `📅 Tomorrow ${format(d, 'hh:mm a')}`;
    return format(d, 'dd MMM, hh:mm a');
  };

  const subjects = ['General', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'History', 'Literature'];

  return (
    <AppLayout>
      <div style={{ padding: '28px 32px', flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 className="page-title">⏰ Reminders & Alarms</h1>
            <p className="page-subtitle">Set study reminders — you will get browser notifications</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
            <Plus size={16} /> New Reminder
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }}>📝 New Reminder</h3>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input className="form-input" placeholder="e.g. Physics chapter review"
                    value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <select className="form-input" value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                    {subjects.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date & Time *</label>
                  <input type="datetime-local" className="form-input"
                    value={form.reminderTime} onChange={e => setForm(f => ({ ...f, reminderTime: e.target.value }))}
                    min={new Date().toISOString().slice(0, 16)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Repeat</label>
                  <select className="form-input" value={form.repeat}
                    onChange={e => setForm(f => ({ ...f, repeat: e.target.value }))}>
                    <option value="none">Only Once</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Message (Optional)</label>
                <input className="form-input" placeholder="e.g. Review chapter 5 notes"
                  value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : <><Bell size={15} /> Set Reminder</>}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Reminders List */}
        {reminders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⏰</div>
            <h3>No reminders</h3>
            <p>Create your first reminder using the "New Reminder" button above</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reminders.map(r => (
              <div key={r._id} className="card" style={{
                display: 'flex', alignItems: 'center', gap: 16,
                borderLeft: `3px solid ${isPast(new Date(r.reminderTime)) ? 'var(--danger)' : 'var(--accent)'}`
              }}>
                <div style={{ fontSize: 28 }}>
                  {isPast(new Date(r.reminderTime)) ? '⚠️' : '🔔'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{r.title}</div>
                  {r.message && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{r.message}</div>}
                  <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                    <span className="badge badge-accent"><Clock size={10} /> {getTimeLabel(r.reminderTime)}</span>
                    <span className="badge badge-muted">{r.subject}</span>
                    {r.repeat !== 'none' && <span className="badge badge-success">🔄 {r.repeat}</span>}
                  </div>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(r._id)}
                  style={{ color: 'var(--danger)' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}