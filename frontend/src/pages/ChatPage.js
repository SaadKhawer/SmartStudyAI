/**
 * ChatPage.js - Enhanced with Image Upload + Voice Input + RAG
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send, Plus, Trash2, BookOpen, Mic, MicOff,
  Image, X, MessageSquare
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { chatAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import AppLayout from '../components/Layout/AppLayout';
import axios from 'axios';

// ── Axios instance with auth ──────────────────────────────────────────────────
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api'
});
api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('studyai_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// ── Typing Indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="message assistant">
      <div className="message-avatar">🤖</div>
      <div className="typing-indicator">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}

// ── Single Message ────────────────────────────────────────────────────────────
function Message({ message, userInitials }) {
  const isUser = message.role === 'user';
  return (
    <div className={`message ${message.role}`}>
      <div className="message-avatar">
        {isUser ? userInitials : '🤖'}
      </div>
      <div className="message-bubble">
        {/* Attached image preview or generated image */}
        {message.imageUrl && (
          <img
            src={message.imageUrl}
            alt={isUser ? "uploaded" : "generated"}
            style={{
              maxWidth: '100%', maxHeight: isUser ? 260 : 512,
              borderRadius: 'var(--radius-md)',
              marginBottom: 10, display: 'block'
            }}
          />
        )}

        {isUser ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
        ) : (
          <div className="markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Source citations */}
        {message.sources && message.sources.length > 0 && (
          <div className="message-sources">
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>
              📎 Sources used:
            </div>
            {[...new Set(message.sources.map(s => s.documentName))].map((name, i) => (
              <span key={i} className="source-tag">
                <BookOpen size={10} /> {name}
              </span>
            ))}
          </div>
        )}

        <div style={{
          fontSize: 11,
          color: isUser ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)',
          marginTop: 6, textAlign: 'right'
        }}>
          {message.timestamp
            ? formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })
            : 'just now'}
        </div>
      </div>
    </div>
  );
}

