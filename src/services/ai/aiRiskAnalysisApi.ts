// AI Risk Analysis API client

import { createLogger } from '@/utils/logger';
import { isAIProxyConfigured } from './aiProxyClient';
import type { RiskAnalysisInput, RiskAnalysisResult } from './types';

const logger = createLogger('AI Risk Analysis');

/**
 * Fetch AI-enhanced risk analysis
 */
export async function fetchAIRiskAnalysis(
  input: RiskAnalysisInput
): Promise<RiskAnalysisResult | null> {
  if (!isAIProxyConfigured()) {
    logger.info('AI proxy not configured, skipping risk analysis');
    return null;
  }

  logger.info('Fetching AI risk analysis');
  const AI_PROXY_URL = import.meta.env.VITE_AI_PROXY_URL as string;

  try {
    const response = await fetch(`${AI_PROXY_URL}/api/risk-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ data: input }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      throw new Error(`Risk analysis failed: ${response.status}`);
    }

    const data = await response.json();
    const result: RiskAnalysisResult = {
      severityAdjustments: data.result?.severityAdjustments || data.result?.severity_adjustments || [],
      missedRisks: data.result?.missedRisks || data.result?.missed_risks || [],
      securityRisks: data.result?.securityRisks || data.result?.security_risks || [],
      goNoGoAnalysis: data.result?.goNoGoAnalysis || data.result?.go_no_go_analysis || {
        recommendation: 'conditional',
        confidence: 0.5,
        reasoning: 'Unable to determine',
        keyConditions: [],
      },
      source: 'watsonx',
    };

    logger.info('AI risk analysis complete');
    return result;
  } catch (error) {
    logger.error('AI risk analysis failed', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}
