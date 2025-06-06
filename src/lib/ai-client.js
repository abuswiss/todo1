/**
 * AI Client - Dedicated module for AI service calls
 * Provides a clean interface to server-side AI endpoints with error handling and retry logic
 */

// Configuration - Always use relative URLs for security
const API_BASE_URL = '/api';

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second

// Error types for better error handling
export const AI_ERROR_TYPES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  API_ERROR: 'API_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

class AIClientError extends Error {
  constructor(message, type, status, details) {
    super(message);
    this.name = 'AIClientError';
    this.type = type;
    this.status = status;
    this.details = details;
  }
}

// Utility functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const withTimeout = (promise, timeoutMs) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new AIClientError('Request timeout', AI_ERROR_TYPES.TIMEOUT_ERROR)), timeoutMs)
    )
  ]);
};

const classifyError = (error, response) => {
  if (error.name === 'AIClientError') return error;
  
  if (!response) {
    return new AIClientError(
      'Network connection failed',
      AI_ERROR_TYPES.NETWORK_ERROR,
      null,
      error.message
    );
  }

  const status = response.status;
  
  if (status === 429) {
    return new AIClientError(
      'Rate limit exceeded - please try again later',
      AI_ERROR_TYPES.RATE_LIMIT_ERROR,
      status
    );
  }
  
  if (status >= 400 && status < 500) {
    return new AIClientError(
      'Invalid request or client error',
      AI_ERROR_TYPES.VALIDATION_ERROR,
      status
    );
  }
  
  if (status >= 500) {
    return new AIClientError(
      'Server error - please try again',
      AI_ERROR_TYPES.API_ERROR,
      status
    );
  }
  
  return new AIClientError(
    error.message || 'Unknown error occurred',
    AI_ERROR_TYPES.UNKNOWN_ERROR,
    status
  );
};

const makeRequest = async (url, options = {}, retries = MAX_RETRIES) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AIClientError(
        errorData.error || `HTTP ${response.status}`,
        response.status === 429 ? AI_ERROR_TYPES.RATE_LIMIT_ERROR : AI_ERROR_TYPES.API_ERROR,
        response.status,
        errorData
      );
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (controller.signal.aborted) {
      throw new AIClientError('Request timeout', AI_ERROR_TYPES.TIMEOUT_ERROR);
    }

    // Retry logic for certain error types
    if (retries > 0 && shouldRetry(error)) {
      await delay(RETRY_DELAY * (MAX_RETRIES - retries + 1)); // Exponential backoff
      return makeRequest(url, options, retries - 1);
    }

    throw classifyError(error);
  }
};

const shouldRetry = (error) => {
  return error.type === AI_ERROR_TYPES.NETWORK_ERROR || 
         error.type === AI_ERROR_TYPES.TIMEOUT_ERROR ||
         (error.type === AI_ERROR_TYPES.API_ERROR && error.status >= 500);
};

