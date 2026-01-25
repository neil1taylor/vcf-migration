// IBM Cloud Global Catalog API client for fetching pricing data
// Uses Code Engine proxy only - no direct browser API access

import { withRetry } from '@/utils/retry';
import { createLogger, parseApiError, getUserFriendlyMessage } from '@/utils/logger';
import { deduplicate } from '@/utils/requestDeduplication';

const logger = createLogger('Pricing API');

// ===== CONSTANTS =====

const DEFAULT_TIMEOUT = 30000; // 30 seconds

// Pricing proxy URL (IBM Code Engine)
const PRICING_PROXY_URL = import.meta.env.VITE_PRICING_PROXY_URL as string | undefined;

// ===== HELPER FUNCTIONS =====

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ===== PROXY TYPES =====

/**
 * Pricing data structure returned by the proxy
 */
export interface ProxyPricingResponse {
  version: string;
  lastUpdated: string;
  source: string;
  cached: boolean;
  cacheAge?: number;
  stale?: boolean;
  error?: string;
  regions: Record<string, { name: string; multiplier: number }>;
  discountOptions: Record<string, { name: string; discountPct: number }>;
  vsiProfiles: Record<string, { vcpus: number; memoryGiB: number; hourlyRate: number }>;
  blockStorage: {
    generalPurpose: { costPerGBMonth: number; iopsPerGB: number };
    custom: { costPerGBMonth: number; costPerIOPS: number };
    tiers: Record<string, { costPerGBMonth: number; iopsPerGB: number }>;
  };
  bareMetal: Record<string, { vcpus: number; memoryGiB: number; storageGiB: number; monthlyRate: number }>;
  roks: { clusterManagementFee: number; workerNodeMarkup: number };
  odf: { perTBMonth: number; minimumTB: number };
  networking: {
    loadBalancer: { perLBMonthly: number; perGBProcessed: number };
    floatingIP: { monthlyRate: number };
    vpnGateway: { monthlyRate: number };
  };
}

// ===== PROXY FUNCTIONS =====

/**
 * Check if pricing proxy is configured
 */
export function isProxyConfigured(): boolean {
  return !!PRICING_PROXY_URL;
}

/**
 * Get the proxy URL
 */
export function getProxyUrl(): string | undefined {
  return PRICING_PROXY_URL;
}

/**
 * Fetch pricing data from the Code Engine proxy
 * This is the only method available - keeps API credentials server-side
 */
export async function fetchFromProxy(
  options?: { refresh?: boolean; timeout?: number }
): Promise<ProxyPricingResponse> {
  if (!PRICING_PROXY_URL) {
    throw new Error('Pricing proxy URL not configured. Set VITE_PRICING_PROXY_URL environment variable.');
  }

  const url = new URL(PRICING_PROXY_URL);
  if (options?.refresh) {
    url.searchParams.set('refresh', 'true');
  }

  const timeout = options?.timeout || DEFAULT_TIMEOUT;

  logger.info('Fetching from proxy');

  return withRetry(
    async () => {
      const response = await fetchWithTimeout(
        url.toString(),
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        },
        timeout
      );

      if (!response.ok) {
        const apiError = await parseApiError(response, 'Proxy request');
        throw new Error(apiError.message);
      }

      const data = await response.json();

      logger.info('Proxy response received', {
        cached: data.cached,
        cacheAge: data.cacheAge,
        source: data.source,
        vsiProfiles: Object.keys(data.vsiProfiles || {}).length,
      });

      return data;
    },
    {
      maxRetries: 2,
      initialDelayMs: 1000,
      onRetry: (error, attempt, delayMs) => {
        logger.warn(`Proxy fetch failed, retrying (attempt ${attempt})`, {
          error: error.message,
          delayMs,
        });
      },
    }
  );
}

/**
 * Test proxy connectivity
 * Returns { success: boolean, error?: string, cancelled?: boolean }
 * cancelled is true when the request was aborted (e.g., React StrictMode cleanup)
 */
export async function testProxyConnection(): Promise<{ success: boolean; error?: string; cancelled?: boolean }> {
  if (!PRICING_PROXY_URL) {
    logger.info('Proxy not configured');
    return { success: false, error: 'Proxy URL not configured' };
  }

  logger.info('Testing proxy connectivity...');

  try {
    const data = await fetchFromProxy({ timeout: 10000 });
    const isAvailable = !!data.vsiProfiles && Object.keys(data.vsiProfiles).length > 0;
    logger.info(`Proxy test result: ${isAvailable ? 'SUCCESS' : 'NO DATA'}`);
    return { success: isAvailable };
  } catch (error) {
    // Handle AbortError specially - this happens during React StrictMode cleanup
    // and should not be treated as a real connectivity failure
    if (error instanceof Error && error.name === 'AbortError') {
      logger.debug('Proxy test cancelled (AbortError)');
      return { success: false, cancelled: true };
    }
    const message = getUserFriendlyMessage(error instanceof Error ? error : new Error(String(error)));
    logger.error('Proxy test FAILED', error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: message };
  }
}

// ===== DEDUPLICATED EXPORTS =====

/**
 * Deduplicated version of fetchFromProxy.
 * If called multiple times concurrently with the same options, only one API request is made.
 */
export const fetchFromProxyDeduped = deduplicate(
  fetchFromProxy,
  'fetchFromProxy'
);
