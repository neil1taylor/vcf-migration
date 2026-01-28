// AI Insights API client

import { createLogger } from '@/utils/logger';
import { isAIProxyConfigured, getMigrationInsights } from './aiProxyClient';
import type { InsightsInput, MigrationInsights, InsightsRequest } from './types';

const logger = createLogger('AI Insights');

/**
 * Fetch AI-generated migration insights
 */
export async function fetchAIInsights(
  data: InsightsInput
): Promise<MigrationInsights | null> {
  if (!isAIProxyConfigured()) {
    logger.info('AI proxy not configured, skipping insights');
    return null;
  }

  logger.info('Fetching AI migration insights');

  try {
    const request: InsightsRequest = { data };
    const response = await getMigrationInsights(request, { timeout: 60000 });

    logger.info(`Received insights in ${response.processingTimeMs}ms`);
    return response.insights;
  } catch (error) {
    logger.error(
      'AI insights failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return null;
  }
}
