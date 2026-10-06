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
 'local-model', 'claude-sonnet-5-5'
]);
const normalizeConversation = (brand, conversation) => {
 const allowed = validModelsFor(brand);
 const fallback = config.brands[brand]?.defaultModel || 'local-model';
 return {
  pinned: false,
  archived: false,
  group: '未分组',
  deletedAt: null,
  channel: brand === 'claude' ? 'subrouter' : undefined,
  ...conversation,
  model: allowed.has(conversation?.model) ? conversation.model : fallback,
  messages: Array.isArray(conversation?.messages) ? conversation.messages : [],
  options: conversation?.options || {}
 };
};
const migrateConversations = (stored) => Object.fromEntries(
 Object.entries(stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}).map(([brand, list]) => {
  if (!Array.isArray(list) || !config.brands[brand] || !['chatgpt', 'claude'].includes(brand)) return [brand, list];
  return [brand, list.map(conversation => normalizeConversation(brand, conversation))];
 })
);

export const AppProvider = ({ children }) => {
 const [activeBrand, setActiveBrand] = useState(null);
 const [settings, setSettings] = useState(() => read('ai-hub-settings', '{"openaiKey":"","anthropicKey":"","subrouterBaseURL":"https://subrouter.ai/v1","subrouterKey":"","subrouterModel":"claude-sonnet-5-5","localBaseURL":"","localKey":""}'));
 const [conversations, setConversations] = useState(() => migrateConversations(read('ai-hub-conversations', '{}')));
 const [activeIds, setActiveIds] = useState(() => read('ai-hub-active', '{}'));
 useEffect(() => localStorage.setItem('ai-hub-settings', JSON.stringify(settings)), [settings]);
 useEffect(() => localStorage.setItem('ai-hub-conversations', JSON.stringify(conversations)), [conversations]);
 useEffect(() => localStorage.setItem('ai-hub-active', JSON.stringify(activeIds)), [activeIds]);
 const makeConversation = (k) => normalizeConversation(k, { id: `${k}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, title: '新对话', messages: [], model: config.brands[k]?.defaultModel || 'local-model', createdAt: Date.now(), options: { maxTokens: 4096, thinking: false, thinkingBudget: 4096, systemPrompt: '', stopSequences: [], temperature: '', topP: '', webSearch: false } });
 const ensure = (k) => {
  let selectedId;
  setConversations(v => {
   const visible = (v[k] || []).filter(c => !c.deletedAt);
   selectedId = activeIds[k] && visible.some(c => c.id === activeIds[k]) ? activeIds[k] : visible[0]?.id;
   if (selectedId) return v;
   const c = makeConversation(k);
   selectedId = c.id;
   return { ...v, [k]: [c, ...(v[k] || [])] };
  });
  setActiveIds(v => ({ ...v, [k]: selectedId || v[k] }));
  return selectedId;
 };
 const key = activeBrand || 'none';
 const visibleConversations = (conversations[key] || []).filter(c => !c.deletedAt);
 const deletedConversations = (conversations[key] || []).filter(c => c.deletedAt);
 const current = visibleConversations.find(c => c.id === activeIds[key]);
 const update = (fn) => setConversations(v => ({ ...v, [key]: (v[key] || []).map(c => c.id === activeIds[key] ? fn(c) : c) }));
 const patchConversation = (patch, id = activeIds[key]) => setConversations(v => ({ ...v, [key]: (v[key] || []).map(c => c.id === id ? { ...c, ...(typeof patch === 'function' ? patch(c) : patch) } : c) }));
 const setConversation = (conversation, id = activeIds[key]) => setConversations(v => ({ ...v, [key]: (v[key] || []).map(c => c.id === id ? normalizeConversation(key, conversation) : c) }));
 const replaceMessages = (messages, id = activeIds[key]) => patchConversation({ messages: typeof messages === 'function' ? messages(current?.messages || []) : messages }, id);
 const updateMessage = (index, patch, id = activeIds[key]) => patchConversation(c => ({ messages: c.messages.map((message, i) => i === index ? { ...message, ...(typeof patch === 'function' ? patch(message) : patch) } : message) }), id);
 const createConversation = (brand = activeBrand) => { if (!brand) return; const c = makeConversation(brand); setConversations(v => ({ ...v, [brand]: [c, ...(v[brand] || [])] })); setActiveIds(v => ({ ...v, [brand]: c.id })); return c; };
 const deleteConversation = (id = activeIds[key]) => { patchConversation({ deletedAt: Date.now() }, id); setActiveIds(v => ({ ...v, [key]: visibleConversations.find(c => c.id !== id)?.id })); };
 const restoreConversation = (id) => patchConversation({ deletedAt: null }, id);
 const switchBrand = b => { setActiveBrand(b); if (b) ensure(b); };
 const value = { activeBrand, settings, updateSettings: setSettings, conversations: visibleConversations, deletedConversations, currentConversation: current, update, ensure, patchConversation, setConversation, replaceMessages, updateMessage, switchBrand, createConversation, switchConversation: id => setActiveIds(v => ({ ...v, [key]: id })), addMessage: m => update(c => ({ ...c, messages: [...c.messages, m], title: c.messages.length === 0 ? (m.content || m.displayText || '').slice(0, 36) : c.title })), updateLastMessage: x => update(c => ({ ...c, messages: c.messages.map((m, i) => i === c.messages.length - 1 ? { ...m, content: typeof x === 'function' ? x(m.content) : x } : m) })), updateConversationModel: model => update(c => ({ ...c, model })), updateConversationOptions: options => update(c => ({ ...c, options: { ...(c.options || {}), ...options } })), deleteConversation, restoreConversation };
 return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
