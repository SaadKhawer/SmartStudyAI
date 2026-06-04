import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Send, RotateCcw, StopCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import AppLayout from '../components/Layout/AppLayout';
import { voiceAPI, gamificationAPI } from '../services/api';

export default function VoiceLearningPage() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [questionCount, setQuestionCount] = useState(0);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  // Topics for quick selection
  const quickTopics = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'Computer Science', 'English', 'Geography'];

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(transcript);
        if (event.results[event.results.length - 1].isFinal) {
          setIsListening(false);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          toast.error('Microphone access denied. Please allow microphone access.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      synthRef.current?.cancel();
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInputText('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const speakText = useCallback((text) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to find a good English voice
    const voices = synthRef.current.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'))
      || voices.find(v => v.lang.startsWith('en') && v.localService)
      || voices.find(v => v.lang.startsWith('en'));
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  }, []);

  const stopSpeaking = () => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
  };

  const sendMessage = async (text = null) => {
    const msgText = text || inputText.trim();
    if (!msgText) return;

    setMessages(prev => [...prev, { role: 'user', content: msgText }]);
    setInputText('');
    setLoading(true);

    try {
      const { data } = await voiceAPI.ask({
        question: msgText,
        topic: topic || 'General',
        sessionId
      });

      setSessionId(data.sessionId);
      setQuestionCount(data.questionCount);
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);

      // Auto-speak the response
      if (autoSpeak) {
        setTimeout(() => speakText(data.answer), 300);
      }

      // Award XP every 3 questions
      if (data.questionCount % 3 === 0) {
        try { await gamificationAPI.awardXP({ action: 'voice_session', description: 'Voice learning session' }); } catch {}
      }
    } catch {
      toast.error('Failed to get response');
    } finally {
      setLoading(false);
    }
  };

  const endSession = async () => {
    if (sessionId) {
      try { await voiceAPI.endSession({ sessionId }); } catch {}
    }
    setSessionId(null);
    setMessages([]);
    setQuestionCount(0);
    setTopic('');
    toast.success('Session ended');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              🎤 Voice Learning Mode
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {sessionId ? `${questionCount} questions · ${topic || 'General'}` : 'Speak or type your questions'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className={`btn btn-sm ${autoSpeak ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setAutoSpeak(!autoSpeak); if (isSpeaking) stopSpeaking(); }}
              title={autoSpeak ? 'Auto-speak ON' : 'Auto-speak OFF'}>
              {autoSpeak ? <Volume2 size={14} /> : <VolumeX size={14} />}
              {autoSpeak ? 'Voice On' : 'Voice Off'}
            </button>
            {sessionId && (
              <button className="btn btn-ghost btn-sm" onClick={endSession} style={{ color: 'var(--danger)' }}>
                <StopCircle size={14} /> End Session
              </button>
            )}
          </div>
        </div>

        {/* Messages / Start Screen */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--bg-base)' }}>
          {messages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              {/* Mic visualization */}
              <div style={{
                width: 120, height: 120, borderRadius: '50%', marginBottom: 24,
                background: 'linear-gradient(135deg, rgba(108,142,245,0.2), rgba(167,139,250,0.2))',
                border: '2px solid rgba(108,142,245,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: isListening ? 'pulse-mic 1.5s ease-in-out infinite' : 'none'
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: isListening ? 'linear-gradient(135deg, #6c8ef5, #8b5cf6)' : 'var(--bg-card)',
                  border: '2px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.3s'
                }}>
                  <Mic size={32} color={isListening ? 'white' : 'var(--text-muted)'} />
                </div>
              </div>

              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Ready to Learn by Voice</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 400, marginBottom: 24 }}>
                Click the microphone or type a question. I'll explain in simple, conversational language and test your understanding.
              </p>

              {/* Quick Topics */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600 }}>Quick Topics</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  {quickTopics.map(t => (
                    <button key={t} className="btn btn-secondary btn-sm"
                      onClick={() => { setTopic(t); sendMessage(`Explain the basics of ${t} to me`); }}
                      style={{ borderRadius: 20 }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 12,
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-start'
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-hover)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: msg.role === 'user' ? 14 : 18
                  }}>
                    {msg.role === 'user' ? '👤' : '🎤'}
                  </div>
                  <div style={{
                    maxWidth: '72%', padding: '14px 18px', borderRadius: 16,
                    fontSize: 15, lineHeight: 1.7,
                    background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-card)',
                    color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                    border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                    borderBottomRightRadius: msg.role === 'user' ? 4 : 16,
                    borderBottomLeftRadius: msg.role === 'user' ? 16 : 4
                  }}>
                    {msg.content}
                    {msg.role === 'assistant' && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => speakText(msg.content)}
                          style={{ padding: '4px 8px', fontSize: 11 }}>
                          <Volume2 size={12} /> Listen
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-hover)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🎤</div>
                  <div className="typing-indicator">
                    <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          {isListening && (
            <div style={{
              textAlign: 'center', padding: '8px', marginBottom: 10, borderRadius: 10,
              background: 'rgba(108,142,245,0.1)', border: '1px solid rgba(108,142,245,0.2)',
              fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', animation: 'pulse 1s infinite' }} />
              Listening... Speak now
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <button onClick={toggleListening} style={{
              width: 48, height: 48, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: isListening ? 'linear-gradient(135deg, #f87171, #ef4444)' : 'linear-gradient(135deg, #6c8ef5, #8b5cf6)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isListening ? '0 0 20px rgba(248,113,113,0.4)' : '0 0 20px rgba(108,142,245,0.3)',
              transition: 'all 0.3s', flexShrink: 0,
              animation: isListening ? 'pulse-mic 1.5s ease-in-out infinite' : 'none'
            }}>
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <div style={{
              flex: 1, display: 'flex', gap: 8, alignItems: 'flex-end',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 16, padding: '10px 14px'
            }}>
              <textarea
                value={inputText} onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask a question or speak..."
                style={{
                  flex: 1, resize: 'none', border: 'none', outline: 'none',
                  background: 'transparent', fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5,
                  maxHeight: 100, overflow: 'auto'
                }}
                rows={1}
              />
              <button onClick={() => sendMessage()} disabled={!inputText.trim() || loading}
                style={{
                  width: 34, height: 34, background: 'var(--accent)', color: 'white',
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: !inputText.trim() || loading ? 0.4 : 1, flexShrink: 0
                }}>
                <Send size={16} />
              </button>
            </div>

            {isSpeaking && (
              <button onClick={stopSpeaking} style={{
                width: 48, height: 48, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: 'rgba(248,113,113,0.15)', color: '#f87171',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <VolumeX size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
