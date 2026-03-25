import { describe, it, expect } from 'vitest';
import {
  matchHostToClassicBM,
  groupHostMappings,
  classifyDatastoreStorage,
  buildSourceBOM,
} from './sourceBomService';
import type { VHostInfo, VDatastoreInfo } from '@/types/rvtools';
import type { ClassicBareMetalCpu, ClassicBareMetalRam, HostMapping } from './types';

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

function makeCpu(overrides: Partial<ClassicBareMetalCpu> = {}): ClassicBareMetalCpu {
  return {
    keyName: 'INTEL_XEON_5218_2_30',
    description: 'Dual Intel Xeon Gold 5218 (32 Cores, 2.30 GHz)',
    cores: 32,
    monthlyRate: 268.13,
    ...overrides,
  };
}

function makeRam(overrides: Partial<ClassicBareMetalRam> = {}): ClassicBareMetalRam {
  return {
    keyName: 'RAM_256_GB',
    description: '256 GB RAM',
    memoryGiB: 256,
    monthlyRate: 473.28,
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

const smallCpu = makeCpu({ keyName: 'INTEL_4110', description: 'Dual Xeon Silver 4110 (16 Cores)', cores: 16, monthlyRate: 170.25 });
const medCpu = makeCpu({ keyName: 'INTEL_5218', description: 'Dual Xeon Gold 5218 (32 Cores)', cores: 32, monthlyRate: 268.13 });
const largeCpu = makeCpu({ keyName: 'INTEL_6140', description: 'Dual Xeon Gold 6140 (36 Cores)', cores: 36, monthlyRate: 370.29 });
const xlCpu = makeCpu({ keyName: 'INTEL_8260', description: 'Dual Xeon Platinum 8260 (48 Cores)', cores: 48, monthlyRate: 412.85 });

const ram128 = makeRam({ keyName: 'RAM_128', description: '128 GB RAM', memoryGiB: 128, monthlyRate: 282.61 });
const ram256 = makeRam({ keyName: 'RAM_256', description: '256 GB RAM', memoryGiB: 256, monthlyRate: 473.28 });
const ram384 = makeRam({ keyName: 'RAM_384', description: '384 GB RAM', memoryGiB: 384, monthlyRate: 663.95 });
const ram512 = makeRam({ keyName: 'RAM_512', description: '512 GB RAM', memoryGiB: 512, monthlyRate: 854.62 });

const allCpus = [smallCpu, medCpu, largeCpu, xlCpu];
const allRams = [ram128, ram256, ram384, ram512];

// ===== TESTS =====

describe('matchHostToClassicBM', () => {
  it('selects the smallest adequate CPU and RAM (exact fit)', () => {
    const host = makeHost({ totalCpuCores: 32, memoryMiB: 256 * 1024 });
    const { mapping, warning } = matchHostToClassicBM(host, allCpus, allRams);
    expect(mapping.matchedCpu).toBe('Dual Xeon Gold 5218 (32 Cores)');
    expect(mapping.matchedCpuCores).toBe(32);
    expect(mapping.matchedRam).toBe('256 GB RAM');
    expect(mapping.matchedRamGiB).toBe(256);
    expect(mapping.overProvisionCoresPct).toBe(0);
    expect(mapping.overProvisionMemoryPct).toBe(0);
    expect(warning).toBeUndefined();
  });

  it('independently matches CPU and RAM — can over-provision differently', () => {
    const host = makeHost({ totalCpuCores: 20, memoryMiB: 200 * 1024 });
    const { mapping, warning } = matchHostToClassicBM(host, allCpus, allRams);
    expect(mapping.matchedCpu).toBe('Dual Xeon Gold 5218 (32 Cores)');
    expect(mapping.matchedRam).toBe('256 GB RAM');
    expect(mapping.overProvisionCoresPct).toBe(60); // (32-20)/20
    expect(mapping.overProvisionMemoryPct).toBe(28); // (256-200)/200
    expect(warning).toBeUndefined();
  });

  it('warns when host exceeds largest CPU', () => {
    const host = makeHost({ totalCpuCores: 64, memoryMiB: 256 * 1024 });
    const { mapping, warning } = matchHostToClassicBM(host, allCpus, allRams);
    expect(mapping.matchedCpuCores).toBe(48); // largest available
    expect(warning).toContain('exceeds the largest available Classic bare metal CPU');
    expect(warning).toContain('esxi-host-01');
  });

  it('warns when host exceeds largest RAM', () => {
    const host = makeHost({ totalCpuCores: 16, memoryMiB: 1024 * 1024 });
    const { mapping, warning } = matchHostToClassicBM(host, allCpus, allRams);
    expect(mapping.matchedRamGiB).toBe(512); // largest available
    expect(warning).toContain('exceeds the largest available Classic bare metal RAM');
  });

  it('calculates total cost as CPU + RAM', () => {
    const host = makeHost({ totalCpuCores: 32, memoryMiB: 384 * 1024 });
    const { mapping } = matchHostToClassicBM(host, allCpus, allRams);
    expect(mapping.cpuMonthlyCost).toBe(268.13);
    expect(mapping.ramMonthlyCost).toBe(663.95);
    expect(mapping.profileMonthlyCost).toBeCloseTo(268.13 + 663.95, 2);
  });

  it('handles host with small specs — picks smallest CPU and RAM', () => {
    const host = makeHost({ totalCpuCores: 8, memoryMiB: 64 * 1024 });
    const { mapping, warning } = matchHostToClassicBM(host, allCpus, allRams);
    expect(mapping.matchedCpuCores).toBe(16); // smallest
    expect(mapping.matchedRamGiB).toBe(128); // smallest
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
    const { mapping } = matchHostToClassicBM(host, allCpus, allRams);
    expect(mapping.hostName).toBe('esx-prod-42');
    expect(mapping.sourceCpuModel).toBe('AMD EPYC 7543');
    expect(mapping.sourceVendor).toBe('HPE');
    expect(mapping.sourceModel).toBe('ProLiant DL380');
    expect(mapping.cluster).toBe('Production');
    expect(mapping.datacenter).toBe('London-DC');
  });
});

describe('groupHostMappings', () => {
  it('groups mappings by matched CPU+RAM combo', () => {
    const base = {
      sourceCores: 32, sourceMemoryGiB: 256, sourceCpuModel: '', sourceVendor: '', sourceModel: '',
      cluster: 'C1', datacenter: 'DC1', overProvisionCoresPct: 0, overProvisionMemoryPct: 0,
    };
    const mappings: HostMapping[] = [
      { ...base, hostName: 'h1', matchedCpu: 'Dual Xeon 5218 (32c)', matchedCpuCores: 32, matchedRam: '256 GB RAM', matchedRamGiB: 256, cpuMonthlyCost: 268, ramMonthlyCost: 473, profileMonthlyCost: 741 },
      { ...base, hostName: 'h2', matchedCpu: 'Dual Xeon 5218 (32c)', matchedCpuCores: 32, matchedRam: '256 GB RAM', matchedRamGiB: 256, cpuMonthlyCost: 268, ramMonthlyCost: 473, profileMonthlyCost: 741 },
      { ...base, hostName: 'h3', matchedCpu: 'Dual Xeon 6140 (36c)', matchedCpuCores: 36, matchedRam: '384 GB RAM', matchedRamGiB: 384, cpuMonthlyCost: 370, ramMonthlyCost: 664, profileMonthlyCost: 1034 },
    ];
    const groups = groupHostMappings(mappings);
    expect(groups).toHaveLength(2);
    const g32 = groups.find(g => g.profileCores === 32)!;
    expect(g32.quantity).toBe(2);
    expect(g32.hosts).toEqual(['h1', 'h2']);
    expect(g32.totalMonthlyCost).toBe(1482);
    const g36 = groups.find(g => g.profileCores === 36)!;
    expect(g36.quantity).toBe(1);
    expect(g36.totalMonthlyCost).toBe(1034);
  });

  it('returns empty array for empty mappings', () => {
    expect(groupHostMappings([])).toEqual([]);
  });
});

describe('classifyDatastoreStorage', () => {
  it('classifies NFS -> file-storage', () => {
    const ds = makeDatastore({ type: 'NFS', capacityMiB: 1024 * 1024 }); // 1 TiB
    const items = classifyDatastoreStorage([ds], 0.11, 0.10);
    expect(items).toHaveLength(1);
    expect(items[0].ibmCloudTarget).toBe('file-storage');
    expect(items[0].capacityGiB).toBe(1024);
    expect(items[0].monthlyCost).toBeCloseTo(112.64, 1);
  });

  it('classifies VMFS -> block-storage', () => {
    const ds = makeDatastore({ type: 'VMFS', capacityMiB: 2048 * 1024 });
    const items = classifyDatastoreStorage([ds], 0.11, 0.10);
    expect(items).toHaveLength(1);
    expect(items[0].ibmCloudTarget).toBe('block-storage');
    expect(items[0].monthlyCost).toBeCloseTo(204.80, 1);
  });

  it('classifies vSAN -> local-nvme with $0 cost', () => {
    const ds = makeDatastore({ type: 'vsan', capacityMiB: 4096 * 1024 });
    const items = classifyDatastoreStorage([ds], 0.11, 0.10);
    expect(items).toHaveLength(1);
    expect(items[0].ibmCloudTarget).toBe('local-nvme');
    expect(items[0].monthlyCost).toBe(0);
    expect(items[0].costPerGBMonth).toBe(0);
  });

  it('classifies VVOL -> local-nvme', () => {
    const ds = makeDatastore({ type: 'VVOL' });
    const items = classifyDatastoreStorage([ds], 0.11, 0.10);
    expect(items[0].ibmCloudTarget).toBe('local-nvme');
  });

  it('classifies NFS41 -> file-storage', () => {
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
    classicCpus: allCpus,
    classicRam: allRams,
    fileStorageCostPerGBMonth: 0.11,
    blockStorageCostPerGBMonth: 0.10,
    vcfPerCoreMonthly: 192.50,
  };

  it('produces correct host groups', () => {
    const result = buildSourceBOM(baseInput);
    expect(result.hostMappings).toHaveLength(3);
    // h1 and h2 both match 32-core CPU + 256GB RAM
    // h3 matches 48-core CPU + 384GB RAM
    expect(result.hostGroups).toHaveLength(2);
    const g32 = result.hostGroups.find(g => g.profileCores === 32)!;
    expect(g32.quantity).toBe(2);
    const g48 = result.hostGroups.find(g => g.profileCores === 48)!;
    expect(g48.quantity).toBe(1);
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

  it('calculates VCF licensing based on matched CPU cores', () => {
    const result = buildSourceBOM(baseInput);
    // h1→32 cores, h2→32 cores, h3→48 cores = 112 total matched CPU cores
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
    // Compute descriptions should mention "Classic Bare Metal"
    for (const item of computeItems) {
      expect(item.description).toContain('Classic Bare Metal');
    }

    const storageItems = estimate.lineItems.filter(li => li.category === 'Storage');
    expect(storageItems.length).toBe(2); // NFS + VMFS

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

  it('warns when host exceeds largest CPU or RAM', () => {
    const input = {
      ...baseInput,
      hosts: [makeHost({ name: 'big-host', totalCpuCores: 128, memoryMiB: 2048 * 1024 })],
    };
    const result = buildSourceBOM(input);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
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

  it('warns when no CPU options available', () => {
    const input = { ...baseInput, classicCpus: [] };
    const result = buildSourceBOM(input);
    expect(result.warnings).toContain('No Classic bare metal CPU options available');
    expect(result.hostMappings).toEqual([]);
  });

  it('warns when no RAM options available', () => {
    const input = { ...baseInput, classicRam: [] };
    const result = buildSourceBOM(input);
    expect(result.warnings).toContain('No Classic bare metal RAM options available');
    expect(result.hostMappings).toEqual([]);
  });
});
