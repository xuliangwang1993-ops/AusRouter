import { useState, useRef, useCallback } from 'react';
import { getAdapterForModel } from '../adapters/index.js';

// sendMessage receives a full credentials map ({ subrouter, anthropic, openai,
// local }) plus the conversation channel, and lets getAdapterForModel pick the
// right endpoint. The hook itself never decides routing.
export const useChat = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const ref = useRef(null);
  const sendMessage = useCallback(async ({ messages, model, brand, channel, credentials, options, onChunk, onEvent }) => {
    setIsLoading(true);
    setError(null);
    ref.current = new AbortController();
    try {
      const adapter = getAdapterForModel(model, brand, credentials, channel);
      const result = await adapter.chat({ messages, model, options, onChunk, onEvent, signal: ref.current.signal });
      setIsLoading(false);
      return result;
    } catch (e) {
      setIsLoading(false);
      if (e.name !== 'AbortError') setError(e.message);
      throw e;
    }
  }, []);
  const cancelRequest = useCallback(() => ref.current?.abort(), []);
  return { sendMessage, cancelRequest, isLoading, error };
};
