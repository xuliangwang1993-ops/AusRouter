import { BaseAdapter } from './base.js';

// Mock adapter for demonstration without API keys
export class MockAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
  }

  async chat({ messages, model, onChunk, signal }) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const lastMessage = messages[messages.length - 1];
    const responses = [
      `I'm a mock AI assistant. You said: "${lastMessage.content}"`,
      `This is a demonstration response. In production, replace the mock adapter with a real API provider.`,
      `Current model: ${model}. Configure your API keys in src/config/providers.js to use real providers.`
    ];

    const fullResponse = responses.join('\n\n');
    
    // Simulate streaming
    if (onChunk) {
      const words = fullResponse.split(' ');
      for (let i = 0; i < words.length; i++) {
        if (signal?.aborted) {
          throw new Error('Request aborted');
        }
        
        const chunk = (i === 0 ? '' : ' ') + words[i];
        onChunk(chunk);
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    }

    return fullResponse;
  }

  async listModels() {
    return this.config.models || [];
  }
}
