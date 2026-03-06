// Unit tests for cost estimation service
import { describe, it, expect } from 'vitest';
import {
  calculateVSICost,
  calculateROKSCost,
  getRegions,
  getDiscountOptions,
  formatCurrency,
  formatCurrencyPrecise,
  findClosestPricedProfile,
} from './costEstimation';
import type { VSISizingInput, ROKSSizingInput } from './costEstimation';
import type { VSIProfile } from '@/services/pricing/pricingCache';
import { getStaticPricing } from '@/services/pricing/pricingCache';

describe('Cost Estimation Service', () => {
  describe('getRegions', () => {
    it('should return a PricingResult with available regions', () => {
      const result = getRegions();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('quality');
      expect(result).toHaveProperty('warnings');
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toHaveProperty('code');
      expect(result.data[0]).toHaveProperty('name');
      expect(result.data[0]).toHaveProperty('multiplier');
    });

    it('should include us-south region', () => {
      const { data: regions } = getRegions();
      const usSouth = regions.find(r => r.code === 'us-south');
      expect(usSouth).toBeDefined();
      expect(usSouth?.name).toBe('Dallas');
      expect(usSouth?.multiplier).toBe(1.0);
    });

    it('should have correct multipliers for regional pricing', () => {
      const { data: regions } = getRegions();
      const euDe = regions.find(r => r.code === 'eu-de');
      expect(euDe).toBeDefined();
      expect(euDe?.multiplier).toBeGreaterThan(1.0); // Europe typically has higher prices
    });

    it('should return static quality when no dynamic pricing is available', () => {
      const result = getRegions();
      expect(['live', 'static']).toContain(result.quality);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('getDiscountOptions', () => {
    it('should return a PricingResult with discount options', () => {
      const result = getDiscountOptions();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('quality');
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('name');
      expect(result.data[0]).toHaveProperty('discountPct');
    });

    it('should have on-demand pricing with 0% discount', () => {
      const { data: discounts } = getDiscountOptions();
      const onDemand = discounts.find(d => d.id === 'onDemand');
      expect(onDemand).toBeDefined();
      expect(onDemand?.discountPct).toBe(0);
    });

    it('should have reserved pricing with discounts', () => {
      const { data: discounts } = getDiscountOptions();
      const reserved1yr = discounts.find(d => d.id === 'reserved1Year');
      const reserved3yr = discounts.find(d => d.id === 'reserved3Year');
      expect(reserved1yr).toBeDefined();
      expect(reserved3yr).toBeDefined();
      expect(reserved1yr?.discountPct).toBeGreaterThan(0);
      expect(reserved3yr?.discountPct).toBeGreaterThan(reserved1yr!.discountPct);
    });
  });

  describe('formatCurrency', () => {
    it('should format currency without decimals', () => {
      expect(formatCurrency(1234)).toBe('$1,234');
      expect(formatCurrency(1234567)).toBe('$1,234,567');
    });

    it('should round to nearest whole number', () => {
      expect(formatCurrency(1234.56)).toBe('$1,235');
      expect(formatCurrency(1234.49)).toBe('$1,234');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('$0');
    });
  });

  describe('formatCurrencyPrecise', () => {
    it('should format currency with 2 decimal places', () => {
      expect(formatCurrencyPrecise(1234.56)).toBe('$1,234.56');
      expect(formatCurrencyPrecise(1234)).toBe('$1,234.00');
    });
  });

  describe('calculateVSICost', () => {
    const basicVSIInput: VSISizingInput = {
      vmProfiles: [
        { profile: 'bx2-4x16', count: 5 },
        { profile: 'cx2-8x16', count: 3 },
      ],
      storageTiB: 10,
      storageTier: '10iops',
    };

    it('should calculate VSI costs correctly', () => {
      const result = calculateVSICost(basicVSIInput, 'us-south', 'onDemand');

      expect(result).toHaveProperty('architecture', 'VPC Virtual Server Instances');
      expect(result).toHaveProperty('region', 'us-south');
      expect(result).toHaveProperty('lineItems');
      expect(result).toHaveProperty('totalMonthly');
      expect(result).toHaveProperty('totalAnnual');
      expect(result.lineItems.length).toBeGreaterThan(0);
    });

    it('should apply regional multiplier', () => {
      const usSouthResult = calculateVSICost(basicVSIInput, 'us-south', 'onDemand');
      const euDeResult = calculateVSICost(basicVSIInput, 'eu-de', 'onDemand');

      // EU should be more expensive due to regional multiplier
      expect(euDeResult.totalMonthly).toBeGreaterThan(usSouthResult.totalMonthly);
    });

    it('should apply discounts correctly', () => {
      const onDemandResult = calculateVSICost(basicVSIInput, 'us-south', 'onDemand');
      const reservedResult = calculateVSICost(basicVSIInput, 'us-south', 'reserved1Year');

      expect(reservedResult.totalMonthly).toBeLessThan(onDemandResult.totalMonthly);
      expect(reservedResult.discountPct).toBeGreaterThan(0);
    });

    it('should include storage costs', () => {
      const result = calculateVSICost(basicVSIInput, 'us-south', 'onDemand');
      const storageItem = result.lineItems.find(item => item.category === 'Storage - Block');

      expect(storageItem).toBeDefined();
      expect(storageItem?.quantity).toBe(10 * 1024); // 10 TiB in GB
    });

    it('should include networking costs', () => {
      const result = calculateVSICost(basicVSIInput, 'us-south', 'onDemand');
      const networkingItems = result.lineItems.filter(item => item.category === 'Networking');

      expect(networkingItems.length).toBeGreaterThan(0);
    });

    it('should handle empty VM profiles', () => {
      const emptyInput: VSISizingInput = {
        vmProfiles: [],
        storageTiB: 0,
      };

      const result = calculateVSICost(emptyInput, 'us-south', 'onDemand');
      expect(result.totalMonthly).toBeGreaterThanOrEqual(0);
    });

    it('should include VPN gateway when specified', () => {
      const inputWithVPN: VSISizingInput = {
        ...basicVSIInput,
        networking: {
          includeVPN: true,
          vpnGatewayCount: 2,
        },
      };

      const result = calculateVSICost(inputWithVPN, 'us-south', 'onDemand');
      const vpnItem = result.lineItems.find(item => item.description === 'VPN Gateway');

      expect(vpnItem).toBeDefined();
      expect(vpnItem?.quantity).toBe(2);
    });

    it('should include Transit Gateway when specified', () => {
      const inputWithTransitGw: VSISizingInput = {
        ...basicVSIInput,
        networking: {
          includeTransitGateway: true,
          transitGatewayLocalConnections: 3,
          transitGatewayGlobalConnections: 1,
        },
      };

      const result = calculateVSICost(inputWithTransitGw, 'us-south', 'onDemand');
      const localConnItem = result.lineItems.find(item => item.description.includes('Local Connection'));
      const globalConnItem = result.lineItems.find(item => item.description.includes('Global Connection'));

      expect(localConnItem).toBeDefined();
      expect(localConnItem?.quantity).toBe(3);
      expect(globalConnItem).toBeDefined();
      expect(globalConnItem?.quantity).toBe(1);
    });

    it('should include Public Gateway when specified', () => {
      const inputWithPgw: VSISizingInput = {
        ...basicVSIInput,
        networking: {
          includePublicGateway: true,
          publicGatewayCount: 3,
        },
      };

      const result = calculateVSICost(inputWithPgw, 'us-south', 'onDemand');
      const pgwItem = result.lineItems.find(item => item.description === 'Public Gateway');

      expect(pgwItem).toBeDefined();
      expect(pgwItem?.quantity).toBe(3);
    });

    it('should calculate annual cost correctly', () => {
      const result = calculateVSICost(basicVSIInput, 'us-south', 'onDemand');
      expect(result.totalAnnual).toBe(result.totalMonthly * 12);
    });

    it('should accept general-purpose as a valid storage tier', () => {
      const input: VSISizingInput = {
        ...basicVSIInput,
        storageTier: 'general-purpose',
      };
      const result = calculateVSICost(input, 'us-south', 'onDemand');
      expect(result.lineItems.length).toBeGreaterThan(0);
    });

    it('should generate per-tier storage line items when storageByTier is provided', () => {
      const input: VSISizingInput = {
        vmProfiles: [{ profile: 'bx2-4x16', count: 5 }],
        storageTiB: 20,
        bootStorageGiB: 500,
        storageByTier: {
          'general-purpose': 5,
          '10iops': 10,
        },
      };
      const result = calculateVSICost(input, 'us-south', 'onDemand');

      const storageItems = result.lineItems.filter(item => item.category === 'Storage - Block');
      expect(storageItems.length).toBe(3); // boot + 2 tiers

      const bootItem = storageItems.find(item => item.description.startsWith('Boot'));
      expect(bootItem).toBeDefined();
      expect(bootItem?.quantity).toBe(500);

      const gpDataItem = storageItems.find(item => item.description.startsWith('Data Storage') && item.description.includes('General Purpose'));
      expect(gpDataItem).toBeDefined();
      expect(gpDataItem?.quantity).toBe(5 * 1024);

      const highItem = storageItems.find(item => item.description.startsWith('Data Storage') && item.description.includes('10 IOPS'));
      expect(highItem).toBeDefined();
      expect(highItem?.quantity).toBe(10 * 1024);
    });

    it('should fall back to single-tier when storageByTier is empty', () => {
      const input: VSISizingInput = {
        vmProfiles: [{ profile: 'bx2-4x16', count: 2 }],
        storageTiB: 5,
        storageTier: '5iops',
        storageByTier: {},
      };
      const result = calculateVSICost(input, 'us-south', 'onDemand');

      const storageItems = result.lineItems.filter(item => item.category === 'Storage - Block');
      expect(storageItems.length).toBe(1);
      expect(storageItems[0].description).toContain('5 IOPS');
    });
  });

  describe('calculateROKSCost', () => {
    const basicROKSInput: ROKSSizingInput = {
      computeNodes: 3,
      computeProfile: 'bx2d-metal-96x384', // Hyphenated format
      storageNodes: 3,
      storageProfile: 'bx2-16x64',
      storageTiB: 20,
      storageTier: '10iops',
    };

    it('should calculate ROKS costs correctly', () => {
      const result = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');

      // Architecture depends on useNvme flag
      expect(result).toHaveProperty('architecture', 'Hybrid (Bare Metal + VSI Storage)');
      expect(result).toHaveProperty('region', 'us-south');
      expect(result).toHaveProperty('lineItems');
      expect(result).toHaveProperty('totalMonthly');
      expect(result.lineItems.length).toBeGreaterThan(0);
    });

    it('should include compute node costs', () => {
      const result = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');
      const computeItem = result.lineItems.find(item => item.category === 'Compute');

      expect(computeItem).toBeDefined();
      expect(computeItem?.quantity).toBe(3);
    });

    it('should include storage node costs', () => {
      const result = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');
      // In hybrid mode, storage nodes are VSIs
      const storageItem = result.lineItems.find(item => item.category === 'Storage - VSI');

      expect(storageItem).toBeDefined();
      expect(storageItem?.quantity).toBe(3);
    });

    it('should apply regional multiplier', () => {
      const usSouthResult = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');
      const euDeResult = calculateROKSCost(basicROKSInput, 'eu-de', 'onDemand');

      expect(euDeResult.totalMonthly).toBeGreaterThan(usSouthResult.totalMonthly);
    });

    it('should apply discounts correctly', () => {
      const onDemandResult = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');
      const reservedResult = calculateROKSCost(basicROKSInput, 'us-south', 'reserved3Year');

      expect(reservedResult.totalMonthly).toBeLessThan(onDemandResult.totalMonthly);
    });

    it('should include metadata', () => {
      const result = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');

      expect(result.metadata).toHaveProperty('pricingVersion');
      expect(result.metadata).toHaveProperty('generatedAt');
      expect(result.metadata).toHaveProperty('notes');
      expect(result.metadata.notes.length).toBeGreaterThan(0);
      expect(result.metadata.notes).toContain('Includes OpenShift licensing and ODF storage costs');
    });

    it('should include OCP license line item with correct amount', () => {
      const result = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');
      const ocpItem = result.lineItems.find(item => item.category === 'Licensing');

      expect(ocpItem).toBeDefined();
      expect(ocpItem?.description).toBe('OpenShift Container Platform License');
      // Hybrid mode: 3 compute nodes (96 vCPUs each) + 3 storage VSIs (bx2-16x64 = 16 vCPUs each)
      // Total vCPUs = 3*96 + 3*16 = 336
      expect(ocpItem?.quantity).toBe(336);
      // Cost = 336 vCPUs × $0.04275/hr × 730 hrs = ~$10,489.14
      expect(ocpItem?.monthlyCost).toBeGreaterThan(10000);
    });

    it('should include ODF line item for hybrid architecture', () => {
      const result = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');
      const odfItem = result.lineItems.find(item => item.category === 'Storage - ODF');

      expect(odfItem).toBeDefined();
      expect(odfItem?.description).toBe('OpenShift Data Foundation Advanced');
      // Hybrid: 3 storage VSIs × 16 vCPUs = 48 vCPUs
      expect(odfItem?.quantity).toBe(48);
      expect(odfItem?.notes).toContain('VSI storage workers');
    });

    it('should include ODF line item for converged (NVMe) architecture', () => {
      const nvmeInput: ROKSSizingInput = {
        computeNodes: 3,
        computeProfile: 'bx2d-metal-96x384',
        useNvme: true,
      };
      const result = calculateROKSCost(nvmeInput, 'us-south', 'onDemand');
      const odfItem = result.lineItems.find(item => item.category === 'Storage - ODF');

      expect(odfItem).toBeDefined();
      expect(odfItem?.quantity).toBe(3);
      expect(odfItem?.unit).toBe('nodes');
      expect(odfItem?.notes).toContain('converged bare metal');
    });

    it('should include OCP + ODF costs in total', () => {
      const result = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');
      const ocpItem = result.lineItems.find(item => item.category === 'Licensing');
      const odfItem = result.lineItems.find(item => item.category === 'Storage - ODF');

      expect(ocpItem).toBeDefined();
      expect(odfItem).toBeDefined();
      // Subtotal should include both new items
      expect(result.subtotalMonthly).toBeGreaterThanOrEqual(
        (ocpItem?.monthlyCost ?? 0) + (odfItem?.monthlyCost ?? 0)
      );
    });

    it('should apply regional multiplier to OCP and ODF line items', () => {
      const usSouthResult = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');
      const euDeResult = calculateROKSCost(basicROKSInput, 'eu-de', 'onDemand');

      const usSouthOcp = usSouthResult.lineItems.find(item => item.category === 'Licensing');
      const euDeOcp = euDeResult.lineItems.find(item => item.category === 'Licensing');
      expect(euDeOcp?.monthlyCost).toBeGreaterThan(usSouthOcp?.monthlyCost ?? 0);

      const usSouthOdf = usSouthResult.lineItems.find(item => item.category === 'Storage - ODF');
      const euDeOdf = euDeResult.lineItems.find(item => item.category === 'Storage - ODF');
      expect(euDeOdf?.monthlyCost).toBeGreaterThan(usSouthOdf?.monthlyCost ?? 0);
    });

    it('should apply discounts to OCP and ODF line items', () => {
      const onDemandResult = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');
      const reservedResult = calculateROKSCost(basicROKSInput, 'us-south', 'reserved3Year');

      // Discount is applied to subtotal, so total should be less
      expect(reservedResult.totalMonthly).toBeLessThan(onDemandResult.totalMonthly);
      // The discount amount should be larger now that OCP/ODF are included
      expect(reservedResult.discountAmountMonthly).toBeGreaterThan(0);
    });

    it('should use ODF Essentials pricing when odfTier is essentials', () => {
      const essentialsInput: ROKSSizingInput = {
        ...basicROKSInput,
        odfTier: 'essentials',
      };
      const advancedResult = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');
      const essentialsResult = calculateROKSCost(essentialsInput, 'us-south', 'onDemand');

      const advancedOdf = advancedResult.lineItems.find(item => item.category === 'Storage - ODF');
      const essentialsOdf = essentialsResult.lineItems.find(item => item.category === 'Storage - ODF');

      expect(advancedOdf?.description).toBe('OpenShift Data Foundation Advanced');
      expect(essentialsOdf?.description).toBe('OpenShift Data Foundation Essentials');
      expect(essentialsResult.totalMonthly).toBeLessThan(advancedResult.totalMonthly);
    });

    it('should use ODF Essentials pricing for converged (NVMe) architecture', () => {
      const nvmeEssentials: ROKSSizingInput = {
        computeNodes: 3,
        computeProfile: 'bx2d-metal-96x384',
        useNvme: true,
        odfTier: 'essentials',
      };
      const nvmeAdvanced: ROKSSizingInput = {
        ...nvmeEssentials,
        odfTier: 'advanced',
      };

      const essResult = calculateROKSCost(nvmeEssentials, 'us-south', 'onDemand');
      const advResult = calculateROKSCost(nvmeAdvanced, 'us-south', 'onDemand');

      const essOdf = essResult.lineItems.find(item => item.category === 'Storage - ODF');
      const advOdf = advResult.lineItems.find(item => item.category === 'Storage - ODF');

      expect(essOdf?.description).toContain('Essentials');
      expect(advOdf?.description).toContain('Advanced');
      expect(essOdf?.unitCost).toBeLessThan(advOdf?.unitCost ?? 0);
    });

    it('should include ACM line item when includeAcm is true', () => {
      const acmInput: ROKSSizingInput = {
        ...basicROKSInput,
        includeAcm: true,
      };
      const result = calculateROKSCost(acmInput, 'us-south', 'onDemand');
      const acmItem = result.lineItems.find(item => item.description === 'Red Hat Advanced Cluster Management');

      expect(acmItem).toBeDefined();
      expect(acmItem?.category).toBe('Licensing');
      // Hybrid mode: 3 compute (96 vCPUs) + 3 storage (16 vCPUs) = 336 vCPUs
      expect(acmItem?.quantity).toBe(336);
      expect(acmItem?.notes).toContain('estimated');
    });

    it('should not include ACM when includeAcm is false or undefined', () => {
      const result = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');
      const acmItem = result.lineItems.find(item => item.description === 'Red Hat Advanced Cluster Management');
      expect(acmItem).toBeUndefined();
    });

    it('should increase total cost when ACM is included', () => {
      const withoutAcm = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');
      const withAcm = calculateROKSCost({ ...basicROKSInput, includeAcm: true }, 'us-south', 'onDemand');
      expect(withAcm.totalMonthly).toBeGreaterThan(withoutAcm.totalMonthly);
    });
  });

  describe('findClosestPricedProfile', () => {
    const mockVSIPricing: Record<string, VSIProfile> = {
      'bx2-4x16': { profile: 'bx2-4x16', family: 'Balanced', vcpus: 4, memoryGiB: 16, networkGbps: 8, hourlyRate: 0.2, monthlyRate: 146, description: 'Balanced 4x16' },
      'bx2-8x32': { profile: 'bx2-8x32', family: 'Balanced', vcpus: 8, memoryGiB: 32, networkGbps: 16, hourlyRate: 0.4, monthlyRate: 292, description: 'Balanced 8x32' },
      'cx2-4x8': { profile: 'cx2-4x8', family: 'Compute', vcpus: 4, memoryGiB: 8, networkGbps: 8, hourlyRate: 0.18, monthlyRate: 131, description: 'Compute 4x8' },
      'mx2-4x32': { profile: 'mx2-4x32', family: 'Memory', vcpus: 4, memoryGiB: 32, networkGbps: 8, hourlyRate: 0.25, monthlyRate: 182.5, description: 'Memory 4x32' },
    };

    it('should find closest profile in the same family', () => {
      const result = findClosestPricedProfile('bx2-6x24', mockVSIPricing);
      expect(result).toBeDefined();
      // Should match bx2-4x16 or bx2-8x32 (both balanced family)
      expect(result?.profile).toMatch(/^bx2-/);
    });

    it('should match by family letter (b=balanced, c=compute, m=memory)', () => {
      const result = findClosestPricedProfile('cx2-4x16', mockVSIPricing);
      expect(result).toBeDefined();
      expect(result?.profile).toBe('cx2-4x8'); // only compute profile
    });

    it('should return null for unparseable profile names', () => {
      expect(findClosestPricedProfile('weird-profile', mockVSIPricing)).toBeNull();
      expect(findClosestPricedProfile('', mockVSIPricing)).toBeNull();
    });

    it('should return null when no profiles match the family', () => {
      const result = findClosestPricedProfile('ox2-4x16', mockVSIPricing);
      expect(result).toBeNull();
    });

    it('should prefer closer specs within same family', () => {
      const result = findClosestPricedProfile('bx2-4x16', mockVSIPricing);
      expect(result?.profile).toBe('bx2-4x16'); // exact match
    });
  });

  describe('calculateVSICost - unmatched profile fallback', () => {
    it('should include VMs with unrecognized profiles using fallback pricing', () => {
      // Use a profile name that follows naming convention but doesn't exist in pricing
      const input: VSISizingInput = {
        vmProfiles: [
          { profile: 'bx2-4x16', count: 3 },      // exists in pricing
          { profile: 'bx2-999x9999', count: 5 },   // doesn't exist but parseable
        ],
        storageTiB: 0,
      };

      const result = calculateVSICost(input, 'us-south', 'onDemand');
      const computeItems = result.lineItems.filter(item => item.category === 'Compute - VSI');

      // Both profiles should appear as line items (not just the known one)
      expect(computeItems.length).toBe(2);

      // The known profile should have exact pricing
      const knownItem = computeItems.find(item => item.description === 'VSI - bx2-4x16');
      expect(knownItem).toBeDefined();
      expect(knownItem?.quantity).toBe(3);

      // The unknown profile should have estimated pricing with a note
      const unknownItem = computeItems.find(item => item.description === 'VSI - bx2-999x9999');
      expect(unknownItem).toBeDefined();
      expect(unknownItem?.quantity).toBe(5);
      expect(unknownItem?.notes).toContain('Estimated from');
      expect(unknownItem?.notes).toContain('exact pricing unavailable');
    });

    it('should not drop VMs when profile is missing from pricing', () => {
      const input: VSISizingInput = {
        vmProfiles: [
          { profile: 'bx2-4x16', count: 10 },
          { profile: 'bx3d-4x20', count: 5 },  // hypothetical future profile
        ],
        storageTiB: 0,
      };

      const result = calculateVSICost(input, 'us-south', 'onDemand');
      const totalVMs = result.lineItems
        .filter(item => item.category === 'Compute - VSI')
        .reduce((sum, item) => sum + item.quantity, 0);

      expect(totalVMs).toBe(15); // all VMs accounted for
    });
  });

  describe('getActivePricing - merge behavior', () => {
    it('should have all static VSI profiles available', () => {
      // When no proxy cache exists, static profiles should all be present
      const staticPricing = getStaticPricing();
      const staticVSICount = Object.keys(staticPricing.vsi).length;
      expect(staticVSICount).toBeGreaterThan(0);

      // bx2-4x16 should always exist in static data
      expect(staticPricing.vsi['bx2-4x16']).toBeDefined();
    });
  });
});
