export const config = {
  providers: {
    openai: { name: 'OpenAI', models: [{ id: 'gpt-4o', name: 'GPT-4o' }, { id: 'gpt-4o-mini', name: 'GPT-4o mini' }, { id: 'o3-mini', name: 'o3-mini' }] },
    anthropic: { name: 'Anthropic', models: [{ id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' }, { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet' }, { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' }] },
    google: { name: 'Google', models: [{ id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' }] },
    copilot: { name: 'Microsoft', models: [] },
    xai: { name: 'xAI', models: [{ id: 'grok-3-mini', name: 'Grok 3 mini' }] },
    local: { name: '本地模型', models: [{ id: 'local-model', name: '本地模型' }] }
  },
  brands: {
    chatgpt: { name: 'ChatGPT', provider: 'openai', defaultModel: 'gpt-4o', color: '#10a37f' },
    claude: { name: 'Claude', provider: 'anthropic', defaultModel: 'claude-sonnet-4-20250514', color: '#d97757' },
    gemini: { name: 'Gemini', comingSoon: true, color: '#4285f4' },
    copilot: { name: 'Copilot', comingSoon: true, color: '#8b5cf6' },
    grok: { name: 'Grok', comingSoon: true, color: '#111827' }
  }
};
export const getModelsForProvider = (provider) => config.providers[provider]?.models || [];
export const getModelsWithLocal = (provider) => [...getModelsForProvider(provider), ...config.providers.local.models];
