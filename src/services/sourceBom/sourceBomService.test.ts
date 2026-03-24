import { describe, it, expect } from 'vitest';
import {
  matchHostToBareMetal,
  groupHostMappings,
  classifyDatastoreStorage,
  buildSourceBOM,
} from './sourceBomService';
import type { VHostInfo, VDatastoreInfo } from '@/types/rvtools';
import type { BareMetalProfile } from '@/services/pricing/pricingCache';
import type { HostMapping } from './types';

// ===== TEST HELPERS =====

function makeHost(overrides: Partial<VHostInfo> = {}): VHostInfo {
  return {
    name: 'esxi-host-01',
    cpuModel: 'Intel Xeon Gold 5218',
    cpuMHz: 2300,
    cpuSockets: 2,
    coresPerSocket: 16,
    totalCpuCores: 32,
    hyperthreading: true,
    cpuUsageMHz: 0,
    memoryMiB: 262144, // 256 GiB
    memoryUsageMiB: 0,
    vendor: 'Dell Inc.',
    model: 'PowerEdge R640',
    esxiVersion: '7.0.3',
    esxiBuild: '',
    vmCount: 10,
    vmCpuCount: 40,
    vmMemoryMiB: 131072,
    uptimeSeconds: 0,
    datacenter: 'DC1',
    cluster: 'Cluster-A',
    ...overrides,
  };
}

function makeProfile(overrides: Partial<BareMetalProfile> = {}): BareMetalProfile {
  return {
    profile: 'bx2d-metal-96x384',
    family: 'balanced',
    vcpus: 96,
    physicalCores: 48,
    memoryGiB: 384,
    hasNvme: true,
    hourlyRate: 5.0,
    monthlyRate: 3650,
    description: 'Balanced - 96 vCPUs, 384 GiB RAM',
    ...overrides,
  };
}

function makeDatastore(overrides: Partial<VDatastoreInfo> = {}): VDatastoreInfo {
  return {
    name: 'ds-nfs-01',
    type: 'NFS',
    capacityMiB: 10240 * 1024, // 10 TiB
    provisionedMiB: 5120 * 1024,
    inUseMiB: 3072 * 1024,
    freeMiB: 7168 * 1024,
    freePercent: 70,
    siocEnabled: false,
    hosts: 'esxi-host-01,esxi-host-02',
    hostCount: 2,
    datacenter: 'DC1',
    cluster: 'Cluster-A',
    ...overrides,
  };
}

const smallProfile = makeProfile({
  profile: 'bx2-metal-32x128',
  physicalCores: 16,
  memoryGiB: 128,
  monthlyRate: 1200,
  hasNvme: false,
});

const mediumProfile = makeProfile({
  profile: 'bx2d-metal-64x256',
  physicalCores: 32,
  memoryGiB: 256,
  monthlyRate: 2400,
});

const largeProfile = makeProfile({
  profile: 'bx2d-metal-96x384',
  physicalCores: 48,
  memoryGiB: 384,
  monthlyRate: 3650,
});

const xlProfile = makeProfile({
  profile: 'mx2d-metal-96x768',
  physicalCores: 48,
  memoryGiB: 768,
  monthlyRate: 5200,
});

const allProfiles = [smallProfile, mediumProfile, largeProfile, xlProfile];

// ===== TESTS =====

