import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCachedTargetSelections,
  setCachedTargetSelections,
  isTargetSelectionCacheValid,
  clearTargetSelectionCache,
} from './aiTargetSelectionCache';
import type { TargetSelectionResult } from './types';

describe('aiTargetSelectionCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const fingerprint = 'test-env-123';

  const selections: TargetSelectionResult[] = [
    {
      vmName: 'vm1',
      target: 'roks',
      confidence: 0.85,
      reasoning: 'Linux with middleware workload',
      alternativeTarget: 'vsi',
      alternativeReasoning: 'Could also work as VSI',
      source: 'ai',
    },
  ];

  it('returns null when no cache exists', () => {
    expect(getCachedTargetSelections()).toBeNull();
  });

  it('stores and retrieves selections', () => {
    setCachedTargetSelections(selections, fingerprint);
    const result = getCachedTargetSelections();
    expect(result).not.toBeNull();
    expect(result!.selections['vm1'].target).toBe('roks');
  });

  it('validates cache against fingerprint', () => {
    setCachedTargetSelections(selections, fingerprint);
    expect(isTargetSelectionCacheValid(fingerprint)).toBe(true);
    expect(isTargetSelectionCacheValid('other-env')).toBe(false);
  });

  it('clears cache', () => {
    setCachedTargetSelections(selections, fingerprint);
    clearTargetSelectionCache();
    expect(getCachedTargetSelections()).toBeNull();
  });
});
