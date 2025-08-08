import { useState, useRef, useEffect } from 'react';
import { sendMessage, fetchMessages } from '../services/api';
import ReactMarkdown from 'react-markdown';
import { Copy, RotateCw, Check } from 'lucide-react';

function ChatWindow({ sessionId, setSessionId, username, refreshSessions }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [streamingMessage, setStreamingMessage] = useState(null);
  const [isHoveringNewChat, setIsHoveringNewChat] = useState(false);
  const [isHoveringSend, setIsHoveringSend] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const endRef = useRef(null);
  const textareaRef = useRef(null);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (!ta) return;

    const minHeight = 24;
    const maxHeight = 140;

    ta.style.height = 'auto';
    if (ta.scrollHeight > maxHeight) {
      ta.style.height = maxHeight + 'px';
      ta.style.overflowY = 'auto';
    } else if (ta.scrollHeight < minHeight) {
      ta.style.height = minHeight + 'px';
      ta.style.overflowY = 'hidden';
    } else {
      ta.style.height = ta.scrollHeight + 'px';
      ta.style.overflowY = 'hidden';
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = {
      role: 'user',
      message: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);
    
    // Initialize streaming message
    const initialStreamingMessage = { 
      role: 'assistant', 
      message: '', 
      timestamp: new Date().toISOString(), 
      source_type: null, 
      sources: [] 
    };
    setStreamingMessage(initialStreamingMessage);

    try {
      await sendMessage(sessionId, currentInput, username, (chunkData) => {
        // This callback is called for each chunk received
        if (!chunkData.isComplete) {
          // Update streaming message with new chunk
          setStreamingMessage(prev => ({
            ...prev,
            message: chunkData.fullResponse // Use full response to avoid concatenation issues
          }));
        } else {
          // Streaming complete, finalize the message
          const finalMessage = {
            role: 'assistant',
            message: chunkData.fullResponse,
            timestamp: new Date().toISOString(),
            source_type: chunkData.source_type || 'llm',
            sources: chunkData.sources || []
          };

          setMessages(prev => [...prev, finalMessage]);
          setStreamingMessage(null);
          setLoading(false);

          // Refresh sessions if this was the first message
          if (messages.length === 0 && typeof refreshSessions === 'function') {
            refreshSessions();
          }
        }
      });
    } catch (error) {
      console.error('Error sending message:', error);
      setStreamingMessage(null);
      setLoading(false);
      
      // Show error message
      const errorMessage = {
        role: 'assistant',
        message: 'Sorry, I encountered an error while processing your message. Please try again.',
        timestamp: new Date().toISOString(),
        source_type: 'error',
        sources: []
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleRegenerate = async (idx) => {
    const prevUserMsg = messages
      .slice(0, idx)
      .reverse()
      .find((m) => m.role === 'user');

    if (!prevUserMsg) return;

    // Remove messages from the regenerate point onwards
    setMessages(prev => prev.slice(0, idx));
    setLoading(true);
    
    const initialStreamingMessage = { 
      role: 'assistant', 
      message: '', 
      timestamp: new Date().toISOString(), 
      source_type: null, 
      sources: [] 
    };
    setStreamingMessage(initialStreamingMessage);

    try {
      await sendMessage(sessionId, prevUserMsg.message, username, (chunkData) => {
        if (!chunkData.isComplete) {
          setStreamingMessage(prev => ({
            ...prev,
            message: chunkData.fullResponse
          }));
        } else {
          const finalMessage = {
            role: 'assistant',
            message: chunkData.fullResponse,
            timestamp: new Date().toISOString(),
            source_type: chunkData.source_type || 'llm',
            sources: chunkData.sources || []
          };

          setMessages(prev => [...prev, finalMessage]);
          setStreamingMessage(null);
          setLoading(false);
        }
      });
    } catch (error) {
      console.error('Error regenerating message:', error);
      setStreamingMessage(null);
      setLoading(false);
    }
  };

  const startNewChat = () => {
    const newId = crypto.randomUUID();
    setSessionId(newId);
    setMessages([]);
    setSearch('');
    setStreamingMessage(null);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const chat = await fetchMessages(sessionId, username);
        const formatted = chat.map(m => ({
          role: m.role.toLowerCase() === 'chatbot' ? 'assistant' : 'user',
          message: m.message,
          timestamp: m.created_at || new Date().toISOString(),
          source_type: m.source_type || null,
          sources: m.sources || [],
        }));
        setMessages(formatted);
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    };

    if (sessionId) load();
  }, [sessionId, username]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const filteredMessages = messages.filter(m =>
    m.message.toLowerCase().includes(search.toLowerCase())
  );

  const formatDateTime = iso => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return '';
    }
  };

  const isEmptyChat = messages.length === 0 && !streamingMessage;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Righteous&display=swap');
        @keyframes fadeUp {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes gradientShift {
          0% { background-position: 0% center; }
          50% { background-position: 100% center; }
          100% { background-position: 0% center; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(720deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .spin-animation {
          animation: spin 1s linear forwards;
        }
        .brand-heading {
          margin: 0;
          font-size: 2rem;
          font-family: "Righteous", sans-serif;
          font-weight: 400;
          background: linear-gradient(90deg, #a958a5, #da1157, #a958a5);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: fadeUp 1.2s ease forwards, gradientShift 2s ease infinite;
        }
        .typing-indicator {
          animation: pulse 1.5s ease-in-out infinite;
        }
      `}</style>

      <div style={{ ...styles.container, justifyContent: isEmptyChat ? 'center' : 'flex-start' }}>
        {isEmptyChat ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            gap: '2rem',
          }}>
            <h1 className="brand-heading">Intellivus</h1>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              width: '100%',
              maxWidth: '600px',
            }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask anything..."
                style={{
                  flex: 1,
                  resize: 'none',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                  fontSize: '1rem',
                }}
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={loading}
                style={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  padding: '0.75rem 1.25rem',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                {loading ? '🟢' : 'Send'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={styles.headerRow}>
              <button
                onClick={startNewChat}
                style={{
                  ...styles.newChatBtn,
                  ...(isHoveringNewChat && styles.glowHoverNewChat)
                }}
                onMouseEnter={() => setIsHoveringNewChat(true)}
                onMouseLeave={() => setIsHoveringNewChat(false)}
              >
                New Chat
              </button>
              <h2 className="brand-heading">Intellivus</h2>
            </div>

            <input
              type="text"
              placeholder="Search messages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.searchInput}
            />

            <div style={styles.chatBox}>
              {filteredMessages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    ...styles.message,
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    backgroundColor: msg.role === 'user' ? '#e0f0ff' : '#f7f7f7'
                  }}
                >
                  {msg.role === 'user' ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <ReactMarkdown>{msg.message}</ReactMarkdown>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.message);
                          setCopiedIdx(idx);
                          setTimeout(() => setCopiedIdx(null), 3000);
                        }}
                        title="Copy"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        {copiedIdx === idx ? <Check size={16} color="#444" /> : <Copy size={16} />}
                      </button>
                    </div>
                  ) : (
                    <>
                      <ReactMarkdown>{msg.message}</ReactMarkdown>
                      {msg.sources && msg.sources.length > 0 && (
                        <div style={styles.sources}>
                          <strong>Sources:</strong>
                          <ul>
                            {msg.sources.map((link, i) => (
                              <li key={i}>
                                <a href={link} target="_blank" rel="noopener noreferrer">{link}</a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(msg.message);
                            setCopiedIdx(idx);
                            setTimeout(() => setCopiedIdx(null), 3000);
                          }}
                          title="Copy"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          {copiedIdx === idx ? <Check size={16} color="#444" /> : <Copy size={16} />}
                        </button>
                        <button
                          title="Regenerate"
                          onClick={async (e) => {
                            const icon = e.currentTarget.querySelector('.regen-icon');
                            if (icon) {
                              icon.classList.remove('spin-animation');
                              void icon.offsetWidth;
                              icon.classList.add('spin-animation');
                            }
                            await handleRegenerate(idx);
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          <RotateCw size={16} className="regen-icon" />
                        </button>
                      </div>
                    </>
                  )}
                  <div style={styles.timestamp}>{formatDateTime(msg.timestamp)}</div>
                </div>
              ))}
              {streamingMessage && (
                <div style={{ ...styles.message, backgroundColor: '#f7f7f7', alignSelf: 'flex-start' }}>
                  <div className="typing-indicator">
                    <ReactMarkdown>{streamingMessage.message || "Thinking..."}</ReactMarkdown>
                  </div>
                  {streamingMessage.sources && streamingMessage.sources.length > 0 && (
                    <div style={styles.sources}>
                      <strong>Sources:</strong>
                      <ul>
                        {streamingMessage.sources.map((link, i) => (
                          <li key={i}>
                            <a href={link} target="_blank" rel="noopener noreferrer">{link}</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <div ref={endRef}></div>
            </div>

            <div style={styles.inputRow}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask anything..."
                style={styles.textarea}
                rows={1}
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                style={{
                  ...styles.button,
                  ...(isHoveringSend && !loading && styles.glowHover),
                  opacity: loading || !input.trim() ? 0.6 : 1
                }}
                onMouseEnter={() => setIsHoveringSend(true)}
                onMouseLeave={() => setIsHoveringSend(false)}
              >
                {loading ? '🟢' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '1rem',
    background: 'linear-gradient(to right, #f2f9e8, #bfddbc)',
    overflow: 'hidden',
    minHeight: 0,
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  newChatBtn: {
    padding: '0.5rem 0.5rem',
    background: 'linear-gradient(135deg, #b3d1b1, #bdc2ff)',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    fontWeight: 500,
    fontSize: '0.875rem',
    textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
    cursor: 'pointer',
    transition: 'background 0.3s ease',
  },
  searchInput: {
    marginBottom: '0.5rem',
    padding: '0.5rem',
    borderRadius: '4px',
    border: '1px solid #ccc',
    fontSize: '1rem',
  },
  chatBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    padding: '0.5rem',
    background: '#fffdff',
    border: '1px solid #ccc',
    borderRadius: '4px',
    marginBottom: '1rem',
    minHeight: 0,
  },
  message: {
    maxWidth: '70%',
    padding: '0.5rem 1rem',
    margin: '0.25rem 0',
    borderRadius: '8px',
    position: 'relative',
  },
  timestamp: {
    fontSize: '0.5rem',
    color: '#666',
    marginTop: '0.25rem',
    textAlign: 'right',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'flex-end',
  },
  textarea: {
    flex: 1,
    padding: '0.5rem',
    fontSize: '1rem',
    fontFamily: 'inherit',
    border: '1px solid #ccc',
    borderRadius: '4px',
    resize: 'none',
    lineHeight: '1.5',
    overflowY: 'hidden',
    boxSizing: 'border-box',
    marginRight: '0.5rem',
    minHeight: '1.5rem',
    maxHeight: '140px',
  },
  button: {
    padding: '0.25rem 0.5rem',
    fontSize: '0.875rem',
    background: 'linear-gradient(135deg, #00893d, #34a853)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    height: '2.5rem',
    alignSelf: 'flex-end',
    flexShrink: 0,
    transition: 'all 0.3s ease',
  },
  glowHover: {
    boxShadow: '0 0 10px rgba(52, 168, 83, 0.6), 0 0 20px rgba(0, 137, 61, 0.5)',
    transform: 'scale(1.03)',
  },
  glowHoverNewChat: {
    boxShadow: '0 0 10px #a0c8a944, 0 0 20px #9aaeff88',
    transform: 'scale(1.03)',
    transition: 'box-shadow 0.3s ease, transform 0.3s ease',
  },
  sources: {
    fontSize: '0.85rem',
    marginTop: '0.5rem',
  },
};

export default ChatWindow;