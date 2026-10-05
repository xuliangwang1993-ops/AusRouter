/* eslint-disable react/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { config } from '../config/providers.js';

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  // Current active brand/mode
  const [activeBrand, setActiveBrand] = useState(null); // null = default bot
  
  // Conversations storage (keyed by brand)
  const [conversations, setConversations] = useState(() => {
    const saved = localStorage.getItem('ai-hub-conversations');
    return saved ? JSON.parse(saved) : {
      default: [{
        id: 'default-1',
        title: 'New Chat',
        messages: [],
        createdAt: Date.now(),
        model: config.defaultBot.model
      }]
    };
  });

  // Active conversation ID per brand
  const [activeConversationId, setActiveConversationId] = useState(() => {
    const saved = localStorage.getItem('ai-hub-active-conversations');
    return saved ? JSON.parse(saved) : { default: 'default-1' };
  });

  // Settings
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('ai-hub-settings');
    return saved ? JSON.parse(saved) : {
      botName: config.defaultBot.name,
      theme: 'dark'
    };
  });

  // Persist conversations
  useEffect(() => {
    localStorage.setItem('ai-hub-conversations', JSON.stringify(conversations));
  }, [conversations]);

  // Persist active conversation IDs
  useEffect(() => {
    localStorage.setItem('ai-hub-active-conversations', JSON.stringify(activeConversationId));
  }, [activeConversationId]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('ai-hub-settings', JSON.stringify(settings));
  }, [settings]);

  // Get current brand key (default or brand name)
  const getCurrentBrandKey = () => activeBrand || 'default';

  // Get current conversation
  const getCurrentConversation = () => {
    const brandKey = getCurrentBrandKey();
    const convId = activeConversationId[brandKey];
    return conversations[brandKey]?.find(c => c.id === convId);
  };

  // Create new conversation
  const createConversation = (brandKey = null) => {
    const key = brandKey || getCurrentBrandKey();
    
    // Determine default model based on brandKey
    let defaultModel;
    if (key === 'default') {
      defaultModel = config.defaultBot.model;
    } else {
      // Look up brand config using the brandKey
      const brand = config.brands[key];
      if (brand && brand.defaultModel) {
        defaultModel = brand.defaultModel;
      } else if (brand && brand.provider) {
        const provider = config.providers[brand.provider];
        defaultModel = provider?.models[0]?.id || config.defaultBot.model;
      } else {
        defaultModel = config.defaultBot.model;
      }
    }

    const newConv = {
      id: `${key}-${Date.now()}`,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      model: defaultModel
    };

    setConversations(prev => ({
      ...prev,
      [key]: [newConv, ...(prev[key] || [])]
    }));

    setActiveConversationId(prev => ({
      ...prev,
      [key]: newConv.id
    }));

    return newConv.id;
  };

  // Switch conversation
  const switchConversation = (convId) => {
    const brandKey = getCurrentBrandKey();
    setActiveConversationId(prev => ({
      ...prev,
      [brandKey]: convId
    }));
  };

  // Delete conversation
  const deleteConversation = (convId) => {
    const brandKey = getCurrentBrandKey();
    const brandConvs = conversations[brandKey] || [];
    
    setConversations(prev => ({
      ...prev,
      [brandKey]: brandConvs.filter(c => c.id !== convId)
    }));

    // If deleting active conversation, switch to another or create new
    if (activeConversationId[brandKey] === convId) {
      const remaining = brandConvs.filter(c => c.id !== convId);
      if (remaining.length > 0) {
        setActiveConversationId(prev => ({
          ...prev,
          [brandKey]: remaining[0].id
        }));
      } else {
        createConversation(brandKey);
      }
    }
  };

  // Add message to current conversation
  const addMessage = (message) => {
    const brandKey = getCurrentBrandKey();
    const convId = activeConversationId[brandKey];

    setConversations(prev => {
      const brandConvs = prev[brandKey] || [];
      return {
        ...prev,
        [brandKey]: brandConvs.map(conv => {
          if (conv.id === convId) {
            const newMessages = [...conv.messages, message];
            // Update title based on first user message
            const title = newMessages.length === 1 && message.role === 'user'
              ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
              : conv.title;
            
            return {
              ...conv,
              messages: newMessages,
              title
            };
          }
          return conv;
        })
      };
    });
  };

  // Update last message (for streaming) - supports both value and updater function
  const updateLastMessage = (contentOrUpdater) => {
    const brandKey = getCurrentBrandKey();
    const convId = activeConversationId[brandKey];

    setConversations(prev => {
      const brandConvs = prev[brandKey] || [];
      return {
        ...prev,
        [brandKey]: brandConvs.map(conv => {
          if (conv.id === convId) {
            const messages = [...conv.messages];
            if (messages.length > 0) {
              const lastMessage = messages[messages.length - 1];
              const newContent = typeof contentOrUpdater === 'function'
                ? contentOrUpdater(lastMessage.content)
                : contentOrUpdater;
              
              messages[messages.length - 1] = {
                ...lastMessage,
                content: newContent
              };
            }
            return { ...conv, messages };
          }
          return conv;
        })
      };
    });
  };

  // Update conversation model
  const updateConversationModel = (modelId) => {
    const brandKey = getCurrentBrandKey();
    const convId = activeConversationId[brandKey];

    setConversations(prev => {
      const brandConvs = prev[brandKey] || [];
      return {
        ...prev,
        [brandKey]: brandConvs.map(conv => 
          conv.id === convId ? { ...conv, model: modelId } : conv
        )
      };
    });
  };

  // Switch brand
  const switchBrand = (brandId) => {
    setActiveBrand(brandId);
    
    // Ensure brand has at least one conversation
    const brandKey = brandId || 'default';
    if (!conversations[brandKey] || conversations[brandKey].length === 0) {
      createConversation(brandKey);
    }
  };

  const value = {
    activeBrand,
    conversations: conversations[getCurrentBrandKey()] || [],
    currentConversation: getCurrentConversation(),
    settings,
    createConversation,
    switchConversation,
    deleteConversation,
    addMessage,
    updateLastMessage,
    updateConversationModel,
    switchBrand,
    updateSettings: setSettings
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
