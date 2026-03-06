// AI Anomaly Detection hook

import { useState, useCallback, useRef } from 'react';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { fetchAIAnomalyAnalysis, clearAnomalyCache } from '@/services/ai/aiAnomalyApi';
import { buildAnomalyInput } from '@/services/ai/anomalyInputBuilder';
import type { AnomalyResult } from '@/services/ai/types';
import type { RVToolsData } from '@/types';
import { useAISettings } from './useAISettings';

export interface UseAIAnomalyDetectionReturn {
  anomalies: AnomalyResult[];
  isLoading: boolean;
  error: string | null;
  fetchAnomalies: (rawData: RVToolsData, environmentHash: string) => Promise<void>;
  refreshAnomalies: (rawData: RVToolsData, environmentHash: string) => Promise<void>;
  clearAnomalies: () => void;
  isAvailable: boolean;
  /** Counts by severity */
  severityCounts: { critical: number; high: number; medium: number; low: number };
}

export function useAIAnomalyDetection(): UseAIAnomalyDetectionReturn {
  const { settings } = useAISettings();
  const [anomalies, setAnomalies] = useState<AnomalyResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const isAvailable = isAIProxyConfigured() && settings.enabled;

  const doFetch = useCallback(async (rawData: RVToolsData, environmentHash: string) => {
    if (!isAvailable || fetchingRef.current) return;

    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const input = buildAnomalyInput(rawData);

      if (input.anomalyCandidates.length === 0) {
        setAnomalies([]);
        return;
      }

      const result = await fetchAIAnomalyAnalysis(input, environmentHash);
      setAnomalies(result?.anomalies || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anomaly detection failed');
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [isAvailable]);

  const refreshAnomalies = useCallback(async (rawData: RVToolsData, environmentHash: string) => {
    clearAnomalyCache();
    setAnomalies([]);
    fetchingRef.current = false;
    await doFetch(rawData, environmentHash);
  }, [doFetch]);

  const clearAnomalies = useCallback(() => {
    clearAnomalyCache();
    setAnomalies([]);
    setError(null);
  }, []);

  const severityCounts = {
    critical: anomalies.filter(a => a.severity === 'critical').length,
    high: anomalies.filter(a => a.severity === 'high').length,
    medium: anomalies.filter(a => a.severity === 'medium').length,
    low: anomalies.filter(a => a.severity === 'low').length,
  };

  return {
    anomalies,
    isLoading,
    error,
    fetchAnomalies: doFetch,
    refreshAnomalies,
    clearAnomalies,
    isAvailable,
    severityCounts,
  };
}
