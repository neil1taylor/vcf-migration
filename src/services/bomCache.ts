// BOM data cache — stores cost estimation data in localStorage so Export page can generate BOMs
// without requiring the user to re-do sizing on migration pages

import type { CostEstimate, RegionCode, DiscountType } from '@/services/costEstimation';
import type { VMDetail, ROKSNodeDetail } from '@/services/export';

const STORAGE_KEY = 'vcf-bom-cache';

interface BOMCacheEntry {
  estimate: CostEstimate;
  vmDetails?: VMDetail[];
  roksNodeDetails?: ROKSNodeDetail[];
  region?: RegionCode;
  discountType?: DiscountType;
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
): void {
  const existing = readCache();
  existing[type] = {
    estimate,
    vmDetails,
    roksNodeDetails,
    region,
    discountType,
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
