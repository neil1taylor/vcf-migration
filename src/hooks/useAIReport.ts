// AI Report Generation hook

import { useState, useCallback, useRef } from 'react';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { fetchAIReportNarrative } from '@/services/ai/aiReportApi';
import type { ReportInput, ReportNarrativeResult } from '@/services/ai/types';
import { useAISettings } from './useAISettings';

export interface UseAIReportReturn {
  narrative: ReportNarrativeResult | null;
  isLoading: boolean;
  error: string | null;
  fetchNarrative: (input: ReportInput) => Promise<void>;
  clearNarrative: () => void;
  isAvailable: boolean;
}

export function useAIReport(): UseAIReportReturn {
  const { settings } = useAISettings();
  const [narrative, setNarrative] = useState<ReportNarrativeResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const isAvailable = isAIProxyConfigured() && settings.enabled;

  const doFetch = useCallback(async (input: ReportInput) => {
    if (!isAvailable || fetchingRef.current) return;

    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchAIReportNarrative(input);
      setNarrative(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report generation failed');
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [isAvailable]);

  const clearNarrative = useCallback(() => {
    setNarrative(null);
    setError(null);
  }, []);

  return {
    narrative,
    isLoading,
    error,
    fetchNarrative: doFetch,
    clearNarrative,
    isAvailable,
  };
}
