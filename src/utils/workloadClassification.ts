// Shared workload classification utility
// Extracts pattern-matching logic from DiscoveryPage for reuse in storage tier assignment

import workloadPatterns from '@/data/workloadPatterns.json';

export type StorageTierType = 'general-purpose' | '5iops' | '10iops';

type CategoryDef = {
  name: string;
  icon: string;
  defaultStorageTier?: string;
  patterns: string[];
};

const categories = workloadPatterns.categories as Record<string, CategoryDef>;

/**
 * Detect a VM's workload category from its name and optional annotation.
 * Returns the category key (e.g., 'databases', 'middleware') or null if unclassified.
 */
export function getVMWorkloadCategory(vmName: string, annotation?: string | null): string | null {
  const vmNameLower = vmName.toLowerCase();
  const annotationLower = (annotation || '').toLowerCase();

  for (const [categoryKey, category] of Object.entries(categories)) {
    for (const pattern of category.patterns) {
      if (vmNameLower.includes(pattern) || annotationLower.includes(pattern)) {
        return categoryKey;
      }
    }
  }

  return null;
}

/**
 * Look up the default storage tier for a workload category.
 * Returns 'general-purpose' for unknown/null categories.
 */
export function getStorageTierForWorkload(categoryKey: string | null): StorageTierType {
  if (!categoryKey) return 'general-purpose';

  const category = categories[categoryKey];
  if (!category?.defaultStorageTier) return 'general-purpose';

  const tier = category.defaultStorageTier;
  if (tier === '5iops' || tier === '10iops' || tier === 'general-purpose') {
    return tier;
  }

  return 'general-purpose';
}

/**
 * Get the category display name for a category key.
 */
export function getCategoryDisplayName(categoryKey: string | null): string | null {
  if (!categoryKey) return null;
  return categories[categoryKey]?.name ?? null;
}

/** Short human-readable label for a storage tier */
export function getStorageTierLabel(tier: StorageTierType): string {
  switch (tier) {
    case '10iops': return 'High Performance';
    case '5iops': return 'Performance';
    case 'general-purpose': return 'Standard';
  }
}

/** Map a storage tier to the corresponding NFS dp2 IOPS value */
export function getNfsIopsForTier(tier: StorageTierType): 500 | 1000 | 3000 {
  switch (tier) {
    case '10iops': return 3000;
    case '5iops': return 1000;
    case 'general-purpose': return 500;
  }
}
