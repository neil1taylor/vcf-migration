// AI Insights hook

import { useState, useCallback, useRef } from 'react';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { fetchAIInsights } from '@/services/ai/aiInsightsApi';
import type { InsightsInput, MigrationInsights } from '@/services/ai/types';
import { useAISettings } from './useAISettings';

export interface UseAIInsightsReturn {
  insights: MigrationInsights | null;
  isLoading: boolean;
  error: string | null;
  fetchInsights: (data: InsightsInput) => Promise<void>;
  clearInsights: () => void;
  isAvailable: boolean;
}

/**
 * Hook for AI-powered migration insights
 */
export function useAIInsights(): UseAIInsightsReturn {
  const { settings } = useAISettings();
  const [insights, setInsights] = useState<MigrationInsights | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAvailable = isAIProxyConfigured() && settings.enabled;
  const fetchingRef = useRef(false);

  const doFetchInsights = useCallback(async (data: InsightsInput) => {
    if (!isAvailable) return;
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchAIInsights(data);
      setInsights(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Insights generation failed';
      setError(message);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [isAvailable]);

  const clearInsights = useCallback(() => {
    setInsights(null);
    setError(null);
  }, []);

  return {
    insights,
    isLoading,
    error,
    fetchInsights: doFetchInsights,
    clearInsights,
    isAvailable,
  };
}
