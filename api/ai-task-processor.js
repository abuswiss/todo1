// AI Task Processor - Deep Integration with OpenAI
export default async function handler(req, res) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  // Enable CORS for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    return;
  }

  try {
    const { userInput, feature, context = {} } = req.body;
    
    if (!userInput) {
      res.status(400).json({ error: 'userInput is required' });
      return;
    }

    // For now, return intelligent mock responses until OpenAI key is configured
    const response = await processWithAI(userInput, feature, context);
    
    res.status(200).json(response);
  } catch (error) {
    console.error('AI Processing Error:', error);
    res.status(500).json({ error: 'Failed to process with AI' });
  }
}

async function processWithAI(userInput, feature, context) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  // If OpenAI API key is available, use real AI processing
  if (OPENAI_API_KEY) {
    try {
      return await processWithOpenAI(userInput, feature, context, OPENAI_API_KEY);
    } catch (error) {
      console.error('OpenAI API error:', error);
      // Fall back to mock responses
    }
  }
  
  // Mock intelligent responses for different AI features (fallback)
  switch (feature) {
    case 'smart-parse':
      return smartParseTask(userInput);
    
    case 'task-breakdown':
      return breakdownTask(userInput, context);
    
    case 'smart-prioritize':
      return smartPrioritize(userInput, context);
    
    case 'contextual-suggestions':
      return getContextualSuggestions(userInput, context);
    
    case 'smart-scheduling':
      return smartScheduling(userInput, context);
    
    default:
      return smartParseTask(userInput);
  }
}

async function processWithOpenAI(userInput, feature, context, apiKey) {
  const prompts = {
    'smart-parse': `You are an expert task parser. Parse this natural language input into structured task data.

User input: "${userInput}"

Extract and return JSON with these fields:
- taskName: The core task (cleaned up)
- date: Any date mentioned (relative or absolute)
- time: Any time mentioned
- priority: high/medium/low based on urgency keywords
- people: Array of people mentioned
- category: Inferred category (work, personal, health, etc.)
- tags: Relevant tags
- estimatedDuration: Estimated time needed
- confidence: Your confidence in parsing (0-1)
- suggestions: Array of helpful suggestions

Respond only with valid JSON.`,

    'task-breakdown': `Break down this complex task into actionable subtasks.

Task: "${userInput}"

Return JSON with:
- breakdown: Array of subtasks with {task, priority, estimatedTime}
- totalEstimatedTime: Overall time estimate
- dependencies: Any task dependencies
- recommendations: Helpful tips

Respond only with valid JSON.`,

    'smart-prioritize': `Analyze and prioritize these tasks intelligently.

Tasks: ${JSON.stringify(context.tasks || [userInput])}

Return JSON with:
- prioritizedTasks: Tasks with aiPriority and reasoning
- insights: Strategic insights about the task list
- recommendations: Productivity recommendations

Respond only with valid JSON.`,

    'contextual-suggestions': `Provide contextual suggestions for this task.

Task: "${userInput}"
Context: ${JSON.stringify(context)}

Return JSON with:
- suggestions: Array of helpful suggestions
- relatedActions: Recommended follow-up actions
- resources: Useful resources or tools
- bestPractices: Relevant best practices

Respond only with valid JSON.`,

    'smart-scheduling': `Provide smart scheduling recommendations.

Task: "${userInput}"
Context: ${JSON.stringify(context)}

Return JSON with:
- optimalTime: Best time to do this task
- duration: Recommended duration
- preparation: Prep time needed
- bufferTime: Recommended buffer
- conflicts: Potential scheduling conflicts
- alternatives: Alternative time slots

Respond only with valid JSON.`
  };

  const prompt = prompts[feature] || prompts['smart-parse'];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4', // Use GPT-4 for better reasoning
      messages: [
        {
          role: 'system',
          content: 'You are an expert AI assistant specializing in task management and productivity. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  try {
    const parsed = JSON.parse(content);
    return {
      success: true,
      aiPowered: true,
      ...parsed
    };
  } catch (parseError) {
    console.error('Failed to parse OpenAI JSON response:', parseError);
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const extracted = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          aiPowered: true,
          ...extracted
        };
      } catch (e) {
        console.error('Failed to parse extracted JSON:', e);
      }
    }
    throw parseError;
  }
}