describe('matchHostToBareMetal', () => {
  it('selects the smallest adequate profile (exact fit)', () => {
    const host = makeHost({ totalCpuCores: 32, memoryMiB: 256 * 1024 });
    const { mapping, warning } = matchHostToBareMetal(host, allProfiles);
    expect(mapping.matchedProfile).toBe('bx2d-metal-64x256');
    expect(mapping.overProvisionCoresPct).toBe(0);
    expect(mapping.overProvisionMemoryPct).toBe(0);
    expect(warning).toBeUndefined();
  });

  it('selects over-provisioned profile when exact match unavailable', () => {
    const host = makeHost({ totalCpuCores: 20, memoryMiB: 200 * 1024 });
    const { mapping, warning } = matchHostToBareMetal(host, allProfiles);
    expect(mapping.matchedProfile).toBe('bx2d-metal-64x256');
    expect(mapping.overProvisionCoresPct).toBe(60); // (32-20)/20 = 60%
    expect(mapping.overProvisionMemoryPct).toBe(28); // (256-200)/200 = 28%
    expect(warning).toBeUndefined();
  });

  it('picks largest profile and warns when host exceeds all profiles', () => {
    const host = makeHost({ totalCpuCores: 64, memoryMiB: 1024 * 1024 });
    const { mapping, warning } = matchHostToBareMetal(host, allProfiles);
    // Largest by cores then memory
    expect(mapping.matchedProfile).toBe('mx2d-metal-96x768');
    expect(warning).toContain('exceeds the largest available');
    expect(warning).toContain('esxi-host-01');
  });

  it('handles host with small specs — picks smallest profile', () => {
    const host = makeHost({ totalCpuCores: 8, memoryMiB: 64 * 1024 });
    const { mapping, warning } = matchHostToBareMetal(host, allProfiles);
    expect(mapping.matchedProfile).toBe('bx2-metal-32x128');
    expect(warning).toBeUndefined();
  });

  it('preserves source host metadata', () => {
    const host = makeHost({
      name: 'esx-prod-42',
      cpuModel: 'AMD EPYC 7543',
      vendor: 'HPE',
      model: 'ProLiant DL380',
      cluster: 'Production',
      datacenter: 'London-DC',
    });
    const { mapping } = matchHostToBareMetal(host, allProfiles);
    expect(mapping.hostName).toBe('esx-prod-42');
    expect(mapping.sourceCpuModel).toBe('AMD EPYC 7543');
    expect(mapping.sourceVendor).toBe('HPE');
    expect(mapping.sourceModel).toBe('ProLiant DL380');
    expect(mapping.cluster).toBe('Production');
    expect(mapping.datacenter).toBe('London-DC');
  });

  it('prefers fewer cores when memory is equal', () => {
    const profileA = makeProfile({ profile: 'a', physicalCores: 32, memoryGiB: 256, monthlyRate: 2000 });
    const profileB = makeProfile({ profile: 'b', physicalCores: 48, memoryGiB: 256, monthlyRate: 3000 });
    const host = makeHost({ totalCpuCores: 24, memoryMiB: 200 * 1024 });
    const { mapping } = matchHostToBareMetal(host, [profileB, profileA]);
    expect(mapping.matchedProfile).toBe('a');
  });
});

describe('groupHostMappings', () => {
  it('groups mappings by matched profile', () => {
    const mappings: HostMapping[] = [
      { ...makeHost(), hostName: 'h1', matchedProfile: 'bx2d-metal-64x256', matchedProfileCores: 32, matchedProfileMemoryGiB: 256, profileMonthlyCost: 2400, sourceCores: 32, sourceMemoryGiB: 256, sourceCpuModel: '', sourceVendor: '', sourceModel: '', cluster: 'C1', datacenter: 'DC1', overProvisionCoresPct: 0, overProvisionMemoryPct: 0 },
      { ...makeHost(), hostName: 'h2', matchedProfile: 'bx2d-metal-64x256', matchedProfileCores: 32, matchedProfileMemoryGiB: 256, profileMonthlyCost: 2400, sourceCores: 28, sourceMemoryGiB: 200, sourceCpuModel: '', sourceVendor: '', sourceModel: '', cluster: 'C1', datacenter: 'DC1', overProvisionCoresPct: 0, overProvisionMemoryPct: 0 },
      { ...makeHost(), hostName: 'h3', matchedProfile: 'bx2d-metal-96x384', matchedProfileCores: 48, matchedProfileMemoryGiB: 384, profileMonthlyCost: 3650, sourceCores: 40, sourceMemoryGiB: 384, sourceCpuModel: '', sourceVendor: '', sourceModel: '', cluster: 'C2', datacenter: 'DC1', overProvisionCoresPct: 0, overProvisionMemoryPct: 0 },
    ];
    const groups = groupHostMappings(mappings);
    expect(groups).toHaveLength(2);
    const g64 = groups.find(g => g.profile === 'bx2d-metal-64x256')!;
    expect(g64.quantity).toBe(2);
    expect(g64.hosts).toEqual(['h1', 'h2']);
    expect(g64.totalMonthlyCost).toBe(4800);
    const g96 = groups.find(g => g.profile === 'bx2d-metal-96x384')!;
    expect(g96.quantity).toBe(1);
    expect(g96.totalMonthlyCost).toBe(3650);
  });

  it('returns empty array for empty mappings', () => {
    expect(groupHostMappings([])).toEqual([]);
  });
});

