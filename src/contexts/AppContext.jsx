/* eslint-disable react/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { config, getModelsForProvider } from '../config/providers.js';

const AppContext = createContext();
export const useApp = () => useContext(AppContext);

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || fallback); } catch { return JSON.parse(fallback); }
};

// Conversations persisted by older versions may contain a model that is no
// longer offered by the brand (notably the old `local-default` value).
const validModelsFor = (brand) => new Set([
  ...(getModelsForProvider(config.brands[brand]?.provider) || []).map(model => model.id),
  'local-model',
  'claude-sonnet-5-5'
]);

const normalizeConversation = (brand, conversation) => {
  const allowed = validModelsFor(brand);
  const fallback = config.brands[brand]?.defaultModel || 'local-model';
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  // Older builds stored "[object Object]" when the first message used content blocks.
  const rawTitle = conversation?.title;
  const title = (!rawTitle || rawTitle === '[object Object]')
    ? (titleFromMessage(messages[0]).slice(0, 36) || '新对话')
    : rawTitle;
  return {
    pinned: false,
    archived: false,
    group: '未分组',
    deletedAt: null,
    channel: brand === 'claude' ? 'subrouter' : undefined,
    ...conversation,
    title,
    model: allowed.has(conversation?.model) ? conversation.model : fallback,
    messages,
    options: conversation?.options || {}
  };
};

const migrateConversations = (stored) => Object.fromEntries(
  Object.entries(stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}).map(([brand, list]) => {
    if (!Array.isArray(list) || !config.brands[brand] || !['chatgpt', 'claude'].includes(brand)) return [brand, list];
    return [brand, list.map(conversation => normalizeConversation(brand, conversation))];
  })
);

const defaultOptions = () => ({
  maxTokens: 4096,
  thinking: false,
  thinkingBudget: 4096,
  systemPrompt: '',
  stopSequences: [],
  temperature: '',
  topP: '',
  webSearch: false
});

// A user message may carry either a plain string or an array of content
// blocks; the conversation title must always be readable text.
const titleFromMessage = (message) => {
  if (message?.displayText) return String(message.displayText);
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter(b => b?.type === 'text').map(b => b.text).join(' ');
  return '';
};

const makeConversation = (brand) => normalizeConversation(brand, {
  id: `${brand}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  title: '新对话',
  messages: [],
  model: config.brands[brand]?.defaultModel || 'local-model',
  createdAt: Date.now(),
  options: defaultOptions()
});

export const AppProvider = ({ children }) => {
  const [activeBrand, setActiveBrand] = useState(null);
  const [settings, setSettings] = useState(() => read('ai-hub-settings', '{"openaiKey":"","anthropicKey":"","subrouterBaseURL":"https://subrouter.ai/v1","subrouterKey":"","subrouterModel":"claude-sonnet-5-5","localBaseURL":"","localKey":""}'));
  const [conversations, setConversations] = useState(() => migrateConversations(read('ai-hub-conversations', '{}')));
  const [activeIds, setActiveIds] = useState(() => read('ai-hub-active', '{}'));

  useEffect(() => localStorage.setItem('ai-hub-settings', JSON.stringify(settings)), [settings]);
  useEffect(() => localStorage.setItem('ai-hub-conversations', JSON.stringify(conversations)), [conversations]);
  useEffect(() => localStorage.setItem('ai-hub-active', JSON.stringify(activeIds)), [activeIds]);

  // ensure() must resolve synchronously from the current render's state.
  // The previous implementation assigned the selected id as a side effect
  // inside a setConversations updater, which left activeIds pointing at
  // nothing on first visit and silently dropped every addMessage update.
  const ensure = (brand) => {
    const list = (conversations[brand] || []).filter(c => !c.deletedAt);
    const currentId = activeIds[brand];
    if (currentId && list.some(c => c.id === currentId)) return currentId;
    if (list.length > 0) {
      setActiveIds(v => ({ ...v, [brand]: list[0].id }));
      return list[0].id;
    }
    const created = makeConversation(brand);
    setConversations(v => ({ ...v, [brand]: [created, ...(v[brand] || [])] }));
    setActiveIds(v => ({ ...v, [brand]: created.id }));
    return created.id;
  };

  const key = activeBrand || 'none';
  const visibleConversations = (conversations[key] || []).filter(c => !c.deletedAt);
  const deletedConversations = (conversations[key] || []).filter(c => c.deletedAt);
  const current = visibleConversations.find(c => c.id === activeIds[key]);

  const patchById = (brand, id, patch) => setConversations(v => ({
    ...v,
    [brand]: (v[brand] || []).map(c => (c.id === id ? { ...c, ...(typeof patch === 'function' ? patch(c) : patch) } : c))
  }));

  // Every write path resolves its target id through ensure(): after the last
  // conversation is deleted activeIds[key] is null, and a message sent from
  // the welcome screen must create a conversation instead of vanishing.
  const resolveId = () => activeIds[key] || ensure(key);

  const update = (fn) => patchById(key, resolveId(), fn);
  const patchConversation = (patch, id) => patchById(key, id || resolveId(), patch);
  const setConversation = (conversation, id) => patchById(key, id || resolveId(), normalizeConversation(key, conversation));
  const replaceMessages = (messages, id) => patchById(key, id || resolveId(), { messages: typeof messages === 'function' ? messages(current?.messages || []) : messages });
  const updateMessage = (index, patch, id) => patchById(key, id || resolveId(), c => ({
    messages: c.messages.map((message, i) => (i === index ? { ...message, ...(typeof patch === 'function' ? patch(message) : patch) } : message))
  }));

  const createConversation = (brand = activeBrand) => {
    if (!brand) return null;
    const created = makeConversation(brand);
    setConversations(v => ({ ...v, [brand]: [created, ...(v[brand] || [])] }));
    setActiveIds(v => ({ ...v, [brand]: created.id }));
    return created;
  };

  const deleteConversation = (id = activeIds[key]) => {
    patchById(key, id, { deletedAt: Date.now() });
    // Only move the active pointer when the deleted conversation was active;
    // deleting another row must not yank the user out of their current chat.
    if (activeIds[key] === id) {
      const remaining = visibleConversations.filter(c => c.id !== id);
      setActiveIds(v => ({ ...v, [key]: remaining[0]?.id || null }));
    }
  };

  const restoreConversation = (id) => patchById(key, id, { deletedAt: null });
  const renameConversation = (title, id = activeIds[key]) => patchById(key, id, { title: String(title || '新对话').slice(0, 60) });
  const togglePin = (id = activeIds[key]) => patchById(key, id, c => ({ pinned: !c.pinned }));
  const setGroup = (group, id = activeIds[key]) => patchById(key, id, { group: String(group || '未分组').slice(0, 30) });

  const exportConversations = () => JSON.stringify({
    app: 'ai-hub',
    version: 1,
    exportedAt: Date.now(),
    brand: key,
    conversations: conversations[key] || []
  }, null, 2);

  const importConversations = (json) => {
    const parsed = JSON.parse(json);
    const list = Array.isArray(parsed) ? parsed : parsed?.conversations;
    if (!Array.isArray(list)) throw new Error('导入文件里没有 conversations 数组');
    const known = new Set((conversations[key] || []).map(c => c.id));
    const incoming = list
      .filter(c => c && typeof c === 'object' && c.id && !known.has(c.id))
      .map(c => normalizeConversation(key, { ...c, deletedAt: c.deletedAt || null }));
    if (incoming.length === 0) return 0;
    setConversations(v => ({ ...v, [key]: [...incoming, ...(v[key] || [])] }));
    return incoming.length;
  };

  const switchBrand = (brand) => {
    setActiveBrand(brand);
    if (brand) ensure(brand);
  };

  const value = {
    activeBrand,
    settings,
    updateSettings: setSettings,
    conversations: visibleConversations,
    deletedConversations,
    currentConversation: current,
    update,
    ensure,
    patchConversation,
    setConversation,
    replaceMessages,
    updateMessage,
    switchBrand,
    createConversation,
    switchConversation: id => setActiveIds(v => ({ ...v, [key]: id })),
    addMessage: m => update(c => ({
      ...c,
      messages: [...c.messages, m],
      // content may be an array of blocks; the title must come from readable text.
      title: c.messages.length === 0 ? (titleFromMessage(m).slice(0, 36) || c.title) : c.title
    })),
    updateLastMessage: x => update(c => ({
      ...c,
      messages: c.messages.map((m, i) => (i === c.messages.length - 1 ? { ...m, content: typeof x === 'function' ? x(m.content) : x } : m))
    })),
    updateConversationModel: model => update(c => ({ ...c, model })),
    updateConversationOptions: options => update(c => ({ ...c, options: { ...c.options, ...options } })),
    deleteConversation,
    restoreConversation,
    renameConversation,
    togglePin,
    setGroup,
    exportConversations,
    importConversations
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
