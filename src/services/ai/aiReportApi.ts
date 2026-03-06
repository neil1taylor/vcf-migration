// AI Report Narrative API client

import { createLogger } from '@/utils/logger';
import { isAIProxyConfigured } from './aiProxyClient';
import type { ReportInput, ReportNarrativeResult } from './types';

const logger = createLogger('AI Report');

/**
 * Fetch AI-generated report narratives
 */
export async function fetchAIReportNarrative(
  input: ReportInput
): Promise<ReportNarrativeResult | null> {
  if (!isAIProxyConfigured()) {
    logger.info('AI proxy not configured, skipping report narrative');
    return null;
  }

  logger.info('Generating AI report narratives');
  const AI_PROXY_URL = import.meta.env.VITE_AI_PROXY_URL as string;

  try {
    const response = await fetch(`${AI_PROXY_URL}/api/report-narrative`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ data: input }),
      signal: AbortSignal.timeout(180000),
    });

    if (!response.ok) {
      throw new Error(`Report narrative failed: ${response.status}`);
    }

    const data = await response.json();
    const r = data.result || {};

    const result: ReportNarrativeResult = {
      executiveSummary: r.executiveSummary || r.executive_summary || '',
      environmentAnalysis: r.environmentAnalysis || r.environment_analysis || '',
      migrationRecommendation: r.migrationRecommendation || r.migration_recommendation || '',
      riskNarrative: r.riskNarrative || r.risk_narrative || '',
      costJustification: r.costJustification || r.cost_justification || '',
      nextSteps: r.nextSteps || r.next_steps || [],
      assumptions: r.assumptions || [],
      source: 'watsonx',
    };

    logger.info('AI report narratives generated');
    return result;
  } catch (error) {
    logger.error('AI report narrative failed', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}
