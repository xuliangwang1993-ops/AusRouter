// Base adapter interface
// All adapters must implement these methods

export class BaseAdapter {
  constructor(config) {
    this.config = config;
  }

  /**
   * Send a chat completion request
   * @param {Object} _params - Request parameters
   * @param {Array} _params.messages - Message history
   * @param {string} _params.model - Model ID
   * @param {Function} _params.onChunk - Callback for streaming chunks
   * @param {AbortSignal} _params.signal - Abort signal for cancellation
   * @returns {Promise<string>} - Complete response text
   */
  async chat(_params) {
    throw new Error('chat() must be implemented by adapter');
  }

  /**
   * List available models
   * @returns {Promise<Array>} - Array of model objects
   */
  async listModels() {
    throw new Error('listModels() must be implemented by adapter');
  }
}
