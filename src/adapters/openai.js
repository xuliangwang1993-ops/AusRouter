import { BaseAdapter } from './base.js';

// OpenAI API adapter
export class OpenAIAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.baseURL = 'https://api.openai.com/v1';
    this.apiKey = config.apiKey;
  }

  async chat({ messages, model, onChunk, signal }) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        stream: !!onChunk
      }),
      signal
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    if (onChunk) {
      return await this._handleStream(response, onChunk);
    } else {
      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    }
  }

  async _handleStream(response, onChunk) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                fullText += content;
                onChunk(content);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullText;
  }

  async listModels() {
    return this.config.models || [];
  }
}
