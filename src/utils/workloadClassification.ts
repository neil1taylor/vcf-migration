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

/** Escape special regex characters in a string */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Pre-compiled word-boundary regexes for each category (built once at module load) */
const compiledCategories = Object.entries(categories).map(([key, cat]) => ({
  key,
  patterns: cat.patterns.map(p => new RegExp(`\\b${escapeRegExp(p)}\\b`, 'i')),
}));

/**
 * Detect a VM's workload category from its name and optional annotation.
 * Returns the category key (e.g., 'databases', 'middleware') or null if unclassified.
 * Uses word-boundary matching to avoid false positives from short patterns.
 */
export function getVMWorkloadCategory(vmName: string, annotation?: string | null): string | null {
  const text = annotation ? `${vmName} ${annotation}` : vmName;

  for (const { key, patterns } of compiledCategories) {
    for (const re of patterns) {
      if (re.test(text)) return key;
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
