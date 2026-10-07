import { BaseAdapter } from './base.js';

// SubRouter is an OpenAI-compatible bridge; it is intentionally distinct from Anthropic direct.
export class SubRouterAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.baseURL = (config.baseURL || 'https://subrouter.ai/v1').replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }

  async chat({ messages, model, options = {}, onChunk, onEvent, signal }) {
    if (!this.apiKey) throw new Error('请先在设置中填写 SubRouter API key。');
    const body = { model, messages, stream: Boolean(onChunk), max_tokens: Number(options.maxTokens) || 4096 };
    if (options.systemPrompt) body.messages = [{ role: 'system', content: options.systemPrompt }, ...messages];
    if (options.temperature !== '' && options.temperature != null) body.temperature = Number(options.temperature);
    if (options.topP !== '' && options.topP != null) body.top_p = Number(options.topP);
    if (options.stopSequences?.length) body.stop = options.stopSequences;
    // Do not send Anthropic-only web_search. Tools are only forwarded when explicitly supplied by a compatible caller.
    if (options.tools?.length) body.tools = options.tools;

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
      throw new Error('无法连接 SubRouter：请检查网络或 Base URL 是否正确。');
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const detail = payload.error?.message || `HTTP ${response.status}`;
      if (response.status === 401) throw new Error(`SubRouter key 无效或未授权：${detail}`);
      if (response.status === 402) throw new Error(`SubRouter 额度不足：${detail}`);
      if (response.status === 429) throw new Error(`SubRouter 请求过于频繁：${detail}`);
      throw new Error(`SubRouter 请求失败（${response.status}）：${detail}`);
    }

    if (!onChunk) {
      const data = await response.json();
      const choice = data.choices?.[0];
      onEvent?.({ type: 'meta', usage: data.usage || null, finishReason: choice?.finish_reason || '' });
      return choice?.message?.content || '';
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    let usage = null;
    let finishReason = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (raw === '[DONE]') continue;
          let delta;
          let chunk;
          try { chunk = JSON.parse(raw); delta = chunk.choices?.[0]?.delta || {}; } catch { continue; }
          if (chunk.usage) usage = chunk.usage;
          if (chunk.choices?.[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason;
          if (delta.reasoning_content) onEvent?.({ type: 'reasoning', text: delta.reasoning_content });
          if (delta.tool_calls) onEvent?.({ type: 'tool_calls', tool_calls: delta.tool_calls });
          if (delta.content) { full += delta.content; onChunk(delta.content); }
        }
      }
    } finally {
      reader.releaseLock();
    }
    onEvent?.({ type: 'meta', usage, finishReason });
    return full;
  }

  async listModels() {
    const res = await fetch(`${this.baseURL}/models`, { headers: { Authorization: `Bearer ${this.apiKey}` } });
    if (!res.ok) throw new Error('无法读取 SubRouter 模型列表');
    return (await res.json()).data || [];
  }
}