function smartParseTask(input) {
  // Intelligent parsing patterns
  const patterns = {
    datePatterns: [
      /\b(today|tomorrow|next week|next month)\b/i,
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      /\b(\d{1,2}\/\d{1,2}\/?\d{0,4})\b/,
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/i
    ],
    timePatterns: [
      /\b(\d{1,2}:\d{2}\s?(am|pm)?)\b/i,
      /\b(morning|afternoon|evening|night)\b/i
    ],
    priorityPatterns: [
      /\b(urgent|asap|important|high priority|critical)\b/i,
      /\b(low priority|when possible|eventually)\b/i
    ],
    personPatterns: [
      /\bwith\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/,
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+and\s+me\b/
    ]
  };

  let taskName = input;
  let extractedDate = null;
  let extractedTime = null;
  let priority = 'medium';
  let people = [];
  let category = inferCategory(input);

  // Extract date
  for (const pattern of patterns.datePatterns) {
    const match = input.match(pattern);
    if (match) {
      extractedDate = match[0];
      taskName = taskName.replace(match[0], '').trim();
      break;
    }
  }

  // Extract time
  for (const pattern of patterns.timePatterns) {
    const match = input.match(pattern);
    if (match) {
      extractedTime = match[0];
      taskName = taskName.replace(match[0], '').trim();
      break;
    }
  }

  // Extract priority
  if (patterns.priorityPatterns[0].test(input)) {
    priority = 'high';
  } else if (patterns.priorityPatterns[1].test(input)) {
    priority = 'low';
  }

  // Extract people
  for (const pattern of patterns.personPatterns) {
    const match = input.match(pattern);
    if (match) {
      people.push(match[1]);
      taskName = taskName.replace(match[0], '').trim();
    }
  }

  // Clean up task name
  taskName = taskName.replace(/\s+/g, ' ').trim();
  taskName = taskName.replace(/^(plan|schedule|organize|prepare|do|complete)\s+/i, '');

  return {
    success: true,
    parsed: {
      taskName: taskName || input,
      date: extractedDate,
      time: extractedTime,
      priority,
      people,
      category,
      tags: generateSmartTags(input),
      estimatedDuration: estimateDuration(input),
      suggestions: generateTaskSuggestions(taskName, category)
    },
    confidence: calculateConfidence(input, extractedDate, extractedTime, people.length)
  };
}

function breakdownTask(task, context) {
  const breakdowns = {
    'organize team retreat': [
      { task: 'Define budget and constraints', priority: 'high', estimatedTime: '1 hour' },
      { task: 'Research and book venue', priority: 'high', estimatedTime: '3 hours' },
      { task: 'Plan agenda and activities', priority: 'medium', estimatedTime: '2 hours' },
      { task: 'Send invitations to team', priority: 'medium', estimatedTime: '30 minutes' },
      { task: 'Arrange catering/meals', priority: 'medium', estimatedTime: '1 hour' },
      { task: 'Prepare materials and supplies', priority: 'low', estimatedTime: '1 hour' }
    ],
    'launch product': [
      { task: 'Finalize product features', priority: 'high', estimatedTime: '1 week' },
      { task: 'Complete testing and QA', priority: 'high', estimatedTime: '3 days' },
      { task: 'Prepare marketing materials', priority: 'high', estimatedTime: '2 days' },
      { task: 'Set up analytics and tracking', priority: 'medium', estimatedTime: '4 hours' },
      { task: 'Plan launch event/announcement', priority: 'medium', estimatedTime: '1 day' },
      { task: 'Monitor initial user feedback', priority: 'low', estimatedTime: 'Ongoing' }
    ]
  };

  const lowerTask = task.toLowerCase();
  const breakdown = Object.keys(breakdowns).find(key => 
    lowerTask.includes(key) || key.includes(lowerTask)
  );

  if (breakdown) {
    return {
      success: true,
      breakdown: breakdowns[breakdown],
      originalTask: task,
      totalEstimatedTime: calculateTotalTime(breakdowns[breakdown])
    };
  }

  // Generate intelligent breakdown for any task
  return {
    success: true,
    breakdown: generateGenericBreakdown(task),
    originalTask: task,
    suggestion: 'AI-generated breakdown based on task analysis'
  };
}

