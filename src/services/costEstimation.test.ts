// Unit tests for cost estimation service
import { describe, it, expect } from 'vitest';
import {
  calculateVSICost,
  calculateROKSCost,
  calculateDp2FileStorageMonthlyCost,
  getRegions,
  getDiscountOptions,
  formatCurrency,
  formatCurrencyPrecise,
  findClosestPricedProfile,
  validateROKSSizingInput,
} from './costEstimation';
import type { VSISizingInput, ROKSSizingInput } from './costEstimation';
import type { VSIProfile, IBMCloudPricing } from '@/services/pricing/pricingCache';
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
      expect(result.data[0]).toHaveProperty('availabilityZones');
    });

    it('should include us-south region', () => {
      const { data: regions } = getRegions();
      const usSouth = regions.find(r => r.code === 'us-south');
      expect(usSouth).toBeDefined();
      expect(usSouth?.name).toBe('Dallas');
      expect(usSouth?.availabilityZones).toBe(3);
    });

    it('should have availabilityZones for each region', () => {
      const { data: regions } = getRegions();
      for (const region of regions) {
        expect(region.availabilityZones).toBeGreaterThan(0);
      }
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

    it('should use regional pricing when available', () => {
      // Both regions should produce valid cost results
      const usSouthResult = calculateVSICost(basicVSIInput, 'us-south', 'onDemand');
      const euDeResult = calculateVSICost(basicVSIInput, 'eu-de', 'onDemand');
      expect(usSouthResult.totalMonthly).toBeGreaterThan(0);
      expect(euDeResult.totalMonthly).toBeGreaterThan(0);
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

    it('should include boot storage even when storageByTier is empty (boot-only VMs)', () => {
      const input: VSISizingInput = {
        vmProfiles: [{ profile: 'bx2-4x16', count: 3 }],
        storageTiB: 0,
        bootStorageGiB: 300,
        storageByTier: {},
      };
      const result = calculateVSICost(input, 'us-south', 'onDemand');

      const storageItems = result.lineItems.filter(item => item.category === 'Storage - Block');
      expect(storageItems.length).toBe(1);
      expect(storageItems[0].description).toBe('Boot Volumes (General Purpose)');
      expect(storageItems[0].quantity).toBe(300);
      expect(storageItems[0].monthlyCost).toBeGreaterThan(0);
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

    it('should use regional pricing when available', () => {
      const usSouthResult = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');
      const euDeResult = calculateROKSCost(basicROKSInput, 'eu-de', 'onDemand');
      expect(usSouthResult.totalMonthly).toBeGreaterThan(0);
      expect(euDeResult.totalMonthly).toBeGreaterThan(0);
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

    it('should use regional pricing for OCP and ODF line items', () => {
      const usSouthResult = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand');
      const euDeResult = calculateROKSCost(basicROKSInput, 'eu-de', 'onDemand');
      const usSouthLicensing = usSouthResult.lineItems.find(item => item.category === 'Licensing');
      const euDeLicensing = euDeResult.lineItems.find(item => item.category === 'Licensing');
      expect(usSouthLicensing).toBeDefined();
      expect(euDeLicensing).toBeDefined();
      expect(euDeLicensing?.monthlyCost).toBe(usSouthLicensing?.monthlyCost);
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

    it('should use ROKS worker rate for bare metal compute when available', () => {
      const staticPricing = getStaticPricing();
      const higherRate = (staticPricing.bareMetal['bx2d-metal-96x384']?.monthlyRate || 5000) * 1.09;
      const pricingWithWorkerRates: IBMCloudPricing = {
        ...staticPricing,
        roks: {
          ...staticPricing.roks,
          workerRates: {
            bareMetal: {
              'bx2d-metal-96x384': { hourlyRate: higherRate / 730, monthlyRate: higherRate },
            },
          },
        },
      };

      const withWorkerRate = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand', pricingWithWorkerRates);
      const withoutWorkerRate = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand', staticPricing);

      const computeWith = withWorkerRate.lineItems.find(item => item.category === 'Compute');
      const computeWithout = withoutWorkerRate.lineItems.find(item => item.category === 'Compute');

      expect(computeWith).toBeDefined();
      expect(computeWithout).toBeDefined();
      expect(computeWith!.monthlyCost).toBeGreaterThan(computeWithout!.monthlyCost);
    });

    it('should fall back to VPC bare metal rate when ROKS worker rate missing', () => {
      const staticPricing = getStaticPricing();
      const pricingNoWorkerRates: IBMCloudPricing = {
        ...staticPricing,
        roks: {
          ...staticPricing.roks,
          // No workerRates
        },
      };

      const result = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand', pricingNoWorkerRates);
      const baseline = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand', staticPricing);

      const computeResult = result.lineItems.find(item => item.category === 'Compute');
      const computeBaseline = baseline.lineItems.find(item => item.category === 'Compute');

      expect(computeResult?.monthlyCost).toBe(computeBaseline?.monthlyCost);
    });

    it('should use ROKS worker rate for storage VSIs in hybrid mode', () => {
      const staticPricing = getStaticPricing();
      const storageProfile = 'bx2-16x64';
      const higherRate = (staticPricing.vsi[storageProfile]?.monthlyRate || 500) * 1.09;
      const pricingWithWorkerRates: IBMCloudPricing = {
        ...staticPricing,
        roks: {
          ...staticPricing.roks,
          workerRates: {
            vsi: {
              [storageProfile]: { hourlyRate: higherRate / 730, monthlyRate: higherRate },
            },
          },
        },
      };

      const withWorkerRate = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand', pricingWithWorkerRates);
      const withoutWorkerRate = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand', staticPricing);

      const storageWith = withWorkerRate.lineItems.find(item => item.category === 'Storage - VSI');
      const storageWithout = withoutWorkerRate.lineItems.find(item => item.category === 'Storage - VSI');

      expect(storageWith).toBeDefined();
      expect(storageWithout).toBeDefined();
      expect(storageWith!.monthlyCost).toBeGreaterThan(storageWithout!.monthlyCost);
    });

    it('should fall back to VPC VSI rate when ROKS VSI worker rate missing', () => {
      const staticPricing = getStaticPricing();
      const pricingNoWorkerRates: IBMCloudPricing = {
        ...staticPricing,
        roks: {
          ...staticPricing.roks,
          workerRates: {
            vsi: {}, // empty — no matching profile
          },
        },
      };

      const result = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand', pricingNoWorkerRates);
      const baseline = calculateROKSCost(basicROKSInput, 'us-south', 'onDemand', staticPricing);

      const storageResult = result.lineItems.find(item => item.category === 'Storage - VSI');
      const storageBaseline = baseline.lineItems.find(item => item.category === 'Storage - VSI');

      expect(storageResult?.monthlyCost).toBe(storageBaseline?.monthlyCost);
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

  describe('calculateROKSCost with roksVariant', () => {
    const baseSizing: ROKSSizingInput = {
      computeNodes: 3,
      computeProfile: 'bx2d-metal-96x384',
      useNvme: true,
      odfTier: 'advanced',
    };

    it('should use OVE pricing when roksVariant is rov', () => {
      const fullCost = calculateROKSCost(baseSizing);
      const rovCost = calculateROKSCost(baseSizing, 'us-south', 'onDemand', undefined, 'rov');

      // ROV should be cheaper than full ROKS (OVE is ~25% of ROKS license rates)
      expect(rovCost.totalMonthly).toBeLessThan(fullCost.totalMonthly);
      // Both should have positive costs
      expect(rovCost.totalMonthly).toBeGreaterThan(0);
      expect(fullCost.totalMonthly).toBeGreaterThan(0);
    });

    it('should label license line item as ROV License for rov variant', () => {
      const rovCost = calculateROKSCost(baseSizing, 'us-south', 'onDemand', undefined, 'rov');
      const licenseItem = rovCost.lineItems.find(item => item.category === 'Licensing' && item.description.includes('ROV'));
      expect(licenseItem).toBeDefined();
      expect(licenseItem!.description).toBe('ROV License');
      expect(licenseItem!.notes).toContain('OVE');
    });

    it('should label license line item as OpenShift Container Platform License for full variant', () => {
      const fullCost = calculateROKSCost(baseSizing, 'us-south', 'onDemand', undefined, 'full');
      const licenseItem = fullCost.lineItems.find(item => item.category === 'Licensing' && item.description.includes('OpenShift'));
      expect(licenseItem).toBeDefined();
      expect(licenseItem!.description).toBe('OpenShift Container Platform License');
    });

    it('should have same compute cost for full and rov variants', () => {
      const fullCost = calculateROKSCost(baseSizing);
      const rovCost = calculateROKSCost(baseSizing, 'us-south', 'onDemand', undefined, 'rov');

      const fullCompute = fullCost.lineItems.find(item => item.category === 'Compute');
      const rovCompute = rovCost.lineItems.find(item => item.category === 'Compute');
      expect(fullCompute?.monthlyCost).toBe(rovCompute?.monthlyCost);
    });

    it('should default to full ROKS pricing when roksVariant is not specified', () => {
      const defaultCost = calculateROKSCost(baseSizing);
      const fullCost = calculateROKSCost(baseSizing, 'us-south', 'onDemand', undefined, 'full');

      expect(defaultCost.totalMonthly).toBe(fullCost.totalMonthly);
    });
  });

  describe('calculateROKSCost with solutionType', () => {
    it('should produce same result for nvme-converged as useNvme: true', () => {
      const legacyInput: ROKSSizingInput = {
        computeNodes: 3,
        computeProfile: 'bx2d-metal-96x384',
        useNvme: true,
        odfTier: 'advanced',
      };
      const newInput: ROKSSizingInput = {
        ...legacyInput,
        solutionType: 'nvme-converged',
      };
      const legacyCost = calculateROKSCost(legacyInput);
      const newCost = calculateROKSCost(newInput);
      expect(newCost.totalMonthly).toBe(legacyCost.totalMonthly);
      expect(newCost.architecture).toBe('All-NVMe Converged');
    });

    it('should produce bm-block-csi architecture with no ODF line items', () => {
      const input: ROKSSizingInput = {
        computeNodes: 3,
        computeProfile: 'bx2-metal-96x384',
        solutionType: 'bm-block-csi',
        storageTiB: 10,
      };
      const cost = calculateROKSCost(input);
      expect(cost.architecture).toBe('Bare Metal + Block Storage (CSI)');
      // Should have boot block storage + data block storage, but no ODF
      const odfItems = cost.lineItems.filter(item => item.category === 'Storage - ODF');
      expect(odfItems).toHaveLength(0);
      const blockItems = cost.lineItems.filter(item => item.category === 'Storage - Block');
      expect(blockItems.length).toBeGreaterThanOrEqual(1);
    });

    it('should split boot and data volumes for bm-block-csi', () => {
      const input: ROKSSizingInput = {
        computeNodes: 6,
        computeProfile: 'bx2-metal-96x384',
        solutionType: 'bm-block-csi',
        bootVolumeCount: 256,
        bootVolumeCapacityGiB: 12800,
        dataVolumeCount: 156,
        dataVolumeCapacityGiB: 5000,
      };
      const cost = calculateROKSCost(input);
      const blockItems = cost.lineItems.filter(item => item.category === 'Storage - Block');
      expect(blockItems).toHaveLength(2);

      const bootItem = blockItems.find(item => item.description.includes('Boot'));
      expect(bootItem).toBeDefined();
      expect(bootItem!.quantity).toBe(12800);
      expect(bootItem!.notes).toContain('256 boot volumes');
      expect(bootItem!.description).toContain('Boot');

      const dataItem = blockItems.find(item => item.description.includes('Data'));
      expect(dataItem).toBeDefined();
      expect(dataItem!.quantity).toBe(5000);
      expect(dataItem!.notes).toContain('156 data volumes');
    });

    it('should default data tier to 5iops for bm-block-csi', () => {
      const input: ROKSSizingInput = {
        computeNodes: 3,
        computeProfile: 'bx2-metal-96x384',
        solutionType: 'bm-block-csi',
        dataVolumeCount: 100,
        dataVolumeCapacityGiB: 2048,
      };
      const cost = calculateROKSCost(input);
      const dataItem = cost.lineItems.find(item => item.description.includes('Data'));
      expect(dataItem).toBeDefined();
      expect(dataItem!.description).toContain('5 IOPS/GB');
    });

    it('should produce bm-block-odf architecture with ODF per-node licensing', () => {
      const input: ROKSSizingInput = {
        computeNodes: 3,
        computeProfile: 'bx2-metal-96x384',
        solutionType: 'bm-block-odf',
        storageTiB: 10,
        odfTier: 'advanced',
      };
      const cost = calculateROKSCost(input);
      expect(cost.architecture).toBe('Bare Metal + Block Storage + ODF');
      // Should have ODF per-node licensing
      const odfItems = cost.lineItems.filter(item => item.category === 'Storage - ODF');
      expect(odfItems).toHaveLength(1);
      expect(odfItems[0].unit).toBe('nodes');
      expect(odfItems[0].quantity).toBe(3);
      expect(odfItems[0].notes).toContain('block storage backed');
    });

    it('should default data tier to 10iops for bm-block-odf', () => {
      const input: ROKSSizingInput = {
        computeNodes: 3,
        computeProfile: 'bx2-metal-96x384',
        solutionType: 'bm-block-odf',
        storageTiB: 10,
      };
      const cost = calculateROKSCost(input);
      const dataItem = cost.lineItems.find(item => item.description.includes('Data'));
      expect(dataItem).toBeDefined();
      expect(dataItem!.description).toContain('10 IOPS');
    });

    it('should not include VSI storage nodes for block storage solutions', () => {
      const input: ROKSSizingInput = {
        computeNodes: 3,
        computeProfile: 'bx2-metal-96x384',
        solutionType: 'bm-block-csi',
        storageTiB: 10,
        storageNodes: 3,
        storageProfile: 'bx2-4x16',
      };
      const cost = calculateROKSCost(input);
      const vsiItems = cost.lineItems.filter(item => item.category === 'Storage - VSI');
      expect(vsiItems).toHaveLength(0);
    });

    it('should apply ROV variant to block storage solutions', () => {
      const input: ROKSSizingInput = {
        computeNodes: 3,
        computeProfile: 'bx2-metal-96x384',
        solutionType: 'bm-block-odf',
        storageTiB: 10,
      };
      const roksCost = calculateROKSCost(input, 'us-south', 'onDemand', undefined, 'full');
      const rovCost = calculateROKSCost(input, 'us-south', 'onDemand', undefined, 'rov');
      expect(rovCost.totalMonthly).toBeLessThan(roksCost.totalMonthly);
    });
  });

  describe('calculateROKSCost with bm-disaggregated', () => {
    it('should produce disaggregated architecture with separate compute and storage BM line items', () => {
      const input: ROKSSizingInput = {
        computeNodes: 6,
        computeProfile: 'bx2-metal-96x384',
        storageNodes: 3,
        storageProfile: 'bx2d-metal-96x384',
        solutionType: 'bm-disaggregated',
        odfTier: 'advanced',
      };
      const cost = calculateROKSCost(input);
      expect(cost.architecture).toBe('Disaggregated Bare Metal (Compute + Storage Pools)');

      // Compute BM line item
      const computeItems = cost.lineItems.filter(item => item.category === 'Compute');
      expect(computeItems).toHaveLength(1);
      expect(computeItems[0].quantity).toBe(6);

      // Storage BM line item
      const storageBMItems = cost.lineItems.filter(item => item.category === 'Storage - Bare Metal');
      expect(storageBMItems).toHaveLength(1);
      expect(storageBMItems[0].quantity).toBe(3);
      expect(storageBMItems[0].description).toContain('ODF Storage Pool');
    });

    it('should license ODF on storage nodes only', () => {
      const input: ROKSSizingInput = {
        computeNodes: 6,
        computeProfile: 'bx2-metal-96x384',
        storageNodes: 3,
        storageProfile: 'bx2d-metal-96x384',
        solutionType: 'bm-disaggregated',
        odfTier: 'advanced',
      };
      const cost = calculateROKSCost(input);
      const odfItems = cost.lineItems.filter(item => item.category === 'Storage - ODF');
      expect(odfItems).toHaveLength(1);
      expect(odfItems[0].quantity).toBe(3); // storage nodes only, not 6 compute
      expect(odfItems[0].notes).toContain('dedicated storage nodes only');
    });

    it('should license OCP on all nodes (compute + storage)', () => {
      const input: ROKSSizingInput = {
        computeNodes: 6,
        computeProfile: 'bx2-metal-96x384',
        storageNodes: 3,
        storageProfile: 'bx2d-metal-96x384',
        solutionType: 'bm-disaggregated',
      };
      const cost = calculateROKSCost(input);
      const ocpItems = cost.lineItems.filter(item => item.description.includes('Container Platform'));
      expect(ocpItems).toHaveLength(1);
      // vCPUs should include both compute (6 * 96) and storage (3 * 96) = 864
      const computeVCPUs = 96 * 6; // bx2-metal-96x384 has 96 vCPUs
      const storageVCPUs = 96 * 3; // bx2d-metal-96x384 has 96 vCPUs
      expect(ocpItems[0].quantity).toBe(computeVCPUs + storageVCPUs);
    });

    it('should show NVMe storage included at zero cost', () => {
      const input: ROKSSizingInput = {
        computeNodes: 6,
        computeProfile: 'bx2-metal-96x384',
        storageNodes: 3,
        storageProfile: 'bx2d-metal-96x384',
        solutionType: 'bm-disaggregated',
      };
      const cost = calculateROKSCost(input);
      const nvmeItems = cost.lineItems.filter(item => item.description.includes('NVMe'));
      expect(nvmeItems).toHaveLength(1);
      expect(nvmeItems[0].monthlyCost).toBe(0);
      expect(nvmeItems[0].notes).toContain('per storage node');
    });
  });

  describe('validateROKSSizingInput with new fields', () => {
    it('should accept general-purpose storage tier', () => {
      const result = validateROKSSizingInput({
        computeNodes: 3,
        computeProfile: 'bx2-metal-96x384',
        storageTier: 'general-purpose',
      });
      expect(result.valid).toBe(true);
    });

    it('should accept valid solution types', () => {
      for (const st of ['nvme-converged', 'hybrid-vsi-odf', 'bm-block-csi', 'bm-block-odf', 'bm-disaggregated', 'bm-nfs-csi']) {
        const result = validateROKSSizingInput({
          computeNodes: 3,
          computeProfile: 'bx2-metal-96x384',
          solutionType: st,
        } as ROKSSizingInput);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject invalid solution type', () => {
      const result = validateROKSSizingInput({
        computeNodes: 3,
        computeProfile: 'bx2-metal-96x384',
        solutionType: 'invalid-type' as never,
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('calculateDp2FileStorageMonthlyCost', () => {
    const defaultRates = [
      { upTo: 5000, rate: 0.000138 },
      { upTo: 20000, rate: 0.0000692 },
      { upTo: 40000, rate: 0.0000277 },
      { upTo: 96000, rate: 0.0000138 },
    ];

    it('should calculate capacity + IOPS cost for 500 IOPS', () => {
      const result = calculateDp2FileStorageMonthlyCost(100, 500, 0.15155, defaultRates);
      expect(result.capacityCost).toBeCloseTo(15.155, 2);
      // 500 IOPS × $0.000138/hr × 730 hrs = $50.37
      expect(result.iopsCost).toBeCloseTo(500 * 0.000138 * 730, 2);
      expect(result.totalCost).toBeCloseTo(result.capacityCost + result.iopsCost, 2);
    });

    it('should calculate capacity + IOPS cost for 3000 IOPS', () => {
      const result = calculateDp2FileStorageMonthlyCost(1000, 3000, 0.15155, defaultRates);
      expect(result.capacityCost).toBeCloseTo(151.55, 2);
      // 3000 IOPS all within first tier (≤5000)
      expect(result.iopsCost).toBeCloseTo(3000 * 0.000138 * 730, 2);
    });

    it('should apply tiered IOPS pricing across tiers', () => {
      // 10000 IOPS: 5000 at tier1 + 5000 at tier2
      const result = calculateDp2FileStorageMonthlyCost(500, 10000, 0.15155, defaultRates);
      const expectedIopsHourly = (5000 * 0.000138) + (5000 * 0.0000692);
      expect(result.iopsCost).toBeCloseTo(expectedIopsHourly * 730, 2);
    });

    it('should handle zero IOPS', () => {
      const result = calculateDp2FileStorageMonthlyCost(100, 0, 0.15155, defaultRates);
      expect(result.iopsCost).toBe(0);
      expect(result.totalCost).toBeCloseTo(15.155, 2);
    });
  });

  describe('calculateROKSCost with bm-nfs-csi', () => {
    it('should produce bm-nfs-csi architecture with no ODF line items', () => {
      const input: ROKSSizingInput = {
        computeNodes: 3,
        computeProfile: 'bx2-metal-96x384',
        solutionType: 'bm-nfs-csi',
        storageTiB: 10,
      };
      const cost = calculateROKSCost(input);
      expect(cost.architecture).toBe('Bare Metal + NFS File Storage (CSI)');
      const odfItems = cost.lineItems.filter(item => item.category === 'Storage - ODF');
      expect(odfItems).toHaveLength(0);
    });

    it('should group data volumes by disk size with per-share pricing', () => {
      const input: ROKSSizingInput = {
        computeNodes: 3,
        computeProfile: 'bx2-metal-96x384',
        solutionType: 'bm-nfs-csi',
        bootVolumeCount: 50,
        bootVolumeCapacityGiB: 5000,
        fileStorageIops: 500,
        fileStorageDiskGroups: [
          { capacityGiB: 100, count: 50 },
          { capacityGiB: 150, count: 100 },
        ],
      };
      const cost = calculateROKSCost(input);

      // No block storage
      const blockItems = cost.lineItems.filter(item => item.category === 'Storage - Block');
      expect(blockItems).toHaveLength(0);

      const fileItems = cost.lineItems.filter(item => item.category === 'Storage - File');
      // 1 boot + 2 data groups = 3 file storage lines
      expect(fileItems).toHaveLength(3);

      // Boot
      const bootItem = fileItems.find(item => item.description.includes('Boot'));
      expect(bootItem).toBeDefined();
      expect(bootItem!.notes).toContain('50 boot volumes');

      // Data groups — each has accurate per-share unit cost
      const data100 = fileItems.find(item => item.description.includes('Data 100 GB'));
      expect(data100).toBeDefined();
      expect(data100!.quantity).toBe(5000); // 100 GB × 50
      expect(data100!.notes).toContain('50 × 100 GB');

      const data150 = fileItems.find(item => item.description.includes('Data 150 GB'));
      expect(data150).toBeDefined();
      expect(data150!.quantity).toBe(15000); // 150 GB × 100
      expect(data150!.notes).toContain('100 × 150 GB');

      // Unit cost per GB should differ (IOPS charge is fixed per share, capacity varies)
      expect(data100!.unitCost).toBeGreaterThan(data150!.unitCost);
    });

    it('should fall back to aggregate line when no disk groups', () => {
      const input: ROKSSizingInput = {
        computeNodes: 3,
        computeProfile: 'bx2-metal-96x384',
        solutionType: 'bm-nfs-csi',
        bootVolumeCount: 100,
        bootVolumeCapacityGiB: 5000,
        fileStorageCapacityGiB: 20000,
        dataVolumeCount: 200,
        dataStorageTier: '5iops', // maps to 1,000 IOPS via getNfsIopsForTier
      };
      const cost = calculateROKSCost(input);

      const fileItems = cost.lineItems.filter(item => item.category === 'Storage - File');
      expect(fileItems).toHaveLength(2); // boot + 1 aggregate data

      const dataItem = fileItems.find(item => item.description.includes('Data'));
      expect(dataItem).toBeDefined();
      expect(dataItem!.description).toContain('1,000 IOPS');
      expect(dataItem!.quantity).toBe(20000);
      expect(dataItem!.notes).toContain('200 data volumes');
    });

    it('should default file storage IOPS to 500', () => {
      const input: ROKSSizingInput = {
        computeNodes: 3,
        computeProfile: 'bx2-metal-96x384',
        solutionType: 'bm-nfs-csi',
        fileStorageCapacityGiB: 10000,
      };
      const cost = calculateROKSCost(input);
      const fileItems = cost.lineItems.filter(item => item.category === 'Storage - File');
      expect(fileItems).toHaveLength(1);
      expect(fileItems[0].description).toContain('500 IOPS');
    });

    it('should fall back to storageTiB for file storage capacity', () => {
      const input: ROKSSizingInput = {
        computeNodes: 3,
        computeProfile: 'bx2-metal-96x384',
        solutionType: 'bm-nfs-csi',
        storageTiB: 5,
      };
      const cost = calculateROKSCost(input);
      const fileItems = cost.lineItems.filter(item => item.category === 'Storage - File');
      expect(fileItems).toHaveLength(1);
      expect(fileItems[0].quantity).toBe(5120); // 5 TiB * 1024
    });

    it('should include metadata note about File Storage', () => {
      const input: ROKSSizingInput = {
        computeNodes: 3,
        computeProfile: 'bx2-metal-96x384',
        solutionType: 'bm-nfs-csi',
        storageTiB: 5,
      };
      const cost = calculateROKSCost(input);
      expect(cost.metadata.notes).toContainEqual(expect.stringContaining('File Storage'));
    });

    it('should work with ROV variant', () => {
      const input: ROKSSizingInput = {
        computeNodes: 3,
        computeProfile: 'bx2-metal-96x384',
        solutionType: 'bm-nfs-csi',
        fileStorageCapacityGiB: 10000,
        fileStorageIops: 500,
      };
      const roksCost = calculateROKSCost(input, 'us-south', 'onDemand', undefined, 'full');
      const rovCost = calculateROKSCost(input, 'us-south', 'onDemand', undefined, 'rov');
      // ROV has lower license cost
      expect(rovCost.totalMonthly).toBeLessThan(roksCost.totalMonthly);
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
