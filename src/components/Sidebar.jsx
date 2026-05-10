import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Trash2, Plus, MessageSquare, ChevronDown, Archive, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const createNewSession = () => ({
  id: Date.now().toString(),
  title: 'New Chat',
  messages: [
    { role: 'assistant', text: 'Привет! Выделите текст в книге, и задайте мне вопрос по этому фрагменту.' }
  ],
  archived: false
});

const Sidebar = React.memo(function Sidebar({ selectedText, onClearSelectedText }) {
  const [sessions, setSessions] = useState([createNewSession()]);
  const [activeSessionId, setActiveSessionId] = useState(sessions[0].id);
  const [question, setQuestion] = useState('');
  const [modelType, setModelType] = useState('local');
  const [showHistory, setShowHistory] = useState(false);
  const chatEndRef = useRef(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const chatHistory = activeSession ? activeSession.messages : [];


  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory.length]);

  const updateActiveSession = (updater) => {
    setSessions(prev => prev.map(s =>
      s.id === activeSessionId ? updater(s) : s
    ));
  };

  const handleSend = () => {
    if (!question.trim() || !activeSession) return;

    const userMessage = { role: 'user', text: question, context: selectedText };

    // Set title from first message
    updateActiveSession(s => ({
      ...s,
      title: s.messages.filter(m => m.role === 'user').length === 0
        ? question.slice(0, 40) + (question.length > 40 ? '...' : '')
        : s.title,
      messages: [...s.messages, userMessage]
    }));

    setQuestion('');

    // TODO: replace with real AI call (see src/ai/agent.js)
    setTimeout(() => {
      updateActiveSession(s => ({
        ...s,
        messages: [...s.messages, {
          role: 'assistant',
          text: `Вот пример того, как я умею форматировать текст, используя **Markdown**!

Здесь вы видите код:
\`\`\`javascript
function helloWorld() {
  console.log("Привет от ИИ!");
}
\`\`\`

И даже таблицы:
| Модель | Статус | Описание |
| --- | --- | --- |
| Локальная | Активна | Быстрая и приватная |
| API | Ожидает | Требует интернет |
`
        }]
      }));
    }, 1000);
  };

  const handleNewChat = () => {
    const newSession = createNewSession();
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setShowHistory(false);
  };

  const switchSession = (sessionId) => {
    setActiveSessionId(sessionId);
    setShowHistory(false);
  };

  const handleArchive = (e, sessionId) => {
    e.stopPropagation();
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, archived: !s.archived } : s));
  };

  const handleDelete = (e, sessionId) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this chat?")) {
      setSessions(prev => {
        const next = prev.filter(s => s.id !== sessionId);
        if (next.length === 0) {
          const newSession = createNewSession();
          setActiveSessionId(newSession.id);
          return [newSession];
        }
        if (activeSessionId === sessionId) {
          setActiveSessionId(next[0].id);
        }
        return next;
      });
    }
  };

  const handleExport = (e, session) => {
    e.stopPropagation();
    let mdContent = `# ${session.title}\n\n`;
    session.messages.forEach(m => {
      mdContent += `**${m.role === 'user' ? 'You' : 'AI Assistant'}**:\n`;
      if (m.context) {
        mdContent += `> ${m.context.replace(/\n/g, '\n> ')}\n\n`;
      }
      mdContent += `${m.text}\n\n---\n\n`;
    });

    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="sidebar-pane" style={{ padding: '20px', gap: '16px', minWidth: '320px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
          <Bot size={20} color="var(--color-go-blue)" />
          <span>AI Assistant</span>
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <select
            value={modelType}
            onChange={(e) => setModelType(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: '12px', fontFamily: 'inherit' }}
          >
            <option value="local">Local Model</option>
            <option value="oauth">OAuth Model</option>
            <option value="api">API Model</option>
          </select>
        </div>
      </div>

      {/* Chat History Toggle */}
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button
          className="button-icon"
          style={{
            flex: 1,
            justifyContent: 'space-between',
            padding: '8px 10px',
            backgroundColor: showHistory ? 'var(--color-go-blue-light)' : 'var(--color-surface)',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--color-text)'
          }}
          onClick={() => setShowHistory(!showHistory)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MessageSquare size={14} />
            {activeSession ? activeSession.title : 'Chat'}
          </span>
          <ChevronDown size={14} style={{ transform: showHistory ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        <button
          className="button-icon"
          style={{
            padding: '8px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '6px',
            border: '1px solid var(--color-border)'
          }}
          onClick={handleNewChat}
          title="New Chat"
        >
          <Plus size={16} color="var(--color-go-blue)" />
        </button>
      </div>

      {/* History Dropdown */}
      {showHistory && (
        <div style={{
          maxHeight: '300px',
          overflowY: 'auto',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {sessions.map(session => (
            <div
              key={session.id}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                fontSize: '13px',
                backgroundColor: session.id === activeSessionId ? 'var(--color-go-blue-light)' : 'transparent',
                borderBottom: '1px solid var(--color-border)',
                transition: 'background-color 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: session.archived ? 0.5 : 1
              }}
              onClick={() => switchSession(session.id)}
              onMouseEnter={e => {
                if (session.id !== activeSessionId) {
                  e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)';
                }
              }}
              onMouseLeave={e => {
                if (session.id !== activeSessionId) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <MessageSquare size={14} style={{ flexShrink: 0, opacity: 0.5 }} />
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session.title} {session.archived && '(Archived)'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-light)' }}>
                  {session.messages.filter(m => m.role === 'user').length} msgs
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  className="button-icon" 
                  style={{ padding: '4px' }} 
                  onClick={(e) => handleExport(e, session)} 
                  title="Export to Markdown"
                >
                  <Download size={14} />
                </button>
                <button 
                  className="button-icon" 
                  style={{ padding: '4px' }} 
                  onClick={(e) => handleArchive(e, session.id)} 
                  title={session.archived ? "Unarchive" : "Archive"}
                >
                  <Archive size={14} />
                </button>
                <button 
                  className="button-icon" 
                  style={{ padding: '4px', color: '#ef4444' }} 
                  onClick={(e) => handleDelete(e, session.id)} 
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Text */}
      {selectedText ? (
        <div style={{ padding: '12px', backgroundColor: 'var(--color-surface)', borderRadius: '8px', borderLeft: '3px solid var(--color-go-blue)', position: 'relative', flexShrink: 0 }}>
          <button
            className="button-icon"
            style={{ position: 'absolute', top: '8px', right: '8px' }}
            onClick={onClearSelectedText}
            title="Clear Selection"
          >
            <Trash2 size={16} />
          </button>
          <p style={{ fontSize: '12px', color: 'var(--color-text-light)', marginBottom: '8px' }}>Selected text:</p>
          <p style={{ fontSize: '14px', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            "{selectedText}"
          </p>
        </div>
      ) : (
        <div style={{ padding: '12px', backgroundColor: 'var(--color-surface)', borderRadius: '8px', borderStyle: 'dashed', borderWidth: '1px', borderColor: 'var(--color-border)', textAlign: 'center', color: 'var(--color-text-light)', fontSize: '14px', flexShrink: 0 }}>
          No text selected. Please highlight a fragment in the book.
        </div>
      )}

      {/* Chat Messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
        {chatHistory.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '90%',
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: msg.role === 'user' ? 'var(--color-go-blue)' : 'var(--color-surface)',
            color: msg.role === 'user' ? 'white' : 'var(--color-text)',
            borderBottomRightRadius: msg.role === 'user' ? '4px' : '12px',
            borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : '12px',
          }}>
            {msg.role === 'assistant' ? (
               <div className="markdown-body">
                 <ReactMarkdown remarkPlugins={[remarkGfm]}>
                   {msg.text}
                 </ReactMarkdown>
               </div>
            ) : (
              <p style={{ fontSize: '14px', lineHeight: '1.5' }}>{msg.text}</p>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '8px', paddingTop: '16px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
        <input
          type="text"
          className="input-field"
          placeholder="Ask about the highlight..."
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button className="button-primary" style={{ padding: '12px' }} onClick={handleSend}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
});

export default Sidebar;
