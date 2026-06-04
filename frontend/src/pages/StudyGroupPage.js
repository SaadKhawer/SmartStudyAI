import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Copy, LogOut, Swords, MessageCircle, Target, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import AppLayout from '../components/Layout/AppLayout';
import { studyGroupAPI, gamificationAPI } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

export default function StudyGroupPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [activeTab, setActiveTab] = useState('members');
  const { user } = useAuth();
  const { socket, joinGroup, leaveGroup, emitBattleStart, emitBattleComplete } = useSocket();

  // Create form
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTopics, setNewTopics] = useState('');
  const [joinCode, setJoinCode] = useState('');

  // Battle state
  const [battleActive, setBattleActive] = useState(false);
  const [battleQuestions, setBattleQuestions] = useState([]);
  const [battleAnswers, setBattleAnswers] = useState({});
  const [battleSubmitted, setBattleSubmitted] = useState(false);
  const [battleScore, setBattleScore] = useState(0);
  const [battleId, setBattleId] = useState(null);
  const [battleTopic, setBattleTopic] = useState('');
  const [startingBattle, setStartingBattle] = useState(false);

  // Discussion
  const [discussions, setDiscussions] = useState([]);
  const [loadingDiscussion, setLoadingDiscussion] = useState(false);

  // Real-time events
  const [battleUpdates, setBattleUpdates] = useState([]);

  useEffect(() => {
    studyGroupAPI.getMyGroups()
      .then(r => setGroups(r.data.groups))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;
    const handlers = {
      'battle-started': (data) => { setBattleUpdates(prev => [...prev, `⚔️ ${data.startedBy} started a battle on "${data.topic}"!`]); toast(`⚔️ New quiz battle: ${data.topic}!`); },
      'battle-player-joined': (data) => { setBattleUpdates(prev => [...prev, `👋 ${data.userName} joined the battle`]); },
      'battle-progress': (data) => { setBattleUpdates(prev => [...prev, `📝 ${data.userName} answered ${data.questionsAnswered} questions`]); },
      'battle-score-update': (data) => { setBattleUpdates(prev => [...prev, `🏆 ${data.userName} scored ${data.score}/${data.total}!`]); }
    };
    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));
    return () => { Object.keys(handlers).forEach(event => socket.off(event)); };
  }, [socket]);

  const loadGroupDetail = useCallback(async (id) => {
    try {
      const { data } = await studyGroupAPI.getDetail(id);
      setGroupDetail(data.group);
      setSelectedGroup(id);
      joinGroup(id);
    } catch { toast.error('Failed to load group'); }
  }, [joinGroup]);

  const handleCreate = async () => {
    if (!newName) { toast.error('Group name required'); return; }
    try {
      const { data } = await studyGroupAPI.create({
        name: newName, description: newDesc,
        topics: newTopics.split(',').map(t => t.trim()).filter(Boolean)
      });
      setGroups([data.group, ...groups]);
      setShowCreate(false);
      setNewName(''); setNewDesc(''); setNewTopics('');
      toast.success(data.message);
      try { await gamificationAPI.awardXP({ action: 'social_learner', description: 'Created a study group' }); } catch {}
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleJoin = async () => {
    if (!joinCode) { toast.error('Enter a join code'); return; }
    try {
      const { data } = await studyGroupAPI.join({ code: joinCode });
      setGroups([data.group, ...groups]);
      setShowJoin(false);
      setJoinCode('');
      toast.success(data.message);
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleLeave = async (id) => {
    try {
      await studyGroupAPI.leave(id);
      setGroups(groups.filter(g => g._id !== id));
      if (selectedGroup === id) { setSelectedGroup(null); setGroupDetail(null); leaveGroup(id); }
      toast.success('Left the group');
    } catch { toast.error('Failed to leave'); }
  };

  const startBattle = async () => {
    if (!groupDetail) return;
    setStartingBattle(true);
    try {
      const { data } = await studyGroupAPI.startBattle(selectedGroup, {
        topic: battleTopic || groupDetail.topics?.[0] || 'General Knowledge',
        difficulty: 'medium', questionCount: 5
      });
      setBattleQuestions(data.battle.questions);
      setBattleId(data.battleId);
      setBattleActive(true);
      setBattleAnswers({});
      setBattleSubmitted(false);
      setBattleScore(0);
      setBattleUpdates([]);
      emitBattleStart({ groupId: selectedGroup, battleId: data.battleId, topic: battleTopic || 'General', userName: user?.name });
      toast.success('Battle started! 🗡️');
    } catch { toast.error('Failed to start battle'); }
    finally { setStartingBattle(false); }
  };

  const handleBattleAnswer = (qIdx, letter) => {
    if (battleSubmitted) return;
    setBattleAnswers(prev => ({ ...prev, [qIdx]: letter }));
  };

  const submitBattle = async () => {
    if (Object.keys(battleAnswers).length < battleQuestions.length) { toast.error('Answer all questions!'); return; }
    let correct = 0;
    battleQuestions.forEach((q, i) => { if (battleAnswers[i] === q.correct) correct++; });
    setBattleScore(correct);
    setBattleSubmitted(true);

    try {
      await studyGroupAPI.submitBattleAnswer(selectedGroup, { battleId, answers: battleAnswers, score: correct });
      emitBattleComplete({ groupId: selectedGroup, battleId, userName: user?.name, score: correct, total: battleQuestions.length });
      await gamificationAPI.awardXP({ action: 'quiz_complete', description: `Quiz battle: ${correct}/${battleQuestions.length}` });
      if (correct === battleQuestions.length) {
        await gamificationAPI.awardXP({ action: 'perfect_score', description: 'Perfect battle score!' });
      }
    } catch {}
    toast.success(`Battle complete! ${correct}/${battleQuestions.length}`);
  };

  const loadDiscussion = async () => {
    setLoadingDiscussion(true);
    try {
      const { data } = await studyGroupAPI.getDiscussion(selectedGroup);
      setDiscussions(data.questions);
      setActiveTab('discussion');
    } catch { toast.error('Failed to generate questions'); }
    finally { setLoadingDiscussion(false); }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success(`Code ${code} copied!`);
  };

  if (loading) return <AppLayout><div className="app-loading"><div className="spinner" /></div></AppLayout>;

  // Battle mode
  if (battleActive) {
    return (
      <AppLayout>
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <h1 className="page-title">⚔️ Quiz Battle</h1>
            {!battleSubmitted && <span className="badge badge-accent">{Object.keys(battleAnswers).length}/{battleQuestions.length} answered</span>}
          </div>

          {battleSubmitted && (
            <div className="card" style={{ marginBottom: 20, textAlign: 'center', background: battleScore >= battleQuestions.length * 0.7 ? 'rgba(74,222,128,0.08)' : 'rgba(251,146,60,0.08)' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: battleScore >= battleQuestions.length * 0.7 ? '#4ade80' : '#fb923c' }}>
                {Math.round((battleScore / battleQuestions.length) * 100)}%
              </div>
              <div style={{ fontSize: 16 }}>{battleScore}/{battleQuestions.length} correct</div>
              {battleUpdates.length > 0 && (
                <div style={{ marginTop: 12, textAlign: 'left', maxWidth: 400, margin: '12px auto 0' }}>
                  {battleUpdates.map((u, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{u}</div>)}
                </div>
              )}
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => { setBattleActive(false); loadGroupDetail(selectedGroup); }}>
                Back to Group
              </button>
            </div>
          )}

          {battleQuestions.map((q, i) => (
            <div key={i} className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Q{i + 1}. {q.question}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {q.options.map((opt, j) => {
                  const letter = opt[0];
                  const selected = battleAnswers[i] === letter;
                  const isCorrect = battleSubmitted && letter === q.correct;
                  const isWrong = battleSubmitted && selected && letter !== q.correct;
                  return (
                    <div key={j} onClick={() => handleBattleAnswer(i, letter)} style={{
                      padding: '10px 14px', borderRadius: 10, fontSize: 13, cursor: battleSubmitted ? 'default' : 'pointer',
                      border: `1px solid ${isCorrect ? '#4ade80' : isWrong ? '#f87171' : selected ? 'var(--accent)' : 'var(--border)'}`,
                      background: isCorrect ? 'rgba(74,222,128,0.1)' : isWrong ? 'rgba(248,113,113,0.1)' : selected ? 'var(--accent-dim)' : 'var(--bg-hover)',
                      display: 'flex', alignItems: 'center', gap: 8
                    }}>
                      {battleSubmitted && isCorrect && <CheckCircle size={14} color="#4ade80" />}
                      {battleSubmitted && isWrong && <XCircle size={14} color="#f87171" />}
                      {opt}
                    </div>
                  );
                })}
              </div>
              {battleSubmitted && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', background: 'var(--accent-dim)', padding: '6px 10px', borderRadius: 8 }}>💡 {q.explanation}</div>}
            </div>
          ))}

          {!battleSubmitted && battleQuestions.length > 0 && (
            <button className="btn btn-primary btn-lg" onClick={submitBattle} style={{ width: '100%' }}>
              <Swords size={16} /> Submit Battle
            </button>
          )}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {/* Groups Sidebar */}
        <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--border)', padding: '20px 14px', overflowY: 'auto', background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => { setShowCreate(true); setShowJoin(false); }}>
              <Plus size={13} /> Create
            </button>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => { setShowJoin(true); setShowCreate(false); }}>
              <Users size={13} /> Join
            </button>
          </div>

          {/* Create Modal */}
          {showCreate && (
            <div className="card" style={{ marginBottom: 12, padding: 14 }}>
              <input className="form-input" placeholder="Group name" value={newName} onChange={e => setNewName(e.target.value)} style={{ marginBottom: 8 }} />
              <input className="form-input" placeholder="Description" value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ marginBottom: 8 }} />
              <input className="form-input" placeholder="Topics (comma separated)" value={newTopics} onChange={e => setNewTopics(e.target.value)} style={{ marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-primary btn-sm" onClick={handleCreate} style={{ flex: 1 }}>Create</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </div>
          )}

          {showJoin && (
            <div className="card" style={{ marginBottom: 12, padding: 14 }}>
              <input className="form-input" placeholder="Enter join code" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: '3px', textAlign: 'center', fontWeight: 700 }} maxLength={6} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-primary btn-sm" onClick={handleJoin} style={{ flex: 1 }}>Join</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowJoin(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>My Groups</div>
          {groups.map(g => (
            <div key={g._id} onClick={() => loadGroupDetail(g._id)} style={{
              padding: '12px 14px', borderRadius: 12, marginBottom: 6, cursor: 'pointer',
              background: selectedGroup === g._id ? 'var(--accent-dim)' : 'transparent',
              border: `1px solid ${selectedGroup === g._id ? 'var(--border-focus)' : 'transparent'}`,
              transition: 'all 0.2s'
            }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{g.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {g.members?.length || 0} members · {g.topics?.slice(0, 2).join(', ') || 'General'}
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>👥</div>
              Create or join a group!
            </div>
          )}
        </div>

        {/* Group Detail */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {!groupDetail ? (
            <div className="empty-state" style={{ marginTop: 80 }}>
              <div className="empty-icon">👥</div>
              <h3>Select a Study Group</h3>
              <p>Choose a group from the sidebar or create a new one</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h1 className="page-title">{groupDetail.name}</h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <span className="badge badge-accent" style={{ cursor: 'pointer' }} onClick={() => copyCode(groupDetail.code)}>
                      <Copy size={10} /> {groupDetail.code}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{groupDetail.members?.length} members</span>
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => handleLeave(selectedGroup)} style={{ color: 'var(--danger)' }}>
                  <LogOut size={14} /> Leave
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {['members', 'battles', 'challenges', 'discussion'].map(tab => (
                  <button key={tab} className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => { setActiveTab(tab); if (tab === 'discussion' && discussions.length === 0) loadDiscussion(); }}>
                    {tab === 'members' ? '👥 Members' : tab === 'battles' ? '⚔️ Battles' : tab === 'challenges' ? '🎯 Challenges' : '💬 Discussion'}
                  </button>
                ))}
              </div>

              {/* Members */}
              {activeTab === 'members' && (
                <div className="card">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(groupDetail.members || []).map((m, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-hover)' }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: `hsl(${i * 60}, 70%, 55%)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>
                          {m.user?.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{m.user?.name || 'Member'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.role}</div>
                        </div>
                        {m.role === 'admin' && <span className="badge badge-warning">Admin</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Battles */}
              {activeTab === 'battles' && (
                <div>
                  <div className="card" style={{ marginBottom: 16, padding: 16 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input className="form-input" placeholder="Battle topic" value={battleTopic}
                        onChange={e => setBattleTopic(e.target.value)} style={{ flex: 1 }} />
                      <button className="btn btn-primary" onClick={startBattle} disabled={startingBattle}>
                        {startingBattle ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Starting...</> : <><Swords size={14} /> Start Battle</>}
                      </button>
                    </div>
                  </div>

                  {/* Live updates */}
                  {battleUpdates.length > 0 && (
                    <div className="card" style={{ marginBottom: 16, background: 'rgba(108,142,245,0.05)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>🔴 Live Updates</div>
                      {battleUpdates.map((u, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{u}</div>)}
                    </div>
                  )}

                  {/* Past battles */}
                  {(groupDetail.quizBattles || []).slice(-5).reverse().map((b, i) => (
                    <div key={i} className="card" style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{b.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.topic} · {b.participants?.length || 0} players</div>
                        </div>
                        <span className={`badge badge-${b.status === 'completed' ? 'success' : b.status === 'active' ? 'accent' : 'muted'}`}>{b.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Challenges */}
              {activeTab === 'challenges' && (
                <div>
                  {(groupDetail.challenges || []).map((c, i) => (
                    <div key={i} className="card" style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{c.title}</div>
                        <span className={`badge badge-${c.status === 'active' ? 'success' : 'muted'}`}>{c.status}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{c.description}</div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${Math.min(100, ((c.participants?.[0]?.progress || 0) / c.target) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                  {(!groupDetail.challenges || groupDetail.challenges.length === 0) && (
                    <div className="card empty-state"><div style={{ fontSize: 32 }}>🎯</div><p>No challenges yet</p></div>
                  )}
                </div>
              )}

              {/* Discussion */}
              {activeTab === 'discussion' && (
                <div>
                  <button className="btn btn-secondary btn-sm" onClick={loadDiscussion} disabled={loadingDiscussion} style={{ marginBottom: 14 }}>
                    {loadingDiscussion ? <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Generating...</> : <><RefreshCw size={12} /> Generate New Questions</>}
                  </button>
                  {discussions.map((d, i) => (
                    <div key={i} className="card" style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ fontSize: 20, flexShrink: 0 }}>💭</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.5 }}>{d.question}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{d.topic}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
