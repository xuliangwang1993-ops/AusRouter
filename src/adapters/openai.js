import { BaseAdapter } from './base.js';

// OpenAI API adapter. Also serves the "local model" channel: when a baseURL is
// supplied (local relay), it must override the official OpenAI endpoint.
export class OpenAIAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.baseURL = (config.baseURL || 'https://api.openai.com/v1').replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }

  async chat({ messages, model, onChunk, onEvent, signal, options = {} }) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const body = { model, messages, stream: Boolean(onChunk) };
    if (options.systemPrompt) body.messages = [{ role: 'system', content: options.systemPrompt }, ...messages];
    if (options.maxTokens) body.max_tokens = Number(options.maxTokens);
    if (options.temperature !== '' && options.temperature != null) body.temperature = Number(options.temperature);
    if (options.topP !== '' && options.topP != null) body.top_p = Number(options.topP);

    let response;
    try {
      response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
        signal
      });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error('无法连接 OpenAI 兼容端点：请检查网络或 Base URL。');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const detail = error.error?.message || `HTTP ${response.status}`;
      if (response.status === 401) throw new Error(`API key 无效或未授权：${detail}`);
      if (response.status === 429) throw new Error(`请求过于频繁：${detail}`);
      throw new Error(`API error: ${detail}`);
    }

    if (onChunk) {
      return await this._handleStream(response, onChunk, onEvent);
    }
    const data = await response.json();
    const choice = data.choices?.[0];
    onEvent?.({ type: 'meta', usage: data.usage || null, finishReason: choice?.finish_reason || '' });
    return choice?.message?.content || '';
  }

  async _handleStream(response, onChunk, onEvent) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let usage = null;
    let finishReason = '';

    const consume = raw => {
      if (!raw || raw === '[DONE]') return;
      let parsed;
      try { parsed = JSON.parse(raw); } catch { return; }
      if (parsed.usage) usage = parsed.usage;
      const choice = parsed.choices?.[0];
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      const content = choice?.delta?.content;
      if (content) {
        fullText += content;
        onChunk(content);
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach(line => { if (line.startsWith('data:')) consume(line.slice(5).trim()); });
      }
      if (buffer.startsWith('data:')) consume(buffer.slice(5).trim());
    } finally {
      reader.releaseLock();
    }
    onEvent?.({ type: 'meta', usage, finishReason });
    return fullText;
  }

  async listModels() {
    return this.config.models || [];
  }
}
