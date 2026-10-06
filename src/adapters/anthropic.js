import { BaseAdapter } from './base.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export class AnthropicAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.apiKey = config.apiKey;
    this.apiVersion = config.apiVersion || '2023-06-01';
  }

  async chat({ messages, model, onChunk, onEvent, signal, options = {} }) {
    if (!this.apiKey) throw new Error('请先在设置中填写 Anthropic API key。');
    const { system, messages: converted } = this._convertMessages(messages);
    const thinking = Boolean(options.thinking);
    const maxTokens = Number(options.maxTokens) || 4096;
    const body = { model, messages: converted, max_tokens: thinking ? Math.max(maxTokens, this._thinkingBudget(options) + 1024) : maxTokens, stream: Boolean(onChunk) };
    const systemPrompt = options.systemPrompt || system;
    if (systemPrompt) body.system = systemPrompt;
    if (options.stopSequences?.length) body.stop_sequences = options.stopSequences;
    if (!thinking) {
      if (options.temperature !== '' && options.temperature != null) body.temperature = Number(options.temperature);
      if (options.topP !== '' && options.topP != null) body.top_p = Number(options.topP);
    } else {
      body.thinking = { type: 'enabled', budget_tokens: this._thinkingBudget(options) };
    }
    if (options.webSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }];

    let response;
    try {
      response = await fetch(API_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': this.apiVersion, 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify(body), signal });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error('无法直连 Anthropic API：请检查网络、浏览器 CORS、API key 或 Anthropic 服务状态。');
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const message = payload?.error?.message || `HTTP ${response.status}`;
      if (response.status === 401) throw new Error(`Anthropic API key 无效或没有权限：${message}`);
      if (response.status === 429) throw new Error(`Anthropic API 请求频率受限：${message}`);
      throw new Error(`Anthropic API 请求失败（${response.status}）：${message}`);
    }
    if (onChunk) return this._handleStream(response, onChunk, onEvent);
    const data = await response.json();
    return this._blocksToText(data.content || [], onEvent);
  }

  _thinkingBudget(options) { return Math.max(1024, Number(options.thinkingBudget) || 4096); }

  _convertMessages(messages) {
    let system = '';
    const result = [];
    for (const message of messages || []) {
      if (message.role === 'system') { system = typeof message.content === 'string' ? message.content : ''; continue; }
      const blocks = Array.isArray(message.content) ? message.content.map(block => this._normalizeBlock(block)).filter(Boolean) : [{ type: 'text', text: String(message.content || '') }];
      result.push({ role: message.role === 'assistant' ? 'assistant' : 'user', content: blocks.length ? blocks : [{ type: 'text', text: '' }] });
    }
    return { system, messages: result };
  }

  _normalizeBlock(block) {
    if (!block || typeof block !== 'object') return null;
    if (block.type === 'text') return { type: 'text', text: String(block.text || '') };
    if (block.type === 'image' && block.source?.type === 'base64' && IMAGE_TYPES.has(block.source.media_type)) return block;
    if (block.type === 'document' && block.source?.type === 'base64' && block.source.media_type === 'application/pdf') return block;
    if (block.type === 'thinking' || block.type === 'tool_use' || block.type === 'tool_result') return block;
    return null;
  }

  _blocksToText(blocks, onEvent) {
    let text = '';
    for (const block of blocks) {
      if (block.type === 'text') text += block.text || '';
      else if (block.type === 'thinking') onEvent?.({ type: 'thinking', text: block.thinking || '' });
      else if (block.type === 'tool_use' || block.type === 'server_tool_use') onEvent?.({ type: 'tool_use', name: block.name, input: block.input });
    }
    return text;
  }

  async _handleStream(response, onChunk, onEvent) {
    if (!response.body) throw new Error('Anthropic API 返回了空响应。');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    const consume = raw => {
      if (!raw || raw === '[DONE]') return;
      let event; try { event = JSON.parse(raw); } catch { return; }
      if (['message_start', 'content_block_start', 'content_block_delta', 'message_delta', 'message_stop'].includes(event.type)) onEvent?.(event);
      if (event.type === 'content_block_delta') {
        const delta = event.delta || {};
        if (delta.type === 'text_delta' && delta.text) { fullText += delta.text; onChunk(delta.text); }
        else if (delta.type === 'thinking_delta') onEvent?.({ type: 'thinking_delta', text: delta.thinking || '' });
        else if (delta.type === 'input_json_delta') onEvent?.({ type: 'tool_input_delta', text: delta.partial_json || '' });
      }
    };
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/); buffer = lines.pop() || '';
        lines.forEach(line => { if (line.startsWith('data:')) consume(line.slice(5).trim()); });
      }
      if (buffer.startsWith('data:')) consume(buffer.slice(5).trim());
    } finally { reader.releaseLock(); }
    return fullText;
  }

  async listModels() { return this.config.models || []; }
}
