// AI Target Selection hook — manages ROKS vs VSI AI selection state

import { useState, useCallback, useRef } from 'react';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { fetchAITargetSelections } from '@/services/ai/aiTargetSelectionApi';
import { clearTargetSelectionCache } from '@/services/ai/aiTargetSelectionCache';
import type { TargetSelectionInput, TargetSelectionResult } from '@/services/ai/types';
import { useAISettings } from './useAISettings';

export interface UseAITargetSelectionReturn {
  selections: Record<string, TargetSelectionResult>;
  isLoading: boolean;
  error: string | null;
  progress: number; // 0-100
  fetchSelections: (vms: TargetSelectionInput[], fingerprint: string) => Promise<void>;
  refreshSelections: (vms: TargetSelectionInput[], fingerprint: string) => Promise<void>;
  getSelection: (vmName: string) => TargetSelectionResult | undefined;
  clearCache: () => void;
  isAvailable: boolean;
}

export function useAITargetSelection(): UseAITargetSelectionReturn {
  const { settings } = useAISettings();
  const [selections, setSelections] = useState<Record<string, TargetSelectionResult>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fetchingRef = useRef(false);
  const isAvailable = isAIProxyConfigured() && settings.enabled;

  const doFetch = useCallback(async (vms: TargetSelectionInput[], fingerprint: string) => {
    if (!isAvailable || fetchingRef.current) return;

    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);
    setProgress(0);

    try {
      const results = await fetchAITargetSelections(vms, fingerprint, (completed, total) => {
        setProgress(Math.round((completed / total) * 100));
      });

      const map: Record<string, TargetSelectionResult> = {};
      for (const r of results) {
        map[r.vmName] = r;
      }
      setSelections(map);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Target selection failed');
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [isAvailable]);

  const refreshSelections = useCallback(async (vms: TargetSelectionInput[], fingerprint: string) => {
    clearTargetSelectionCache();
    setSelections({});
    fetchingRef.current = false;
    await doFetch(vms, fingerprint);
  }, [doFetch]);

  const getSelection = useCallback((vmName: string) => {
    return selections[vmName];
  }, [selections]);

  const clearCache = useCallback(() => {
    clearTargetSelectionCache();
    setSelections({});
    setError(null);
  }, []);

  return {
    selections,
    isLoading,
    error,
    progress,
    fetchSelections: doFetch,
    refreshSelections,
    getSelection,
    clearCache,
    isAvailable,
  };
}
