// Dynamic profiles hook - manages IBM Cloud profiles with proxy refresh capability

import { useState, useEffect, useCallback } from 'react';
import type { IBMCloudProfiles, ProfilesSource, VSIProfilesByFamily, BareMetalProfilesByFamily } from '@/services/profiles/profilesCache';
import {
  getCurrentProfiles,
  setCachedProfiles,
  isProfilesCacheExpired,
  clearProfilesCache,
  getStaticProfiles,
  countProfiles,
} from '@/services/profiles/profilesCache';
import {
  isProfilesProxyConfigured,
  fetchFromProfilesProxy,
  testProfilesProxyConnection,
  type ProxyProfilesResponse,
} from '@/services/ibmCloudProfilesApi';

export interface UseDynamicProfilesConfig {
  region?: string;
  zone?: string;
  autoRefreshOnExpiry?: boolean;
}

export interface UseDynamicProfilesReturn {
  profiles: IBMCloudProfiles;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  source: ProfilesSource;
  refreshProfiles: () => Promise<void>;
  clearCache: () => void;
  isApiAvailable: boolean | null;
  profileCounts: { vsi: number; bareMetal: number };
}

/**
 * Hook for managing dynamic IBM Cloud profiles with proxy refresh capability
 */
export function useDynamicProfiles(
  config?: UseDynamicProfilesConfig
): UseDynamicProfilesReturn {
  const region = config?.region || 'us-south';
  const zone = config?.zone || `${region}-1`;

  const [profiles, setProfiles] = useState<IBMCloudProfiles>(() => {
    const current = getCurrentProfiles();
    return current.data;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    const current = getCurrentProfiles();
    return current.lastUpdated;
  });
  const [source, setSource] = useState<ProfilesSource>(() => {
    const current = getCurrentProfiles();
    return current.source;
  });
  const [isApiAvailable, setIsApiAvailable] = useState<boolean | null>(null);

  /**
   * Fetch fresh profiles from proxy
   */
  const fetchProfiles = useCallback(async () => {
    console.log('[Dynamic Profiles] Starting profiles fetch...', { region, zone });

    if (!isProfilesProxyConfigured()) {
      console.log('[Dynamic Profiles] No proxy configured, using static data');
      return false;
    }

    console.log('[Dynamic Profiles] Proxy configured, fetching from proxy...');
    try {
      const proxyData = await fetchFromProfilesProxy({ region, zone });
      console.log('[Dynamic Profiles] Proxy data received:', {
        vsiProfiles: proxyData.counts?.vsi || proxyData.vsiProfiles?.length || 0,
        bareMetalProfiles: proxyData.counts?.bareMetal || proxyData.bareMetalProfiles?.length || 0,
        cached: proxyData.cached,
        source: proxyData.source,
      });

      // Transform proxy response to IBMCloudProfiles format
      const newProfiles = transformProxyResponse(proxyData, region, zone);

      // Cache the data
      setCachedProfiles(newProfiles, 'proxy');

      // Update state
      setProfiles(newProfiles);
      setLastUpdated(new Date());
      setSource('proxy');
      setIsApiAvailable(true);
      setError(null);

      const counts = countProfiles(newProfiles);
      console.log('[Dynamic Profiles] Successfully updated from PROXY:', counts);

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch profiles';
      console.warn('[Dynamic Profiles] Proxy fetch failed:', errorMessage);
      setError(errorMessage);
      setIsApiAvailable(false);
      return false;
    }
  }, [region, zone]);

  /**
   * Manual refresh profiles data
   */
  const refreshProfiles = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    const success = await fetchProfiles();

    if (!success) {
      // Fallback to static data
      const staticData = getStaticProfiles();
      setProfiles(staticData);
      setSource('static');
    }

    setIsRefreshing(false);
  }, [fetchProfiles]);

  /**
   * Clear the profiles cache
   */
  const clearCache = useCallback(() => {
    clearProfilesCache();
    const staticData = getStaticProfiles();
    setProfiles(staticData);
    setSource('static');
    setLastUpdated(null);
    setError(null);
  }, []);

  // Initial load - check cache and optionally refresh
  useEffect(() => {
    const initializeProfiles = async () => {
      console.log('[Dynamic Profiles] Initializing profiles system...');
      setIsLoading(true);

      // Check current cached data
      const current = getCurrentProfiles();
      setProfiles(current.data);
      setLastUpdated(current.lastUpdated);
      setSource(current.source);

      console.log('[Dynamic Profiles] Current profiles state:', {
        source: current.source,
        lastUpdated: current.lastUpdated?.toISOString() || 'never',
        cacheExpired: isProfilesCacheExpired(),
        counts: countProfiles(current.data),
      });

      // Check if proxy is configured
      if (!isProfilesProxyConfigured()) {
        console.log('[Dynamic Profiles] No proxy configured, using static data');
        setIsApiAvailable(false);
        setIsLoading(false);
        return;
      }

      // Test proxy connectivity
      console.log('[Dynamic Profiles] Testing proxy connectivity...');
      const connectionResult = await testProfilesProxyConnection();

      // If the request was cancelled (React StrictMode cleanup), don't update state
      if (connectionResult.cancelled) {
        console.log('[Dynamic Profiles] Proxy test cancelled, skipping state update');
        return;
      }

      const apiAvailable = connectionResult.success;
      setIsApiAvailable(apiAvailable);

      console.log('[Dynamic Profiles] Proxy availability:', apiAvailable);

      // If cache is expired and auto-refresh is enabled, fetch fresh data
      if (config?.autoRefreshOnExpiry !== false && isProfilesCacheExpired() && apiAvailable) {
        console.log('[Dynamic Profiles] Cache expired and proxy available, fetching fresh data...');
        const success = await fetchProfiles();
        if (!success) {
          console.log('[Dynamic Profiles] Fetch failed, keeping current source:', current.source);
          setSource(current.source);
        }
      } else if (!apiAvailable) {
        console.log('[Dynamic Profiles] Proxy not available, using', current.source, 'data');
      } else {
        console.log('[Dynamic Profiles] Using cached data (not expired)');
      }

      setIsLoading(false);
    };

    initializeProfiles();
  }, [config?.autoRefreshOnExpiry, region, fetchProfiles]);

  return {
    profiles,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    source,
    refreshProfiles,
    clearCache,
    isApiAvailable,
    profileCounts: countProfiles(profiles),
  };
}