describe('classifyDatastoreStorage', () => {
  it('classifies NFS → file-storage', () => {
    const ds = makeDatastore({ type: 'NFS', capacityMiB: 1024 * 1024 }); // 1 TiB
    const items = classifyDatastoreStorage([ds], 0.11, 0.10);
    expect(items).toHaveLength(1);
    expect(items[0].ibmCloudTarget).toBe('file-storage');
    expect(items[0].capacityGiB).toBe(1024);
    expect(items[0].monthlyCost).toBeCloseTo(112.64, 1);
  });

  it('classifies VMFS → block-storage', () => {
    const ds = makeDatastore({ type: 'VMFS', capacityMiB: 2048 * 1024 });
    const items = classifyDatastoreStorage([ds], 0.11, 0.10);
    expect(items).toHaveLength(1);
    expect(items[0].ibmCloudTarget).toBe('block-storage');
    expect(items[0].monthlyCost).toBeCloseTo(204.80, 1);
  });

  it('classifies vSAN → local-nvme with $0 cost', () => {
    const ds = makeDatastore({ type: 'vsan', capacityMiB: 4096 * 1024 });
    const items = classifyDatastoreStorage([ds], 0.11, 0.10);
    expect(items).toHaveLength(1);
    expect(items[0].ibmCloudTarget).toBe('local-nvme');
    expect(items[0].monthlyCost).toBe(0);
    expect(items[0].costPerGBMonth).toBe(0);
  });

  it('classifies VVOL → local-nvme', () => {
    const ds = makeDatastore({ type: 'VVOL' });
    const items = classifyDatastoreStorage([ds], 0.11, 0.10);
    expect(items[0].ibmCloudTarget).toBe('local-nvme');
  });

  it('classifies NFS41 → file-storage', () => {
    const ds = makeDatastore({ type: 'NFS41' });
    const items = classifyDatastoreStorage([ds], 0.11, 0.10);
    expect(items[0].ibmCloudTarget).toBe('file-storage');
  });

  it('defaults unknown types to block-storage', () => {
    const ds = makeDatastore({ type: 'Unknown' });
    const items = classifyDatastoreStorage([ds], 0.11, 0.10);
    expect(items[0].ibmCloudTarget).toBe('block-storage');
  });

  it('handles empty datastores', () => {
    expect(classifyDatastoreStorage([], 0.11, 0.10)).toEqual([]);
  });
});

