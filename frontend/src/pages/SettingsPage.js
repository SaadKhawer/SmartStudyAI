/**
 * Settings Page
 * User preferences, profile editing, theme
 */

import React, { useState } from 'react';
import { Save, User, Palette } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import AppLayout from '../components/Layout/AppLayout';

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [form, setForm]     = useState({ name: user?.name || '', subject: user?.preferences?.subject || 'General' });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await authAPI.updateProfile({
        name: form.name,
        preferences: { subject: form.subject, theme }
      });
      updateUser(data.user);
      toast.success('Settings saved!');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const Section = ({ title, icon: Icon, children }) => (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
        <Icon size={16} style={{ color: 'var(--accent)' }} />
        <h2 style={{ fontSize: 14, fontWeight: 600 }}>{title}</h2>
      </div>
      {children}
    </div>
  );

  return (
    <AppLayout>
      <div style={{ padding: '28px 32px', maxWidth: 560, flex: 1, overflowY: 'auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your profile and preferences</p>
        </div>

        <form onSubmit={handleSave}>
          <Section title="Profile" icon={User}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Email (read-only)</label>
                <input className="form-input" value={user?.email || ''} disabled
                  style={{ opacity: 0.6, cursor: 'not-allowed' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Primary Study Subject</label>
                <select className="form-input" value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                  {['General', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'History', 'Literature', 'Economics', 'Other'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          <Section title="Appearance" icon={Palette}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Theme</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Currently using {theme} mode
                </div>
              </div>
              <button type="button" className="btn btn-secondary" onClick={toggleTheme}>
                {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
              </button>
            </div>
          </Section>

          {/* Account Stats */}
          <Section title="Account" icon={User}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Member since', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—' },
                { label: 'Last login', value: user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : '—' },
                { label: 'Total chats', value: user?.stats?.totalChats || 0 },
                { label: 'Documents', value: user?.stats?.totalDocuments || 0 }
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: '12px 14px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>
          </Section>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Saving...</> : <><Save size={16} /> Save Changes</>}
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
