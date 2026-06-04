import React, { useState, useEffect } from 'react';
import { Trophy, Star, Zap, Lock, Crown, Flame, Medal } from 'lucide-react';
import toast from 'react-hot-toast';
import AppLayout from '../components/Layout/AppLayout';
import { gamificationAPI } from '../services/api';

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

export default function GamificationPage() {
  const [profile, setProfile] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    Promise.all([gamificationAPI.getProfile(), gamificationAPI.getLeaderboard()])
      .then(([p, l]) => { setProfile(p.data); setLeaderboard(l.data.leaderboard); })
      .catch(() => toast.error('Failed to load gamification data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <AppLayout><div className="app-loading"><div className="spinner" /></div></AppLayout>;

  const xpProgress = profile?.xpProgress || 0;
  const xpForNext = profile?.xpForNextLevel || 500;
  const earnedBadges = profile?.badges || [];
  const allBadges = profile?.allBadges || [];

  return (
    <AppLayout>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* XP Hero Section */}
        <div style={{
          background: 'linear-gradient(135deg, #1a1040 0%, #0f1118 50%, #1a0f2e 100%)',
          padding: '36px 36px 60px', position: 'relative', overflow: 'hidden'
        }}>
          {/* Decorative blobs */}
          <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(251,146,60,0.3) 0%, transparent 70%)', animation: 'float 6s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: -30, left: 80, width: 150, height: 150, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(167,139,250,0.2) 0%, transparent 70%)', animation: 'float 8s ease-in-out infinite reverse' }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              {/* Level Circle */}
              <div style={{
                width: 100, height: 100, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 40px rgba(251,146,60,0.4)', border: '3px solid rgba(255,255,255,0.2)'
              }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'white', lineHeight: 1 }}>{profile?.level || 1}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Level</div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700, marginBottom: 4 }}>
                  {profile?.title || 'Beginner'}
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#ffffff', letterSpacing: '-1.5px', lineHeight: 1 }}>
                  {profile?.xp?.toLocaleString() || 0} <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }}>XP</span>
                </div>

                {/* XP Progress Bar */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                    <span>Level {profile?.level}</span>
                    <span>{xpProgress}% to Level {(profile?.level || 1) + 1}</span>
                  </div>
                  <div style={{ height: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${xpProgress}%`, borderRadius: 99,
                      background: 'linear-gradient(90deg, #fb923c, #facc15)',
                      transition: 'width 1.2s cubic-bezier(.4,0,.2,1)',
                      boxShadow: '0 0 12px rgba(251,146,60,0.5)'
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                    {xpForNext - (profile?.xp || 0) % 500} XP to next level
                  </div>
                </div>
              </div>

              {/* Stats Summary */}
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { icon: '🔥', value: profile?.stats?.streakDays || 0, label: 'Streak' },
                  { icon: '🏆', value: earnedBadges.length, label: 'Badges' },
                  { icon: '🧠', value: profile?.stats?.quizzesCompleted || 0, label: 'Quizzes' }
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: 'center', minWidth: 65 }}>
                    <div style={{ fontSize: 22, marginBottom: 2 }}>{s.icon}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'white' }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '0 36px 40px', marginTop: -24 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {['profile', 'badges', 'leaderboard', 'history'].map(tab => (
              <button key={tab} className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab(tab)} style={{ textTransform: 'capitalize' }}>
                {tab === 'profile' ? '📊 Stats' : tab === 'badges' ? '🏅 Badges' : tab === 'leaderboard' ? '🏆 Leaderboard' : '📜 History'}
              </button>
            ))}
          </div>

          {/* Stats Tab */}
          {activeTab === 'profile' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {[
                { label: 'Quizzes Done', value: profile?.stats?.quizzesCompleted || 0, icon: '🧠', color: '#6c8ef5' },
                { label: 'Exams Done', value: profile?.stats?.examsCompleted || 0, icon: '🎓', color: '#4ade80' },
                { label: 'Perfect Scores', value: profile?.stats?.perfectScores || 0, icon: '💯', color: '#fb923c' },
                { label: 'Study Minutes', value: profile?.stats?.studyMinutes || 0, icon: '⏰', color: '#f472b6' },
                { label: 'Current Streak', value: `${profile?.stats?.streakDays || 0} days`, icon: '🔥', color: '#f87171' },
                { label: 'Longest Streak', value: `${profile?.stats?.longestStreak || 0} days`, icon: '👑', color: '#facc15' },
                { label: 'Voice Sessions', value: profile?.stats?.voiceSessions || 0, icon: '🎤', color: '#a78bfa' },
                { label: 'Battles Won', value: profile?.stats?.quizBattlesWon || 0, icon: '⚔️', color: '#38bdf8' }
              ].map((s, i) => (
                <div key={i} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: -15, right: -15, width: 50, height: 50, borderRadius: '50%', background: s.color, filter: 'blur(25px)', opacity: 0.2 }} />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>{s.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, letterSpacing: '-1px' }}>{s.value}</div>
                  <div style={{ fontSize: 20, position: 'absolute', top: 14, right: 14 }}>{s.icon}</div>
                </div>
              ))}
            </div>
          )}

          {/* Badges Tab */}
          {activeTab === 'badges' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {allBadges.map((badge, i) => (
                <div key={i} className="card" style={{
                  textAlign: 'center', padding: 20,
                  opacity: badge.earned ? 1 : 0.45,
                  border: badge.earned ? '1px solid rgba(251,146,60,0.3)' : '1px solid var(--border)',
                  background: badge.earned ? 'rgba(251,146,60,0.05)' : 'var(--bg-card)',
                  transition: 'all 0.3s'
                }}>
                  <div style={{ fontSize: 40, marginBottom: 8, filter: badge.earned ? 'none' : 'grayscale(100%)' }}>
                    {badge.earned ? badge.icon : '🔒'}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{badge.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{badge.description}</div>
                  {badge.earned && badge.earnedAt && (
                    <div style={{ fontSize: 10, color: '#fb923c', marginTop: 6, fontWeight: 600 }}>
                      ✨ Earned {new Date(badge.earnedAt).toLocaleDateString()}
                    </div>
                  )}
                  {badge.xpReward > 0 && !badge.earned && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                      +{badge.xpReward} XP
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Leaderboard Tab */}
          {activeTab === 'leaderboard' && (
            <div className="card">
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trophy size={16} color="#fb923c" /> Global Leaderboard
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {leaderboard.map((entry, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12,
                    background: i < 3 ? `rgba(251,146,60,${0.08 - i * 0.02})` : 'var(--bg-hover)',
                    border: `1px solid ${i < 3 ? 'rgba(251,146,60,0.2)' : 'var(--border)'}`,
                    transition: 'all 0.2s'
                  }}>
                    <div style={{ width: 30, textAlign: 'center', fontSize: i < 3 ? 20 : 14, fontWeight: 700, color: 'var(--text-muted)' }}>
                      {i < 3 ? RANK_MEDALS[i] : `#${entry.rank}`}
                    </div>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: `linear-gradient(135deg, hsl(${i * 40}, 70%, 55%), hsl(${i * 40 + 30}, 70%, 45%))`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 700, fontSize: 14
                    }}>
                      {entry.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{entry.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Level {entry.level} · {entry.title} · {entry.badges} badges
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: '#fb923c' }}>{entry.xp?.toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>XP</div>
                    </div>
                  </div>
                ))}
                {leaderboard.length === 0 && (
                  <div className="empty-state" style={{ padding: 30 }}>
                    <div style={{ fontSize: 36 }}>🏆</div>
                    <p>Be the first on the leaderboard!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="card">
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={16} color="#facc15" /> Recent XP Activity
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(profile?.xpHistory || []).map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10,
                    background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(251,146,60,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Zap size={14} color="#fb923c" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{e.description || e.action}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {e.date ? new Date(e.date).toLocaleString() : ''}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, color: '#4ade80', fontSize: 14 }}>+{e.xp} XP</div>
                  </div>
                ))}
                {(!profile?.xpHistory || profile.xpHistory.length === 0) && (
                  <div className="empty-state" style={{ padding: 30 }}>
                    <div style={{ fontSize: 36 }}>⚡</div>
                    <p>Complete quizzes and exams to earn XP!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
