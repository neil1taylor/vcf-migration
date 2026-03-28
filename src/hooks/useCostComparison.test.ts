import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCostComparison } from './useCostComparison';
import type { RVToolsData, VirtualMachine, VDiskInfo } from '@/types/rvtools';
import type { CostEstimate, RegionCode, DiscountType } from '@/services/costEstimation';

// Mock useSourceBOM
const mockSourceEstimate: CostEstimate = {
  architecture: 'source-vcf',
  region: 'us-south',
  regionName: 'Dallas',
  discountType: 'none',
  discountPct: 0,
  lineItems: [
    { category: 'Compute', description: 'BM Servers', quantity: 3, unit: 'servers', unitCost: 5000, monthlyCost: 15000, annualCost: 180000 },
    { category: 'Storage', description: 'Block Storage', quantity: 1000, unit: 'GB', unitCost: 0.13, monthlyCost: 130, annualCost: 1560 },
    { category: 'Licensing', description: 'VCF License', quantity: 96, unit: 'cores', unitCost: 192.5, monthlyCost: 18480, annualCost: 221760 },
  ],
  subtotalMonthly: 33610,
  subtotalAnnual: 403320,
  discountAmountMonthly: 0,
  discountAmountAnnual: 0,
  totalMonthly: 33610,
  totalAnnual: 403320,
  metadata: { pricingVersion: '2026-03-24', generatedAt: '2026-03-28T00:00:00Z', notes: [] },
};

vi.mock('./useSourceBOM', () => ({
  useSourceBOM: vi.fn(() => ({
    estimate: mockSourceEstimate,
    hostMappings: [],
    hostGroups: [],
    storageItems: [],
    vcfLicensing: { totalPhysicalCores: 96, perCoreMonthly: 192.5, totalMonthly: 18480 },
    warnings: ['Test warning'],
  })),
}));

// Mock cost estimation functions
const mockEstimate = (totalMonthly: number): CostEstimate => ({
  architecture: 'test',
  region: 'us-south',
  regionName: 'Dallas',
  discountType: 'On-Demand',
  discountPct: 0,
  lineItems: [
    { category: 'Compute', description: 'Worker Nodes', quantity: 3, unit: 'nodes', unitCost: totalMonthly / 3, monthlyCost: totalMonthly, annualCost: totalMonthly * 12 },
  ],
  subtotalMonthly: totalMonthly,
  subtotalAnnual: totalMonthly * 12,
  discountAmountMonthly: 0,
  discountAmountAnnual: 0,
  totalMonthly,
  totalAnnual: totalMonthly * 12,
  metadata: { pricingVersion: '2026-03-24', generatedAt: '2026-03-28T00:00:00Z', notes: [] },
});

vi.mock('@/services/costEstimation', async () => {
  const actual = await vi.importActual<typeof import('@/services/costEstimation')>('@/services/costEstimation');
  return {
    ...actual,
    calculateROKSCost: vi.fn((_input, _region, _discount, _pricing, variant) => {
      // Return different costs per variant to test cheapest selection
      return mockEstimate(variant === 'full' ? 25000 : 22000);
    }),
    calculateVSICost: vi.fn(() => mockEstimate(20000)),
    getBareMetalProfiles: vi.fn(() => ({
      data: [
        { id: 'mx2d.metal.96x768', physicalCores: 48, memoryGiB: 768, hasNvme: true, nvmeDisks: 8, totalNvmeGB: 25600, roksSupported: true, monthlyRate: 5000, profile: 'mx2d.metal.96x768' },
        { id: 'bx2.metal.96x384', physicalCores: 48, memoryGiB: 384, hasNvme: false, roksSupported: true, monthlyRate: 3500, profile: 'bx2.metal.96x384' },
      ],
      quality: 'live',
      warnings: [],
    })),
  };
});

vi.mock('@/utils/nodeCalculation', () => ({
  calculateNodesForProfile: vi.fn(() => 3),
  calculateStorageNodesForProfile: vi.fn(() => 3),
}));

vi.mock('@/services/migration', () => ({
  mapVMToVSIProfile: vi.fn(() => ({ name: 'bx3d-8x40', vcpus: 8, memoryGiB: 40 })),
}));

// Build test data
function makeVM(name: string, cpus = 4, memoryMiB = 8192, inUseMiB = 40960): VirtualMachine {
  return {
    vmName: name,
    cpus,
    memory: memoryMiB,
    inUseMiB,
    provisionedMiB: inUseMiB * 2,
    powerState: 'poweredOn',
    guestOS: 'CentOS 8 (64-bit)',
    firmwareType: 'efi',
    template: false,
    annotation: null,
    uuid: `uuid-${name}`,
    nics: 1,
    datacenter: 'DC1',
    cluster: 'Cluster-01',
    host: 'host1',
    resourcePool: 'pool1',
    folder: '/',
    guestHostName: name,
    primaryIPAddress: '10.0.0.1',
    toolsStatus: 'toolsOk',
    toolsVersion: '11000',
    snapshotCount: 0,
    cdConnected: false,
    osFamily: 'linux',
  } as VirtualMachine;
}

function makeDisk(vmName: string, capacityMiB: number, diskKey = 0): VDiskInfo {
  return {
    vmName,
    capacityMiB,
    diskKey,
    disk: `Hard disk ${diskKey + 1}`,
    diskMode: 'persistent',
    thinProvisioned: true,
    controllerType: 'SCSI',
    datastore: 'datastore1',
    datacenter: 'DC1',
  } as VDiskInfo;
}

