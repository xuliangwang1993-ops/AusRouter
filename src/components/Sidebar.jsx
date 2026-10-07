import { useRef, useState } from 'react';
import { useApp } from '../contexts/AppContext.jsx';
import { useIsMobile } from '../hooks/useMediaQuery.js';
import { formatTimestamp } from '../utils/helpers.js';
import './Sidebar.css';

const ConversationRow = ({ conv, active, onOpen, onDelete, onRename, onTogglePin }) => {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(conv.title);
  const commit = () => { onRename(draft); setRenaming(false); };
  return (
    <div className={`conversation-item ${active ? 'active' : ''} ${conv.pinned ? 'pinned' : ''}`} onClick={onOpen}>
      <div className="conversation-content">
        {renaming ? (
          <input
            className="rename-input"
            value={draft}
            autoFocus
            onClick={event => event.stopPropagation()}
            onChange={event => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={event => { if (event.key === 'Enter') commit(); if (event.key === 'Escape') setRenaming(false); }}
          />
        ) : (
          <div className="conversation-title">{conv.pinned && <span className="pin-mark">📌</span>}{conv.title}</div>
        )}
        <div className="conversation-time">{formatTimestamp(conv.createdAt)}{conv.group && conv.group !== '未分组' ? ` · ${conv.group}` : ''}</div>
      </div>
      <div className="row-actions" onClick={event => event.stopPropagation()}>
        <button className="btn-row" title={conv.pinned ? '取消置顶' : '置顶'} onClick={onTogglePin}>{conv.pinned ? '◉' : '○'}</button>
        <button className="btn-row" title="重命名" onClick={() => { setDraft(conv.title); setRenaming(true); }}>✎</button>
        <button className="btn-row danger" title="删除会话" onClick={onDelete}>×</button>
      </div>
    </div>
  );
};

export const Sidebar = ({ isOpen, onClose }) => {
  const {
    conversations, deletedConversations, currentConversation, createConversation, switchConversation,
    deleteConversation, restoreConversation, renameConversation, togglePin, switchBrand,
    exportConversations, importConversations
  } = useApp();
  const isMobile = useIsMobile();
  const [showSettings, setShowSettings] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const importRef = useRef(null);

  const filtered = conversations.filter(conv => conv.title.toLowerCase().includes(search.toLowerCase()));
  const pinned = filtered.filter(conv => conv.pinned);
  const groups = filtered.filter(conv => !conv.pinned).reduce((acc, conv) => {
    const name = conv.group || '未分组';
    (acc[name] = acc[name] || []).push(conv);
    return acc;
  }, {});

  const handleNewChat = () => { createConversation(); if (isMobile) onClose(); };
  const handleConversationClick = id => { switchConversation(id); if (isMobile) onClose(); };
  const handleBackToHome = () => { switchBrand(null); if (isMobile) onClose(); };

  const doExport = () => {
    const blob = new Blob([exportConversations()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-hub-conversations-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('已导出当前品牌的会话');
  };

  const doImport = async file => {
    try {
      const count = importConversations(await file.text());
      setNotice(count ? `已导入 ${count} 个会话` : '文件里没有新会话');
    } catch (error) {
      setNotice(`导入失败：${error.message}`);
    }
  };

  if (isMobile && !isOpen) return null;

  return (
    <>
      {isMobile && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isMobile ? 'mobile' : ''}`}>
        <div className="sidebar-brand">
          <button className="brand-lockup" onClick={handleBackToHome}><span className="claude-sigil">✦</span><span>Claude</span></button>
          <span className="workspace-label">AI Hub workspace</span>
        </div>
        <div className="sidebar-header">
          <button className="btn-new-chat" onClick={handleNewChat}><span>＋</span> New chat</button>
          <button className="btn-icon btn-home" onClick={handleBackToHome} title="返回品牌选择"><span>⌂</span></button>
        </div>
        <label className="conversation-search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索会话" /></label>
        {notice && <div className="sidebar-notice">{notice}</div>}
        <div className="conversations-list">
          {showTrash ? (
            <>
              <div className="section-heading"><span>已删除（可恢复）</span><button className="link-btn" onClick={() => setShowTrash(false)}>返回</button></div>
              {deletedConversations.length === 0 ? <div className="empty-state"><p>回收站是空的</p></div> : deletedConversations.map(conv => (
                <div key={conv.id} className="conversation-item">
                  <div className="conversation-content"><div className="conversation-title">{conv.title}</div><div className="conversation-time">{formatTimestamp(conv.deletedAt)}</div></div>
                  <div className="row-actions"><button className="btn-row" title="恢复" onClick={() => restoreConversation(conv.id)}>↺</button></div>
                </div>
              ))}
            </>
          ) : (
            <>
              {pinned.length > 0 && <div className="section-heading"><span>置顶</span><small>{pinned.length}</small></div>}
              {pinned.map(conv => (
                <ConversationRow key={conv.id} conv={conv} active={currentConversation?.id === conv.id}
                  onOpen={() => handleConversationClick(conv.id)} onDelete={() => deleteConversation(conv.id)}
                  onRename={title => renameConversation(title, conv.id)} onTogglePin={() => togglePin(conv.id)} />
              ))}
              {Object.entries(groups).map(([group, list]) => (
                <div key={group}>
                  <div className="section-heading"><span>{group}</span><small>{list.length}</small></div>
                  {list.length === 0 ? null : list.map(conv => (
                    <ConversationRow key={conv.id} conv={conv} active={currentConversation?.id === conv.id}
                      onOpen={() => handleConversationClick(conv.id)} onDelete={() => deleteConversation(conv.id)}
                      onRename={title => renameConversation(title, conv.id)} onTogglePin={() => togglePin(conv.id)} />
                  ))}
                </div>
              ))}
              {filtered.length === 0 && <div className="empty-state"><span>○</span><p>{search ? '没有匹配的会话' : '还没有会话'}</p></div>}
            </>
          )}
        </div>
        <div className="sidebar-note"><span className="note-mark">●</span><div><strong>SubRouter channel</strong><small>Claude Sonnet · OpenAI-compatible · 本地会话分组，不是 Claude.ai Projects</small></div></div>
        <div className="sidebar-footer">
          <div className="footer-row">
            <button className="btn-mini" onClick={doExport} title="导出当前品牌会话为 JSON">导出</button>
            <button className="btn-mini" onClick={() => importRef.current?.click()} title="从 JSON 导入会话">导入</button>
            <button className="btn-mini" onClick={() => setShowTrash(value => !value)} title="已删除会话">回收站{deletedConversations.length > 0 ? ` ${deletedConversations.length}` : ''}</button>
          </div>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={event => { const file = event.target.files?.[0]; if (file) doImport(file); event.target.value = ''; }} />
          <button className="btn-settings" onClick={() => setShowSettings(!showSettings)}><span>⚙</span> Settings</button>
        </div>
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      </aside>
    </>
  );
};

const SettingsPanel = ({ onClose }) => {
  const { settings, updateSettings } = useApp();
  const [draft, setDraft] = useState(settings);
  const save = () => { updateSettings(draft); onClose(); };
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={event => event.stopPropagation()}>
        <div className="settings-header"><h3>Settings</h3><button className="btn-close" onClick={onClose}>×</button></div>
        <div className="settings-content">
          <p className="setting-info">密钥只保存在此浏览器 localStorage，不会写入日志、构建产物或 git。Claude 默认使用 SubRouter bridge（不是 Anthropic 官方 API）；选择 Anthropic 直连模型时才使用 Anthropic key。</p>
          <div className="setting-group"><label>OpenAI API key</label><input type="password" value={draft.openaiKey || ''} onChange={event => setDraft({ ...draft, openaiKey: event.target.value })} /></div>
          <div className="setting-group"><label>SubRouter Base URL</label><input value={draft.subrouterBaseURL || 'https://subrouter.ai/v1'} onChange={event => setDraft({ ...draft, subrouterBaseURL: event.target.value })} /></div>
          <div className="setting-group"><label>SubRouter API key</label><input type="password" value={draft.subrouterKey || ''} onChange={event => setDraft({ ...draft, subrouterKey: event.target.value })} /></div>
          <div className="setting-group"><label>Anthropic API key（可选直连）</label><input type="password" value={draft.anthropicKey || ''} onChange={event => setDraft({ ...draft, anthropicKey: event.target.value })} /></div>
          <div className="setting-group"><label>本地模型 Base URL</label><input value={draft.localBaseURL || ''} placeholder="http://localhost:8000/v1" onChange={event => setDraft({ ...draft, localBaseURL: event.target.value })} /></div>
          <div className="setting-group"><label>本地模型 API key</label><input type="password" value={draft.localKey || ''} onChange={event => setDraft({ ...draft, localKey: event.target.value })} /></div>
          <button className="save-settings" onClick={save}>保存设置</button>
        </div>
      </div>
    </div>
  );
};