// Task Processing API
export const taskProcessor = {
  /**
   * Smart parse a task input with AI
   * @param {string} userInput - The task text to parse
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Parsed task data
   */
  async smartParse(userInput, options = {}) {
    if (!userInput || typeof userInput !== 'string') {
      throw new AIClientError('User input is required and must be a string', AI_ERROR_TYPES.VALIDATION_ERROR);
    }

    const response = await makeRequest(`${API_BASE_URL}/ai-task-processor`, {
      method: 'POST',
      body: JSON.stringify({
        userInput: userInput.trim(),
        feature: 'smart-parse',
        context: options.context || {}
      }),
      timeout: options.timeout
    });

    const data = await response.json();
    
    if (!data.success) {
      throw new AIClientError('Failed to parse task', AI_ERROR_TYPES.API_ERROR, null, data);
    }

    return {
      taskName: data.parsed?.taskName || userInput,
      date: data.parsed?.date,
      time: data.parsed?.time,
      priority: data.parsed?.priority || 'medium',
      people: data.parsed?.people || [],
      category: data.parsed?.category || 'general',
      tags: data.parsed?.tags || [],
      estimatedDuration: data.parsed?.estimatedDuration || '30 minutes',
      suggestions: data.parsed?.suggestions || [],
      confidence: data.confidence || 0.5,
      aiPowered: data.aiPowered || false,
      cached: data.cached || false
    };
  },

  /**
   * Break down a complex task into subtasks
   * @param {string} task - The task to break down
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Task breakdown
   */
  async breakdownTask(task, context = {}) {
    if (!task) {
      throw new AIClientError('Task is required', AI_ERROR_TYPES.VALIDATION_ERROR);
    }

    const response = await makeRequest(`${API_BASE_URL}/ai-task-processor`, {
      method: 'POST',
      body: JSON.stringify({
        userInput: task,
        feature: 'task-breakdown',
        context
      })
    });

    const data = await response.json();
    
    if (!data.success) {
      throw new AIClientError('Failed to breakdown task', AI_ERROR_TYPES.API_ERROR, null, data);
    }

    return {
      breakdown: data.breakdown || [],
      originalTask: data.originalTask || task,
      totalEstimatedTime: data.totalEstimatedTime,
      recommendations: data.recommendations || [],
      aiPowered: data.aiPowered || false
    };
  },

  /**
   * Get smart prioritization for tasks
   * @param {Array} tasks - Array of tasks to prioritize
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Prioritized tasks
   */
  async prioritizeTasks(tasks, context = {}) {
    if (!Array.isArray(tasks)) {
      throw new AIClientError('Tasks must be an array', AI_ERROR_TYPES.VALIDATION_ERROR);
    }

    const response = await makeRequest(`${API_BASE_URL}/ai-task-processor`, {
      method: 'POST',
      body: JSON.stringify({
        userInput: JSON.stringify(tasks),
        feature: 'smart-prioritize',
        context: { ...context, tasks }
      })
    });

    const data = await response.json();
    
    if (!data.success) {
      throw new AIClientError('Failed to prioritize tasks', AI_ERROR_TYPES.API_ERROR, null, data);
    }

    return {
      prioritizedTasks: data.prioritizedTasks || [],
      insights: data.insights || [],
      aiPowered: data.aiPowered || false
    };
  },

  /**
   * Get contextual suggestions for a task
   * @param {string} input - The task or context
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Suggestions
   */
  async getContextualSuggestions(input, context = {}) {
    if (!input) {
      throw new AIClientError('Input is required', AI_ERROR_TYPES.VALIDATION_ERROR);
    }

    const response = await makeRequest(`${API_BASE_URL}/ai-task-processor`, {
      method: 'POST',
      body: JSON.stringify({
        userInput: input,
        feature: 'contextual-suggestions',
        context
      })
    });

    const data = await response.json();
    
    if (!data.success) {
      throw new AIClientError('Failed to get suggestions', AI_ERROR_TYPES.API_ERROR, null, data);
    }

    return {
      suggestions: data.suggestions || [],
      category: data.category || 'general',
      relatedActions: data.relatedActions || [],
      bestPractices: data.bestPractices || [],
      aiPowered: data.aiPowered || false
    };
  },

  /**
   * Get smart scheduling recommendations
   * @param {string} input - The task to schedule
   * @param {Object} context - Additional context including existing tasks
   * @returns {Promise<Object>} Scheduling recommendations
   */
  async getSmartScheduling(input, context = {}) {
    if (!input) {
      throw new AIClientError('Input is required', AI_ERROR_TYPES.VALIDATION_ERROR);
    }

    const response = await makeRequest(`${API_BASE_URL}/ai-task-processor`, {
      method: 'POST',
      body: JSON.stringify({
        userInput: input,
        feature: 'smart-scheduling',
        context
      })
    });

    const data = await response.json();
    
    if (!data.success) {
      throw new AIClientError('Failed to get scheduling recommendations', AI_ERROR_TYPES.API_ERROR, null, data);
    }

    return {
      optimalTime: data.recommendations?.bestTime,
      duration: data.recommendations?.duration,
      preparation: data.recommendations?.preparation,
      alternatives: data.scheduling?.alternatives || [],
      conflicts: data.scheduling?.conflicts,
      bufferTime: data.scheduling?.bufferTime,
      reminders: data.recommendations?.reminders || [],
      aiPowered: data.aiPowered || false
    };
  }
};

