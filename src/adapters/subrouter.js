import { BaseAdapter } from './base.js';

// SubRouter is an OpenAI-compatible bridge; it is intentionally distinct from Anthropic direct.
export class SubRouterAdapter extends BaseAdapter {
  constructor(config) { super(config); this.baseURL = (config.baseURL || 'https://subrouter.ai/v1').replace(/\/$/, ''); this.apiKey = config.apiKey; }
  async chat({ messages, model, options = {}, onChunk, onEvent, signal }) {
    if (!this.apiKey) throw new Error('请先在设置中填写 SubRouter API key。');
    const body = { model, messages, stream: Boolean(onChunk), max_tokens: Number(options.maxTokens) || 4096 };
    if (options.systemPrompt) body.messages = [{ role: 'system', content: options.systemPrompt }, ...messages];
    if (options.temperature !== '' && options.temperature != null) body.temperature = Number(options.temperature);
    if (options.topP !== '' && options.topP != null) body.top_p = Number(options.topP);
    if (options.stopSequences?.length) body.stop = options.stopSequences;
    // Do not send Anthropic-only web_search. Tools are only forwarded when explicitly supplied by a compatible caller.
    if (options.tools?.length) body.tools = options.tools;
    const res = await fetch(`${this.baseURL}/chat/completions`, { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${this.apiKey}`}, body:JSON.stringify(body), signal });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `SubRouter 请求失败（${res.status}）`); }
    if (!onChunk) return (await res.json()).choices?.[0]?.message?.content || '';
    const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let full = '';
    try { while (true) { const {done,value}=await reader.read(); if(done) break; buffer += decoder.decode(value,{stream:true}); const lines=buffer.split('\n'); buffer=lines.pop() || ''; for (const line of lines) { if(!line.startsWith('data:')) continue; const raw=line.slice(5).trim(); if(raw==='[DONE]') continue; try { const d=JSON.parse(raw); const delta=d.choices?.[0]?.delta || {}; if(delta.reasoning_content) onEvent?.({type:'reasoning', text:delta.reasoning_content}); if(delta.tool_calls) onEvent?.({type:'tool_calls', tool_calls:delta.tool_calls}); if(delta.content) { full += delta.content; onChunk(delta.content); } } catch { /* partial SSE */ } } } } finally { reader.releaseLock(); }
    return full;
  }
  async listModels() { const res=await fetch(`${this.baseURL}/models`,{headers:{Authorization:`Bearer ${this.apiKey}`}}); if(!res.ok) throw new Error('无法读取 SubRouter 模型列表'); return (await res.json()).data || []; }
}
