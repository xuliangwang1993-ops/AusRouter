import { useState } from 'react';
import { useApp } from '../contexts/AppContext.jsx';
import { useIsMobile } from '../hooks/useMediaQuery.js';
import { formatTimestamp } from '../utils/helpers.js';
import './Sidebar.css';

export const Sidebar = ({ isOpen, onClose }) => {
  const { conversations, currentConversation, createConversation, switchConversation, deleteConversation, switchBrand } = useApp();
  const isMobile = useIsMobile();
  const [showSettings, setShowSettings] = useState(false);
  const [search, setSearch] = useState('');
  const visibleConversations = conversations.filter(conv => conv.title.toLowerCase().includes(search.toLowerCase()));

  const handleNewChat = () => { createConversation(); if (isMobile) onClose(); };
  const handleConversationClick = id => { switchConversation(id); if (isMobile) onClose(); };
  const handleBackToHome = () => { switchBrand(null); if (isMobile) onClose(); };
  if (isMobile && !isOpen) return null;

  return (
    <>
      {isMobile && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isMobile ? 'mobile' : ''}`}>
        <div className="sidebar-brand"><button className="brand-lockup" onClick={handleBackToHome}><span className="claude-sigil">✦</span><span>Claude</span></button><span className="workspace-label">AI Hub workspace</span></div>
        <div className="sidebar-header"><button className="btn-new-chat" onClick={handleNewChat}><span>＋</span> New chat</button><button className="btn-icon btn-home" onClick={handleBackToHome} title="返回品牌选择"><span>⌂</span></button></div>
        <label className="conversation-search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索会话" /><kbd>⌘ K</kbd></label>
        <div className="section-heading"><span>最近会话</span><small>{visibleConversations.length}</small></div>
        <div className="conversations-list">
          {visibleConversations.length === 0 ? <div className="empty-state"><span>○</span><p>{search ? '没有匹配的会话' : '还没有会话'}</p></div> : visibleConversations.map(conv => <div key={conv.id} className={`conversation-item ${currentConversation?.id === conv.id ? 'active' : ''}`} onClick={() => handleConversationClick(conv.id)}><div className="conversation-content"><div className="conversation-title">{conv.title}</div><div className="conversation-time">{formatTimestamp(conv.createdAt)}</div></div><button className="btn-delete" onClick={event => { event.stopPropagation(); deleteConversation(conv.id); }} title="删除会话">×</button></div>)}
        </div>
        <div className="sidebar-note"><span className="note-mark">●</span><div><strong>SubRouter channel</strong><small>Claude Sonnet · OpenAI-compatible</small></div></div>
        <div className="sidebar-footer"><button className="btn-settings" onClick={() => setShowSettings(!showSettings)}><span>⚙</span> Settings</button></div>
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      </aside>
    </>
  );
};

const SettingsPanel = ({ onClose }) => {
  const { settings, updateSettings } = useApp();
  const [draft, setDraft] = useState(settings);
  const save = () => { updateSettings(draft); onClose(); };
  return <div className="settings-overlay" onClick={onClose}><div className="settings-panel" onClick={event => event.stopPropagation()}><div className="settings-header"><h3>Settings</h3><button className="btn-close" onClick={onClose}>×</button></div><div className="settings-content"><p className="setting-info">密钥只保存在此浏览器 localStorage，不会写入日志、构建产物或 git。Claude 默认使用 SubRouter bridge（不是 Anthropic 官方 API）。</p><div className="setting-group"><label>OpenAI API key</label><input type="password" value={draft.openaiKey || ''} onChange={event => setDraft({ ...draft, openaiKey: event.target.value })} /></div><div className="setting-group"><label>SubRouter Base URL</label><input value={draft.subrouterBaseURL || 'https://subrouter.ai/v1'} onChange={event => setDraft({ ...draft, subrouterBaseURL: event.target.value })} /></div><div className="setting-group"><label>SubRouter API key</label><input type="password" value={draft.subrouterKey || ''} onChange={event => setDraft({ ...draft, subrouterKey: event.target.value })} /></div><div className="setting-group"><label>SubRouter Claude model</label><input value={draft.subrouterModel || 'claude-sonnet-5-5'} onChange={event => setDraft({ ...draft, subrouterModel: event.target.value })} /><small>填写上游实际模型名。</small></div><div className="setting-group"><label>Anthropic API key（可选直连）</label><input type="password" value={draft.anthropicKey || ''} onChange={event => setDraft({ ...draft, anthropicKey: event.target.value })} /></div><div className="setting-group"><label>本地模型 Base URL</label><input value={draft.localBaseURL || ''} placeholder="http://localhost:8000/v1" onChange={event => setDraft({ ...draft, localBaseURL: event.target.value })} /></div><div className="setting-group"><label>本地模型 API key</label><input type="password" value={draft.localKey || ''} onChange={event => setDraft({ ...draft, localKey: event.target.value })} /></div><button className="save-settings" onClick={save}>保存设置</button></div></div></div>;
};
