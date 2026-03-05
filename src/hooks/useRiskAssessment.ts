// Risk Assessment Hook
// Manages risk domain overrides with localStorage persistence

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useData } from './useData';
import { getEnvironmentFingerprint, fingerprintsMatch } from '@/utils/vmIdentifier';
import { calculateRiskAssessment } from '@/services/riskAssessment';
import type { RiskAssessment, RiskDomainId, RiskSeverity, RiskOverrides, CostComparisonInput } from '@/types/riskAssessment';
import type { CalculatedCosts } from '@/context/dataReducer';

const STORAGE_KEY = 'vcf-risk-overrides';
const CURRENT_VERSION = 2;

function migrateV1toV2(stored: RiskOverrides): RiskOverrides {
  const migrated = { ...stored, version: CURRENT_VERSION };
  const overrides = { ...migrated.domainOverrides };

  // Merge infrastructure + complexity into readiness (keep whichever has data)
  const infra = overrides['infrastructure'];
  const complexity = overrides['complexity'];
  if (infra || complexity) {
    // Take the higher severity of the two
    const infraSev = infra?.severity;
    const complexSev = complexity?.severity;
    const sevOrder: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
    const bestSeverity = infraSev && complexSev
      ? ((sevOrder[infraSev] ?? 0) >= (sevOrder[complexSev] ?? 0) ? infraSev : complexSev)
      : infraSev ?? complexSev;

    const notes = [infra?.notes, complexity?.notes].filter(Boolean).join('; ');
    overrides['readiness'] = {
      ...(bestSeverity ? { severity: bestSeverity } : {}),
      ...(notes ? { notes } : {}),
    };
  }

  // Remove old domain keys
  delete overrides['infrastructure'];
  delete overrides['complexity'];
  delete overrides['other'];

  migrated.domainOverrides = overrides;
  return migrated;
}

function loadFromStorage(): RiskOverrides | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      let parsed = JSON.parse(stored) as RiskOverrides;
      if (parsed?.domainOverrides) {
        // Migrate v1 → v2
        if (!parsed.version || parsed.version < 2) {
          parsed = migrateV1toV2(parsed);
          saveToStorage(parsed);
        }
        return parsed;
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
  currentMonthlyCost: number | null;
  setCurrentMonthlyCost: (cost: number | null) => void;
  clearAll: () => void;
  exportData: () => string;
}

export function useRiskAssessment(calculatedCosts?: CalculatedCosts | null): UseRiskAssessmentReturn {
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

  const currentMonthlyCost = overrides.costInput?.currentMonthlyCost ?? null;

  const costInput: CostComparisonInput | undefined = useMemo(() => {
    if (currentMonthlyCost == null && !calculatedCosts) return undefined;
    return {
      currentMonthlyCost,
      calculatedROKSMonthlyCost: calculatedCosts?.roksMonthlyCost ?? null,
      calculatedVSIMonthlyCost: calculatedCosts?.vsiMonthlyCost ?? null,
    };
  }, [currentMonthlyCost, calculatedCosts]);

  const assessment = useMemo(() => {
    return calculateRiskAssessment(rawData, overrides, costInput);
  }, [rawData, overrides, costInput]);

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

  const setCurrentMonthlyCost = useCallback((cost: number | null) => {
    setOverrides(prev => ({
      ...prev,
      costInput: { currentMonthlyCost: cost },
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const clearAll = useCallback(() => {
    setOverrides(prev => ({
      ...prev,
      domainOverrides: {},
      costInput: undefined,
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const exportData = useCallback(() => {
    return JSON.stringify({ assessment, overrides }, null, 2);
  }, [assessment, overrides]);

  return { assessment, setDomainOverride, setDomainNotes, currentMonthlyCost, setCurrentMonthlyCost, clearAll, exportData };
}