/**
 * Transform proxy response to IBMCloudProfiles format
 */
function transformProxyResponse(
  proxyData: ProxyProfilesResponse,
  region: string,
  zone: string
): IBMCloudProfiles {
  // Group VSI profiles by family
  const vsiByFamily: VSIProfilesByFamily = {
    balanced: [],
    compute: [],
    memory: [],
    veryHighMemory: [],
    ultraHighMemory: [],
    gpu: [],
    other: [],
  };

  for (const profile of proxyData.vsiProfiles || []) {
    const familyKey = mapFamilyToKey(profile.family);
    if (vsiByFamily[familyKey]) {
      vsiByFamily[familyKey].push({
        name: profile.name,
        family: profile.family,
        vcpus: profile.vcpus,
        memoryGiB: profile.memoryGiB,
        bandwidthGbps: profile.bandwidthGbps,
      });
    }
  }

  // Group bare metal profiles by family
  const bareMetalByFamily: BareMetalProfilesByFamily = {
    balanced: [],
    compute: [],
    memory: [],
    veryHighMemory: [],
  };

  for (const profile of proxyData.bareMetalProfiles || []) {
    const familyKey = mapBareMetalFamilyToKey(profile.family);
    if (bareMetalByFamily[familyKey]) {
      bareMetalByFamily[familyKey].push({
        name: profile.name,
        family: profile.family,
        vcpus: profile.vcpus,
        physicalCores: profile.physicalCores,
        memoryGiB: profile.memoryGiB,
        bandwidthGbps: profile.bandwidthGbps,
        hasNvme: profile.hasNvme,
        nvmeDisks: profile.nvmeDisks,
        nvmeSizeGiB: profile.nvmeSizeGiB,
        totalNvmeGiB: profile.totalNvmeGiB,
        roksSupported: profile.roksSupported,
      });
    }
  }

  return {
    version: proxyData.version || new Date().toISOString().split('T')[0],
    vsiProfiles: vsiByFamily,
    bareMetalProfiles: bareMetalByFamily,
    region,
    zone,
  };
}

/**
 * Map VSI family name to key
 */
function mapFamilyToKey(family: string): keyof VSIProfilesByFamily {
  const familyLower = family.toLowerCase();
  if (familyLower.includes('balanced') || familyLower.startsWith('bx')) return 'balanced';
  if (familyLower.includes('compute') || familyLower.startsWith('cx')) return 'compute';
  if (familyLower.includes('memory') || familyLower.startsWith('mx')) return 'memory';
  if (familyLower.includes('very') || familyLower.startsWith('vx')) return 'veryHighMemory';
  if (familyLower.includes('ultra') || familyLower.startsWith('ux')) return 'ultraHighMemory';
  if (familyLower.includes('gpu') || familyLower.startsWith('gx')) return 'gpu';
  return 'other';
}

/**
 * Map bare metal family name to key
 */
function mapBareMetalFamilyToKey(family: string): keyof BareMetalProfilesByFamily {
  const familyLower = family.toLowerCase();
  if (familyLower.includes('balanced') || familyLower.startsWith('bx')) return 'balanced';
  if (familyLower.includes('compute') || familyLower.startsWith('cx')) return 'compute';
  if (familyLower.includes('memory') || familyLower.startsWith('mx')) return 'memory';
  if (familyLower.includes('very') || familyLower.startsWith('vx')) return 'veryHighMemory';
  return 'balanced';
}

export default useDynamicProfiles;
