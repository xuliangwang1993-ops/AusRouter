import { MockAdapter } from './mock.js';
import { OpenAIAdapter } from './openai.js';
import { AnthropicAdapter } from './anthropic.js';
import { config } from '../config/providers.js';

// Adapter factory - creates the right adapter based on provider
export const createAdapter = (providerName) => {
  const providerConfig = config.providers[providerName];
  
  if (!providerConfig) {
    throw new Error(`Unknown provider: ${providerName}`);
  }

  switch (providerName) {
    case 'mock':
      return new MockAdapter(providerConfig);
    case 'openai':
      return new OpenAIAdapter(providerConfig);
    case 'anthropic':
      return new AnthropicAdapter(providerConfig);
    case 'local':
      // Local uses OpenAI-compatible API, fallback to mock if no baseURL or apiKey
      if (!providerConfig.baseURL || !providerConfig.apiKey) {
        return new MockAdapter(providerConfig);
      }
      return new OpenAIAdapter(providerConfig);
    default:
      throw new Error(`No adapter implemented for provider: ${providerName}`);
  }
};

// Get adapter for a specific model
export const getAdapterForModel = (modelId) => {
  // Check which provider has this model
  for (const [providerName, providerConfig] of Object.entries(config.providers)) {
    const hasModel = providerConfig.models?.some(m => m.id === modelId);
    if (hasModel) {
      return createAdapter(providerName);
    }
  }
  
  // Default to mock if model not found
  return createAdapter('mock');
};
