// AI Anomaly Detection API client

import { createLogger } from '@/utils/logger';
import { isAIProxyConfigured } from './aiProxyClient';
import type { AnomalyDetectionInput, AnomalyDetectionResult, AnomalyResult } from './types';

const logger = createLogger('AI Anomaly Detection');

const CACHE_KEY = 'vcf-ai-anomalies';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

interface CachedAnomalies {
  anomalies: AnomalyResult[];
  environmentHash: string;
  expiresAt: string;
}

function getCached(hash: string): AnomalyResult[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAnomalies;
    if (parsed.environmentHash !== hash) return null;
    if (new Date() > new Date(parsed.expiresAt)) return null;
    return parsed.anomalies;
  } catch {
    return null;
  }
}

function setCache(anomalies: AnomalyResult[], hash: string): void {
  try {
    const cached: CachedAnomalies = {
      anomalies,
      environmentHash: hash,
      expiresAt: new Date(Date.now() + CACHE_DURATION_MS).toISOString(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Silently fail
  }
}

/**
 * Send pre-computed anomaly candidates to AI for analysis
 */
export async function fetchAIAnomalyAnalysis(
  input: AnomalyDetectionInput,
  environmentHash: string
): Promise<AnomalyDetectionResult | null> {
  if (!isAIProxyConfigured()) {
    logger.info('AI proxy not configured, skipping anomaly analysis');
    return null;
  }

  const cached = getCached(environmentHash);
  if (cached) {
    logger.info(`Returning ${cached.length} cached anomalies`);
    return { anomalies: cached, source: 'cached' };
  }

  logger.info(`Analyzing ${input.anomalyCandidates.length} anomaly candidates via AI`);
  const AI_PROXY_URL = import.meta.env.VITE_AI_PROXY_URL as string;

  try {
    const response = await fetch(`${AI_PROXY_URL}/api/anomaly-detection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ data: input }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      throw new Error(`Anomaly detection failed: ${response.status}`);
    }

    const data = await response.json();
    const result: AnomalyDetectionResult = {
      anomalies: (data.result?.anomalies || []).filter((a: AnomalyResult) => a.isValid !== false),
      source: 'watsonx',
    };

    setCache(result.anomalies, environmentHash);
    logger.info(`Received ${result.anomalies.length} validated anomalies`);
    return result;
  } catch (error) {
    logger.error('AI anomaly detection failed', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

export function clearAnomalyCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Silently fail
  }
}
