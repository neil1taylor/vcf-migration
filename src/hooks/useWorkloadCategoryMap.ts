// Shared hook: builds a vmName → workload category key map using the full
// 4-pass classification chain (User > Maintainer > AI > Name-pattern).
// Used by both DiscoveryPage and VSIMigrationPage to ensure consistent
// workload category assignment across all consumers.

import { useMemo } from 'react';
import type { VirtualMachine } from '@/types/rvtools';
import type { VMClassificationResult } from '@/services/ai/types';
import type { UseVMOverridesReturn } from '@/hooks/useVMOverrides';
import { getVMIdentifier } from '@/utils/vmIdentifier';
import { findCategoryKeyByName, getVMWorkloadCategory } from '@/utils/workloadClassification';
import workloadPatterns from '@/data/workloadPatterns.json';

// ===== TYPES =====

type AuthoritativeRule = {
  id: string;
  match: 'contains' | 'startsWith' | 'endsWith' | 'exact' | 'regex';
  patterns: string[];
  category: string;
  description?: string;
};

// ===== STATIC DATA (loaded once) =====

const authoritativeRules: AuthoritativeRule[] =
  ((workloadPatterns as Record<string, unknown>).authoritativeClassifications as { rules?: AuthoritativeRule[] })?.rules ?? [];

function matchesAuthoritativeRule(vmName: string, rule: AuthoritativeRule): boolean {
  const nameLower = vmName.toLowerCase();
  for (const pattern of rule.patterns) {
    const patternLower = pattern.toLowerCase();
    switch (rule.match) {
      case 'startsWith':
        if (nameLower.startsWith(patternLower)) return true;
        break;
      case 'endsWith':
        if (nameLower.endsWith(patternLower)) return true;
        break;
      case 'exact':
        if (nameLower === patternLower) return true;
        break;
      case 'regex':
        if (new RegExp(pattern, 'i').test(nameLower)) return true;
        break;
      case 'contains':
      default:
        if (nameLower.includes(patternLower)) return true;
        break;
    }
  }
  return false;
}

// ===== HOOK =====

/**
 * Builds a Map<vmName, categoryKey> using the full 4-pass classification chain.
 *
 * @param vms - Powered-on VMs to classify
 * @param vmOverrides - VM overrides (for user workload type overrides)
 * @param aiClassifications - AI classification results (may be empty)
 */
export function useWorkloadCategoryMap(
  vms: VirtualMachine[],
  vmOverrides: UseVMOverridesReturn,
  aiClassifications?: Record<string, VMClassificationResult>,
): Map<string, string> {
  return useMemo(() => {
    const map = new Map<string, string>();
    const classified = new Set<string>();

    // Pass 1: User workload type overrides (highest priority)
    for (const vm of vms) {
      const vmId = getVMIdentifier(vm);
      const userType = vmOverrides.getWorkloadType(vmId);
      if (!userType) continue;
      const categoryKey = findCategoryKeyByName(userType);
      if (categoryKey) {
        map.set(vm.vmName, categoryKey);
        classified.add(vm.vmName);
      }
    }

    // Pass 2: Maintainer authoritative rules
    for (const vm of vms) {
      if (classified.has(vm.vmName)) continue;
      for (const rule of authoritativeRules) {
        if (matchesAuthoritativeRule(vm.vmName, rule)) {
          map.set(vm.vmName, rule.category);
          classified.add(vm.vmName);
          break;
        }
      }
    }

    // Pass 3: AI classifications
    if (aiClassifications && Object.keys(aiClassifications).length > 0) {
      for (const vm of vms) {
        if (classified.has(vm.vmName)) continue;
        const aiResult = aiClassifications[vm.vmName];
        if (aiResult?.source === 'ai' && aiResult.workloadType) {
          const aiCategoryKey = findCategoryKeyByName(aiResult.workloadType);
          if (aiCategoryKey) {
            map.set(vm.vmName, aiCategoryKey);
            classified.add(vm.vmName);
          }
        }
      }
    }

    // Pass 4: Rule-based name-pattern matching
    for (const vm of vms) {
      if (classified.has(vm.vmName)) continue;
      const category = getVMWorkloadCategory(vm.vmName);
      if (category) {
        map.set(vm.vmName, category);
      }
    }

    return map;
  }, [vms, vmOverrides, aiClassifications]);
}
