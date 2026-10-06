import { useEffect, useRef, useState } from 'react';
import { useApp } from '../contexts/AppContext.jsx';
import { useChat } from '../hooks/useChat.js';
import { useIsMobile } from '../hooks/useMediaQuery.js';
import { getModelsForProvider } from '../config/providers.js';
import { renderMarkdown } from '../utils/markdown.js';
import './ClaudeInterface.css';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const defaults = { maxTokens: 4096, thinking: false, thinkingBudget: 4096, systemPrompt: '', stopSequences: [], temperature: '', topP: '', webSearch: false };
const suggestions = [
  ['写作与编辑', '帮我把这段文字改得更清晰、更有说服力'],
  ['分析与总结', '请总结这份内容，并列出三个关键结论'],
  ['头脑风暴', '围绕一个新产品给我五个有创意的方向'],
  ['代码协作', '帮我检查这段代码，并指出最值得先修的问题']
];

const readFile = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const WelcomeState = ({ setInput, inputRef }) => (
  <div className="empty-chat"><div className="welcome-mark">✦</div><span className="eyebrow">Claude workspace</span><h1>今天想一起完成什么？</h1><p>一个安静、专注的空间，用来思考、写作和解决复杂问题。</p><div className="suggestion-grid">{suggestions.map(([label, text]) => <button key={label} className="suggestion-card" onClick={() => { setInput(text); inputRef.current?.focus(); }}><span>{label}</span><strong>{text}</strong><i>↗</i></button>)}</div></div>
);

