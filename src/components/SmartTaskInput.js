import React, { useState, useRef, useEffect } from 'react';
import {
  FiPlus,
  FiZap,
  FiCalendar,
  FiUser,
  FiTag,
  FiClock,
  FiTarget,
} from 'react-icons/fi';

const SmartTaskInput = ({ onAddTask, projectId }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedTask, setParsedTask] = useState(null);
  const [showAIFeatures, setShowAIFeatures] = useState(false);
  const inputRef = useRef(null);

  const aiFeatures = [
    {
      id: 'smart-parse',
      icon: <FiZap />,
      title: 'Smart Parse',
      description:
        'AI understands natural language like "Call Sarah tomorrow at 3pm"',
      example: 'Try: "Plan team meeting next Friday morning"',
    },
    {
      id: 'task-breakdown',
      icon: <FiTarget />,
      title: 'Task Breakdown',
      description: 'Break complex tasks into actionable steps',
      example: 'Try: "Organize company retreat"',
    },
    {
      id: 'smart-scheduling',
      icon: <FiCalendar />,
      title: 'Smart Scheduling',
      description: 'AI suggests optimal timing and preparation',
      example: 'Try: "Prepare presentation for board meeting"',
    },
    {
      id: 'contextual-suggestions',
      icon: <FiZap />,
      title: 'Smart Suggestions',
      description: 'Get relevant next steps and resources',
      example: 'Try: "Write blog post about AI"',
    },
  ];

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const handleInputChange = async (e) => {
    const value = e.target.value;
    setInput(value);

    // Clear existing AI data when user is actively typing
    if (parsedTask) {
      setParsedTask(null);
    }
    if (aiSuggestions) {
      setAiSuggestions(null);
    }

    // Trigger AI processing for inputs longer than 8 characters
    if (value.length > 8 && !isProcessing) {
      debounceAIProcess(value);
    }
  };

  const handleInputBlur = async (e) => {
    const value = e.target.value.trim();
    // Process on blur if we have meaningful content and no current processing
    if (value.length > 5 && !isProcessing && !parsedTask) {
      await processWithAI(value, 'smart-parse');
    }
  };

  const debounceAIProcess = debounce(async (text) => {
    const trimmedText = text.trim();
    // Process if we have at least 2 words
    const words = trimmedText.split(/\s+/).filter(word => word.length > 0);
    
    if (words.length >= 2) {
      await processWithAI(trimmedText, 'smart-parse');
    }
  }, 1200); // Longer debounce to let users finish typing

  const processWithAI = async (text, feature = 'smart-parse', context = {}) => {
    if (!text.trim()) return;

    setIsProcessing(true);

    try {
      // Add 5 second timeout for faster user experience
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('/api/ai-task-processor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userInput: text,
          feature,
          context: {
            projectId,
            ...context,
          },
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();

        if (feature === 'smart-parse' && result.parsed) {
          setParsedTask(result.parsed);
        } else {
          setAiSuggestions(result);
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('AI request timeout - continuing without AI suggestions');
      } else {
        console.error('AI processing error:', error);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!input.trim()) return;

    let taskData = {
      task: input,
      projectId: projectId || '1',
      date: '',
      priority: 'medium',
    };

    // Use AI-parsed data if available
    if (parsedTask) {
      taskData = {
        task: parsedTask.taskName || input,
        projectId: projectId || '1',
        date: parsedTask.date || '',
        priority: parsedTask.priority || 'medium',
        aiEnhanced: true,
        metadata: {
          originalInput: input,
          aiParsed: parsedTask,
          confidence: parsedTask.confidence,
        },
      };
    }

    onAddTask(taskData);

    // Reset form
    setInput('');
    setParsedTask(null);
    setAiSuggestions(null);
    setIsExpanded(false);
  };

  const handleAIFeatureClick = async (feature) => {
    if (!input.trim()) {
      // Show example
      const selectedFeature = aiFeatures.find((f) => f.id === feature.id);
      if (selectedFeature) {
        setInput(selectedFeature.example.replace('Try: ', ''));
      }
      return;
    }

    await processWithAI(input, feature.id);
  };

  const handleSuggestionClick = async (suggestion) => {
    // Add the main task first if not already added
    if (input.trim()) {
      let mainTaskData = {
        task: input.trim(),
        projectId: projectId || '1',
        date: '',
        priority: 'medium',
      };

      // Use AI-parsed data if available for main task
      if (parsedTask) {
        mainTaskData = {
          task: parsedTask.taskName || input.trim(),
          projectId: projectId || '1',
          date: parsedTask.date || '',
          priority: parsedTask.priority || 'medium',
          aiEnhanced: true,
          metadata: {
            originalInput: input,
            aiParsed: parsedTask,
          },
        };
      }

      // Add main task
      await onAddTask(mainTaskData);

      // Add suggestion as a related task
      const suggestionTaskData = {
        task: suggestion,
        projectId: projectId || '1',
        date: '',
        priority: 'low',
        aiEnhanced: true,
        metadata: {
          relatedTo: input.trim(),
          type: 'suggestion',
        },
      };

      await onAddTask(suggestionTaskData);

      // Reset form
      setInput('');
      setParsedTask(null);
      setAiSuggestions(null);
      setIsExpanded(false);
    }
  };

  const ApplyParsedTask = () => {
    if (!parsedTask) return null;

    return (
      <div className="ai-parsed-preview">
        <div className="ai-parsed-header">
          <FiZap className="ai-icon" />
          <span>AI Enhanced Task</span>
        </div>

        <div className="parsed-details">
          <div className="detail-item">
            <FiTarget className="detail-icon" />
            <span className="detail-label">Task:</span>
            <span className="detail-value">{parsedTask.taskName}</span>
          </div>

          {parsedTask.date && (
            <div className="detail-item">
              <FiCalendar className="detail-icon" />
              <span className="detail-label">Date:</span>
              <span className="detail-value">{parsedTask.date}</span>
            </div>
          )}

          {parsedTask.time && (
            <div className="detail-item">
              <FiClock className="detail-icon" />
              <span className="detail-label">Time:</span>
              <span className="detail-value">{parsedTask.time}</span>
            </div>
          )}

          <div className="detail-item">
            <FiTag className="detail-icon" />
            <span className="detail-label">Priority:</span>
            <span className={`priority-badge ${parsedTask.priority}`}>
              {parsedTask.priority}
            </span>
          </div>

          {parsedTask.people && parsedTask.people.length > 0 && (
            <div className="detail-item">
              <FiUser className="detail-icon" />
              <span className="detail-label">People:</span>
              <span className="detail-value">
                {parsedTask.people.join(', ')}
              </span>
            </div>
          )}

          {parsedTask.category && (
            <div className="detail-item">
              <FiTag className="detail-icon" />
              <span className="detail-label">Category:</span>
              <span className="detail-value">{parsedTask.category}</span>
            </div>
          )}
        </div>

        {parsedTask.suggestions && parsedTask.suggestions.length > 0 && (
          <div className="ai-suggestions">
            <h4>Smart Suggestions:</h4>
            <div className="suggestions-grid">
              {parsedTask.suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  className="suggestion-btn clickable"
                  onClick={() => handleSuggestionClick(suggestion)}
                  title="Click to add as related task"
                >
                  <span className="suggestion-text">{suggestion}</span>
                  <span className="add-icon">+</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const AIFeatureButtons = () => (
    <div className="ai-features">
      <div className="ai-features-header">
        <FiZap className="ai-icon" />
        <span>AI Features</span>
      </div>

      <div className="ai-features-grid">
        {aiFeatures.map((feature) => (
          <button
            type="button"
            key={feature.id}
            className="ai-feature-btn"
            onClick={() => handleAIFeatureClick(feature)}
            disabled={isProcessing}
          >
            <div className="feature-icon">{feature.icon}</div>
            <div className="feature-content">
              <div className="feature-title">{feature.title}</div>
              <div className="feature-description">{feature.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  if (!isExpanded) {
    return (
      <div className="smart-task-input-collapsed">
        <button
          type="button"
          className="expand-button"
          onClick={() => setIsExpanded(true)}
        >
          <FiPlus className="plus-icon" />
          <span>Add task with AI assistance</span>
          <FiZap className="ai-badge" />
        </button>
      </div>
    );
  }

  return (
    <div className="smart-task-input-expanded">
      <form onSubmit={handleSubmit} className="task-form">
        <div className="input-container">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            placeholder="Type naturally: 'Call Sarah tomorrow at 3pm' or 'Plan team retreat'"
            className="smart-input"
          />

          <div className="input-actions">
            <button
              type="button"
              className="ai-toggle"
              onClick={() => setShowAIFeatures(!showAIFeatures)}
              title="Toggle AI Features"
            >
              <FiZap
                className={`ai-icon ${isProcessing ? 'processing' : ''}`}
              />
            </button>

            <button
              type="submit"
              className="submit-btn"
              disabled={!input.trim() || isProcessing}
            >
              Add Task
            </button>

            <button
              type="button"
              className="cancel-btn"
              onClick={() => {
                setIsExpanded(false);
                setInput('');
                setParsedTask(null);
                setAiSuggestions(null);
                setShowAIFeatures(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>

        {isProcessing && (
          <div className="ai-processing">
            <FiZap className="processing-icon" />
            <span>AI is analyzing your task...</span>
          </div>
        )}

        <ApplyParsedTask />

        {showAIFeatures && <AIFeatureButtons />}

        {aiSuggestions && (
          <div className="ai-suggestions-panel">
            <div className="ai-suggestions-header">
              <FiZap className="ai-icon" />
              <h4>AI Suggestions</h4>
            </div>
            
            {aiSuggestions.taskName && (
              <div className="suggestion-item">
                <FiTarget className="suggestion-icon" />
                <span className="suggestion-label">Task:</span>
                <span className="suggestion-value">{aiSuggestions.taskName}</span>
              </div>
            )}
            
            {aiSuggestions.category && (
              <div className="suggestion-item">
                <FiTag className="suggestion-icon" />
                <span className="suggestion-label">Category:</span>
                <span className="suggestion-value">{aiSuggestions.category}</span>
              </div>
            )}
            
            {aiSuggestions.priority && (
              <div className="suggestion-item">
                <FiTag className="suggestion-icon" />
                <span className="suggestion-label">Priority:</span>
                <span className={`priority-badge ${aiSuggestions.priority}`}>
                  {aiSuggestions.priority}
                </span>
              </div>
            )}
            
            {aiSuggestions.people && aiSuggestions.people.length > 0 && (
              <div className="suggestion-item">
                <FiUser className="suggestion-icon" />
                <span className="suggestion-label">People:</span>
                <span className="suggestion-value">{aiSuggestions.people.join(', ')}</span>
              </div>
            )}
            
            {aiSuggestions.suggestions && aiSuggestions.suggestions.length > 0 && (
              <div className="ai-recommendations">
                <h5>Smart Recommendations:</h5>
                <div className="suggestions-grid">
                  {aiSuggestions.suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      className="suggestion-btn clickable"
                      onClick={() => handleSuggestionClick(suggestion)}
                      title="Click to add as related task"
                    >
                      <span className="suggestion-text">{suggestion}</span>
                      <span className="add-icon">+</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        )}
      </form>
    </div>
  );
};

// Utility function for debouncing
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export default SmartTaskInput;