// Chat API for Perplexity integration
export const chatClient = {
  /**
   * Send a message to the AI chat assistant
   * @param {Array} messages - Array of chat messages
   * @param {Object} taskContext - Current user's task context
   * @param {Object} options - Additional options
   * @returns {Promise<string>} AI response
   */
  async sendMessage(messages, taskContext = null, options = {}) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new AIClientError('Messages array is required and cannot be empty', AI_ERROR_TYPES.VALIDATION_ERROR);
    }

    // Validate message format
    for (const message of messages) {
      if (!message.role || !message.content) {
        throw new AIClientError('Each message must have role and content', AI_ERROR_TYPES.VALIDATION_ERROR);
      }
    }

    const response = await makeRequest(`${API_BASE_URL}/chat`, {
      method: 'POST',
      body: JSON.stringify({
        messages,
        taskContext
      }),
      timeout: options.timeout || 30000 // Chat can take longer
    });

    // Handle both streaming and non-streaming responses
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      // Non-streaming response (fallback mode)
      const data = await response.json();
      if (data.fallback) {
        throw new AIClientError(data.response || data.error, AI_ERROR_TYPES.API_ERROR, null, { fallback: true });
      }
      return data.response;
    } else {
      // Streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          result += decoder.decode(value, { stream: true });
        }
      } finally {
        reader.releaseLock();
      }

      return result;
    }
  },

  /**
   * Stream a chat response for real-time updates
   * @param {Array} messages - Array of chat messages
   * @param {Object} taskContext - Current user's task context
   * @param {Function} onChunk - Callback for each chunk of data
   * @param {Object} options - Additional options
   * @returns {Promise<void>}
   */
  async streamMessage(messages, taskContext = null, onChunk, options = {}) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new AIClientError('Messages array is required and cannot be empty', AI_ERROR_TYPES.VALIDATION_ERROR);
    }

    if (typeof onChunk !== 'function') {
      throw new AIClientError('onChunk callback is required', AI_ERROR_TYPES.VALIDATION_ERROR);
    }

    const response = await makeRequest(`${API_BASE_URL}/chat`, {
      method: 'POST',
      body: JSON.stringify({
        messages,
        taskContext
      }),
      timeout: options.timeout || 30000
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        onChunk(chunk);
      }
    } finally {
      reader.releaseLock();
    }
  }
};

// Health check utility
export const healthCheck = {
  /**
   * Check if AI services are available
   * @returns {Promise<Object>} Service status
   */
  async checkServices() {
    try {
      // Test the task processor with a simple request
      const testResponse = await taskProcessor.smartParse('test task', { timeout: 5000 });
      
      return {
        taskProcessor: {
          available: true,
          aiPowered: testResponse.aiPowered,
          responseTime: 'fast'
        },
        chat: {
          available: true, // Assume available if task processor works
          note: 'Chat availability depends on Perplexity API key configuration'
        }
      };
    } catch (error) {
      return {
        taskProcessor: {
          available: false,
          error: error.message,
          type: error.type
        },
        chat: {
          available: false,
          note: 'Status unknown due to task processor unavailability'
        }
      };
    }
  }
};

// Export error types and classes for external error handling
export { AIClientError };

// Default export with all APIs
export default {
  taskProcessor,
  chatClient,
  healthCheck,
  errorTypes: AI_ERROR_TYPES,
  AIClientError
};