export const ClaudeInterface = ({ onMenuClick }) => {
  const { currentConversation, addMessage, updateLastMessage, updateConversationModel, updateConversationOptions, activeBrand, settings } = useApp();
  const { sendMessage, cancelRequest, isLoading } = useChat();
  const [input, setInput] = useState('');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [status, setStatus] = useState('');
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const isMobile = useIsMobile();
  const options = { ...defaults, ...(currentConversation?.options || {}) };
  const models = [...getModelsForProvider('subrouter'), ...getModelsForProvider('anthropic')];
  const selectedModel = models.find(model => model.id === currentConversation?.model) || models[0];
  const hasMessages = Boolean(currentConversation?.messages?.length);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [currentConversation?.messages]);

  const addFiles = async event => {
    const next = [];
    for (const file of [...event.target.files]) {
      if (file.size > MAX_FILE_SIZE) setStatus(`${file.name} 超过 10 MB 限制`);
      else if (file.type.startsWith('image/')) next.push({ name: file.name, type: 'image_url', media_type: file.type, data: await readFile(file) });
      else if (file.type === 'application/pdf' || file.type.startsWith('text/')) setStatus(`${file.name}：当前通道不保证文件解析，请复制文字内容后发送。`);
      else setStatus(`${file.name}：当前通道不支持此文件类型`);
    }
    setAttachments(value => [...value, ...next]);
    event.target.value = '';
  };

  const submit = async event => {
    event?.preventDefault();
    if ((!input.trim() && !attachments.length) || isLoading) return;
    const content = [...attachments.map(file => ({ type: 'image_url', image_url: { url: `data:${file.media_type};base64,${file.data}` } })), ...(input.trim() ? [{ type: 'text', text: input.trim() }] : [])];
    const user = { role: 'user', content, displayText: input.trim() || attachments.map(file => file.name).join(', ') };
    addMessage(user);
    addMessage({ role: 'assistant', content: '', thinking: '', error: '' });
    setInput('');
    setAttachments([]);
    setStatus('');
    try {
      await sendMessage({
        messages: [...(currentConversation?.messages || []), user], model: selectedModel.id, brand: activeBrand,
        credentials: { baseURL: settings.subrouterBaseURL, apiKey: settings.subrouterKey }, options,
        onChunk: chunk => updateLastMessage(value => value + chunk),
        onEvent: eventData => {
          if (eventData.type === 'reasoning') setStatus('正在生成 reasoning…');
          if (eventData.type === 'tool_calls') setStatus('收到工具调用');
        }
      });
    } catch (error) {
      if (error.name !== 'AbortError') updateLastMessage(`请求失败：${error.message}`);
    }
  };

  const copy = text => navigator.clipboard?.writeText(text);
  const option = (key, value) => updateConversationOptions({ [key]: value });

  const modelMenu = showModelSelector ? (
    <div className="model-selector">
      <div className="popover-label">选择模型与通道</div>
      {models.map(model => (
        <button key={model.id} className={`model-option ${model.id === selectedModel.id ? 'active' : ''}`} onClick={() => { updateConversationModel(model.id); setShowModelSelector(false); }}>
          <span><b>{model.name}</b><small>{model.id.includes('sonnet') ? 'SubRouter / 可选 Anthropic 直连' : model.id}</small></span>
          {model.id === selectedModel.id && <span>✓</span>}
        </button>
      ))}
      <p className="model-note">默认使用 SubRouter。官方 Anthropic API 仅在明确选择并配置后使用。</p>
    </div>
  ) : null;

  const messageList = hasMessages ? (
    <div className="messages">
      {currentConversation.messages.map((message, index) => {
        const text = message.displayText || message.content || '';
        return (
          <article className={`message ${message.role}`} key={index}>
            <div className="message-avatar">{message.role === 'user' ? '你' : '✦'}</div>
            <div className="message-body">
              <div className="message-label">{message.role === 'user' ? '你' : 'Claude'}</div>
              {message.role === 'assistant' ? <div className="message-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} /> : <div className="message-text">{text}</div>}
              {message.role === 'assistant' && text && (
                <div className="message-actions"><button onClick={() => copy(text)}>复制</button>{isLoading && index === currentConversation.messages.length - 1 && <button onClick={cancelRequest}>停止生成</button>}</div>
              )}
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
          <button className="workspace-button" onClick={() => setShowAdvanced(value => !value)}>工作区 <span>⌄</span></button>
          <div className="model-wrap">
            <button className="model-selector-trigger" onClick={() => setShowModelSelector(value => !value)}><span className="channel-dot" /> {selectedModel.name} <span>⌄</span></button>
            {modelMenu}
          </div>
          <button className="header-more" title="更多会话操作">•••</button>
        </div>
      </header>

      <div className="messages-container">
        {!hasMessages ? <WelcomeState setInput={setInput} inputRef={inputRef} /> : messageList}
      </div>

      {status && <div className="status-line"><span className="status-pulse" />{status}</div>}
      <div className="input-container">
        {attachments.length > 0 && <div className="attachment-list">{attachments.map((file, index) => <div className="attachment" key={index}>▧ {file.name}<button onClick={() => setAttachments(value => value.filter((_, item) => item !== index))}>×</button></div>)}</div>}
        <form className="input-form" onSubmit={submit} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles({ target: { files: event.dataTransfer.files } }); }}>
          <div className="composer-tools"><button type="button" className="btn-attach" onClick={() => fileRef.current?.click()} title="添加附件">＋</button><span className="tool-divider" /></div>
          <textarea ref={inputRef} value={input} onChange={event => setInput(event.target.value)} placeholder="给 Claude 发消息…" rows="1" onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(event); } }} />
          <input ref={fileRef} type="file" accept="image/*,.pdf,.txt,.md,.csv" multiple hidden onChange={addFiles} />
          <div className="composer-end"><button type="button" className="quick-prompt" onClick={() => setInput(value => `${value}${value ? ' ' : ''}请先列出你的思路，再给出答案。`)}>⌁ 提示</button>{isLoading ? <button type="button" className="btn-send stop" onClick={cancelRequest}>■</button> : <button className="btn-send" disabled={!input.trim() && !attachments.length}>↑</button>}</div>
        </form>
        <div className="composer-footer"><button className={`advanced-toggle ${showAdvanced ? 'selected' : ''}`} onClick={() => setShowAdvanced(value => !value)}>⚙ 高级参数</button><span>Enter 发送 · Shift + Enter 换行</span><small>本地分组，不是 Claude.ai Projects</small></div>
        {showAdvanced && <div className="advanced-panel"><div className="panel-heading"><b>高级请求参数</b><span>SubRouter OpenAI-compatible bridge</span></div><label>System prompt<textarea value={options.systemPrompt} onChange={event => option('systemPrompt', event.target.value)} /></label><div className="advanced-grid"><label>Max tokens<input type="number" value={options.maxTokens} onChange={event => option('maxTokens', event.target.value)} /></label><label>Temperature<input value={options.temperature} onChange={event => option('temperature', event.target.value)} /></label><label>Top P<input value={options.topP} onChange={event => option('topP', event.target.value)} /></label><label>Stop sequences<input value={options.stopSequences.join(', ')} onChange={event => option('stopSequences', event.target.value.split(',').map(value => value.trim()).filter(Boolean))} /></label></div><label className="check"><input type="checkbox" checked={options.thinking} onChange={event => option('thinking', event.target.checked)} /> reasoning 开关（取决于上游）</label></div>}
      </div>
    </div>
  );
};
