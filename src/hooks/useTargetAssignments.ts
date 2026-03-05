/**
 * Target Assignments Hook
 *
 * Manages VM-to-target (ROKS/VSI) assignments with localStorage persistence
 * and environment fingerprinting. Auto-classifies VMs via targetClassification
 * service, with user overrides merged on top.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useData, useAllVMs } from './useData';
import { useVMOverrides } from './useVMOverrides';
import { useAutoExclusion } from './useAutoExclusion';
import { getVMIdentifier, getEnvironmentFingerprint, fingerprintsMatch } from '@/utils/vmIdentifier';
import { getVMWorkloadCategory } from '@/utils/workloadClassification';
import {
  classifyAllVMs,
  type VMClassification,
  type MigrationTarget,
} from '@/services/migration/targetClassification';

// ===== TYPES =====

interface TargetOverride {
  target: MigrationTarget;
  modifiedAt: string;
}

interface TargetAssignmentsData {
  version: number;
  environmentFingerprint: string;
  overrides: Record<string, TargetOverride>;
  createdAt: string;
  modifiedAt: string;
}

export interface UseTargetAssignmentsReturn {
  assignments: VMClassification[];
  overrideTarget: (vmId: string, target: MigrationTarget) => void;
  resetOverride: (vmId: string) => void;
  resetAll: () => void;
  roksCount: number;
  vsiCount: number;
  overrideCount: number;
}

// ===== CONSTANTS =====

const STORAGE_KEY = 'vcf-target-assignments';
const CURRENT_VERSION = 1;

// ===== HELPER FUNCTIONS =====

function loadFromStorage(): TargetAssignmentsData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && parsed.version && parsed.overrides) {
        return parsed as TargetAssignmentsData;
      }
    }
  } catch (error) {
    console.warn('[TargetAssignments] Failed to load from storage:', error);
  }
  return null;
}

function saveToStorage(data: TargetAssignmentsData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('[TargetAssignments] Failed to save to storage:', error);
  }
}

function createEmptyData(fingerprint: string): TargetAssignmentsData {
  const now = new Date().toISOString();
  return {
    version: CURRENT_VERSION,
    environmentFingerprint: fingerprint,
    overrides: {},
    createdAt: now,
    modifiedAt: now,
  };
}

// ===== HOOK =====

export function useTargetAssignments(): UseTargetAssignmentsReturn {
  const { rawData } = useData();
  const allVMs = useAllVMs();
  const vmOverrides = useVMOverrides();
  const { getAutoExclusionById } = useAutoExclusion();

  // Current environment fingerprint
  const currentFingerprint = useMemo(() => {
    if (!rawData) return '';
    return getEnvironmentFingerprint(rawData);
  }, [rawData]);

  // Load stored data
  const storedData = useMemo(() => loadFromStorage(), []);

  // State
  const [data, setData] = useState<TargetAssignmentsData>(() => {
    if (storedData && currentFingerprint) {
      if (fingerprintsMatch(storedData.environmentFingerprint, currentFingerprint)) {
        return storedData;
      }
      return createEmptyData(currentFingerprint);
    }
    if (currentFingerprint) {
      return createEmptyData(currentFingerprint);
    }
    return storedData || createEmptyData('');
  });

  // Update fingerprint when data changes
  useEffect(() => {
    if (!currentFingerprint) return;

    const stored = loadFromStorage();
    if (!stored) {
      const newData = createEmptyData(currentFingerprint);
      setData(newData);
      saveToStorage(newData);
      return;
    }

    if (fingerprintsMatch(stored.environmentFingerprint, currentFingerprint)) {
      setData(stored);
    } else {
      const newData = createEmptyData(currentFingerprint);
      setData(newData);
      saveToStorage(newData);
    }
  }, [currentFingerprint]);

  // Persist to localStorage on changes
  useEffect(() => {
    if (data.environmentFingerprint) {
      saveToStorage(data);
    }
  }, [data]);

  // Filter to non-excluded VMs
  const includedVMs = useMemo(() => {
    return allVMs.filter(vm => {
      const vmId = getVMIdentifier(vm);
      const autoResult = getAutoExclusionById(vmId);
      return !vmOverrides.isEffectivelyExcluded(vmId, autoResult.isAutoExcluded);
    });
  }, [allVMs, getAutoExclusionById, vmOverrides]);

  // Build workload type map
  const workloadTypes = useMemo(() => {
    const map = new Map<string, string>();
    for (const vm of includedVMs) {
      const vmId = getVMIdentifier(vm);
      const category = getVMWorkloadCategory(vm.vmName, vm.annotation ?? null);
      if (category) {
        map.set(vmId, category);
      }
    }
    return map;
  }, [includedVMs]);

  // Auto-classify all included VMs
  const autoClassifications = useMemo(() => {
    if (includedVMs.length === 0) return [];
    return classifyAllVMs(includedVMs, workloadTypes);
  }, [includedVMs, workloadTypes]);

  // Merge user overrides on top of auto-classifications
  const assignments = useMemo(() => {
    return autoClassifications.map(classification => {
      const override = data.overrides[classification.vmId];
      if (override) {
        return {
          ...classification,
          target: override.target,
          reasons: ['User override'],
          confidence: 'high' as const,
        };
      }
      return classification;
    });
  }, [autoClassifications, data.overrides]);

  // Compute counts from final merged assignments
  const roksCount = useMemo(() => {
    return assignments.filter(a => a.target === 'roks').length;
  }, [assignments]);

  const vsiCount = useMemo(() => {
    return assignments.filter(a => a.target === 'vsi').length;
  }, [assignments]);

  const overrideCount = useMemo(() => {
    return Object.keys(data.overrides).length;
  }, [data.overrides]);

  // ===== OPERATIONS =====

  const overrideTarget = useCallback((vmId: string, target: MigrationTarget) => {
    setData(prev => {
      const now = new Date().toISOString();
      return {
        ...prev,
        overrides: {
          ...prev.overrides,
          [vmId]: { target, modifiedAt: now },
        },
        modifiedAt: now,
      };
    });
  }, []);

  const resetOverride = useCallback((vmId: string) => {
    setData(prev => {
      const { [vmId]: _removed, ...rest } = prev.overrides;
      void _removed;
      return {
        ...prev,
        overrides: rest,
        modifiedAt: new Date().toISOString(),
      };
    });
  }, []);

  const resetAll = useCallback(() => {
    setData(prev => ({
      ...prev,
      overrides: {},
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  return {
    assignments,
    overrideTarget,
    resetOverride,
    resetAll,
    roksCount,
    vsiCount,
    overrideCount,
  };
}

export default useTargetAssignments;
