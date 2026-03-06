// AI Discovery Questions hook

import { useState, useCallback, useRef } from 'react';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { fetchAIDiscoveryQuestions } from '@/services/ai/aiDiscoveryQuestionsApi';
import type { DiscoveryQuestionsInput, DiscoveryQuestionsResult } from '@/services/ai/types';
import { useAISettings } from './useAISettings';

export interface UseAIDiscoveryQuestionsReturn {
  questions: DiscoveryQuestionsResult | null;
  isLoading: boolean;
  error: string | null;
  fetchQuestions: (input: DiscoveryQuestionsInput) => Promise<void>;
  clearQuestions: () => void;
  isAvailable: boolean;
}

export function useAIDiscoveryQuestions(): UseAIDiscoveryQuestionsReturn {
  const { settings } = useAISettings();
  const [questions, setQuestions] = useState<DiscoveryQuestionsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const isAvailable = isAIProxyConfigured() && settings.enabled;

  const doFetch = useCallback(async (input: DiscoveryQuestionsInput) => {
    if (!isAvailable || fetchingRef.current) return;

    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchAIDiscoveryQuestions(input);
      setQuestions(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery questions failed');
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [isAvailable]);

  const clearQuestions = useCallback(() => {
    setQuestions(null);
    setError(null);
  }, []);

  return {
    questions,
    isLoading,
    error,
    fetchQuestions: doFetch,
    clearQuestions,
    isAvailable,
  };
}
