// Dynamic pricing hook - manages pricing data with proxy refresh capability

import { useState, useEffect, useCallback } from 'react';
import type { IBMCloudPricing, PricingSource } from '@/services/pricing/pricingCache';
import {
  getCurrentPricing,
  setCachedPricing,
  isCacheExpired,
  clearPricingCache,
  getStaticPricing,
} from '@/services/pricing/pricingCache';
import {
  isProxyConfigured,
  fetchFromProxy,
  testProxyConnection,
} from '@/services/pricing/globalCatalogApi';
import { transformProxyToAppPricing } from '@/services/pricing/pricingTransformer';

export interface UseDynamicPricingConfig {
  autoRefreshOnExpiry?: boolean;
}

export interface UseDynamicPricingReturn {
  pricing: IBMCloudPricing;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  source: PricingSource;
  refreshPricing: () => Promise<void>;
  clearCache: () => void;
  isApiAvailable: boolean | null;
}

/**
 * Hook for managing dynamic pricing with proxy refresh capability
 */
export function useDynamicPricing(
  config?: UseDynamicPricingConfig
): UseDynamicPricingReturn {
  const [pricing, setPricing] = useState<IBMCloudPricing>(() => {
    const current = getCurrentPricing();
    return current.data;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    const current = getCurrentPricing();
    return current.lastUpdated;
  });
  const [source, setSource] = useState<PricingSource>(() => {
    const current = getCurrentPricing();
    return current.source;
  });
  const [isApiAvailable, setIsApiAvailable] = useState<boolean | null>(null);

  /**
   * Fetch fresh pricing from proxy
   */
  const fetchPricing = useCallback(async () => {
    console.log('[Dynamic Pricing] Starting pricing fetch...');

    if (!isProxyConfigured()) {
      console.log('[Dynamic Pricing] No proxy configured, using static data');
      return false;
    }

    console.log('[Dynamic Pricing] Proxy configured, fetching from proxy...');
    try {
      const proxyData = await fetchFromProxy({ timeout: 30000 });

      // Check if we got valid data
      if (proxyData.vsiProfiles && Object.keys(proxyData.vsiProfiles).length > 0) {
        // Transform proxy response to app format
        const transformedPricing = transformProxyToAppPricing(proxyData);

        console.log('[Dynamic Pricing] Proxy data received:', {
          vsiProfiles: Object.keys(transformedPricing.vsi).length,
          cached: proxyData.cached,
          source: proxyData.source,
        });

        // Cache the transformed data
        setCachedPricing(transformedPricing, 'proxy');

        // Update state
        setPricing(transformedPricing);
        setLastUpdated(new Date(proxyData.lastUpdated));
        setSource('proxy');
        setIsApiAvailable(true);
        setError(null);

        console.log('[Dynamic Pricing] Successfully updated from PROXY');
        return true;
      }

      console.warn('[Dynamic Pricing] Proxy returned no data');
      return false;
    } catch (proxyError) {
      const errorMessage = proxyError instanceof Error ? proxyError.message : 'Failed to fetch pricing';
      console.warn('[Dynamic Pricing] Proxy fetch failed:', errorMessage);
      setError(errorMessage);
      setIsApiAvailable(false);
      return false;
    }
  }, []);

  /**
   * Manual refresh pricing data
   */
  const refreshPricing = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    const success = await fetchPricing();

    if (!success) {
      // Fallback to static data
      const staticData = getStaticPricing();
      setPricing(staticData);
      setSource('static');
    }

    setIsRefreshing(false);
  }, [fetchPricing]);

  /**
   * Clear the pricing cache
   */
  const clearCache = useCallback(() => {
    clearPricingCache();
    const staticData = getStaticPricing();
    setPricing(staticData);
    setSource('static');
    setLastUpdated(null);
    setError(null);
  }, []);

  // Initial load - check cache and optionally refresh
  useEffect(() => {
    const initializePricing = async () => {
      console.log('[Dynamic Pricing] Initializing pricing system...');
      setIsLoading(true);

      // Check current cached data
      const current = getCurrentPricing();
      setPricing(current.data);
      setLastUpdated(current.lastUpdated);
      setSource(current.source);

      console.log('[Dynamic Pricing] Current pricing state:', {
        source: current.source,
        lastUpdated: current.lastUpdated?.toISOString() || 'never',
        cacheExpired: isCacheExpired(),
      });

      // Test proxy connectivity
      let apiAvailable = false;
      if (isProxyConfigured()) {
        console.log('[Dynamic Pricing] Testing proxy connectivity...');
        const proxyResult = await testProxyConnection();

        // If the request was cancelled (React StrictMode cleanup), don't update state
        if (proxyResult.cancelled) {
          console.log('[Dynamic Pricing] Proxy test cancelled, skipping state update');
          return;
        }

        apiAvailable = proxyResult.success;
        if (apiAvailable) {
          console.log('[Dynamic Pricing] Proxy available');
        } else {
          console.log('[Dynamic Pricing] Proxy not available:', proxyResult.error);
        }
      } else {
        console.log('[Dynamic Pricing] No proxy configured, using static data');
      }
      setIsApiAvailable(apiAvailable);

      console.log('[Dynamic Pricing] Proxy availability:', apiAvailable);

      // If cache is expired and auto-refresh is enabled, fetch fresh data
      if (config?.autoRefreshOnExpiry !== false && isCacheExpired() && apiAvailable) {
        console.log('[Dynamic Pricing] Cache expired and proxy available, fetching fresh data...');
        const success = await fetchPricing();
        if (!success) {
          // Keep using cached/static data
          console.log('[Dynamic Pricing] Fetch failed, keeping current source:', current.source);
          setSource(current.source);
        }
      } else if (!apiAvailable) {
        console.log('[Dynamic Pricing] Proxy not available, using', current.source, 'data');
      } else {
        console.log('[Dynamic Pricing] Using cached data (not expired)');
      }

      setIsLoading(false);
    };

    initializePricing();
  }, [config?.autoRefreshOnExpiry, fetchPricing]);

  return {
    pricing,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    source,
    refreshPricing,
    clearCache,
    isApiAvailable,
  };
}

export default useDynamicPricing;
