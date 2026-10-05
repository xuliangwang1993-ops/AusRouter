import { BaseAdapter } from './base.js';

// Anthropic API adapter
export class AnthropicAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.baseURL = config.baseURL || 'https://api.anthropic.com/v1';
    this.apiKey = config.apiKey;
    this.apiVersion = config.apiVersion || '2023-06-01';
  }

  async chat({ messages, model, onChunk, signal }) {
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    // Convert OpenAI format to Anthropic format
    const { system, messages: anthropicMessages } = this._convertMessages(messages);

    const body = {
      model,
      messages: anthropicMessages,
      max_tokens: 4096,
      stream: !!onChunk
    };

    if (system) {
      body.system = system;
    }

    const response = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.apiVersion
      },
      body: JSON.stringify(body),
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
      return data.content[0]?.text || '';
    }
  }

  _convertMessages(messages) {
    let system = null;
    const anthropicMessages = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = msg.content;
      } else {
        anthropicMessages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      }
    }

    return { system, messages: anthropicMessages };
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

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'content_block_delta') {
                const content = parsed.delta?.text;
                if (content) {
                  fullText += content;
                  onChunk(content);
                }
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