const testVMs = [makeVM('vm1'), makeVM('vm2'), makeVM('vm3')];
const testDisks = [
  makeDisk('vm1', 102400, 0), makeDisk('vm1', 204800, 1),
  makeDisk('vm2', 102400, 0),
  makeDisk('vm3', 102400, 0), makeDisk('vm3', 512000, 1),
];

const mockPricing = {
  pricingVersion: '2026-03-24',
  regions: { 'us-south': { name: 'Dallas' } },
} as any;

const mockRawData = {
  vInfo: testVMs,
  vHost: [{ hostName: 'host1' }],
  vDatastore: [],
  vDisk: testDisks,
  vNetwork: [],
  vSnapshot: [],
  vTools: [],
  vCluster: [],
  vCD: [],
  vSource: [],
} as unknown as RVToolsData;

describe('useCostComparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns source BOM estimate', () => {
    const { result } = renderHook(() =>
      useCostComparison(mockRawData, testVMs, testDisks, mockPricing, 'us-south' as RegionCode, 'onDemand' as DiscountType),
    );

    expect(result.current.sourceBOM).not.toBeNull();
    expect(result.current.sourceBOM!.totalMonthly).toBe(33610);
  });

  it('computes ROKS estimates for all solution types and variants', () => {
    const { result } = renderHook(() =>
      useCostComparison(mockRawData, testVMs, testDisks, mockPricing, 'us-south' as RegionCode, 'onDemand' as DiscountType),
    );

    // 6 solution types × 2 variants = 12 entries
    expect(result.current.roksEstimates.length).toBe(12);
    const fullEntries = result.current.roksEstimates.filter(e => e.variant === 'full');
    const rovEntries = result.current.roksEstimates.filter(e => e.variant === 'rov');
    expect(fullEntries.length).toBe(6);
    expect(rovEntries.length).toBe(6);
  });

  it('computes VSI estimate', () => {
    const { result } = renderHook(() =>
      useCostComparison(mockRawData, testVMs, testDisks, mockPricing, 'us-south' as RegionCode, 'onDemand' as DiscountType),
    );

    expect(result.current.vsiEstimate).not.toBeNull();
    expect(result.current.vsiEstimate!.totalMonthly).toBe(20000);
  });

  it('identifies cheapest ROKS and ROVe', () => {
    const { result } = renderHook(() =>
      useCostComparison(mockRawData, testVMs, testDisks, mockPricing, 'us-south' as RegionCode, 'onDemand' as DiscountType),
    );

    expect(result.current.cheapestRoks).not.toBeNull();
    expect(result.current.cheapestRoks!.totalMonthly).toBe(25000);
    expect(result.current.cheapestRov).not.toBeNull();
    expect(result.current.cheapestRov!.totalMonthly).toBe(22000);
  });

  it('computes best savings percentage relative to source', () => {
    const { result } = renderHook(() =>
      useCostComparison(mockRawData, testVMs, testDisks, mockPricing, 'us-south' as RegionCode, 'onDemand' as DiscountType),
    );

    // Source: 33610, cheapest target: VSI at 20000 → savings = (33610-20000)/33610 = 40.5%
    expect(result.current.bestSavingsPct).not.toBeNull();
    expect(result.current.bestSavingsPct!).toBeCloseTo(40.5, 0);
  });

  it('returns null estimates when no VMs provided', () => {
    const { result } = renderHook(() =>
      useCostComparison(mockRawData, [], testDisks, mockPricing, 'us-south' as RegionCode, 'onDemand' as DiscountType),
    );

    expect(result.current.roksEstimates.length).toBe(0);
    expect(result.current.vsiEstimate).toBeNull();
  });

  it('returns null estimates when no pricing available', () => {
    const { result } = renderHook(() =>
      useCostComparison(mockRawData, testVMs, testDisks, null, 'us-south' as RegionCode, 'onDemand' as DiscountType),
    );

    expect(result.current.roksEstimates.length).toBe(0);
    expect(result.current.vsiEstimate).toBeNull();
  });

  it('includes source warnings', () => {
    const { result } = renderHook(() =>
      useCostComparison(mockRawData, testVMs, testDisks, mockPricing, 'us-south' as RegionCode, 'onDemand' as DiscountType),
    );

    expect(result.current.sourceWarnings).toContain('Test warning');
  });

  it('marks future solution types', () => {
    const { result } = renderHook(() =>
      useCostComparison(mockRawData, testVMs, testDisks, mockPricing, 'us-south' as RegionCode, 'onDemand' as DiscountType),
    );

    const futureEntries = result.current.roksEstimates.filter(e => e.isFuture);
    // bm-block-csi and bm-block-odf are future → 2 types × 2 variants = 4
    expect(futureEntries.length).toBe(4);
  });

  it('returns region and discount info', () => {
    const { result } = renderHook(() =>
      useCostComparison(mockRawData, testVMs, testDisks, mockPricing, 'us-south' as RegionCode, 'onDemand' as DiscountType),
    );

    expect(result.current.region).toBe('us-south');
    expect(result.current.regionName).toBe('Dallas');
    expect(result.current.discountType).toBe('onDemand');
    expect(result.current.pricingVersion).toBe('2026-03-24');
  });
});
