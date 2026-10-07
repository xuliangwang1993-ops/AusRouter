import { useEffect, useRef, useState } from 'react';
import { useApp } from '../contexts/AppContext.jsx';
import { useChat } from '../hooks/useChat.js';
import { useIsMobile } from '../hooks/useMediaQuery.js';
import { getModelsForProvider } from '../config/providers.js';
import { renderMarkdown } from '../utils/markdown.js';
import './markdown.css';
import './ClaudeInterface.css';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const defaults = { maxTokens: 4096, thinking: false, thinkingBudget: 4096, systemPrompt: '', stopSequences: [], temperature: '', topP: '', webSearch: false };
const suggestions = [
  ['写作与编辑', '帮我把这段文字改得更清晰、更有说服力'],
  ['分析与总结', '请总结这份内容，并列出三个关键结论'],
  ['头脑风暴', '围绕一个新产品给我五个有创意的方向'],
  ['代码协作', '帮我检查这段代码，并指出最值得先修的问题']
];

const readFileAsBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const WelcomeState = ({ setInput, inputRef }) => (
  <div className="empty-chat">
    <div className="welcome-mark">✦</div>
    <span className="eyebrow">Claude workspace</span>
    <h1>今天想一起完成什么？</h1>
    <p>一个安静、专注的空间，用来思考、写作和解决复杂问题。</p>
    <div className="suggestion-grid">
      {suggestions.map(([label, text]) => (
        <button key={label} className="suggestion-card" onClick={() => { setInput(text); inputRef.current?.focus(); }}>
          <span>{label}</span><strong>{text}</strong><i>↗</i>
        </button>
      ))}
    </div>
  </div>
);

