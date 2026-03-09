import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useCostSettings } from './useCostSettings';
import type { RegionCode, DiscountType } from '@/services/costEstimation';

const STORAGE_KEY = 'vcf-cost-settings';

describe('useCostSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when no stored settings exist', () => {
    const { result } = renderHook(() => useCostSettings());
    expect(result.current.region).toBe('us-south');
    expect(result.current.discountType).toBe('onDemand');
    expect(result.current.odfTier).toBe('advanced');
    expect(result.current.includeAcm).toBe(false);
    expect(result.current.networkingOptions.includeVPN).toBe(false);
  });

  it('uses initialRegionHint when no stored settings exist', () => {
    const { result } = renderHook(() => useCostSettings('eu-de' as RegionCode));
    expect(result.current.region).toBe('eu-de');
  });

  it('prefers stored settings over initialRegionHint', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      region: 'eu-gb',
      discountType: 'onDemand',
      networkingOptions: { includeVPN: false, vpnGatewayCount: 1, includeTransitGateway: false, transitGatewayLocalConnections: 1, transitGatewayGlobalConnections: 0, includePublicGateway: false, publicGatewayCount: 1, loadBalancerCount: 1 },
      odfTier: 'essentials',
      includeAcm: true,
    }));

    const { result } = renderHook(() => useCostSettings('us-south' as RegionCode));
    expect(result.current.region).toBe('eu-gb');
    expect(result.current.odfTier).toBe('essentials');
    expect(result.current.includeAcm).toBe(true);
  });

  it('persists changes to localStorage', () => {
    const { result } = renderHook(() => useCostSettings());

    act(() => {
      result.current.setRegion('jp-tok' as RegionCode);
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.region).toBe('jp-tok');
  });

  it('persists discountType changes', () => {
    const { result } = renderHook(() => useCostSettings());

    act(() => {
      result.current.setDiscountType('1year' as DiscountType);
    });

    expect(result.current.discountType).toBe('1year');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.discountType).toBe('1year');
  });

  it('persists networkingOptions changes', () => {
    const { result } = renderHook(() => useCostSettings());

    act(() => {
      result.current.setNetworkingOptions(prev => ({ ...prev, includeVPN: true, vpnGatewayCount: 3 }));
    });

    expect(result.current.networkingOptions.includeVPN).toBe(true);
    expect(result.current.networkingOptions.vpnGatewayCount).toBe(3);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.networkingOptions.includeVPN).toBe(true);
  });

  it('persists odfTier and includeAcm changes', () => {
    const { result } = renderHook(() => useCostSettings());

    act(() => {
      result.current.setOdfTier('essentials');
      result.current.setIncludeAcm(true);
    });

    expect(result.current.odfTier).toBe('essentials');
    expect(result.current.includeAcm).toBe(true);
  });

  it('round-trips through localStorage correctly', () => {
    const { result } = renderHook(() => useCostSettings());

    act(() => {
      result.current.setRegion('eu-de' as RegionCode);
      result.current.setDiscountType('3year' as DiscountType);
      result.current.setOdfTier('essentials');
      result.current.setIncludeAcm(true);
      result.current.setNetworkingOptions(prev => ({ ...prev, includeTransitGateway: true }));
    });

    // Simulate a new hook instance reading from storage
    const { result: result2 } = renderHook(() => useCostSettings());
    expect(result2.current.region).toBe('eu-de');
    expect(result2.current.discountType).toBe('3year');
    expect(result2.current.odfTier).toBe('essentials');
    expect(result2.current.includeAcm).toBe(true);
    expect(result2.current.networkingOptions.includeTransitGateway).toBe(true);
  });

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json');
    const { result } = renderHook(() => useCostSettings());
    expect(result.current.region).toBe('us-south');
  });
});