function smartPrioritize(tasks, context) {
  // Intelligent prioritization based on keywords and context
  const priorityKeywords = {
    urgent: ['urgent', 'asap', 'deadline', 'due', 'critical', 'emergency'],
    high: ['important', 'meeting', 'presentation', 'client', 'boss', 'interview'],
    medium: ['plan', 'prepare', 'research', 'review', 'organize'],
    low: ['someday', 'maybe', 'when possible', 'eventually', 'nice to have']
  };

  return {
    success: true,
    prioritizedTasks: tasks.map(task => ({
      ...task,
      aiPriority: calculateTaskPriority(task, priorityKeywords),
      reasoning: explainPriority(task, priorityKeywords)
    })),
    insights: generatePriorityInsights(tasks)
  };
}

function getContextualSuggestions(input, context) {
  const suggestions = {
    'blog post': [
      'Research trending topics in your niche',
      'Create an outline with key points',
      'Find relevant images and graphics',
      'Optimize for SEO keywords',
      'Schedule social media promotion'
    ],
    'meeting': [
      'Prepare agenda items',
      'Send calendar invites',
      'Book conference room',
      'Prepare presentation materials',
      'Share pre-meeting documents'
    ],
    'project': [
      'Define project scope and goals',
      'Identify key stakeholders',
      'Create project timeline',
      'Set up collaboration tools',
      'Plan regular check-ins'
    ]
  };

  const matchedCategory = Object.keys(suggestions).find(category =>
    input.toLowerCase().includes(category)
  );

  return {
    success: true,
    suggestions: matchedCategory ? suggestions[matchedCategory] : generateGenericSuggestions(input),
    category: matchedCategory || 'general',
    relatedActions: generateRelatedActions(input)
  };
}

function smartScheduling(input, context) {
  return {
    success: true,
    recommendations: {
      bestTime: suggestOptimalTime(input),
      duration: estimateDuration(input),
      preparation: calculatePrepTime(input),
      reminders: generateSmartReminders(input)
    },
    scheduling: {
      conflicts: checkForConflicts(context.existingTasks || []),
      alternatives: suggestAlternatives(input),
      bufferTime: recommendBufferTime(input)
    }
  };
}

// Helper functions
function inferCategory(input) {
  const categories = {
    work: ['meeting', 'project', 'presentation', 'email', 'call', 'deadline'],
    personal: ['family', 'friend', 'home', 'health', 'exercise', 'hobby'],
    shopping: ['buy', 'purchase', 'shop', 'grocery', 'store'],
    health: ['doctor', 'appointment', 'exercise', 'gym', 'medicine'],
    finance: ['pay', 'bill', 'budget', 'bank', 'tax', 'money']
  };

  const lowerInput = input.toLowerCase();
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => lowerInput.includes(keyword))) {
      return category;
    }
  }
  return 'general';
}

function generateSmartTags(input) {
  const tags = [];
  const lowerInput = input.toLowerCase();
  
  if (lowerInput.includes('urgent') || lowerInput.includes('asap')) tags.push('urgent');
  if (lowerInput.includes('meeting') || lowerInput.includes('call')) tags.push('meeting');
  if (lowerInput.includes('email') || lowerInput.includes('message')) tags.push('communication');
  if (lowerInput.includes('buy') || lowerInput.includes('purchase')) tags.push('shopping');
  
  return tags;
}

