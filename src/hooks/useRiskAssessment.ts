// Risk Assessment Hook
// Manages risk domain overrides with localStorage persistence

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useData } from './useData';
import { getEnvironmentFingerprint, fingerprintsMatch } from '@/utils/vmIdentifier';
import { calculateRiskAssessment } from '@/services/riskAssessment';
import type { RiskAssessment, RiskDomainId, RiskSeverity, RiskOverrides } from '@/types/riskAssessment';

const STORAGE_KEY = 'vcf-risk-overrides';
const CURRENT_VERSION = 1;

function loadFromStorage(): RiskOverrides | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.version && parsed?.domainOverrides) {
        return parsed as RiskOverrides;
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

function saveToStorage(data: RiskOverrides): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore
  }
}

function createEmpty(fingerprint: string): RiskOverrides {
  const now = new Date().toISOString();
  return {
    version: CURRENT_VERSION,
    environmentFingerprint: fingerprint,
    domainOverrides: {},
    createdAt: now,
    modifiedAt: now,
  };
}

export interface UseRiskAssessmentReturn {
  assessment: RiskAssessment;
  setDomainOverride: (domainId: RiskDomainId, severity: RiskSeverity | null) => void;
  setDomainNotes: (domainId: RiskDomainId, notes: string) => void;
  clearAll: () => void;
  exportData: () => string;
}

export function useRiskAssessment(): UseRiskAssessmentReturn {
  const { rawData } = useData();

  const currentFingerprint = useMemo(() => {
    if (!rawData) return '';
    return getEnvironmentFingerprint(rawData);
  }, [rawData]);

  const [overrides, setOverrides] = useState<RiskOverrides>(() => {
    const stored = loadFromStorage();
    if (stored && currentFingerprint && fingerprintsMatch(stored.environmentFingerprint, currentFingerprint)) {
      return stored;
    }
    return createEmpty(currentFingerprint);
  });

  // Re-sync when environment changes
  useEffect(() => {
    if (!currentFingerprint) return;
    const stored = loadFromStorage();
    if (stored && fingerprintsMatch(stored.environmentFingerprint, currentFingerprint)) {
      setOverrides(stored);
    } else {
      const newData = createEmpty(currentFingerprint);
      setOverrides(newData);
      saveToStorage(newData);
    }
  }, [currentFingerprint]);

  // Persist
  useEffect(() => {
    if (overrides.environmentFingerprint) {
      saveToStorage(overrides);
    }
  }, [overrides]);

  const assessment = useMemo(() => {
    return calculateRiskAssessment(rawData, overrides);
  }, [rawData, overrides]);

  const setDomainOverride = useCallback((domainId: RiskDomainId, severity: RiskSeverity | null) => {
    setOverrides(prev => {
      const now = new Date().toISOString();
      const existing = prev.domainOverrides[domainId] ?? {};
      if (severity === null) {
        const { [domainId]: _, ...rest } = prev.domainOverrides;
        void _;
        return { ...prev, domainOverrides: { ...rest, ...(existing.notes ? { [domainId]: { notes: existing.notes } } : {}) }, modifiedAt: now };
      }
      return {
        ...prev,
        domainOverrides: { ...prev.domainOverrides, [domainId]: { ...existing, severity } },
        modifiedAt: now,
      };
    });
  }, []);

  const setDomainNotes = useCallback((domainId: RiskDomainId, notes: string) => {
    setOverrides(prev => {
      const now = new Date().toISOString();
      const existing = prev.domainOverrides[domainId] ?? {};
      return {
        ...prev,
        domainOverrides: { ...prev.domainOverrides, [domainId]: { ...existing, notes: notes || undefined } },
        modifiedAt: now,
      };
    });
  }, []);

  const clearAll = useCallback(() => {
    setOverrides(prev => ({
      ...prev,
      domainOverrides: {},
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const exportData = useCallback(() => {
    return JSON.stringify({ assessment, overrides }, null, 2);
  }, [assessment, overrides]);

  return { assessment, setDomainOverride, setDomainNotes, clearAll, exportData };
}
