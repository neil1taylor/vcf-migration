// BOM data cache — stores cost estimation data in localStorage so Export page can generate BOMs
// without requiring the user to re-do sizing on migration pages

import type { CostEstimate, RegionCode, DiscountType, RoksSolutionType } from '@/services/costEstimation';
import type { VMDetail, ROKSNodeDetail } from '@/services/export';
import type { ROKSSizing, VSIMapping } from '@/types/exportSizing';

const STORAGE_KEY = 'vcf-bom-cache';

interface BOMCacheEntry {
  estimate: CostEstimate;
  vmDetails?: VMDetail[];
  roksNodeDetails?: ROKSNodeDetail[];
  region?: RegionCode;
  discountType?: DiscountType;
  solutionType?: RoksSolutionType;
  /** ROKS aggregate sizing summary — computed by the sizing calculator on the ROKS page */
  roksSizingSummary?: ROKSSizing;
  /** Per-VM VSI profile mapping with costs — computed by the VSI page */
  vsiMappingSummary?: VSIMapping[];
  cachedAt: string;
}

interface BOMCache {
  vsi?: BOMCacheEntry;
  roks?: BOMCacheEntry;
}

export function cacheBOMData(
  type: 'vsi' | 'roks',
  estimate: CostEstimate,
  vmDetails?: VMDetail[],
  roksNodeDetails?: ROKSNodeDetail[],
  region?: RegionCode,
  discountType?: DiscountType,
  solutionType?: RoksSolutionType,
  roksSizingSummary?: ROKSSizing,
  vsiMappingSummary?: VSIMapping[],
): void {
  const existing = readCache();
  existing[type] = {
    estimate,
    vmDetails,
    roksNodeDetails,
    region,
    discountType,
    solutionType,
    roksSizingSummary,
    vsiMappingSummary,
    cachedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function getCachedBOM(type: 'vsi' | 'roks'): BOMCacheEntry | null {
  return readCache()[type] ?? null;
}

export function hasCachedBOM(type: 'vsi' | 'roks'): boolean {
  return !!readCache()[type];
}

function readCache(): BOMCache {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as BOMCache;
  } catch {
    return {};
  }
}
