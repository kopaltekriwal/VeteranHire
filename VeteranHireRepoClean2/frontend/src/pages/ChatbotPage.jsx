import { useEffect, useMemo, useRef, useState } from 'react';

import { chatWithAssistant } from '../api';

const QUICK_PROMPTS = [
  'Suggest Jobs',
  'Improve Resume',
  'Skill Gap Advice',
  'Courses to Take',
];

function sanitizeAssistantText(value) {
  return String(value || '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+•/g, '\n•')
    .replace(/([.!?])\s+(•)/g, '$1\n$2')
    .replace(/(📊|🚀|📈|🎯)\s*/g, '\n$1 ')
    .trim();
}

function ChatbotPage({ user }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! I am your AI Assistant. Ask me about jobs, resume improvements, skill gaps, or courses.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = async (rawText) => {
    const text = String(rawText || '').trim();
    if (!text || loading) {
      return;
    }

    const userMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const payload = await chatWithAssistant({ userId: user?.id, message: text });
      const assistantMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: sanitizeAssistantText(payload.reply || 'No response from assistant.'),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: sanitizeAssistantText(err.message || 'Something went wrong while contacting the assistant.'),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    await sendMessage(input);
  };

  return (
    <section className="page page-section">
      <div className="header-box">
        <h1 className="page-title">AI Assistant</h1>
        <p>Get personalized career guidance with your latest profile and resume context.</p>
      </div>

      <div className="chat-quick-prompts">
        {QUICK_PROMPTS.map((prompt) => (
          <button key={prompt} type="button" className="btn-primary" onClick={() => setInput(prompt)} disabled={loading}>
            {prompt}
          </button>
        ))}
      </div>

      <div className="chat-shell card-block">
        <div className="chat-container" ref={scrollRef}>
          {messages.length === 0 && !loading ? (
            <p className="chat-empty">{'\uD83D\uDCAC Ask me about jobs, resumes, or skills!'}</p>
          ) : null}

          {messages.map((message) => (
            <div key={message.id} className={`chat-message-row ${message.role === 'user' ? 'user' : 'assistant'}`}>
              <article className={message.role === 'user' ? 'message-user' : 'message-bot'}>{message.content}</article>
            </div>
          ))}

          {loading ? (
            <div className="chat-message-row assistant">
              <article className="message-bot typing">Thinking</article>
            </div>
          ) : null}
        </div>

        <form className="chat-input-row" onSubmit={onSubmit}>
          <input
            type="text"
            value={input}
            placeholder="Ask about jobs, resume, skills, or courses..."
            onChange={(event) => setInput(event.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn-primary" disabled={!canSend}>
            Send
          </button>
        </form>
      </div>
    </section>
  );
}

export default ChatbotPage;
