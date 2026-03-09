/**
 * Cost Settings Persistence Hook
 *
 * Persists shared cost estimation settings (region, discount type, networking options,
 * ODF tier, ACM toggle) to localStorage. User preferences, not environment-specific
 * (same pattern as useCustomProfiles).
 */

import { useState, useCallback, useEffect } from 'react';
import type { RegionCode, DiscountType, NetworkingOptions } from '@/services/costEstimation';

const STORAGE_KEY = 'vcf-cost-settings';

export interface CostSettings {
  region: RegionCode;
  discountType: DiscountType;
  networkingOptions: NetworkingOptions;
  odfTier: 'advanced' | 'essentials';
  includeAcm: boolean;
}

const DEFAULT_NETWORKING: NetworkingOptions = {
  includeVPN: false,
  vpnGatewayCount: 1,
  includeTransitGateway: false,
  transitGatewayLocalConnections: 1,
  transitGatewayGlobalConnections: 0,
  includePublicGateway: false,
  publicGatewayCount: 1,
  loadBalancerCount: 1,
};

function loadCostSettings(): CostSettings | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return null;
}

function saveCostSettings(settings: CostSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export interface UseCostSettingsReturn {
  region: RegionCode;
  setRegion: (region: RegionCode) => void;
  discountType: DiscountType;
  setDiscountType: (type: DiscountType) => void;
  networkingOptions: NetworkingOptions;
  setNetworkingOptions: React.Dispatch<React.SetStateAction<NetworkingOptions>>;
  odfTier: 'advanced' | 'essentials';
  setOdfTier: (tier: 'advanced' | 'essentials') => void;
  includeAcm: boolean;
  setIncludeAcm: (include: boolean) => void;
}

export function useCostSettings(initialRegionHint?: RegionCode): UseCostSettingsReturn {
  const [settings, setSettings] = useState<CostSettings>(() => {
    const stored = loadCostSettings();
    return {
      region: stored?.region ?? initialRegionHint ?? 'us-south' as RegionCode,
      discountType: stored?.discountType ?? 'onDemand' as DiscountType,
      networkingOptions: stored?.networkingOptions ?? DEFAULT_NETWORKING,
      odfTier: stored?.odfTier ?? 'advanced',
      includeAcm: stored?.includeAcm ?? false,
    };
  });

  // Persist on change
  useEffect(() => {
    saveCostSettings(settings);
  }, [settings]);

  const setRegion = useCallback((region: RegionCode) => {
    setSettings(prev => ({ ...prev, region }));
  }, []);

  const setDiscountType = useCallback((discountType: DiscountType) => {
    setSettings(prev => ({ ...prev, discountType }));
  }, []);

  const setNetworkingOptions: React.Dispatch<React.SetStateAction<NetworkingOptions>> = useCallback(
    (action) => {
      setSettings(prev => ({
        ...prev,
        networkingOptions: typeof action === 'function' ? action(prev.networkingOptions) : action,
      }));
    },
    []
  );

  const setOdfTier = useCallback((odfTier: 'advanced' | 'essentials') => {
    setSettings(prev => ({ ...prev, odfTier }));
  }, []);

  const setIncludeAcm = useCallback((includeAcm: boolean) => {
    setSettings(prev => ({ ...prev, includeAcm }));
  }, []);

  return {
    region: settings.region,
    setRegion,
    discountType: settings.discountType,
    setDiscountType,
    networkingOptions: settings.networkingOptions,
    setNetworkingOptions,
    odfTier: settings.odfTier,
    setOdfTier,
    includeAcm: settings.includeAcm,
    setIncludeAcm,
  };
}
