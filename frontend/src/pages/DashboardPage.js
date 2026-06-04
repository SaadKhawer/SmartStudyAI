import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, chatAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import AppLayout from '../components/Layout/AppLayout';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

function CountUp({ end, duration = 1200 }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!end) return;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration]);
  return <span>{count}</span>;
}

function Sparkline({ data = [], color = '#6c8ef5' }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 36 }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1, borderRadius: 3,
          background: `${color}${i === data.length - 1 ? 'ff' : '55'}`,
          height: `${Math.max(8, (v / max) * 100)}%`,
          transition: 'height 0.6s ease'
        }} />
      ))}
    </div>
  );
}

function RingProgress({ pct = 0, size = 56, color = '#6c8ef5' }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="var(--progress-bg)" strokeWidth="6"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct / 100)}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }}/>
      <text x={size/2} y={size/2 + 1} textAnchor="middle"
        fill="var(--hero-text)" fontSize="11" fontWeight="700"
        style={{ transform: 'rotate(90deg)', transformOrigin: `${size/2}px ${size/2}px` }}>
        {pct}%
      </text>
    </svg>
  );
}

function StatCard({ icon, label, value, sub, accent, sparkData, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div style={{
      background: 'var(--card-glass)',
      border: '1px solid var(--card-border)',
      borderRadius: 20, padding: '22px 20px',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
      transition: 'all 0.5s cubic-bezier(.4,0,.2,1)',
      position: 'relative', overflow: 'hidden',
      backdropFilter: 'blur(20px)'
    }}>
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: accent, filter: 'blur(30px)',
        opacity: 'var(--blob-opacity)'
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `${accent}22`, border: `1px solid ${accent}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
        }}>{icon}</div>
        {sparkData && <Sparkline data={sparkData} color={accent} />}
      </div>
      <div style={{ color: 'var(--stat-label)', fontSize: 11, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ color: 'var(--stat-text)', fontSize: 32, fontWeight: 800,
        letterSpacing: '-1.5px', lineHeight: 1, marginBottom: 4 }}>
        {visible && typeof value === 'number' ? <CountUp end={value} /> : value}
      </div>
      <div style={{ color: 'var(--stat-sub)', fontSize: 12 }}>{sub}</div>
    </div>
  );
}

function QuickAction({ icon, label, sub, gradient, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? gradient : 'var(--quick-action-default)',
        border: `1px solid ${hovered ? 'transparent' : 'var(--quick-action-border)'}`,
        borderRadius: 16, padding: '16px 14px',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? '0 12px 32px rgba(0,0,0,0.2)' : 'none',
      }}>
      <div style={{ fontSize: 26, marginBottom: 8 }}>{icon}</div>
      <div style={{
        color: hovered ? '#ffffff' : 'var(--quick-label)',
        fontWeight: 700, fontSize: 13, marginBottom: 3,
        fontFamily: "'DM Sans', sans-serif"
      }}>{label}</div>
      <div style={{ color: hovered ? 'rgba(255,255,255,0.7)' : 'var(--quick-sub)', fontSize: 11 }}>
        {sub}
      </div>
    </button>
  );
}

export default function DashboardPage() {
  const [stats, setStats]     = useState(null);
  const [recs, setRecs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [time, setTime]       = useState(new Date());
  const { user }              = useAuth();
  const navigate              = useNavigate();

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    Promise.all([dashboardAPI.getStats(), dashboardAPI.getRecommendations()])
      .then(([s, r]) => { setStats(s.data); setRecs(r.data.recommendations || []); })
      .catch(() => toast.error('Dashboard failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const handleNewChat = async (prompt = null) => {
    try {
      const { data } = await chatAPI.createSession({ title: 'New Conversation' });
      navigate(`/chat/${data.session._id}${prompt ? `?prompt=${encodeURIComponent(prompt)}` : ''}`);
    } catch { navigate('/chat'); }
  };

  const greeting = () => {
    const h = time.getHours();
    if (h < 5)  return { text: 'Burning midnight oil', emoji: '🌙' };
    if (h < 12) return { text: 'Good morning', emoji: '☀️' };
    if (h < 17) return { text: 'Good afternoon', emoji: '🌤️' };
    if (h < 21) return { text: 'Good evening', emoji: '🌆' };
    return { text: 'Late night grind', emoji: '🌙' };
  };

  const { text: greetText, emoji: greetEmoji } = greeting();
  const firstName = user?.name?.split(' ')[0] || 'Student';
  const weekData  = [3,7,5,8,4,9,6];
  const docData   = [1,2,2,3,4,4,5];
  const quizData  = [60,72,68,80,75,88,82];

  const statCards = stats ? [
    { icon:'💬', label:'Total Chats',    accent:'#6c8ef5', value:stats.stats.totalChats,      sub:'AI conversations',       sparkData:weekData },
    { icon:'📄', label:'Documents',      accent:'#4ade80', value:stats.stats.totalDocuments,   sub:'Indexed & ready for RAG', sparkData:docData  },
    { icon:'🔥', label:'Study Streak',   accent:'#fb923c', value:stats.stats.studyStreak,      sub:'Days in a row',           sparkData:[2,2,3,3,4,4,stats.stats.studyStreak||0] },
    { icon:'⚡', label:'Quiz Accuracy',  accent:'#f472b6', value:82,                           sub:'Average this week',       sparkData:quizData },
  ] : [];

  const quickActions = [
    { icon:'🤖', label:'Ask AI',       sub:'Chat with your study assistant',  gradient:'linear-gradient(135deg,#6c8ef5,#8b5cf6)', onClick:()=>handleNewChat() },
    { icon:'📅', label:'Study Plan',   sub:'Smart AI-powered timetable',      gradient:'linear-gradient(135deg,#38bdf8,#0ea5e9)', onClick:()=>navigate('/study-planner') },
    { icon:'🧠', label:'Take Quiz',    sub:'AI-generated questions',          gradient:'linear-gradient(135deg,#4ade80,#22c55e)', onClick:()=>navigate('/quiz') },
    { icon:'🎓', label:'Start Exam',   sub:'AI oral examiner',                gradient:'linear-gradient(135deg,#fb923c,#f97316)', onClick:()=>navigate('/exam') },
    { icon:'🎤', label:'Voice Mode',   sub:'Learn by speaking',               gradient:'linear-gradient(135deg,#f472b6,#ec4899)', onClick:()=>navigate('/voice') },
    { icon:'📊', label:'My Progress',  sub:'Weakness analysis',               gradient:'linear-gradient(135deg,#a78bfa,#7c3aed)', onClick:()=>navigate('/weakness') },
    { icon:'🏆', label:'Achievements', sub:'XP, badges & levels',             gradient:'linear-gradient(135deg,#facc15,#f59e0b)', onClick:()=>navigate('/achievements') },
    { icon:'👥', label:'Study Groups', sub:'Learn together',                   gradient:'linear-gradient(135deg,#4ade80,#10b981)', onClick:()=>navigate('/groups') },
    { icon:'📤', label:'Upload PDF',   sub:'Add study materials',             gradient:'linear-gradient(135deg,#38bdf8,#0284c7)', onClick:()=>navigate('/documents') },
  ];

  const studyTips = [
    { tip:"Use the Pomodoro technique — 25 min study, 5 min break", icon:"⏱️" },
    { tip:"Upload your lecture notes as PDF for contextual AI answers", icon:"📄" },
    { tip:"Ask AI to quiz you after each study session", icon:"🧠" },
    { tip:"Review flashcards right before sleeping for better retention", icon:"🃏" },
    { tip:"Use voice input to practice spoken answers out loud", icon:"🎤" },
  ];
  const todayTip = studyTips[Math.floor(Math.random() * studyTips.length)];

  return (
    <AppLayout>
      <div style={{ flex:1, overflowY:'auto', background:'var(--bg-base)', minHeight:'100vh' }}>

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <div style={{
          background: 'var(--hero-bg)',
          padding: '36px 36px 80px',
          position: 'relative', overflow: 'hidden'
        }}>
          {/* Blobs */}
          <div style={{ position:'absolute', top:-60, right:-60, width:300, height:300,
            borderRadius:'50%', background:'radial-gradient(circle, rgba(108,142,245,0.3) 0%, transparent 70%)',
            animation:'float 6s ease-in-out infinite' }}/>
          <div style={{ position:'absolute', bottom:-40, left:100, width:200, height:200,
            borderRadius:'50%', background:'radial-gradient(circle, rgba(167,139,250,0.2) 0%, transparent 70%)',
            animation:'float 8s ease-in-out infinite reverse' }}/>

          {/* Top row */}
          <div style={{ display:'flex', justifyContent:'space-between',
            alignItems:'flex-start', position:'relative', zIndex:1 }}>
            <div>
              <div style={{ color:'var(--hero-muted)', fontSize:12,
                fontWeight:700, letterSpacing:'1.2px',
                textTransform:'uppercase', marginBottom:8 }}>
                {greetEmoji} {greetText}
              </div>
              <h1 style={{ fontSize:36, fontWeight:800, color:'var(--hero-text)',
                letterSpacing:'-1.5px', lineHeight:1.1, margin:0 }}>
                {firstName} 👋
              </h1>
              <p style={{ color:'var(--hero-sub)', marginTop:10, fontSize:14, maxWidth:400 }}>
                {stats?.stats.isStudiedToday
                  ? "You've already studied today — keep the streak alive! 🔥"
                  : "Ready to learn something incredible today?"}
              </p>
            </div>

            {/* Clock */}
            <div style={{
              background:'var(--clock-bg)', border:'1px solid var(--clock-border)',
              borderRadius:16, padding:'14px 20px', textAlign:'center',
              backdropFilter:'blur(20px)'
            }}>
              <div style={{ fontSize:26, fontWeight:800, color:'var(--clock-text)',
                letterSpacing:'-1px', fontFamily:"'DM Mono', monospace" }}>
                {time.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
              </div>
              <div style={{ fontSize:12, color:'var(--clock-sub)', marginTop:4 }}>
                {time.toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' })}
              </div>
            </div>
          </div>

          {/* Progress row */}
          <div style={{ display:'flex', alignItems:'center', gap:16,
            marginTop:28, position:'relative', zIndex:1 }}>
            <RingProgress pct={stats?.stats.isStudiedToday ? 75 : 20} size={56} color="#6c8ef5" />
            <div>
              <div style={{ color:'var(--hero-text)', fontWeight:700, fontSize:14 }}>
                Daily Goal — {stats?.stats.isStudiedToday ? '75%' : '20%'} complete
              </div>
              <div style={{ color:'var(--hero-sub)', fontSize:12, marginTop:2 }}>
                Target: 60 min/day · Keep going!
              </div>
            </div>
            <div style={{
              marginLeft:'auto', background:'var(--streak-bg)',
              border:'1px solid var(--streak-border)', borderRadius:12,
              padding:'8px 16px', fontSize:13, color:'var(--streak-text)'
            }}>
              🏅 {stats?.stats.studyStreak || 0} day streak
            </div>
          </div>
        </div>

        {/* ── CONTENT ──────────────────────────────────────────────────────── */}
        <div style={{ padding:'0 36px 40px', marginTop:-44 }}>

          {/* Stat Cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
            {loading
              ? Array(4).fill(0).map((_,i) => (
                  <div key={i} style={{ height:150, borderRadius:20,
                    background:'var(--card-glass)', border:'1px solid var(--card-border)',
                    animation:'pulse 1.5s ease-in-out infinite' }} />
                ))
              : statCards.map((c,i) => <StatCard key={c.label} {...c} delay={i*100} />)
            }
          </div>

          {/* Main Grid */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>

            {/* Quick Actions */}
            <div style={{
              background:'var(--bg-card)', border:'1px solid var(--border)',
              borderRadius:24, padding:24
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#6c8ef5' }} />
                <h2 style={{ color:'var(--section-title)', fontSize:15, fontWeight:700, margin:0 }}>
                  Quick Actions
                </h2>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                {quickActions.map(a => <QuickAction key={a.label} {...a} />)}
              </div>
            </div>

            {/* Recent Chats */}
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:24, padding:24 }}>
              <div style={{ display:'flex', alignItems:'center',
                justifyContent:'space-between', marginBottom:18 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#4ade80' }} />
                  <h2 style={{ color:'var(--section-title)', fontSize:15, fontWeight:700, margin:0 }}>
                    Recent Chats
                  </h2>
                </div>
                <button onClick={() => navigate('/chat')} style={{
                  background:'none', border:'none', cursor:'pointer',
                  color:'var(--accent)', fontSize:12, fontWeight:600
                }}>View all →</button>
              </div>

              {!stats?.recentActivity?.length ? (
                <div style={{ textAlign:'center', padding:'30px 0', color:'var(--text-muted)' }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>💬</div>
                  <div style={{ fontSize:13 }}>Start your first conversation!</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {stats.recentActivity.map((s,i) => (
                    <div key={s._id} onClick={() => navigate(`/chat/${s._id}`)}
                      style={{
                        display:'flex', alignItems:'center', gap:12,
                        padding:'12px 14px', borderRadius:14,
                        background:'var(--chat-item-bg)',
                        border:'1px solid var(--chat-item-border)',
                        cursor:'pointer', transition:'all 0.2s'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'var(--accent-dim)';
                        e.currentTarget.style.borderColor = 'var(--border-focus)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'var(--chat-item-bg)';
                        e.currentTarget.style.borderColor = 'var(--chat-item-border)';
                      }}>
                      <div style={{
                        width:36, height:36, borderRadius:10, flexShrink:0,
                        background:`hsl(${i*60},70%,60%)22`,
                        border:`1px solid hsl(${i*60},70%,60%)44`,
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:16
                      }}>💬</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:'var(--chat-item-text)', fontSize:13, fontWeight:600,
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {s.title}
                        </div>
                        <div style={{ color:'var(--chat-item-sub)', fontSize:11, marginTop:2 }}>
                          {s.messageCount} messages · {formatDistanceToNow(new Date(s.updatedAt), { addSuffix:true })}
                        </div>
                      </div>
                      <span style={{ color:'var(--text-muted)' }}>›</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:20 }}>

            {/* Recommendations */}
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:24, padding:24 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#a78bfa' }} />
                <h2 style={{ color:'var(--section-title)', fontSize:15, fontWeight:700, margin:0 }}>
                  Suggested For You
                </h2>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {recs.slice(0,3).map((r,i) => (
                  <div key={i}
                    onClick={() => {
                      if (r.action==='upload') navigate('/documents');
                      else if (r.prompt) handleNewChat(r.prompt);
                      else navigate('/chat');
                    }}
                    style={{
                      display:'flex', alignItems:'center', gap:12,
                      padding:'12px 14px', borderRadius:14,
                      background:'var(--feature-bg)', border:'1px solid var(--feature-border)',
                      cursor:'pointer', transition:'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background='var(--accent-dim)'; e.currentTarget.style.borderColor='var(--border-focus)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background='var(--feature-bg)'; e.currentTarget.style.borderColor='var(--feature-border)'; }}>
                    <span style={{ fontSize:22 }}>{r.icon}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:'var(--section-title)', fontSize:12, fontWeight:600 }}>{r.title}</div>
                      <div style={{ color:'var(--text-muted)', fontSize:11,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {r.description}
                      </div>
                    </div>
                    <span style={{ color:'var(--text-muted)' }}>›</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Study Tip */}
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)',
              borderRadius:24, padding:24, display:'flex', flexDirection:'column' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#fb923c' }} />
                <h2 style={{ color:'var(--section-title)', fontSize:15, fontWeight:700, margin:0 }}>
                  Tip of the Day
                </h2>
              </div>
              <div style={{ flex:1, display:'flex', flexDirection:'column',
                justifyContent:'center', alignItems:'center', textAlign:'center', padding:'10px 0' }}>
                <div style={{ fontSize:44, marginBottom:14 }}>{todayTip.icon}</div>
                <div style={{ color:'var(--tip-text)', fontSize:13, lineHeight:1.7, fontStyle:'italic' }}>
                  "{todayTip.tip}"
                </div>
              </div>
              <button onClick={() => handleNewChat('Give me 5 evidence-based study tips')}
                style={{
                  marginTop:16, background:'var(--tip-btn-bg)',
                  border:'1px solid var(--tip-btn-border)', borderRadius:12,
                  padding:'10px', cursor:'pointer',
                  color:'var(--tip-btn-color)', fontSize:13, fontWeight:600,
                  transition:'all 0.2s', fontFamily:"'DM Sans', sans-serif"
                }}>
                💡 Get More Tips from AI
              </button>
            </div>

            {/* Feature List */}
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:24, padding:24 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#4ade80' }} />
                <h2 style={{ color:'var(--section-title)', fontSize:15, fontWeight:700, margin:0 }}>
                  What You Can Do
                </h2>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { icon:'📚', text:'Upload PDFs — AI answers from YOUR notes', color:'#6c8ef5' },
                  { icon:'📸', text:'Photo a math problem — AI solves it',       color:'#f472b6' },
                  { icon:'🎓', text:'AI Oral Exam with follow-up questions',     color:'#fb923c' },
                  { icon:'🧠', text:'Quiz from any topic or your document',       color:'#4ade80' },
                  { icon:'🎤', text:'Voice input — just speak your question',    color:'#a78bfa' },
                ].map((f,i) => (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'10px 12px', borderRadius:12,
                    background:'var(--feature-bg)', border:'1px solid var(--feature-border)'
                  }}>
                    <div style={{
                      width:32, height:32, borderRadius:8, flexShrink:0,
                      background:`${f.color}18`, border:`1px solid ${f.color}33`,
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:16
                    }}>{f.icon}</div>
                    <div style={{ color:'var(--feature-text)', fontSize:12, lineHeight:1.4 }}>
                      {f.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
