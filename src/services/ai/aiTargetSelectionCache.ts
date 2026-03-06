// AI target selection cache — localStorage persistence

import type { TargetSelectionResult } from './types';

export interface CachedTargetSelections {
  selections: Record<string, TargetSelectionResult>;
  environmentFingerprint: string;
  lastUpdated: string;
  expiresAt: string;
}

const CACHE_KEY = 'vcf-ai-target-selections';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getCachedTargetSelections(): CachedTargetSelections | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as CachedTargetSelections;
    if (!parsed.selections || typeof parsed.selections !== 'object') {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

export function setCachedTargetSelections(
  selections: TargetSelectionResult[],
  environmentFingerprint: string
): void {
  try {
    const now = new Date();
    const selectionMap: Record<string, TargetSelectionResult> = {};
    for (const s of selections) {
      selectionMap[s.vmName] = s;
    }
    const cached: CachedTargetSelections = {
      selections: selectionMap,
      environmentFingerprint,
      lastUpdated: now.toISOString(),
      expiresAt: new Date(now.getTime() + CACHE_DURATION_MS).toISOString(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Silently fail
  }
}

export function isTargetSelectionCacheValid(environmentFingerprint: string): boolean {
  const cached = getCachedTargetSelections();
  if (!cached) return false;
  if (cached.environmentFingerprint !== environmentFingerprint) return false;
  return new Date() <= new Date(cached.expiresAt);
}

export function clearTargetSelectionCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Silently fail
  }
}