export const ClaudeInterface = ({ onMenuClick }) => {
  const {
    currentConversation, addMessage, updateConversationModel, updateConversationOptions,
    patchConversation, replaceMessages, activeBrand, settings
  } = useApp();
  const { sendMessage, cancelRequest, isLoading } = useChat();
  const [input, setInput] = useState('');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [status, setStatus] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const isMobile = useIsMobile();

  const options = { ...defaults, ...currentConversation?.options };
  const models = [
    ...getModelsForProvider('subrouter').map(m => ({ ...m, channel: 'subrouter' })),
    ...getModelsForProvider('anthropic').map(m => ({ ...m, channel: 'anthropic' })),
    { id: 'local-model', name: '本地模型', channel: 'local' }
  ];
  const selectedModel = models.find(model => model.id === currentConversation?.model) || models[0];
  const hasMessages = Boolean(currentConversation?.messages?.length);
  const credentials = {
    subrouter: { baseURL: settings.subrouterBaseURL, apiKey: settings.subrouterKey },
    anthropic: { apiKey: settings.anthropicKey },
    openai: { apiKey: settings.openaiKey },
    local: { baseURL: settings.localBaseURL, apiKey: settings.localKey }
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [currentConversation?.messages]);

  // Code-copy buttons live inside rendered Markdown, so handle them with one
  // delegated listener instead of per-button React handlers.
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

  // Textarea grows with content up to a cap, like native clients.
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

  const addFiles = async fileList => {
    const next = [];
    for (const file of fileList) {
      if (file.size > MAX_FILE_SIZE) setStatus(`${file.name} 超过 10 MB 限制`);
      else if (IMAGE_TYPES.includes(file.type)) next.push({ name: file.name, media_type: file.type, data: await readFileAsBase64(file) });
      else if (file.type === 'application/pdf' || file.type.startsWith('text/')) setStatus(`${file.name}：当前通道不保证文件解析，请复制文字内容后发送。`);
      else setStatus(`${file.name}：当前通道不支持此文件类型`);
    }
    setAttachments(value => [...value, ...next]);
  };

  const runRequest = async (history) => {
    addMessage({ role: 'assistant', content: '', thinking: '', toolCalls: [], streaming: true, error: '' });
    setStatus('');
    try {
      await sendMessage({
        messages: history,
        model: selectedModel.id,
        brand: activeBrand,
        channel: selectedModel.channel,
        credentials,
        options,
        onChunk: chunk => patchLast(m => ({ ...m, content: (m.content || '') + chunk })),
        onEvent: eventData => {
          if (eventData.type === 'reasoning') patchLast(m => ({ ...m, thinking: (m.thinking || '') + eventData.text }));
          if (eventData.type === 'tool_calls') patchLast(m => ({ ...m, toolCalls: [...(m.toolCalls || []), ...eventData.tool_calls] }));
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
    if ((!input.trim() && !attachments.length) || isLoading) return;
    const content = [
      ...attachments.map(file => ({ type: 'image_url', image_url: { url: `data:${file.media_type};base64,${file.data}` } })),
      ...(input.trim() ? [{ type: 'text', text: input.trim() }] : [])
    ];
    const user = { role: 'user', content, displayText: input.trim() || attachments.map(file => file.name).join(', ') };
    const history = [...(currentConversation?.messages || []), user];
    addMessage(user);
    setInput('');
    setAttachments([]);
    await runRequest(history);
  };

  // Retry re-sends everything up to and including the user message at index,
  // discarding the failed/partial assistant turn that followed it.
  const retryFrom = async index => {
    if (isLoading) return;
    const history = (currentConversation?.messages || []).slice(0, index + 1);
    replaceMessages(history);
    await runRequest(history);
  };

  const startEdit = index => {
    const message = currentConversation.messages[index];
    setEditingIndex(index);
    setEditDraft(message.displayText || (typeof message.content === 'string' ? message.content : ''));
  };

  const commitEdit = async () => {
    if (editingIndex == null || isLoading) return;
    const text = editDraft.trim();
    if (!text) return;
    const history = [
      ...(currentConversation?.messages || []).slice(0, editingIndex),
      { role: 'user', content: [{ type: 'text', text }], displayText: text }
    ];
    replaceMessages(history);
    setEditingIndex(null);
    await runRequest(history);
  };

  const copy = text => navigator.clipboard?.writeText(text).catch(() => {});
  const option = (key, value) => updateConversationOptions({ [key]: value });
  const pickModel = model => {
    updateConversationModel(model.id);
    patchConversation({ channel: model.channel });
    setShowModelSelector(false);
  };

  const channelLabel = { subrouter: 'SubRouter bridge', anthropic: 'Anthropic 直连', local: '本地中转' }[selectedModel.channel];

  const modelMenu = showModelSelector ? (
    <div className="model-selector">
      <div className="popover-label">选择模型与通道</div>
      {models.map(model => (
        <button key={model.id} className={`model-option ${model.id === selectedModel.id ? 'active' : ''}`} onClick={() => pickModel(model)}>
          <span><b>{model.name}</b><small>{{ subrouter: 'SubRouter · OpenAI-compatible', anthropic: 'Anthropic Messages API', local: '本地 Base URL' }[model.channel]}</small></span>
          {model.id === selectedModel.id && <span>✓</span>}
        </button>
      ))}
      <p className="model-note">默认 SubRouter bridge。选择 Anthropic 直连需在设置填写 Anthropic key；本地模型使用本地 Base URL。三者互不混用。</p>
    </div>
  ) : null;

  const messageList = hasMessages ? (
    <div className="messages">
      {currentConversation.messages.map((message, index) => {
        const text = message.displayText || (typeof message.content === 'string' ? message.content : '') || '';
        const isLastAssistant = message.role === 'assistant' && index === currentConversation.messages.length - 1;
        return (
          <article className={`message ${message.role}`} key={index}>
            <div className="message-avatar">{message.role === 'user' ? '你' : '✦'}</div>
            <div className="message-body">
              <div className="message-label">{message.role === 'user' ? '你' : 'Claude'}</div>
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
              {message.role === 'assistant' && message.thinking && (
                <details className="reasoning-block"><summary>思考过程</summary><pre>{message.thinking}</pre></details>
              )}
              {message.role === 'assistant' && message.toolCalls?.length > 0 && (
                <div className="tool-card"><b>工具调用（仅展示，不执行）</b><pre>{JSON.stringify(message.toolCalls, null, 2)}</pre></div>
              )}
              {message.role === 'assistant' && message.error && (
                <div className="message-error"><span>{message.error}</span><button onClick={() => retryFrom(index - 1)}>重试</button></div>
              )}
              {message.role === 'assistant' && message.stopped && !message.error && (
                <div className="message-stopped">已停止生成</div>
              )}
              {message.role === 'assistant' && message.meta?.usage && (
                <div className="message-meta">tokens {message.meta.usage.prompt_tokens ?? '?'}→{message.meta.usage.completion_tokens ?? '?'}{message.meta.finishReason ? ` · ${message.meta.finishReason}` : ''}</div>
              )}
              {message.role === 'assistant' && text && !message.streaming && (
                <div className="message-actions">
                  <button onClick={() => copy(text)}>复制</button>
                  <button onClick={() => retryFrom(index - 1)}>重新生成</button>
                </div>
              )}
              {message.role === 'user' && (
                <div className="message-actions">
                  <button onClick={() => copy(text)}>复制</button>
                  {!isLoading && <button onClick={() => startEdit(index)}>编辑</button>}
                  {!isLoading && <button onClick={() => retryFrom(index)}>重试</button>}
                </div>
              )}
              {message.role === 'assistant' && message.streaming && (
                <div className="message-actions"><button onClick={cancelRequest}>停止生成</button></div>
              )}
              {isLastAssistant && message.streaming && <div className="typing-dot" />}
            </div>
          </article>
        );
      })}
      <div ref={endRef} />
    </div>
  ) : null;

  return (
    <div className="claude-interface">
      <header className="chat-header">
        <div className="header-leading">
          {isMobile && <button className="btn-menu" onClick={onMenuClick} aria-label="打开会话导航">☰</button>}
          <div className="conversation-heading"><span className="eyebrow">当前会话</span><strong>{currentConversation?.title || '新对话'}</strong></div>
        </div>
        <div className="header-actions">
          <button className="workspace-button" onClick={() => setShowAdvanced(value => !value)}>参数 <span>⌄</span></button>
          <div className="model-wrap">
            <button className="model-selector-trigger" onClick={() => setShowModelSelector(value => !value)}>
              <span className={`channel-dot ch-${selectedModel.channel}`} /> {selectedModel.name} <span>⌄</span>
            </button>
            {modelMenu}
          </div>
        </div>
      </header>

      <div className="messages-container">
        {!hasMessages ? <WelcomeState setInput={setInput} inputRef={inputRef} /> : messageList}
      </div>

      {status && <div className="status-line"><span className="status-pulse" />{status}</div>}
      <div className="input-container">
        {attachments.length > 0 && (
          <div className="attachment-list">
            {attachments.map((file, index) => (
              <div className="attachment" key={index}>▧ {file.name}<button onClick={() => setAttachments(value => value.filter((_, item) => item !== index))}>×</button></div>
            ))}
          </div>
        )}
        <form
          className="input-form"
          onSubmit={submit}
          onDragOver={event => event.preventDefault()}
          onDrop={event => { event.preventDefault(); addFiles(event.dataTransfer.files); }}
        >
          <div className="composer-tools">
            <button type="button" className="btn-attach" onClick={() => fileRef.current?.click()} title="添加附件">＋</button>
            <span className="channel-pill">{channelLabel}</span>
          </div>
          <textarea
            ref={inputRef}
            value={input}
            onChange={event => setInput(event.target.value)}
            onPaste={event => { const files = [...(event.clipboardData?.files || [])]; if (files.length) { event.preventDefault(); addFiles(files); } }}
            placeholder="给 Claude 发消息…"
            rows="1"
            onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(event); } }}
          />
          <input ref={fileRef} type="file" accept="image/*,.pdf,.txt,.md,.csv" multiple hidden onChange={event => { addFiles(event.target.files); event.target.value = ''; }} />
          <div className="composer-end">
            {isLoading
              ? <button type="button" className="btn-send stop" onClick={cancelRequest}>■</button>
              : <button className="btn-send" disabled={!input.trim() && !attachments.length}>↑</button>}
          </div>
        </form>
        <div className="composer-footer">
          <button className={`advanced-toggle ${showAdvanced ? 'selected' : ''}`} onClick={() => setShowAdvanced(value => !value)}>⚙ 高级参数</button>
          <span>Enter 发送 · Shift + Enter 换行</span>
          <small>本地分组，不是 Claude.ai Projects</small>
        </div>
        {showAdvanced && (
          <div className="advanced-panel">
            <div className="panel-heading"><b>高级请求参数</b><span>{channelLabel}</span></div>
            <label>System prompt<textarea value={options.systemPrompt} onChange={event => option('systemPrompt', event.target.value)} /></label>
            <div className="advanced-grid">
              <label>Max tokens<input type="number" value={options.maxTokens} onChange={event => option('maxTokens', event.target.value)} /></label>
              <label>Temperature<input value={options.temperature} onChange={event => option('temperature', event.target.value)} /></label>
              <label>Top P<input value={options.topP} onChange={event => option('topP', event.target.value)} /></label>
              <label>Stop sequences<input value={options.stopSequences.join(', ')} onChange={event => option('stopSequences', event.target.value.split(',').map(value => value.trim()).filter(Boolean))} /></label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
