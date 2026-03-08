// Timeline Configuration Hook
// Manages timeline phase durations with localStorage persistence

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useData } from './useData';
import { getEnvironmentFingerprint, fingerprintsMatch } from '@/utils/vmIdentifier';
import { buildDefaultTimeline, calculateTimelineTotals } from '@/services/migration/timelineEstimation';
import type { TimelinePhase, TimelineConfig, TimelineTotals } from '@/types/timeline';

const STORAGE_KEY = 'vcf-timeline-config';
const CURRENT_VERSION = 1;

function loadFromStorage(): TimelineConfig | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.version && parsed?.phaseDurations) {
        return parsed as TimelineConfig;
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

function saveToStorage(data: TimelineConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore
  }
}

function createEmpty(fingerprint: string): TimelineConfig {
  const now = new Date().toISOString();
  return {
    version: CURRENT_VERSION,
    environmentFingerprint: fingerprint,
    phaseDurations: {},
    createdAt: now,
    modifiedAt: now,
  };
}

function resolveConfig(fingerprint: string): TimelineConfig {
  if (!fingerprint) return createEmpty('');
  const stored = loadFromStorage();
  if (stored && fingerprintsMatch(stored.environmentFingerprint, fingerprint)) {
    return stored;
  }
  const newData = createEmpty(fingerprint);
  saveToStorage(newData);
  return newData;
}

export interface UseTimelineConfigReturn {
  phases: TimelinePhase[];
  totals: TimelineTotals;
  startDate: Date | undefined;
  updatePhaseDuration: (phaseId: string, weeks: number) => void;
  setStartDate: (date: Date | undefined) => void;
  resetToDefaults: (waveCount: number) => void;
}

export function useTimelineConfig(waveCount: number, waveVmCounts?: number[], waveNames?: string[], waveStorageGiB?: number[]): UseTimelineConfigReturn {
  const { rawData } = useData();

  const currentFingerprint = useMemo(() => {
    if (!rawData) return '';
    return getEnvironmentFingerprint(rawData);
  }, [rawData]);

  const [config, setConfig] = useState<TimelineConfig>(() => resolveConfig(currentFingerprint));

  // Re-sync when environment changes — same pattern as useRiskAssessment/useVMOverrides
  useEffect(() => {
    if (!currentFingerprint) return;
    const resolved = resolveConfig(currentFingerprint);
    setConfig(resolved); // eslint-disable-line react-hooks/set-state-in-effect -- sync localStorage on env change
  }, [currentFingerprint]);

  // Persist to localStorage when config changes
  useEffect(() => {
    if (config.environmentFingerprint) {
      saveToStorage(config);
    }
  }, [config]);

  const startDate = useMemo(() => {
    return config.startDate ? new Date(config.startDate) : undefined;
  }, [config.startDate]);

  const phases = useMemo(() => {
    return buildDefaultTimeline(waveCount, config.phaseDurations, waveVmCounts, waveNames, waveStorageGiB);
  }, [waveCount, config.phaseDurations, waveVmCounts, waveNames, waveStorageGiB]);

  const totals = useMemo(() => {
    return calculateTimelineTotals(phases, startDate);
  }, [phases, startDate]);

  const updatePhaseDuration = useCallback((phaseId: string, weeks: number) => {
    setConfig(prev => ({
      ...prev,
      phaseDurations: { ...prev.phaseDurations, [phaseId]: Math.max(1, weeks) },
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const setStartDate = useCallback((date: Date | undefined) => {
    setConfig(prev => ({
      ...prev,
      startDate: date?.toISOString(),
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const resetToDefaults = useCallback((wc: number) => {
    void wc;
    setConfig(prev => ({
      ...prev,
      phaseDurations: {},
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  return { phases, totals, startDate, updatePhaseDuration, setStartDate, resetToDefaults };
}