// ── Main ChatPage ─────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { id: sessionId }      = useParams();
  const [searchParams]         = useSearchParams();
  const navigate               = useNavigate();
  const { user }               = useAuth();

  const [sessions, setSessions]       = useState([]);
  const [messages, setMessages]       = useState([]);
  const [currentSession, setSession]  = useState(null);
  const [input, setInput]             = useState('');
  const [isTyping, setIsTyping]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const [useDocuments, setUseDocs]    = useState(true);

  // ── Image state ─────────────────────────────────────────────────────────────
  const [selectedImage, setSelectedImage]   = useState(null);   // File object
  const [imagePreview, setImagePreview]     = useState(null);   // base64 preview
  const [imageBase64, setImageBase64]       = useState(null);   // base64 for API

  // ── Voice state ─────────────────────────────────────────────────────────────
  const [listening, setListening] = useState(false);
  const recognitionRef            = useRef(null);

  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);
  const fileInputRef   = useRef(null);

  const userInitials = user?.name
    ?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  // ── Auto scroll ──────────────────────────────────────────────────────────────
  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  // ── Voice recognition setup ──────────────────────────────────────────────────
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous      = false;
    rec.interimResults  = false;
    rec.lang            = 'en-US';
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => prev ? prev + ' ' + transcript : transcript);
      setListening(false);
    };
    rec.onerror = () => { setListening(false); toast.error('No voice detected. Please try again.'); };
    rec.onend   = () => setListening(false);
    recognitionRef.current = rec;
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      toast.error('Voice input only works in Chrome!'); return;
    }
    if (listening) {
      recognitionRef.current.stop(); setListening(false);
    } else {
      recognitionRef.current.start(); setListening(true);
      toast('🎤 Listening... (speak in English)', { duration: 3000 });
    }
  };

  // ── Image selection ──────────────────────────────────────────────────────────
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      toast.error('Only upload JPG, PNG, WEBP, or GIF!'); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB!'); return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target.result);
      // Store base64 without the data:image/...;base64, prefix
      setImageBase64(ev.target.result.split(',')[1]);
    };
    reader.readAsDataURL(file);
    toast.success('Image ready! Now type your question 📸');
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Load sessions ────────────────────────────────────────────────────────────
  useEffect(() => {
    chatAPI.getSessions()
      .then(r => setSessions(r.data.sessions || []))
      .catch(() => {});
  }, []);

  // ── Load specific session ────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    } else {
      setMessages([]); setSession(null);
    }
    const prompt = searchParams.get('prompt');
    if (prompt && sessionId) {
      setTimeout(() => sendMessage(null, prompt), 600);
    }
  // eslint-disable-next-line
  }, [sessionId]);

  const loadSession = async (id) => {
    setLoading(true);
    try {
      const { data } = await chatAPI.getSession(id);
      setSession(data.session);
      setMessages(data.session.messages || []);
    } catch {
      toast.error('Failed to load session');
      navigate('/chat');
    } finally { setLoading(false); }
  };

  const createNewSession = async () => {
    try {
      const { data } = await chatAPI.createSession({ title: 'New Conversation' });
      setSessions(s => [data.session, ...s]);
      navigate(`/chat/${data.session._id}`);
    } catch { toast.error('Failed to create session'); }
  };

  const deleteSession = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation?')) return;
    try {
      await chatAPI.deleteSession(id);
      setSessions(s => s.filter(x => x._id !== id));
      if (sessionId === id) navigate('/chat');
      toast.success('Deleted!');
    } catch { toast.error('Failed to delete'); }
  };

  // ── SEND MESSAGE (with optional image) ───────────────────────────────────────
  const sendMessage = useCallback(async (e, overrideText = null) => {
    if (e) e.preventDefault();
    const text = overrideText || input.trim();
    if ((!text && !imageBase64) || isTyping) return;

    // Build user message for UI
    const userMsg = {
      role: 'user',
      content: text || '📸 [Image uploaded]',
      imageUrl: imagePreview || null,
      timestamp: new Date()
    };
    setMessages(m => [...m, userMsg]);
    setInput('');
    const capturedImage  = imageBase64;
    const capturedPreview = imagePreview;
    clearImage();
    setIsTyping(true);

    // Auto-resize textarea
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      let responseData;

      if (capturedImage) {
        // ── Image + text path: call vision endpoint ─────────────────────────
        const { data } = await api.post('/chat/vision', {
          message: text || 'Please analyze this image and explain what you see in an educational context.',
          imageBase64: capturedImage,
          sessionId: sessionId || currentSession?._id || null,
          useDocuments
        });
        responseData = data;
      } else {
        // ── Text-only path: normal RAG chat ────────────────────────────────
        const { data } = await chatAPI.sendMessage({
          message: text,
          sessionId: sessionId || currentSession?._id || null,
          useDocuments
        });
        responseData = data;
      }

      // Navigate to new session if created
      if (!sessionId && responseData.sessionId) {
        navigate(`/chat/${responseData.sessionId}`, { replace: true });
        setSessions(s => {
          const exists = s.find(x => x._id === responseData.sessionId);
          if (!exists) {
            return [{
              _id: responseData.sessionId,
              title: (text || 'Image analysis').substring(0, 60),
              messageCount: 2,
              updatedAt: new Date()
            }, ...s];
          }
          return s;
        });
      }

      setMessages(m => [...m, {
        ...responseData.message,
        timestamp: new Date(responseData.message.timestamp)
      }]);

    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send message');
      setMessages(m => m.slice(0, -1));
    } finally {
      setIsTyping(false);
    }
  }, [input, sessionId, currentSession, isTyping, useDocuments, imageBase64, imagePreview, navigate]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); }
  };

  const handleTextareaChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="chat-page">

        {/* ── Session Sidebar ── */}
        <div className="chat-sidebar">
          <button className="btn btn-primary btn-full btn-sm"
            style={{ marginBottom: 16 }} onClick={createNewSession}>
            <Plus size={15} /> New Chat
          </button>

          <div className="chat-sidebar-title">Conversations</div>

          {sessions.length === 0 && (
            <div style={{ padding: '20px 8px', textAlign: 'center',
              color: 'var(--text-muted)', fontSize: 13 }}>
              No conversations yet
            </div>
          )}

          {sessions.map(s => (
            <div key={s._id}
              className={`session-item ${sessionId === s._id ? 'active' : ''}`}
              onClick={() => navigate(`/chat/${s._id}`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', gap: 6 }}>
                <div className="session-title">{s.title}</div>
                <button className="btn btn-ghost btn-icon"
                  style={{ padding: '2px', width: 20, height: 20, flexShrink: 0 }}
                  onClick={(e) => deleteSession(s._id, e)}>
                  <Trash2 size={11} />
                </button>
              </div>
              <div className="session-meta">
                {s.messageCount} msg · {formatDistanceToNow(new Date(s.updatedAt), { addSuffix: true })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Main Chat Area ── */}
        <div className="chat-main">

          {/* Header */}
          <div className="chat-header">
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {currentSession?.title || 'New Conversation'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                RAG · Image Vision · Voice Input · {messages.length} messages
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={useDocuments}
                onChange={e => setUseDocs(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }} />
              <BookOpen size={14} /> Use my documents
            </label>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {loading && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                Loading conversation...
              </div>
            )}

            {!loading && messages.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">🤖</div>
                <h3>Start a Conversation</h3>
                <p>Type a question, upload an image, or use your voice!</p>

                {/* Quick prompts */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8,
                  justifyContent: 'center', marginTop: 16 }}>
                  {[
                    '📸 Upload an image to analyze',
                    'Explain photosynthesis',
                    'Quiz me on my documents',
                    'Solve this math problem step by step'
                  ].map(s => (
                    <button key={s} className="btn btn-secondary btn-sm"
                      onClick={() => {
                        if (s.startsWith('📸')) {
                          fileInputRef.current?.click();
                        } else {
                          setInput(s);
                        }
                      }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <Message key={i} message={msg} userInitials={userInitials} />
            ))}

            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Input Area ── */}
          <div className="chat-input-area">

            {/* Image Preview Strip */}
            {imagePreview && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                marginBottom: 10, padding: '8px 12px',
                background: 'var(--bg-hover)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)'
              }}>
                <img src={imagePreview} alt="preview"
                  style={{ width: 48, height: 48, objectFit: 'cover',
                    borderRadius: 'var(--radius-sm)' }} />
                <div style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {selectedImage?.name}
                  </strong>
                  <br />
                  <span style={{ fontSize: 11 }}>
                    {(selectedImage?.size / 1024).toFixed(0)} KB — Now type your question or send directly
                  </span>
                </div>
                <button className="btn btn-ghost btn-icon"
                  onClick={clearImage}
                  style={{ color: 'var(--danger)' }}>
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={handleImageSelect}
            />

            {/* Main input box */}
            <div className="chat-input-wrapper">
              {/* Image button */}
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => fileInputRef.current?.click()}
                title="Upload image"
                style={{
                  color: imagePreview ? 'var(--accent)' : 'var(--text-muted)',
                  flexShrink: 0
                }}
              >
                <Image size={18} />
              </button>

              {/* Text input */}
              <textarea
                ref={textareaRef}
                className="chat-textarea"
                placeholder={
                  listening
                    ? '🎤 Listening...'
                    : imagePreview
                    ? 'Ask something about this image... (or just Send)'
                    : 'Type a question, upload an image, or use the mic... (Enter = send)'
                }
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={isTyping || listening}
              />

              {/* Voice button */}
              <button
                onClick={toggleVoice}
                title={listening ? 'Stop recording' : 'Use voice input'}
                style={{
                  width: 34, height: 34, flexShrink: 0,
                  background: listening ? 'var(--danger)' : 'var(--bg-hover)',
                  border: 'none', borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: listening ? 'white' : 'var(--text-secondary)',
                  animation: listening ? 'pulse 1s infinite' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              {/* Send button */}
              <button
                className="chat-send-btn"
                onClick={sendMessage}
                disabled={(!input.trim() && !imageBase64) || isTyping}
              >
                <Send size={15} />
              </button>
            </div>

            {/* Status bar */}
            <div style={{ fontSize: 11, color: 'var(--text-muted)',
              marginTop: 6, textAlign: 'center', display: 'flex',
              justifyContent: 'center', gap: 16 }}>
              <span>
                {useDocuments ? '📚 Documents ON' : '💬 General mode'}
              </span>
              <span>🎤 Voice (Chrome)</span>
              <span>📸 Image Vision</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </AppLayout>
  );
}