describe('buildSourceBOM', () => {
  const baseInput = {
    hosts: [
      makeHost({ name: 'h1', totalCpuCores: 32, memoryMiB: 256 * 1024 }),
      makeHost({ name: 'h2', totalCpuCores: 32, memoryMiB: 256 * 1024 }),
      makeHost({ name: 'h3', totalCpuCores: 48, memoryMiB: 384 * 1024 }),
    ],
    datastores: [
      makeDatastore({ name: 'nfs-01', type: 'NFS', capacityMiB: 10240 * 1024 }),
      makeDatastore({ name: 'vmfs-01', type: 'VMFS', capacityMiB: 5120 * 1024 }),
      makeDatastore({ name: 'vsan-01', type: 'vsan', capacityMiB: 20480 * 1024 }),
    ],
    region: 'us-south',
    regionName: 'Dallas',
    bareMetalProfiles: Object.fromEntries(allProfiles.map(p => [p.profile, p])),
    fileStorageCostPerGBMonth: 0.11,
    blockStorageCostPerGBMonth: 0.10,
    vcfPerCoreMonthly: 192.50,
  };

  it('produces correct host groups', () => {
    const result = buildSourceBOM(baseInput);
    expect(result.hostMappings).toHaveLength(3);
    // h1 and h2 both match bx2d-metal-64x256 (32 cores, 256 GiB)
    // h3 matches bx2d-metal-96x384 (48 cores, 384 GiB)
    expect(result.hostGroups).toHaveLength(2);
    const g64 = result.hostGroups.find(g => g.profile === 'bx2d-metal-64x256')!;
    expect(g64.quantity).toBe(2);
    const g96 = result.hostGroups.find(g => g.profile === 'bx2d-metal-96x384')!;
    expect(g96.quantity).toBe(1);
  });

  it('classifies storage correctly', () => {
    const result = buildSourceBOM(baseInput);
    expect(result.storageItems).toHaveLength(3);
    const nfs = result.storageItems.find(s => s.datastoreName === 'nfs-01')!;
    expect(nfs.ibmCloudTarget).toBe('file-storage');
    const vmfs = result.storageItems.find(s => s.datastoreName === 'vmfs-01')!;
    expect(vmfs.ibmCloudTarget).toBe('block-storage');
    const vsan = result.storageItems.find(s => s.datastoreName === 'vsan-01')!;
    expect(vsan.ibmCloudTarget).toBe('local-nvme');
  });

  it('calculates VCF licensing correctly', () => {
    const result = buildSourceBOM(baseInput);
    // h1→32 cores, h2→32 cores, h3→48 cores = 112 total matched profile cores
    expect(result.vcfLicensing.totalPhysicalCores).toBe(112);
    expect(result.vcfLicensing.perCoreMonthly).toBe(192.50);
    expect(result.vcfLicensing.totalMonthly).toBe(21560);
  });

  it('builds CostEstimate with correct line items', () => {
    const result = buildSourceBOM(baseInput);
    const { estimate } = result;
    expect(estimate.architecture).toBe('source-vcf');
    expect(estimate.region).toBe('us-south');

    const computeItems = estimate.lineItems.filter(li => li.category === 'Compute');
    expect(computeItems.length).toBeGreaterThanOrEqual(1);

    const storageItems = estimate.lineItems.filter(li => li.category === 'Storage');
    expect(storageItems.length).toBe(2); // NFS + VMFS (vSAN has $0 so not listed separately, but as local)

    const licensingItems = estimate.lineItems.filter(li => li.category === 'Licensing');
    expect(licensingItems).toHaveLength(1);
    expect(licensingItems[0].description).toContain('VCF');

    // Total should be sum of all line items
    const computedTotal = estimate.lineItems.reduce((sum, li) => sum + li.monthlyCost, 0);
    expect(estimate.totalMonthly).toBeCloseTo(computedTotal, 0);
  });

  it('handles no warnings for well-matched hosts', () => {
    const result = buildSourceBOM(baseInput);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns when host exceeds largest profile', () => {
    const input = {
      ...baseInput,
      hosts: [makeHost({ name: 'big-host', totalCpuCores: 128, memoryMiB: 2048 * 1024 })],
    };
    const result = buildSourceBOM(input);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('big-host');
    expect(result.warnings[0]).toContain('exceeds');
  });

  it('handles empty hosts', () => {
    const result = buildSourceBOM({ ...baseInput, hosts: [] });
    expect(result.hostMappings).toEqual([]);
    expect(result.hostGroups).toEqual([]);
    expect(result.vcfLicensing.totalPhysicalCores).toBe(0);
    expect(result.estimate.lineItems.filter(li => li.category === 'Compute')).toHaveLength(0);
  });

  it('handles empty datastores', () => {
    const result = buildSourceBOM({ ...baseInput, datastores: [] });
    expect(result.storageItems).toEqual([]);
    expect(result.estimate.lineItems.filter(li => li.category === 'Storage')).toHaveLength(0);
  });

  it('excludes custom profiles from matching', () => {
    const customProfile = makeProfile({
      profile: 'custom-big',
      physicalCores: 192,
      memoryGiB: 1024,
      monthlyRate: 10000,
      isCustom: true,
    });
    const input = {
      ...baseInput,
      bareMetalProfiles: {
        ...baseInput.bareMetalProfiles,
        'custom-big': customProfile,
      },
    };
    const result = buildSourceBOM(input);
    // Custom profiles should not be matched
    const usedProfiles = result.hostMappings.map(m => m.matchedProfile);
    expect(usedProfiles).not.toContain('custom-big');
  });
});
