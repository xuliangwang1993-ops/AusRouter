import { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext.jsx';
import { useChat } from '../hooks/useChat.js';
import { useIsMobile } from '../hooks/useMediaQuery.js';
import { config, getModelsWithLocal } from '../config/providers.js';
import './ChatGPTInterface.css';

export const ChatGPTInterface = ({ onMenuClick }) => {
  const { 
    currentConversation, 
    addMessage, 
    updateLastMessage,
    updateConversationModel,
    activeBrand,
    settings
  } = useApp();
  
  const { sendMessage, cancelRequest, isLoading, error } = useChat();
  const [input, setInput] = useState('');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation?.messages]);

  const getBrandInfo = () => {
    if (!activeBrand) {
      return {
        name: 'AI Hub',
        provider: 'local'
      };
    }
    const brand = config.brands[activeBrand];
    return {
      name: brand.name,
      provider: brand.provider
    };
  };

  const brandInfo = getBrandInfo();

  const availableModels = () => {
    const brandInfo = getBrandInfo();
    return getModelsWithLocal(brandInfo.provider);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: input.trim()
    };

    addMessage(userMessage);
    setInput('');

    // Add placeholder for assistant response
    const assistantMessage = {
      role: 'assistant',
      content: ''
    };
    addMessage(assistantMessage);

    try {
      const messages = [...(currentConversation?.messages || []), userMessage];
      
      await sendMessage({
        messages,
        model: currentConversation?.model || availableModels()[0]?.id,
        brand: activeBrand,
        credentials: currentConversation?.model === 'local-model' ? { baseURL: settings.localBaseURL, apiKey: settings.localKey } : { apiKey: activeBrand === 'chatgpt' ? settings.openaiKey : settings.anthropicKey },
        onChunk: (chunk) => {
          updateLastMessage((prev) => prev + chunk);
        }
      });
    } catch (err) {
      if (!err.message.includes('aborted') && !err.message.includes('cancelled')) {
        updateLastMessage(`Error: ${err.message}`);
      }
    }
  };

  const handleCancel = () => {
    cancelRequest();
  };

  const handleModelChange = (modelId) => {
    updateConversationModel(modelId);
    setShowModelSelector(false);
  };

  const currentModel = currentConversation?.model || availableModels()[0]?.id;
  const currentModelName = availableModels().find(m => m.id === currentModel)?.name || currentModel;

  return (
    <div className="chatgpt-interface">
      <div className="chat-header">
        {isMobile && (
          <button className="btn-menu" onClick={onMenuClick}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        <div className="chat-title">
          <div className="brand-name">{brandInfo.name}</div>
          <button 
            className="model-selector-trigger"
            onClick={() => setShowModelSelector(!showModelSelector)}
          >
            {currentModelName}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        {showModelSelector && (
          <div className="model-selector">
            {availableModels().map(model => (
              <button
                key={model.id}
                className={`model-option ${model.id === currentModel ? 'active' : ''}`}
                onClick={() => handleModelChange(model.id)}
              >
                {model.name}
                {model.id === currentModel && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8L6 11L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="messages-container">
        {!currentConversation?.messages?.length ? (
          <div className="empty-chat">
            <div className="empty-icon">💬</div>
            <h2>Start a conversation</h2>
            <p>Send a message to begin chatting with {brandInfo.name}</p>
          </div>
        ) : (
          <div className="messages">
            {currentConversation.messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content">
                  <div className="message-text">{msg.content}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {error && (
        <div className="error-banner">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 4V8M8 11V11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {error}
        </div>
      )}

      <div className="input-container">
        <form onSubmit={handleSubmit} className="input-form">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Send a message..."
            rows={1}
            disabled={isLoading}
          />
          {isLoading ? (
            <button type="button" className="btn-send loading" onClick={handleCancel}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="6" y="6" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
          ) : (
            <button type="submit" className="btn-send" disabled={!input.trim()}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M18 10L2 2L5 10L2 18L18 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
