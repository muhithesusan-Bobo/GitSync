import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import type { ApiResponse } from '@hazinahub/types';
import { Send, BrainCircuit, Sparkles, AlertTriangle } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'ai' | 'user';
  timestamp: Date;
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: "Hello! I am Hazina AI, your context-aware financial advisor. I read your real-time business wallet transaction history, expenses, and MMF investments to give you tailored, actionable advice. How can I help you grow your business and optimize your portfolio today?",
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: textToSend,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<ApiResponse<{ reply: string }>>('/ai/chat', {
        message: textToSend
      });

      if (response.data.success && response.data.data) {
        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          text: response.data.data.reply,
          sender: 'ai',
          timestamp: new Date()
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        setError(response.data.error || 'Gemini advisor is temporarily unavailable');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const handleQuickPrompt = (prompt: string) => {
    handleSend(prompt);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '4px' }}>Hazina AI Advisor</h1>
          <p style={{ color: 'var(--text-muted)' }}>Tailored, context-aware business insights powered by Google Gemini.</p>
        </div>
      </div>

      <div className="glass-panel chat-container" style={{ padding: '24px' }}>
        {/* Chat Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          paddingBottom: '16px', 
          borderBottom: '1px solid var(--border-glass)',
          marginBottom: '8px'
        }}>
          <div style={{
            background: 'var(--primary-glow)',
            color: 'var(--primary)',
            padding: '8px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <BrainCircuit size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              Hazina Engine <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: 'var(--primary-glow)', color: 'var(--primary)' }}>Gemini v1.5</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Online & analyzing your business metrics</div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="chat-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-bubble ${msg.sender}`}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)', marginBottom: '6px', fontWeight: 600 }}>
                {msg.sender === 'ai' ? 'HAZINA ADVISOR' : 'YOU'}
              </div>
              <div style={{ whiteSpace: 'pre-line', fontSize: '0.95rem' }}>
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="chat-bubble ai">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)', marginBottom: '6px', fontWeight: 600 }}>
                HAZINA ADVISOR
              </div>
              <div style={{ display: 'flex', gap: '4px', padding: '4px 0' }}>
                <span className="dot" style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' }} />
                <span className="dot" style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both 0.2s' }} />
                <span className="dot" style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both 0.4s' }} />
              </div>
            </div>
          )}

          {error && (
            <div style={{ 
              alignSelf: 'center',
              background: 'var(--danger-glow)', 
              border: '1px solid rgba(239, 68, 68, 0.3)', 
              color: 'var(--danger)', 
              padding: '12px 16px', 
              borderRadius: '10px', 
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              maxWidth: '90%'
            }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Row */}
        {messages.length === 1 && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-dark)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suggested Inquiries</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button 
                className="btn btn-glass" 
                style={{ fontSize: '0.8125rem', padding: '8px 12px' }}
                onClick={() => handleQuickPrompt("Analyze my business transactions and tell me my financial health score.")}
              >
                <Sparkles size={12} color="var(--primary)" /> Analyze financial health score
              </button>
              <button 
                className="btn btn-glass" 
                style={{ fontSize: '0.8125rem', padding: '8px 12px' }}
                onClick={() => handleQuickPrompt("Which Money Market Fund fits my business if I want low-risk growth?")}
              >
                <Sparkles size={12} color="var(--primary)" /> MMF advice (low-risk growth)
              </button>
              <button 
                className="btn btn-glass" 
                style={{ fontSize: '0.8125rem', padding: '8px 12px' }}
                onClick={() => handleQuickPrompt("Give me suggestions on compound interest strategy for my cash balance.")}
              >
                <Sparkles size={12} color="var(--primary)" /> Compound interest advice
              </button>
            </div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="chat-input-area">
          <input
            type="text"
            className="input-control"
            placeholder="Ask Hazina AI about your business cashflow or investments..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading || !input.trim()}
            style={{ width: '48px', height: '48px', padding: 0, flexShrink: 0 }}
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1.0); }
        }
      `}</style>
    </div>
  );
};

export default Chat;
