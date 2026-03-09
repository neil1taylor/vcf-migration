/**
 * Target Assignments Hook
 *
 * Manages VM-to-target (ROKS/VSI/PowerVS) assignments with localStorage persistence
 * and environment fingerprinting. Default platform comes from the Platform Selection
 * questionnaire's leaning, with SAP/Oracle VMs defaulting to PowerVS.
 * Falls back to auto-classification rules when leaning is neutral.
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
  reason?: string;
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
  overrideReason: (vmId: string, reason: string) => void;
  resetOverride: (vmId: string) => void;
  resetAll: () => void;
  roksCount: number;
  vsiCount: number;
  powervsCount: number;
  overrideCount: number;
  overriddenVmIds: Set<string>;
}

// ===== CONSTANTS =====

const STORAGE_KEY = 'vcf-target-assignments';
const CURRENT_VERSION = 1;

const SAP_NAME_PATTERNS = ['sap', 'hana', 's4hana'];
const ORACLE_NAME_PATTERNS = ['oracle'];

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

function isSAPOrOracleVM(vmName: string, workloadType: string | undefined): boolean {
  const vmNameLower = vmName.toLowerCase();

  // SAP: enterprise workload + SAP/HANA name patterns
  if (workloadType?.toLowerCase().includes('enterprise')) {
    if (SAP_NAME_PATTERNS.some(p => vmNameLower.includes(p))) return true;
  }

  // Oracle: database workload + Oracle name pattern
  if (workloadType?.toLowerCase().includes('database')) {
    if (ORACLE_NAME_PATTERNS.some(p => vmNameLower.includes(p))) return true;
  }

  return false;
}

// ===== HOOK =====

export function useTargetAssignments(
  platformLeaning: 'roks' | 'vsi' | 'neutral' = 'neutral',
): UseTargetAssignmentsReturn {
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

  // Build workload type map (user overrides take priority over pattern matching)
  const workloadTypes = useMemo(() => {
    const map = new Map<string, string>();
    for (const vm of includedVMs) {
      const vmId = getVMIdentifier(vm);
      // User workload type override from Discovery takes priority
      const userWorkloadType = vmOverrides.getWorkloadType(vmId);
      if (userWorkloadType) {
        map.set(vmId, userWorkloadType);
      } else {
        const category = getVMWorkloadCategory(vm.vmName, vm.annotation ?? null);
        if (category) {
          map.set(vmId, category);
        }
      }
    }
    return map;
  }, [includedVMs, vmOverrides]);

  // Auto-classify all included VMs (used as fallback when leaning is neutral)
  const autoClassifications = useMemo(() => {
    if (includedVMs.length === 0) return [];
    return classifyAllVMs(includedVMs, workloadTypes);
  }, [includedVMs, workloadTypes]);

  // Build assignments: platform leaning → SAP/Oracle override → fallback to auto-classification
  const assignments = useMemo(() => {
    return autoClassifications.map(classification => {
      // 1. User override takes highest priority
      const override = data.overrides[classification.vmId];
      if (override) {
        return {
          ...classification,
          target: override.target,
          reasons: [override.reason || 'User override'],
          confidence: 'high' as const,
        };
      }

      // 2. SAP/Oracle VMs → PowerVS
      const wt = workloadTypes.get(classification.vmId);
      if (isSAPOrOracleVM(classification.vmName, wt)) {
        return {
          ...classification,
          target: 'powervs' as MigrationTarget,
          reasons: ['For SAP/Oracle, PowerVS is the preferred platform'],
          confidence: 'high' as const,
        };
      }

      // 3. Platform leaning from questionnaire
      if (platformLeaning !== 'neutral') {
        return {
          ...classification,
          target: platformLeaning as MigrationTarget,
          reasons: ['Assigned based on platform selection questionnaire'],
          confidence: 'medium' as const,
        };
      }

      // 4. Fallback to auto-classification rules
      return classification;
    });
  }, [autoClassifications, data.overrides, workloadTypes, platformLeaning]);

  // Compute counts from final merged assignments
  const roksCount = useMemo(() => {
    return assignments.filter(a => a.target === 'roks').length;
  }, [assignments]);

  const vsiCount = useMemo(() => {
    return assignments.filter(a => a.target === 'vsi').length;
  }, [assignments]);

  const powervsCount = useMemo(() => {
    return assignments.filter(a => a.target === 'powervs').length;
  }, [assignments]);

  const overrideCount = useMemo(() => {
    return Object.keys(data.overrides).length;
  }, [data.overrides]);

  const overriddenVmIds = useMemo(() => {
    return new Set(Object.keys(data.overrides));
  }, [data.overrides]);

  // ===== OPERATIONS =====

  const overrideTarget = useCallback((vmId: string, target: MigrationTarget) => {
    setData(prev => {
      const now = new Date().toISOString();
      const existing = prev.overrides[vmId];
      return {
        ...prev,
        overrides: {
          ...prev.overrides,
          [vmId]: { target, reason: existing?.reason, modifiedAt: now },
        },
        modifiedAt: now,
      };
    });
  }, []);

  const overrideReason = useCallback((vmId: string, reason: string) => {
    setData(prev => {
      const now = new Date().toISOString();
      const existing = prev.overrides[vmId];
      if (existing) {
        return {
          ...prev,
          overrides: {
            ...prev.overrides,
            [vmId]: { ...existing, reason, modifiedAt: now },
          },
          modifiedAt: now,
        };
      }
      // Create override preserving the current assignment's target
      const currentAssignment = assignments.find(a => a.vmId === vmId);
      const target = currentAssignment?.target ?? 'vsi';
      return {
        ...prev,
        overrides: {
          ...prev.overrides,
          [vmId]: { target, reason, modifiedAt: now },
        },
        modifiedAt: now,
      };
    });
  }, [assignments]);

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
    overrideReason,
    resetOverride,
    resetAll,
    roksCount,
    vsiCount,
    powervsCount,
    overrideCount,
    overriddenVmIds,
  };
}

export default useTargetAssignments;
