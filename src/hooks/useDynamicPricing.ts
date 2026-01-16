// Dynamic pricing hook - manages pricing data with API refresh capability

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
  fetchAllCatalogPricing,
  testApiConnection,
  isProxyConfigured,
  fetchFromProxy,
  testProxyConnection,
} from '@/services/pricing/globalCatalogApi';
import { transformCatalogToAppPricing, transformProxyToAppPricing } from '@/services/pricing/pricingTransformer';

export interface UseDynamicPricingConfig {
  apiKey?: string;
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
 * Hook for managing dynamic pricing with API refresh capability
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
   * Fetch fresh pricing from proxy (preferred) or direct API
   */
  const fetchPricing = useCallback(async () => {
    console.log('[Dynamic Pricing] Starting pricing fetch...');

    // Try proxy first if configured (keeps credentials server-side)
    if (isProxyConfigured()) {
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
      } catch (proxyError) {
        console.warn('[Dynamic Pricing] Proxy fetch failed, trying direct API:', proxyError);
      }
    }

    // Fall back to direct API if proxy not configured or failed
    try {
      // Fetch from Global Catalog API
      const catalogData = await fetchAllCatalogPricing({
        apiKey: config?.apiKey,
        timeout: 30000,
      });

      // Check if we got any data
      const hasVsiData = catalogData.vsi.length > 0;
      const hasBareMetalData = catalogData.bareMetal.length > 0;
      const hasBlockStorageData = catalogData.blockStorage.length > 0;

      console.log('[Dynamic Pricing] Data received:', {
        hasVsiData,
        hasBareMetalData,
        hasBlockStorageData,
      });

      if (!hasVsiData && !hasBareMetalData && !hasBlockStorageData) {
        // API returned no data, use static fallback
        console.warn('[Dynamic Pricing] API returned no pricing data, falling back to static');
        throw new Error('API returned no pricing data');
      }

      // Transform to app format
      const transformedPricing = transformCatalogToAppPricing(catalogData);
      console.log('[Dynamic Pricing] Transformed pricing:', {
        vsiProfiles: Object.keys(transformedPricing.vsi).length,
        bareMetalProfiles: Object.keys(transformedPricing.bareMetal).length,
        blockStorageTiers: Object.keys(transformedPricing.blockStorage).length,
      });

      // Cache the transformed data
      setCachedPricing(transformedPricing, 'api');

      // Update state
      setPricing(transformedPricing);
      setLastUpdated(new Date());
      setSource('api');
      setIsApiAvailable(true);
      setError(null);

      console.log('[Dynamic Pricing] Successfully updated to LIVE API pricing');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch pricing';

      // Check if it's a CORS or network error
      if (errorMessage.includes('CORS') || errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
        console.warn('[Dynamic Pricing] API not available (possibly CORS). Using static data.');
        console.info('[Dynamic Pricing] The Global Catalog API may not support CORS from browser origins.');
        setIsApiAvailable(false);
      } else {
        console.warn('[Dynamic Pricing] Fetch error:', errorMessage);
      }

      setError(errorMessage);
      return false;
    }
  }, [config?.apiKey]);

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

      // Test connectivity - prefer proxy, fall back to direct API
      let apiAvailable = false;
      if (isProxyConfigured()) {
        console.log('[Dynamic Pricing] Testing proxy connectivity...');
        const proxyResult = await testProxyConnection();
        apiAvailable = proxyResult.success;
        if (apiAvailable) {
          console.log('[Dynamic Pricing] Proxy available');
        } else {
          console.log('[Dynamic Pricing] Proxy not available, testing direct API...');
          const apiResult = await testApiConnection({ apiKey: config?.apiKey });
          apiAvailable = apiResult.success;
        }
      } else {
        console.log('[Dynamic Pricing] No proxy configured, testing direct API...');
        const apiResult = await testApiConnection({ apiKey: config?.apiKey });
        apiAvailable = apiResult.success;
      }
      setIsApiAvailable(apiAvailable);

      console.log('[Dynamic Pricing] API/Proxy availability:', apiAvailable);

      // If cache is expired and auto-refresh is enabled, fetch fresh data
      if (config?.autoRefreshOnExpiry !== false && isCacheExpired() && apiAvailable) {
        console.log('[Dynamic Pricing] Cache expired and API available, fetching fresh data...');
        const success = await fetchPricing();
        if (!success) {
          // Keep using cached/static data
          console.log('[Dynamic Pricing] Fetch failed, keeping current source:', current.source);
          setSource(current.source);
        }
      } else if (!apiAvailable) {
        console.log('[Dynamic Pricing] API not available, using', current.source, 'data');
      } else {
        console.log('[Dynamic Pricing] Using cached data (not expired)');
      }

      setIsLoading(false);
    };

    initializePricing();
  }, [config?.apiKey, config?.autoRefreshOnExpiry, fetchPricing]);

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
