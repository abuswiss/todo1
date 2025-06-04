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

    // Trigger AI processing for inputs longer than 10 characters
    if (value.length > 10 && !isProcessing) {
      debounceAIProcess(value);
    }
  };

  const debounceAIProcess = debounce(async (text) => {
    await processWithAI(text, 'smart-parse');
  }, 800);

  const processWithAI = async (text, feature = 'smart-parse', context = {}) => {
    if (!text.trim()) return;

    setIsProcessing(true);

    try {
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
      });

      if (response.ok) {
        const result = await response.json();

        if (feature === 'smart-parse' && result.parsed) {
          setParsedTask(result.parsed);
        } else {
          setAiSuggestions(result);
        }
      }
    } catch (error) {
      console.error('AI processing error:', error);
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

  const ApplyParsedTask = () => {
    if (!parsedTask) return null;

    return (
      <div className="ai-parsed-preview">
        <div className="ai-parsed-header">
          <FiZap className="ai-icon" />
          <span>AI Enhanced Task</span>
          <span className="confidence">
            Confidence: {Math.round(parsedTask.confidence * 100)}%
          </span>
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
            <h4>AI Suggestions:</h4>
            <ul>
              {parsedTask.suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
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
                <h5>Recommendations:</h5>
                <ul>
                  {aiSuggestions.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {aiSuggestions.confidence && (
              <div className="confidence-meter">
                <span className="confidence-label">AI Confidence:</span>
                <div className="confidence-bar">
                  <div 
                    className="confidence-fill" 
                    style={{ width: `${aiSuggestions.confidence * 100}%` }}
                  />
                </div>
                <span className="confidence-value">
                  {Math.round(aiSuggestions.confidence * 100)}%
                </span>
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
