import { perplexity } from '@ai-sdk/perplexity';
import { streamText } from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export default async function handler(req, res) {
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
    // Extract the `messages` from the body of the request
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Messages array is required' });
      return;
    }

    // Check if Perplexity API key is available
    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
    
    if (!PERPLEXITY_API_KEY) {
      // Fallback response without Perplexity
      res.status(200).json({
        response: "I'm a helpful AI assistant! However, I need a Perplexity API key to be configured to provide real-time web search and answers. Please add your PERPLEXITY_API_KEY to the environment variables.",
        fallback: true
      });
      return;
    }

    // Add system message for todo app context
    const systemMessage = {
      role: 'system',
      content: `You are a helpful AI assistant integrated into a todo/productivity app. Help users with:
      - Task planning and organization
      - Productivity tips and strategies  
      - Time management advice
      - Breaking down complex projects
      - Research and information for their tasks
      - General questions and assistance
      
      Be concise, practical, and focused on helping users be more productive. If they ask about specific topics for research or work, provide accurate and up-to-date information.`
    };

    const messagesWithSystem = [systemMessage, ...messages];

    // Call the Perplexity language model
    const result = streamText({
      model: perplexity('sonar-pro'),
      messages: messagesWithSystem,
      temperature: 0.7,
      maxTokens: 1000,
    });

    // Set up streaming response
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Stream the response
    const stream = result.toDataStreamResponse();
    
    // Handle the streaming response
    const reader = stream.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
    } finally {
      reader.releaseLock();
      res.end();
    }

  } catch (error) {
    console.error('Chat API error:', error);
    
    // Send error response
    res.status(500).json({ 
      error: 'Failed to process chat request',
      details: error.message,
      fallback: true
    });
  }
}