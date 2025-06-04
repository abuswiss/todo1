import React, { useState, useRef, useEffect } from 'react';
import {
  FiSend,
  FiMessageCircle,
  FiX,
  FiZap,
  FiMinimize2,
  FiMaximize2,
  FiStar,
} from 'react-icons/fi';

const PerplexityChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "👋 Hi! I'm your AI assistant powered by Perplexity. I can help you with:\n\n• Research for your tasks\n• Planning and organization\n• Productivity tips\n• Breaking down complex projects\n• General questions and assistance\n\nWhat can I help you with today?",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];

    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages.slice(-10), // Keep last 10 messages for context
        }),
      });

      if (response.ok) {
        // Check if it's a streaming response
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('text/plain')) {
          // Handle streaming response
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (reader) {
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: '', streaming: true },
            ]);

            let assistantContent = '';

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                assistantContent += chunk;

                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: assistantContent,
                    streaming: true,
                  };
                  return updated;
                });
              }
            } finally {
              reader.releaseLock();
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: assistantContent,
                  streaming: false,
                };
                return updated;
              });
            }
          }
        } else {
          // Handle JSON response (fallback)
          const data = await response.json();
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content:
                data.response || data.error || 'Sorry, I encountered an error.',
              fallback: data.fallback,
            },
          ]);
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            "❌ Sorry, I'm having trouble connecting right now. Please try again later.",
          error: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedQuestions = [
    'How can I improve my productivity?',
    "What's the best way to prioritize tasks?",
    'Help me break down a complex project',
    'Research productivity methodologies',
    'Time management strategies for busy schedules',
  ];

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  if (!isOpen) {
    return (
      <div className="perplexity-chat-trigger">
        <button
          type="button"
          className="chat-trigger-btn"
          onClick={() => setIsOpen(true)}
          title="Open AI Assistant"
        >
          <FiStar className="chat-icon" />
          <span className="chat-label">AI Assistant</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`perplexity-chat ${isMinimized ? 'minimized' : 'expanded'}`}
    >
      <div className="chat-header">
        <div className="header-left">
          <FiStar className="header-icon" />
          <h3>AI Assistant</h3>
          <span className="powered-by">Powered by Perplexity</span>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="header-btn"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <FiMaximize2 /> : <FiMinimize2 />}
          </button>

          <button
            type="button"
            className="header-btn close-btn"
            onClick={() => setIsOpen(false)}
            title="Close"
          >
            <FiX />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="chat-messages">
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.role}`}>
                <div className="message-content">
                  {message.role === 'assistant' && (
                    <div className="message-avatar">
                      <FiStar />
                    </div>
                  )}

                  <div className="message-text">
                    {message.content.split('\\n').map((line, lineIndex) => (
                      <div key={lineIndex}>
                        {line}
                        {lineIndex <
                          message.content.split('\\n').length - 1 && <br />}
                      </div>
                    ))}

                    {message.streaming && (
                      <span className="streaming-indicator">▋</span>
                    )}

                    {message.fallback && (
                      <div className="fallback-notice">
                        💡 Add your Perplexity API key for enhanced responses
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && !messages[messages.length - 1]?.streaming && (
              <div className="message assistant">
                <div className="message-content">
                  <div className="message-avatar">
                    <FiStar className="loading" />
                  </div>
                  <div className="message-text">
                    <div className="typing-indicator">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {messages.length === 1 && (
            <div className="suggested-questions">
              <h4>Try asking:</h4>
              <div className="suggestions-grid">
                {suggestedQuestions.map((question, index) => (
                  <button
                    type="button"
                    key={index}
                    className="suggestion-btn"
                    onClick={() => handleSuggestionClick(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="chat-input-form">
            <div className="input-container">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                className="chat-input"
                disabled={isLoading}
              />

              <button
                type="submit"
                className="send-btn"
                disabled={!input.trim() || isLoading}
              >
                <FiSend />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default PerplexityChat;
