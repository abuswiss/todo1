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
import { useTasks } from '../hooks';
import { useSelectedProjectValue } from '../context';
import { chatClient, AIClientError, AI_ERROR_TYPES } from '../lib/ai-client';

const PerplexityChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const { selectedProject } = useSelectedProjectValue();
  const { tasks } = useTasks(selectedProject);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "👋 Hi! I'm your AI assistant powered by Perplexity. I can see your current tasks and help you with:\n\n• Analyzing and prioritizing your tasks\n• Research for your specific projects\n• Breaking down complex tasks\n• Time management and productivity tips\n• General questions and assistance\n\nI'm aware of your current tasks and can provide personalized advice! What can I help you with?",
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
      const taskContext = {
        currentProject: selectedProject,
        tasks: tasks.slice(0, 20).map(task => ({
          id: task.id,
          task: task.task,
          priority: task.priority,
          date: task.date,
          projectId: task.projectId,
          archived: task.archived
        }))
      };

      // Use streaming for better user experience
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '', streaming: true },
      ]);

      let assistantContent = '';

      await chatClient.streamMessage(
        newMessages.slice(-10), // Keep last 10 messages for context
        taskContext,
        (chunk) => {
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
      );

      // Mark streaming as complete
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: assistantContent,
          streaming: false,
        };
        return updated;
      });

    } catch (error) {
      console.error('Chat error:', error);
      
      let errorMessage = "❌ Sorry, I'm having trouble connecting right now. Please try again later.";
      let fallback = false;

      if (error instanceof AIClientError) {
        switch (error.type) {
          case AI_ERROR_TYPES.NETWORK_ERROR:
            errorMessage = "🌐 Network connection issue. Please check your connection and try again.";
            break;
          case AI_ERROR_TYPES.TIMEOUT_ERROR:
            errorMessage = "⏱️ Request timed out. The AI service might be busy. Please try again.";
            break;
          case AI_ERROR_TYPES.RATE_LIMIT_ERROR:
            errorMessage = "🚫 Rate limit exceeded. Please wait a moment before trying again.";
            break;
          case AI_ERROR_TYPES.API_ERROR:
            if (error.details?.fallback) {
              errorMessage = error.message;
              fallback = true;
            } else {
              errorMessage = "🔧 AI service is temporarily unavailable. Please try again later.";
            }
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: errorMessage,
          error: !fallback,
          fallback: fallback,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedQuestions = [
    'How should I prioritize my current tasks?',
    'What tasks should I focus on today?',
    'Help me break down my complex tasks',
    'Research strategies for my current projects',
    'Time management tips for my workload',
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
