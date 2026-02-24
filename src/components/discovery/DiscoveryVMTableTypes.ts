/**
 * DiscoveryVMTable Types and Helpers
 *
 * Shared types, constants, and utility functions used by the DiscoveryVMTable
 * component and its extracted sub-components.
 */

import type { VirtualMachine } from '@/types/rvtools';
import type { UseVMOverridesReturn } from '@/hooks/useVMOverrides';
import type { AutoExclusionResult } from '@/utils/autoExclusion';
import type { VMClassificationResult } from '@/services/ai/types';
import type { WorkloadMatch } from './WorkloadVMTable';
import workloadPatterns from '@/data/workloadPatterns.json';

// ===== TYPES =====

export interface DiscoveryVMTableProps {
  vms: VirtualMachine[];
  workloadMatches: WorkloadMatch[];
  vmOverrides: UseVMOverridesReturn;
  autoExclusionMap: Map<string, AutoExclusionResult>;
  aiClassifications?: Record<string, VMClassificationResult>;
  selectedCategory: string | null;
  onCategorySelect: (key: string | null) => void;
  workloadsByCategory: Record<string, { name: string; vms: Set<string> }>;
}

export type FilterOption = 'all' | 'included' | 'auto-excluded' | 'manually-excluded' | 'overridden';

export interface VMRow {
  id: string;
  vmName: string;
  cluster: string;
  powerState: string;
  cpus: number;
  memoryGiB: number;
  storageGiB: number;
  guestOS: string;
  // Category info
  category: string;       // category key or '_custom' or '_unclassified'
  categoryName: string;   // display name
  categorySource: 'user' | 'maintainer' | 'ai' | 'name' | 'annotation' | 'none';
  matchedPattern: string;
  // Exclusion info
  isAutoExcluded: boolean;
  autoExclusionLabels: string[];
  isForceIncluded: boolean;
  isManuallyExcluded: boolean;
  isEffectivelyExcluded: boolean;
  exclusionSource: 'auto' | 'manual' | 'none';
  hasNotes: boolean;
  notes: string;
}

// ===== CONSTANTS =====

export const FILTER_OPTIONS: Array<{ id: FilterOption; text: string }> = [
  { id: 'all', text: 'All VMs' },
  { id: 'included', text: 'Included' },
  { id: 'auto-excluded', text: 'Auto-Excluded' },
  { id: 'manually-excluded', text: 'Manually Excluded' },
  { id: 'overridden', text: 'Overridden' },
];

// ===== HELPERS =====

export function getWorkloadCategories(): Array<{ id: string; text: string }> {
  const categories = workloadPatterns.categories as Record<string, { name: string; patterns: string[] }>;
  const items = Object.entries(categories).map(([key, cat]) => ({
    id: key,
    text: cat.name,
  }));
  items.unshift({ id: 'unclassified', text: 'Unclassified' });
  return items;
}

export function getActionText(row: VMRow): string {
  if (row.isAutoExcluded && !row.isForceIncluded) return 'Include in Migration';
  if (row.isForceIncluded) return 'Revert to Auto-Excluded';
  if (row.isManuallyExcluded) return 'Include in Migration';
  return 'Exclude from Migration';
}
