import { describe, it, expect } from 'vitest';
import { getRegionalPricing, buildFallbackFromBase } from './regionalPricingResolver';
import type { IBMCloudPricing, RegionalPricingData } from './pricingCache';
import { getStaticPricing } from './pricingCache';

// Minimal regional pricing fixture for tests
const mockRegionalPricing: Record<string, RegionalPricingData> = {
  'us-south': {
    vsi: { 'bx2-2x8': { hourlyRate: 0.1036, monthlyRate: 75.60 } },
    bareMetal: { 'bx2d-metal-96x384': { hourlyRate: 3.90, monthlyRate: 2847.00 } },
    blockStorage: { 'generalPurpose': { costPerGBMonth: 0.10 } },
    networking: {
      loadBalancer: { perLBMonthly: 21.60, perGBProcessed: 0.008 },
      vpnGateway: { perGatewayMonthly: 99, perConnectionMonthly: 0.04 },
      publicGateway: { perGatewayMonthly: 5 },
      transitGateway: { perGatewayMonthly: 0, localConnectionMonthly: 50, globalConnectionMonthly: 100, perGBLocal: 0.02, perGBGlobal: 0.04 },
      floatingIP: { perIPMonthly: 5 },
    },
    roks: {
      ocpLicense: { perVCPUHourly: 0.04275, perVCPUMonthly: 31.21 },
      odf: {
        advanced: { bareMetalPerNodeMonthly: 681.818, vsiPerVCPUHourly: 0.00725 },
        essentials: { bareMetalPerNodeMonthly: 545.455, vsiPerVCPUHourly: 0.00575 },
      },
      clusterManagement: { perClusterMonthly: 0 },
    },
  },
  'eu-gb': {
    vsi: { 'bx2-2x8': { hourlyRate: 0.1100, monthlyRate: 80.30 } },
    bareMetal: { 'bx2d-metal-96x384': { hourlyRate: 4.10, monthlyRate: 2993.00 } },
    blockStorage: { 'generalPurpose': { costPerGBMonth: 0.11 } },
    networking: {
      loadBalancer: { perLBMonthly: 23.00, perGBProcessed: 0.009 },
      vpnGateway: { perGatewayMonthly: 105, perConnectionMonthly: 0.04 },
      publicGateway: { perGatewayMonthly: 5.50 },
      transitGateway: { perGatewayMonthly: 0, localConnectionMonthly: 53, globalConnectionMonthly: 106, perGBLocal: 0.02, perGBGlobal: 0.04 },
      floatingIP: { perIPMonthly: 5.50 },
    },
    roks: {
      ocpLicense: { perVCPUHourly: 0.04500, perVCPUMonthly: 32.85 },
      odf: {
        advanced: { bareMetalPerNodeMonthly: 720.00, vsiPerVCPUHourly: 0.00765 },
        essentials: { bareMetalPerNodeMonthly: 576.00, vsiPerVCPUHourly: 0.00605 },
      },
      clusterManagement: { perClusterMonthly: 0 },
    },
  },
};

describe('regionalPricingResolver', () => {
  describe('getRegionalPricing', () => {
    it('should return exact region match when available', () => {
      const pricing = { regionalPricing: mockRegionalPricing } as IBMCloudPricing;
      const result = getRegionalPricing(pricing, 'eu-gb');
      expect(result.vsi['bx2-2x8'].monthlyRate).toBe(80.30);
    });

    it('should fall back to us-south when region not found', () => {
      const pricing = { regionalPricing: mockRegionalPricing } as IBMCloudPricing;
      const result = getRegionalPricing(pricing, 'ap-north');
      expect(result.vsi['bx2-2x8'].monthlyRate).toBe(75.60);
    });

    it('should fall back to base fields when regionalPricing is absent', () => {
      const staticPricing = getStaticPricing();
      delete (staticPricing as Record<string, unknown>).regionalPricing;
      const result = getRegionalPricing(staticPricing, 'us-south');
      expect(result.vsi).toBeDefined();
      expect(Object.keys(result.vsi).length).toBeGreaterThan(0);
      const profileName = Object.keys(staticPricing.vsi)[0];
      expect(result.vsi[profileName].monthlyRate).toBe(staticPricing.vsi[profileName].monthlyRate);
    });
  });

  describe('buildFallbackFromBase', () => {
    it('should map vsi profiles to regional format', () => {
      const staticPricing = getStaticPricing();
      const result = buildFallbackFromBase(staticPricing);
      const profileName = Object.keys(staticPricing.vsi)[0];
      expect(result.vsi[profileName].hourlyRate).toBe(staticPricing.vsi[profileName].hourlyRate);
      expect(result.vsi[profileName].monthlyRate).toBe(staticPricing.vsi[profileName].monthlyRate);
    });

    it('should map bareMetal profiles to regional format', () => {
      const staticPricing = getStaticPricing();
      const result = buildFallbackFromBase(staticPricing);
      const profileName = Object.keys(staticPricing.bareMetal)[0];
      expect(result.bareMetal[profileName].monthlyRate).toBe(staticPricing.bareMetal[profileName].monthlyRate);
    });

    it('should map blockStorage tiers', () => {
      const staticPricing = getStaticPricing();
      const result = buildFallbackFromBase(staticPricing);
      expect(result.blockStorage).toBeDefined();
      expect(Object.keys(result.blockStorage).length).toBeGreaterThan(0);
    });

    it('should copy networking rates', () => {
      const staticPricing = getStaticPricing();
      const result = buildFallbackFromBase(staticPricing);
      expect(result.networking.loadBalancer.perLBMonthly).toBe(staticPricing.networking.loadBalancer.perLBMonthly);
    });

    it('should copy roks rates', () => {
      const staticPricing = getStaticPricing();
      const result = buildFallbackFromBase(staticPricing);
      expect(result.roks.ocpLicense.perVCPUHourly).toBe(staticPricing.roks.ocpLicense.perVCPUHourly);
    });
  });
});
