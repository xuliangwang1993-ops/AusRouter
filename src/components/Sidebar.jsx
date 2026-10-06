import { useState } from 'react';
import { useApp } from '../contexts/AppContext.jsx';
import { useIsMobile } from '../hooks/useMediaQuery.js';
import { formatTimestamp } from '../utils/helpers.js';
import './Sidebar.css';

export const Sidebar = ({ isOpen, onClose }) => {
  const { 
    conversations, 
    currentConversation, 
    createConversation, 
    switchConversation,
    deleteConversation,
    switchBrand
  } = useApp();
  
  const isMobile = useIsMobile();
  const [showSettings, setShowSettings] = useState(false);

  const handleNewChat = () => {
    createConversation();
    if (isMobile) onClose();
  };

  const handleConversationClick = (convId) => {
    switchConversation(convId);
    if (isMobile) onClose();
  };

  const handleBackToHome = () => {
    switchBrand(null);
    if (isMobile) onClose();
  };

  if (isMobile && !isOpen) return null;

  return (
    <>
      {isMobile && <div className="sidebar-overlay" onClick={onClose} />}
      <div className={`sidebar ${isMobile ? 'mobile' : ''}`}>
        <div className="sidebar-header">
          <button className="btn-new-chat" onClick={handleNewChat}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1V15M1 8H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            New chat
          </button>
          <button className="btn-icon btn-home" onClick={handleBackToHome} title="Back to home">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 10L10 3L17 10M4 9V17H7V13H13V17H16V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="conversations-list">
          {conversations.length === 0 ? (
            <div className="empty-state">
              <p>No conversations yet</p>
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                className={`conversation-item ${currentConversation?.id === conv.id ? 'active' : ''}`}
                onClick={() => handleConversationClick(conv.id)}
              >
                <div className="conversation-content">
                  <div className="conversation-title">{conv.title}</div>
                  <div className="conversation-time">{formatTimestamp(conv.createdAt)}</div>
                </div>
                <button
                  className="btn-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  title="Delete conversation"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4H14M6 4V2H10V4M3 4L4 14H12L13 4M6 7V11M10 7V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <button 
            className="btn-settings"
            onClick={() => setShowSettings(!showSettings)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M16 10C16 10.5 15.8 10.9 15.5 11.3L16.5 13L14.5 15L12.8 14C12.4 14.3 11.9 14.5 11.4 14.6L11 16.5H8.5L8.1 14.6C7.6 14.5 7.1 14.3 6.7 14L5 15L3 13L4 11.3C3.7 10.9 3.5 10.5 3.5 10C3.5 9.5 3.7 9.1 4 8.7L3 7L5 5L6.7 6C7.1 5.7 7.6 5.5 8.1 5.4L8.5 3.5H11L11.4 5.4C11.9 5.5 12.4 5.7 12.8 6L14.5 5L16.5 7L15.5 8.7C15.8 9.1 16 9.5 16 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Settings
          </button>
        </div>

        {showSettings && (
          <SettingsPanel onClose={() => setShowSettings(false)} />
        )}
      </div>
    </>
  );
};

const SettingsPanel = ({ onClose }) => {
  const { settings, updateSettings } = useApp();
  const [draft, setDraft] = useState(settings);
  const save = () => { updateSettings(draft); onClose(); };
  return <div className="settings-overlay" onClick={onClose}><div className="settings-panel" onClick={(e) => e.stopPropagation()}><div className="settings-header"><h3>Settings</h3><button className="btn-close" onClick={onClose}>×</button></div><div className="settings-content">
    <p className="setting-info">密钥仅保存在此浏览器 localStorage。官方请求直连官方 API；选择本地模型时使用下方中转配置。</p>
    <div className="setting-group"><label>OpenAI API key</label><input type="password" value={draft.openaiKey || ''} onChange={e => setDraft({...draft, openaiKey:e.target.value})} /></div>
    <div className="setting-group"><label>Anthropic API key</label><input type="password" value={draft.anthropicKey || ''} onChange={e => setDraft({...draft, anthropicKey:e.target.value})} /></div>
    <div className="setting-group"><label>本地模型 Base URL</label><input value={draft.localBaseURL || ''} placeholder="http://localhost:8000/v1" onChange={e => setDraft({...draft, localBaseURL:e.target.value})} /></div>
    <div className="setting-group"><label>本地模型 API key</label><input type="password" value={draft.localKey || ''} onChange={e => setDraft({...draft, localKey:e.target.value})} /></div>
    <button className="save-settings" onClick={save}>保存设置</button>
  </div></div></div>;
};
