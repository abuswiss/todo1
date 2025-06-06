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
import { taskProcessor, AIClientError, AI_ERROR_TYPES } from '../lib/ai-client';

const SmartTaskInput = ({ onAddTask, projectId }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedTask, setParsedTask] = useState(null);
  const [showAIFeatures, setShowAIFeatures] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState(new Set());
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

  // Utility function for debouncing
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  const processWithAI = async (text, feature = 'smart-parse', context = {}) => {
    if (!text.trim()) return;

    setIsProcessing(true);

    try {
      const fullContext = {
        projectId,
        ...context,
      };

      let result;
      
      switch (feature) {
        case 'smart-parse':
          result = await taskProcessor.smartParse(text, { 
            context: fullContext, 
            timeout: 5000 
          });
          setParsedTask(result);
          break;
          
        case 'task-breakdown':
          result = await taskProcessor.breakdownTask(text, fullContext);
          setAiSuggestions(result);
          break;
          
        case 'smart-scheduling':
          result = await taskProcessor.getSmartScheduling(text, fullContext);
          setAiSuggestions(result);
          break;
          
        case 'contextual-suggestions':
          result = await taskProcessor.getContextualSuggestions(text, fullContext);
          setAiSuggestions(result);
          break;
          
        default:
          result = await taskProcessor.smartParse(text, { 
            context: fullContext, 
            timeout: 5000 
          });
          setParsedTask(result);
      }

    } catch (error) {
      if (error instanceof AIClientError) {
        if (error.type === AI_ERROR_TYPES.TIMEOUT_ERROR) {
          console.log('AI request timeout - continuing without AI suggestions');
        } else {
          console.error('AI processing error:', error.message);
        }
      } else {
        console.error('Unexpected error:', error);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const debounceAIProcess = debounce(async (text) => {
    const trimmedText = text.trim();
    // Process if we have at least 2 words
    const words = trimmedText.split(/\s+/).filter((word) => word.length > 0);

    if (words.length >= 2) {
      await processWithAI(trimmedText, 'smart-parse');
    }
  }, 1200); // Longer debounce to let users finish typing

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const handleInputChange = async (e) => {
    const { value } = e.target;
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

  const handleSuggestionToggle = (suggestion, index) => {
    const newSelected = new Set(selectedSuggestions);
    const suggestionId = `${index}-${suggestion}`;

    if (newSelected.has(suggestionId)) {
      newSelected.delete(suggestionId);
    } else {
      newSelected.add(suggestionId);
    }

    setSelectedSuggestions(newSelected);
  };

  const handleAddSelectedSuggestions = async () => {
    if (!input.trim() || selectedSuggestions.size === 0) return;

    // First add the main task
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

    try {
      // Add main task first and wait for its ID
      const createdMainTask = await onAddTask(mainTaskData);

      if (createdMainTask?.id) {
        // Get the suggestions from either parsedTask or aiSuggestions
        const suggestions = parsedTask?.suggestions || 
                           aiSuggestions?.suggestions || 
                           aiSuggestions?.breakdown || [];

        // Add each selected suggestion as a subtask with proper parent relationship
        const subtasks = Array.from(selectedSuggestions)
          .map((suggestionId) => {
            const [index] = suggestionId.split('-');
            const suggestion = suggestions[parseInt(index, 10)];

            if (suggestion) {
              const subtaskText = typeof suggestion === 'string' ? suggestion : 
                                 suggestion.task || suggestion;
              const subtaskPriority = suggestion.priority || 'low';
              
              return {
                task: subtaskText,
                projectId: projectId || '1',
                date: '',
                priority: subtaskPriority,
                aiEnhanced: true,
                parentTaskId: createdMainTask.id, // Properly set parent task ID
                metadata: {
                  parentTask: mainTaskData.task,
                  type: 'subtask',
                  aiGenerated: true,
                  estimatedTime: suggestion.estimatedTime,
                },
              };
            }
            return null;
          })
          .filter(Boolean);

        // Add subtasks sequentially to avoid race conditions
        const subtaskPromises = subtasks.map(async (subtaskData) => {
          try {
            await onAddTask(subtaskData);
          } catch (error) {
            console.error('Error creating subtask:', subtaskData.task, error);
            // Continue with other subtasks even if one fails
          }
        });

        // Wait for all subtasks to be processed
        await Promise.allSettled(subtaskPromises);
      } else {
        console.warn('Main task creation did not return an ID, skipping subtask creation');
      }
    } catch (error) {
      console.error('Error creating main task:', error);
      // Don't create subtasks if main task creation failed
    }

    // Reset form
    setInput('');
    setParsedTask(null);
    setAiSuggestions(null);
    setSelectedSuggestions(new Set());
    setIsExpanded(false);
  };

  const handleSuggestionClick = async (suggestion) => {
    // Single suggestion click - add as individual subtask
    if (input.trim()) {
      let mainTaskData = {
        task: input.trim(),
        projectId: projectId || '1',
        date: '',
        priority: 'medium',
      };

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

      try {
        const createdMainTask = await onAddTask(mainTaskData);

        if (createdMainTask?.id) {
          const suggestionTaskData = {
            task: suggestion,
            projectId: projectId || '1',
            date: '',
            priority: 'low',
            aiEnhanced: true,
            parentTaskId: createdMainTask.id, // Properly set parent task ID
            metadata: {
              parentTask: mainTaskData.task,
              type: 'subtask',
              aiGenerated: true,
            },
          };

          await onAddTask(suggestionTaskData);
        } else {
          console.warn('Main task creation did not return an ID, skipping subtask creation');
        }
      } catch (error) {
        console.error('Error creating main task or subtask:', error);
      }

      setInput('');
      setParsedTask(null);
      setAiSuggestions(null);
      setSelectedSuggestions(new Set());
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
            <div className="suggestions-header">
              <h4>Smart Suggestions:</h4>
              {selectedSuggestions.size > 0 && (
                <button
                  type="button"
                  className="add-selected-btn"
                  onClick={handleAddSelectedSuggestions}
                  title={`Add ${selectedSuggestions.size} selected suggestions as subtasks`}
                >
                  Add Selected ({selectedSuggestions.size})
                </button>
              )}
            </div>
            <div className="suggestions-grid">
              {parsedTask.suggestions.map((suggestion, index) => {
                const suggestionId = `${index}-${suggestion}`;
                const isSelected = selectedSuggestions.has(suggestionId);
                
                return (
                  <div key={index} className="suggestion-item-container">
                    <input
                      type="checkbox"
                      id={`suggestion-${index}`}
                      checked={isSelected}
                      onChange={() => handleSuggestionToggle(suggestion, index)}
                      className="suggestion-checkbox"
                    />
                    <label
                      htmlFor={`suggestion-${index}`}
                      className={`suggestion-btn clickable ${
                        isSelected ? 'selected' : ''
                      }`}
                    >
                      <span className="suggestion-text">{suggestion}</span>
                      <span className="add-icon">{isSelected ? '✓' : '+'}</span>
                    </label>
                  </div>
                );
              })}
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
                setSelectedSuggestions(new Set());
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
                <span className="suggestion-value">
                  {aiSuggestions.taskName}
                </span>
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
                <div className="recommendations-header">
                  <h5>Smart Recommendations:</h5>
                  {selectedSuggestions.size > 0 && (
                    <button
                      type="button"
                      className="add-selected-btn"
                      onClick={handleAddSelectedSuggestions}
                      title={`Add ${selectedSuggestions.size} selected suggestions as subtasks`}
                    >
                      Add Selected ({selectedSuggestions.size})
                    </button>
                  )}
                </div>
                <div className="suggestions-grid">
                  {aiSuggestions.suggestions.map((suggestion, index) => {
                    const suggestionId = `${index}-${suggestion}`;
                    const isSelected = selectedSuggestions.has(suggestionId);
                    
                    return (
                      <div key={index} className="suggestion-item-container">
                        <input
                          type="checkbox"
                          id={`ai-suggestion-${index}`}
                          checked={isSelected}
                          onChange={() => handleSuggestionToggle(suggestion, index)}
                          className="suggestion-checkbox"
                        />
                        <label
                          htmlFor={`ai-suggestion-${index}`}
                          className={`suggestion-btn clickable ${
                        isSelected ? 'selected' : ''
                      }`}
                        >
                          <span className="suggestion-text">{suggestion}</span>
                          <span className="add-icon">{isSelected ? '✓' : '+'}</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
          </div>
        )}
      </form>
    </div>
  );
};


export default SmartTaskInput;
