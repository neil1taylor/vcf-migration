// Risk Assessment Hook — v3 (flat risk table)
// Manages risk table overrides with localStorage persistence

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useData } from './useData';
import { getEnvironmentFingerprint, fingerprintsMatch } from '@/utils/vmIdentifier';
import { buildRiskTable } from '@/services/riskAssessment';
import type {
  RiskStatus,
  RiskRow,
  RiskTableData,
  RiskTableOverrides,
  CostComparisonInput,
} from '@/types/riskAssessment';
import type { CalculatedCosts } from '@/context/dataReducer';

const STORAGE_KEY = 'vcf-risk-overrides';
const CURRENT_VERSION = 3;

function loadFromStorage(): RiskTableOverrides | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Only accept v3 data — discard older versions
      if (parsed?.version === CURRENT_VERSION && parsed.rowOverrides) {
        return parsed as RiskTableOverrides;
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

function saveToStorage(data: RiskTableOverrides): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore
  }
}

function createEmpty(fingerprint: string): RiskTableOverrides {
  const now = new Date().toISOString();
  return {
    version: CURRENT_VERSION,
    environmentFingerprint: fingerprint,
    rowOverrides: {},
    deletedRows: [],
    userRows: [],
    createdAt: now,
    modifiedAt: now,
  };
}

let nextUserRowId = 1;

export interface UseRiskAssessmentReturn {
  riskTable: RiskTableData;
  updateRowStatus: (rowId: string, status: RiskStatus) => void;
  updateRowMitigation: (rowId: string, mitigation: string) => void;
  updateRowField: (rowId: string, field: string, value: string) => void;
  addUserRow: (row: Omit<RiskRow, 'id' | 'source'>) => void;
  removeRow: (rowId: string) => void;
  clearAll: () => void;
  exportData: () => string;
}

export function useRiskAssessment(calculatedCosts?: CalculatedCosts | null): UseRiskAssessmentReturn {
  const { rawData } = useData();

  const currentFingerprint = useMemo(() => {
    if (!rawData) return '';
    return getEnvironmentFingerprint(rawData);
  }, [rawData]);

  const [overrides, setOverrides] = useState<RiskTableOverrides>(() => {
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

  const costInput: CostComparisonInput | undefined = useMemo(() => {
    if (!calculatedCosts) return undefined;
    return {
      currentMonthlyCost: null,
      calculatedROKSMonthlyCost: calculatedCosts.roksMonthlyCost ?? null,
      calculatedVSIMonthlyCost: calculatedCosts.vsiMonthlyCost ?? null,
    };
  }, [calculatedCosts]);

  const riskTable = useMemo(() => {
    return buildRiskTable(rawData, overrides, costInput);
  }, [rawData, overrides, costInput]);

  const updateRowStatus = useCallback((rowId: string, status: RiskStatus) => {
    setOverrides(prev => ({
      ...prev,
      rowOverrides: {
        ...prev.rowOverrides,
        [rowId]: { ...prev.rowOverrides[rowId], status },
      },
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const updateRowMitigation = useCallback((rowId: string, mitigation: string) => {
    setOverrides(prev => ({
      ...prev,
      rowOverrides: {
        ...prev.rowOverrides,
        [rowId]: { ...prev.rowOverrides[rowId], mitigationPlan: mitigation },
      },
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const updateRowField = useCallback((rowId: string, field: string, value: string) => {
    setOverrides(prev => ({
      ...prev,
      rowOverrides: {
        ...prev.rowOverrides,
        [rowId]: { ...prev.rowOverrides[rowId], [field]: value },
      },
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const addUserRow = useCallback((row: Omit<RiskRow, 'id' | 'source'>) => {
    const id = `user-${Date.now()}-${nextUserRowId++}`;
    const newRow: RiskRow = { ...row, id, source: 'user' };
    setOverrides(prev => ({
      ...prev,
      userRows: [...prev.userRows, newRow],
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const removeRow = useCallback((rowId: string) => {
    setOverrides(prev => {
      const { [rowId]: _, ...restOverrides } = prev.rowOverrides;
      void _;
      const isUserRow = prev.userRows.some(r => r.id === rowId);
      return {
        ...prev,
        userRows: isUserRow ? prev.userRows.filter(r => r.id !== rowId) : prev.userRows,
        deletedRows: isUserRow ? prev.deletedRows : [...(prev.deletedRows ?? []), rowId],
        rowOverrides: restOverrides,
        modifiedAt: new Date().toISOString(),
      };
    });
  }, []);

  const clearAll = useCallback(() => {
    setOverrides(prev => ({
      ...prev,
      rowOverrides: {},
      deletedRows: [],
      userRows: [],
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const exportData = useCallback(() => {
    return JSON.stringify({ riskTable, overrides }, null, 2);
  }, [riskTable, overrides]);

  return { riskTable, updateRowStatus, updateRowMitigation, updateRowField, addUserRow, removeRow, clearAll, exportData };
}
