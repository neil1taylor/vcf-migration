// AI Target Selection API client

import { createLogger } from '@/utils/logger';
import { isAIProxyConfigured } from './aiProxyClient';
import { getCachedTargetSelections, setCachedTargetSelections, isTargetSelectionCacheValid } from './aiTargetSelectionCache';
import type { TargetSelectionInput, TargetSelectionResult } from './types';

const logger = createLogger('AI Target Selection');

/**
 * Fetch AI target selections with caching
 */
export async function fetchAITargetSelections(
  vms: TargetSelectionInput[],
  environmentFingerprint: string,
  onProgress?: (completed: number, total: number) => void
): Promise<TargetSelectionResult[]> {
  if (!isAIProxyConfigured()) {
    logger.info('AI proxy not configured, skipping target selection');
    return [];
  }

  if (isTargetSelectionCacheValid(environmentFingerprint)) {
    const cached = getCachedTargetSelections();
    if (cached) {
      const results = Object.values(cached.selections);
      logger.info(`Returning ${results.length} cached target selections`);
      return results;
    }
  }

  logger.info(`Selecting targets for ${vms.length} VMs via AI proxy`);
  const AI_PROXY_URL = import.meta.env.VITE_AI_PROXY_URL as string;

  try {
    const response = await fetch(`${AI_PROXY_URL}/api/target-selection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ vms }),
      signal: AbortSignal.timeout(300000),
    });

    if (!response.ok) {
      throw new Error(`Target selection failed: ${response.status}`);
    }

    const data = await response.json();
    const selections: TargetSelectionResult[] = data.selections || [];

    logger.info(`Received ${selections.length} target selections in ${data.processingTimeMs}ms`);
    setCachedTargetSelections(selections, environmentFingerprint);

    if (onProgress) onProgress(selections.length, vms.length);
    return selections;
  } catch (error) {
    logger.error('AI target selection failed', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}
