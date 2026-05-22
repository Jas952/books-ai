import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Trash2, Plus, MessageSquare, ChevronDown, ChevronUp, Archive, Download, Loader, Paperclip, X, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { darcula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { sendMessage } from '../ai/agent.js';

const createNewSession = () => ({
  id: Date.now().toString(),
  title: 'New Chat',
  messages: [
    { role: 'assistant', text: 'Привет! Выделите текст в книге, и задайте мне вопрос по этому фрагменту.' }
  ],
  archived: false
});

/* Collapsible context attachment inside a user message bubble */
function ContextAttachment({ text }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  return (
    <div className="context-attachment" onClick={() => setExpanded(!expanded)}>
      <div className="context-attachment-header">
        <Paperclip size={10} />
        <span>Attached text</span>
        {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </div>
      <div className={`context-attachment-text ${expanded ? '' : 'collapsed'}`}>
        "{text}"
      </div>
    </div>
  );
}

/* Custom Code Block for Markdown */
const CodeBlock = ({ node, inline, className, children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline && match) {
    return (
      <div className="code-block-container" style={{ position: 'relative', margin: '12px 0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2b2b2b', padding: '6px 12px', borderBottom: '1px solid #1e1e1e' }}>
          <span style={{ color: '#a9b7c6', fontSize: '12px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{language}</span>
          <button 
            onClick={handleCopy}
            title="Copy code"
            style={{ 
              display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', 
              color: copied ? '#4CAF50' : '#a9b7c6', cursor: 'pointer', fontSize: '12px', transition: 'color 0.2s', padding: '4px'
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <SyntaxHighlighter
          style={darcula}
          language={language}
          PreTag="div"
          customStyle={{ margin: 0, padding: '16px', fontSize: '13px', borderRadius: '0 0 8px 8px', backgroundColor: '#1e1e1e' }}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    );
  }
  return (
    <code className={className} style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace' }} {...props}>
      {children}
    </code>
  );
};

const Sidebar = React.memo(function Sidebar({ selectedText, onClearSelectedText, onSetSelectedText, settings = {} }) {
  const chatFontSize = settings.chatFontSize || 14;
  const [sessions, setSessions] = useState([createNewSession()]);
  const [activeSessionId, setActiveSessionId] = useState(sessions[0].id);
  const [question, setQuestion] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef(null);

  const [chatSelection, setChatSelection] = useState(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const chatHistory = activeSession ? activeSession.messages : [];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory.length]);

  // Handle text selection inside the chat for Ask AI functionality
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      if (text && chatEndRef.current) {
        // Ensure the selection is within the sidebar
        const sidebarPane = chatEndRef.current.closest('.sidebar-pane');
        if (sidebarPane && sidebarPane.contains(selection.anchorNode)) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setChatSelection({ text, rect });
            return;
          }
        }
      }
      setChatSelection(null);
    };
    
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const updateActiveSession = (updater) => {
    setSessions(prev => prev.map(s =>
      s.id === activeSessionId ? updater(s) : s
    ));
  };

  const handleSend = async () => {
    if (!question.trim() || !activeSession || isLoading) return;

    const userMessage = { role: 'user', text: question, context: selectedText || '' };
    const currentQuestion = question;
    const currentContext = selectedText;

    // Set title from first message
    updateActiveSession(s => ({
      ...s,
      title: s.messages.filter(m => m.role === 'user').length === 0
        ? question.slice(0, 40) + (question.length > 40 ? '...' : '')
        : s.title,
      messages: [...s.messages, userMessage]
    }));

    setQuestion('');
    setIsLoading(true);

    try {
      const reply = await sendMessage(currentQuestion, currentContext);
      updateActiveSession(s => ({
        ...s,
        messages: [...s.messages, { role: 'assistant', text: reply }]
      }));
    } catch (err) {
      updateActiveSession(s => ({
        ...s,
        messages: [...s.messages, {
          role: 'assistant',
          text: `⚠️ **Ошибка:** ${err.message}`
        }]
      }));
    } finally {
      setIsLoading(false);
    }
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
        <div className="model-pills">
          <button
            className="model-pill disabled"
            disabled
            title="Local model (coming soon)"
          >
            Local Model
          </button>
          <button
            className="model-pill active"
            title="AI Router — active"
          >
            Router
          </button>
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
               <div className="markdown-body" style={{ fontSize: `${chatFontSize}px` }}>
                 <ReactMarkdown 
                   remarkPlugins={[remarkGfm]}
                   components={{
                     code: CodeBlock
                   }}
                 >
                   {msg.text}
                 </ReactMarkdown>
               </div>
            ) : (
              <div>
                <p style={{ fontSize: `${chatFontSize}px`, lineHeight: '1.5' }}>{msg.text}</p>
                {msg.context && <ContextAttachment text={msg.context} />}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div style={{
            alignSelf: 'flex-start',
            maxWidth: '90%',
            padding: '12px 16px',
            borderRadius: '12px',
            borderBottomLeftRadius: '4px',
            backgroundColor: 'var(--color-surface)',
            display: 'flex',
            gap: '5px',
            alignItems: 'center'
          }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-text-light)',
                display: 'inline-block',
                animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
              }} />
            ))}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Context indicator */}
      {selectedText && (
        <div style={{ flexShrink: 0 }}>
          <div className="context-indicator">
            <Paperclip size={12} />
            <span>{selectedText.slice(0, 60)}{selectedText.length > 60 ? '...' : ''}</span>
            <button
              className="button-icon"
              style={{ padding: '2px', marginLeft: 'auto' }}
              onClick={onClearSelectedText}
              title="Remove attached text"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', gap: '8px', paddingTop: '16px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
        <input
          type="text"
          className="input-field"
          placeholder={selectedText ? "Ask about the highlight..." : "Type a message..."}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !isLoading && handleSend()}
          disabled={isLoading}
        />
        <button
          className="button-primary"
          style={{ padding: '12px', opacity: isLoading ? 0.6 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
          onClick={handleSend}
          disabled={isLoading}
          title={isLoading ? 'Ожидаю ответа...' : 'Отправить'}
        >
          {isLoading
            ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
            : <Send size={18} />}
        </button>
      </div>

      {/* Floating Ask AI Button for Chat Text Selection */}
      {chatSelection && (
        <div style={{
          position: 'fixed',
          top: Math.max(10, chatSelection.rect.top - 45),
          left: chatSelection.rect.left + (chatSelection.rect.width / 2) - 45,
          zIndex: 9999,
          animation: 'fadeIn 0.15s ease'
        }}>
          <button
            onClick={() => {
              if (onSetSelectedText) {
                onSetSelectedText(chatSelection.text);
              }
              window.getSelection().removeAllRanges();
              setChatSelection(null);
            }}
            title="Ask AI about this"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', backgroundColor: 'var(--color-go-blue)', color: 'white',
              border: 'none', borderRadius: '6px', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)', fontSize: '13px', fontWeight: 500
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-go-blue-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-go-blue)'}
          >
            <Bot size={14} /> Ask AI
          </button>
        </div>
      )}
    </div>
  );
});

export default Sidebar;
