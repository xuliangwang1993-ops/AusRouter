import { useEffect, useRef, useState } from 'react';
import { useApp } from '../contexts/AppContext.jsx';
import { useChat } from '../hooks/useChat.js';
import { useIsMobile } from '../hooks/useMediaQuery.js';
import { config, getModelsWithLocal } from '../config/providers.js';
import { renderMarkdown } from '../utils/markdown.js';
import './markdown.css';
import './ChatGPTInterface.css';

const defaults = { maxTokens: 4096, systemPrompt: '', temperature: '', topP: '' };

export const ChatGPTInterface = ({ onMenuClick }) => {
  const {
    currentConversation, addMessage, updateConversationModel,
    patchConversation, replaceMessages, activeBrand, settings
  } = useApp();
  const { sendMessage, cancelRequest, isLoading } = useChat();
  const [input, setInput] = useState('');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const isMobile = useIsMobile();

  const options = { ...defaults, ...currentConversation?.options };
  const availableModels = getModelsWithLocal(config.brands[activeBrand]?.provider || 'openai');
  const currentModel = currentConversation?.model || availableModels[0]?.id;
  const currentModelName = availableModels.find(m => m.id === currentModel)?.name || currentModel;
  const hasMessages = Boolean(currentConversation?.messages?.length);
  const credentials = {
    openai: { apiKey: settings.openaiKey },
    local: { baseURL: settings.localBaseURL, apiKey: settings.localKey }
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [currentConversation?.messages]);

  useEffect(() => {
    const onClick = event => {
      const button = event.target.closest('[data-copy-code]');
      if (!button) return;
      navigator.clipboard?.writeText(decodeURIComponent(button.dataset.copyCode)).catch(() => {});
      const original = button.textContent;
      button.textContent = '已复制';
      setTimeout(() => { button.textContent = original; }, 1200);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input]);

  const patchLast = patchFn => patchConversation(c => {
    const messages = [...c.messages];
    messages[messages.length - 1] = patchFn(messages[messages.length - 1]);
    return { ...c, messages };
  });

  const runRequest = async history => {
    addMessage({ role: 'assistant', content: '', streaming: true, error: '' });
    try {
      await sendMessage({
        messages: history,
        model: currentModel,
        brand: activeBrand,
        channel: currentModel === 'local-model' ? 'local' : undefined,
        credentials,
        options,
        onChunk: chunk => patchLast(m => ({ ...m, content: (m.content || '') + chunk })),
        onEvent: eventData => {
          if (eventData.type === 'meta') patchLast(m => ({ ...m, meta: { usage: eventData.usage, finishReason: eventData.finishReason }, streaming: false }));
        }
      });
      patchLast(m => ({ ...m, streaming: false }));
    } catch (error) {
      if (error.name === 'AbortError') patchLast(m => ({ ...m, streaming: false, stopped: true }));
      else patchLast(m => ({ ...m, streaming: false, error: error.message }));
    }
  };

  const submit = async event => {
    event?.preventDefault();
    if (!input.trim() || isLoading) return;
    const user = { role: 'user', content: input.trim(), displayText: input.trim() };
    const history = [...(currentConversation?.messages || []), user];
    addMessage(user);
    setInput('');
    await runRequest(history);
  };

  const retryFrom = async index => {
    if (isLoading) return;
    const history = (currentConversation?.messages || []).slice(0, index + 1);
    replaceMessages(history);
    await runRequest(history);
  };

  const commitEdit = async () => {
    if (editingIndex == null || isLoading) return;
    const text = editDraft.trim();
    if (!text) return;
    const history = [
      ...(currentConversation?.messages || []).slice(0, editingIndex),
      { role: 'user', content: text, displayText: text }
    ];
    replaceMessages(history);
    setEditingIndex(null);
    await runRequest(history);
  };

  const copy = text => navigator.clipboard?.writeText(text).catch(() => {});

  return (
    <div className="chatgpt-interface">
      <div className="chat-header">
        {isMobile && (
          <button className="btn-menu" onClick={onMenuClick} aria-label="打开会话导航">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        )}
        <div className="chat-title">
          <div className="brand-name">{config.brands[activeBrand]?.name || 'AI Hub'}</div>
          <button className="model-selector-trigger" onClick={() => setShowModelSelector(value => !value)}>
            {currentModelName}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        {showModelSelector && (
          <div className="model-selector">
            {availableModels.map(model => (
              <button key={model.id} className={`model-option ${model.id === currentModel ? 'active' : ''}`} onClick={() => { updateConversationModel(model.id); setShowModelSelector(false); }}>
                {model.name}
                {model.id === currentModel && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8L6 11L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </button>
            ))}
            <p className="model-note">官方模型直连 OpenAI API；本地模型使用设置中的本地 Base URL。</p>
          </div>
        )}
      </div>

      <div className="messages-container">
        {!hasMessages ? (
          <div className="empty-chat">
            <div className="empty-icon">◉</div>
            <h2>Start a conversation</h2>
            <p>Send a message to begin chatting with {config.brands[activeBrand]?.name || 'AI Hub'}</p>
          </div>
        ) : (
          <div className="messages">
            {currentConversation.messages.map((message, index) => {
              const text = message.displayText || message.content || '';
              return (
                <div className={`message ${message.role}`} key={index}>
                  <div className="message-avatar">{message.role === 'user' ? '👤' : '◉'}</div>
                  <div className="message-content">
                    {editingIndex === index ? (
                      <div className="edit-box">
                        <textarea value={editDraft} onChange={event => setEditDraft(event.target.value)} rows={3} />
                        <div className="edit-actions">
                          <button onClick={commitEdit}>保存并重发</button>
                          <button onClick={() => setEditingIndex(null)}>取消</button>
                        </div>
                      </div>
                    ) : message.role === 'assistant' ? (
                      <div className="message-text markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
                    ) : (
                      <div className="message-text">{text}</div>
                    )}
                    {message.role === 'assistant' && message.error && (
                      <div className="message-error"><span>{message.error}</span><button onClick={() => retryFrom(index - 1)}>重试</button></div>
                    )}
                    {message.role === 'assistant' && message.stopped && !message.error && <div className="message-stopped">已停止生成</div>}
                    {text && !message.streaming && (
                      <div className="message-actions">
                        <button onClick={() => copy(text)}>复制</button>
                        {message.role === 'assistant' && <button onClick={() => retryFrom(index - 1)}>重新生成</button>}
                        {message.role === 'user' && !isLoading && <button onClick={() => { setEditingIndex(index); setEditDraft(text); }}>编辑</button>}
                        {message.role === 'user' && !isLoading && <button onClick={() => retryFrom(index)}>重试</button>}
                      </div>
                    )}
                    {message.role === 'assistant' && message.streaming && (
                      <div className="message-actions"><button onClick={cancelRequest}>停止生成</button></div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="input-container">
        <form onSubmit={submit} className="input-form">
          <textarea
            ref={inputRef}
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(event); } }}
            placeholder="Send a message..."
            rows={1}
          />
          {isLoading ? (
            <button type="button" className="btn-send loading" onClick={cancelRequest}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="6" y="6" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="2" /></svg>
            </button>
          ) : (
            <button type="submit" className="btn-send" disabled={!input.trim()}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M18 10L2 10M18 10L12 4M18 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