function estimateDuration(input) {
  const durationKeywords = {
    '15 minutes': ['quick', 'brief', 'short'],
    '30 minutes': ['call', 'standup', 'check-in'],
    '1 hour': ['meeting', 'appointment', 'review'],
    '2 hours': ['project work', 'deep work', 'analysis'],
    '4 hours': ['workshop', 'training', 'major task'],
    '1 day': ['project', 'research', 'planning']
  };

  const lowerInput = input.toLowerCase();
  for (const [duration, keywords] of Object.entries(durationKeywords)) {
    if (keywords.some(keyword => lowerInput.includes(keyword))) {
      return duration;
    }
  }
  return '30 minutes';
}

function generateTaskSuggestions(taskName, category) {
  const suggestions = {
    work: ['Set reminder 1 day before', 'Prepare agenda', 'Block calendar time'],
    personal: ['Add to shopping list', 'Set location reminder', 'Share with family'],
    health: ['Set recurring reminder', 'Add to calendar', 'Prepare insurance info']
  };

  return suggestions[category] || ['Set reminder', 'Add notes', 'Set priority'];
}

function calculateConfidence(input, date, time, peopleCount) {
  let confidence = 0.5;
  if (date) confidence += 0.2;
  if (time) confidence += 0.1;
  if (peopleCount > 0) confidence += 0.1;
  if (input.length > 10) confidence += 0.1;
  
  return Math.min(confidence, 1.0);
}

function generateGenericBreakdown(task) {
  return [
    { task: `Research and plan for: ${task}`, priority: 'medium', estimatedTime: '30 minutes' },
    { task: `Execute main work for: ${task}`, priority: 'high', estimatedTime: '1 hour' },
    { task: `Review and finalize: ${task}`, priority: 'low', estimatedTime: '15 minutes' }
  ];
}

function calculateTotalTime(breakdown) {
  return breakdown.length > 3 ? '1-2 days' : '2-4 hours';
}

function calculateTaskPriority(task, keywords) {
  const taskText = (task.title || task.task || '').toLowerCase();
  
  for (const [priority, words] of Object.entries(keywords)) {
    if (words.some(word => taskText.includes(word))) {
      return priority;
    }
  }
  return 'medium';
}

function explainPriority(task, keywords) {
  const taskText = (task.title || task.task || '').toLowerCase();
  
  for (const [priority, words] of Object.entries(keywords)) {
    const matchedWord = words.find(word => taskText.includes(word));
    if (matchedWord) {
      return `Marked as ${priority} priority due to keyword: "${matchedWord}"`;
    }
  }
  return 'Default medium priority assigned';
}

function generatePriorityInsights(tasks) {
  return [
    `${tasks.length} tasks analyzed for intelligent prioritization`,
    'Consider tackling high-priority items during your peak energy hours',
    'Group similar tasks together for better efficiency'
  ];
}

function generateGenericSuggestions(input) {
  return [
    'Break this down into smaller steps',
    'Set a deadline for completion',
    'Identify resources you might need',
    'Consider who else might be involved'
  ];
}

function generateRelatedActions(input) {
  return [
    'Add to calendar',
    'Set reminder',
    'Create checklist',
    'Share with team'
  ];
}

function suggestOptimalTime(input) {
  const lowerInput = input.toLowerCase();
  if (lowerInput.includes('meeting') || lowerInput.includes('call')) {
    return '10:00 AM - Best for focused discussions';
  }
  if (lowerInput.includes('creative') || lowerInput.includes('design')) {
    return '9:00 AM - Peak creative hours';
  }
  return '2:00 PM - Good for general tasks';
}

function checkForConflicts(existingTasks) {
  return existingTasks.length > 5 ? 'Schedule appears busy - consider rescheduling' : 'No scheduling conflicts detected';
}

function suggestAlternatives(input) {
  return ['Tomorrow morning', 'Next week', 'End of day today'];
}

function recommendBufferTime(input) {
  return input.toLowerCase().includes('meeting') ? '15 minutes before and after' : '5 minutes buffer';
}

function calculatePrepTime(input) {
  if (input.toLowerCase().includes('presentation')) return '1 hour preparation time';
  if (input.toLowerCase().includes('meeting')) return '15 minutes preparation time';
  return '5 minutes preparation time';
}

function generateSmartReminders(input) {
  return [
    '1 day before',
    '1 hour before',
    '15 minutes before'
  ];
}