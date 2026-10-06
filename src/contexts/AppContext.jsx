/* eslint-disable react/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { config, getModelsForProvider } from '../config/providers.js';
const AppContext = createContext();
export const useApp = () => useContext(AppContext);
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || fallback); } catch { return JSON.parse(fallback); } };

// Conversations persisted by older versions may contain a model that is no longer
// offered by the brand (notably the old `local-default` value).
const validModelsFor = (brand) => new Set([
 ...(getModelsForProvider(config.brands[brand]?.provider) || []).map(model => model.id),
 'local-model'
]);
const migrateConversations = (stored) => Object.fromEntries(
 Object.entries(stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}).map(([brand, list]) => {
  if (!Array.isArray(list) || !config.brands[brand] || !['chatgpt', 'claude'].includes(brand)) return [brand, list];
  const allowed = validModelsFor(brand);
  const fallback = config.brands[brand].defaultModel;
  return [brand, list.map(conversation => ({
   ...conversation,
   model: allowed.has(conversation?.model) ? conversation.model : fallback
  }))];
 })
);

export const AppProvider = ({ children }) => {
 const [activeBrand, setActiveBrand] = useState(null);
 const [settings, setSettings] = useState(() => read('ai-hub-settings', '{"openaiKey":"","anthropicKey":"","localBaseURL":"","localKey":""}'));
 const [conversations, setConversations] = useState(() => migrateConversations(read('ai-hub-conversations', '{}')));
 const [activeIds, setActiveIds] = useState(() => read('ai-hub-active', '{}'));
 useEffect(() => localStorage.setItem('ai-hub-settings', JSON.stringify(settings)), [settings]);
 useEffect(() => localStorage.setItem('ai-hub-conversations', JSON.stringify(conversations)), [conversations]);
 useEffect(() => localStorage.setItem('ai-hub-active', JSON.stringify(activeIds)), [activeIds]);
 const makeConversation = (k) => ({ id: `${k}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, title: '新对话', messages: [], model: config.brands[k]?.defaultModel || 'local-model', createdAt: Date.now(), options: { maxTokens: 4096, thinking: false, thinkingBudget: 4096, systemPrompt: '', stopSequences: [], temperature: '', topP: '', webSearch: false } });
 const ensure = (k) => {
  if (!conversations[k]?.length) { const c = makeConversation(k); setConversations(v => ({ ...v, [k]: [c, ...(v[k] || [])] })); setActiveIds(v => ({ ...v, [k]: c.id })); }
  else if (!activeIds[k]) setActiveIds(v => ({ ...v, [k]: conversations[k][0].id }));
 };
 const key = activeBrand || 'none';
 const current = (conversations[key] || []).find(c => c.id === activeIds[key]);
 const update = (fn) => setConversations(v => ({ ...v, [key]: (v[key] || []).map(c => c.id === activeIds[key] ? fn(c) : c) }));
 const createConversation = () => { if (!activeBrand) return; const c = makeConversation(activeBrand); setConversations(v => ({ ...v, [activeBrand]: [c, ...(v[activeBrand] || [])] })); setActiveIds(v => ({ ...v, [activeBrand]: c.id })); };
 const deleteConversation = (id) => setConversations(v => { const remaining = (v[key] || []).filter(c => c.id !== id); const next = remaining[0] || makeConversation(key); const list = remaining.length ? remaining : [next]; setActiveIds(a => ({ ...a, [key]: remaining.find(c => c.id === a[key])?.id || next.id })); return { ...v, [key]: list }; });
 const value = { activeBrand, settings, updateSettings: setSettings, conversations: conversations[key] || [], currentConversation: current, update, switchBrand: b => { setActiveBrand(b); if (b) ensure(b); }, createConversation, switchConversation: id => setActiveIds(v => ({ ...v, [key]: id })), addMessage: m => update(c => ({ ...c, messages: [...c.messages, m], title: c.messages.length === 0 ? m.content.slice(0, 36) : c.title })), updateLastMessage: x => update(c => ({ ...c, messages: c.messages.map((m, i) => i === c.messages.length - 1 ? { ...m, content: typeof x === 'function' ? x(m.content) : x } : m) })), updateConversationModel: model => update(c => ({ ...c, model })), updateConversationOptions: options => update(c => ({ ...c, options: { ...(c.options || {}), ...options } })), deleteConversation };
 return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};