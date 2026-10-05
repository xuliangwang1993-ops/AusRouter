import { useState, useRef, useCallback } from 'react';
import { getAdapterForModel } from '../adapters/index.js';

export const useChat = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const sendMessage = useCallback(async ({ messages, model, onChunk }) => {
    setIsLoading(true);
    setError(null);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const adapter = getAdapterForModel(model);
      
      const response = await adapter.chat({
        messages,
        model,
        onChunk,
        signal: abortControllerRef.current.signal
      });

      setIsLoading(false);
      return response;
    } catch (err) {
      if (err.name === 'AbortError' || err.message.includes('aborted')) {
        setError('Request cancelled');
      } else {
        setError(err.message || 'Failed to send message');
      }
      setIsLoading(false);
      throw err;
    }
  }, []);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    sendMessage,
    cancelRequest,
    isLoading,
    error
  };
};
