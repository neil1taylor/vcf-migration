// AI Risk Analysis hook

import { useState, useCallback, useRef } from 'react';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { fetchAIRiskAnalysis } from '@/services/ai/aiRiskAnalysisApi';
import type { RiskAnalysisInput, RiskAnalysisResult } from '@/services/ai/types';
import { useAISettings } from './useAISettings';

export interface UseAIRiskAnalysisReturn {
  riskAnalysis: RiskAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  fetchRiskAnalysis: (input: RiskAnalysisInput) => Promise<void>;
  clearRiskAnalysis: () => void;
  isAvailable: boolean;
}

export function useAIRiskAnalysis(): UseAIRiskAnalysisReturn {
  const { settings } = useAISettings();
  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const isAvailable = isAIProxyConfigured() && settings.enabled;

  const doFetch = useCallback(async (input: RiskAnalysisInput) => {
    if (!isAvailable || fetchingRef.current) return;

    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchAIRiskAnalysis(input);
      setRiskAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Risk analysis failed');
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [isAvailable]);

  const clearRiskAnalysis = useCallback(() => {
    setRiskAnalysis(null);
    setError(null);
  }, []);

  return {
    riskAnalysis,
    isLoading,
    error,
    fetchRiskAnalysis: doFetch,
    clearRiskAnalysis,
    isAvailable,
  };
}
