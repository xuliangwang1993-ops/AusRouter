// Provider configuration
// To switch provider: change 'active' value
// To add API key: set apiKey for the provider
// To use custom endpoint: set baseURL

export const config = {
  // Default bot configuration
  defaultBot: {
    name: "AI Assistant",
    model: "local-default",
    provider: "mock"
  },
  
  // Provider settings
  providers: {
    mock: {
      active: true,
      name: "Mock Provider",
      baseURL: null, // No API needed for mock
      apiKey: null,
      models: [
        { id: "local-default", name: "Local Model" }
      ]
    },
    
    openai: {
      active: false,
      name: "OpenAI",
      baseURL: "https://api.openai.com/v1", // Change to your proxy/relay URL
      apiKey: "", // Set your API key here or use environment variable
      models: [
        { id: "gpt-4o", name: "GPT-4o" },
        { id: "gpt-4o-mini", name: "GPT-4o Mini" },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" }
      ]
    },
    
    anthropic: {
      active: false,
      name: "Anthropic",
      baseURL: "https://api.anthropic.com/v1", // Change to your proxy/relay URL
      apiKey: "", // Set your API key here
      apiVersion: "2023-06-01",
      models: [
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
        { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus" }
      ]
    },
    
    local: {
      active: true,
      name: "Local Relay",
      // Fill in your local relay endpoint URL below (e.g., http://localhost:8000/v1)
      // Leave empty to use mock responses
      baseURL: "", 
      // Fill in your relay API key if required
      // Leave empty to use mock responses
      apiKey: "",
      models: [
        { id: "local-relay", name: "Local" }
      ]
    }
  },
  
  // Brand configurations
  brands: {
    chatgpt: {
      name: "ChatGPT",
      provider: "openai",
      defaultModel: "gpt-4o",
      comingSoon: false
    },
    claude: {
      name: "Claude",
      provider: "anthropic",
      defaultModel: "claude-3-5-sonnet-20241022",
      comingSoon: false
    },
    copilot: {
      name: "Copilot",
      comingSoon: true
    },
    gemini: {
      name: "Gemini",
      comingSoon: true
    },
    grok: {
      name: "Grok",
      comingSoon: true
    },
    placeholder: {
      name: "Coming Soon",
      comingSoon: true
    }
  }
};

// Get active provider for a brand
export const getProviderForBrand = (brandId) => {
  const brand = config.brands[brandId];
  if (!brand || brand.comingSoon) return null;
  return brand.provider;
};

// Get models for a provider, always add Local at the end
export const getModelsForProvider = (providerName) => {
  const provider = config.providers[providerName];
  if (!provider) return [];
  
  const models = [...provider.models];
  
  // Add Local option at the end if not already a local provider
  if (providerName !== 'local' && config.providers.local.active) {
    models.push(...config.providers.local.models);
  }
  
  return models;
};
