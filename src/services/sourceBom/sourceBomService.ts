import type { VHostInfo, VDatastoreInfo } from '@/types/rvtools';
import type { CostEstimate, CostLineItem } from '@/services/costEstimation';
import type {
  ClassicBareMetalCpu,
  ClassicBareMetalRam,
  HostMapping,
  HostGroupLineItem,
  StorageLineItem,
  DatastoreStorageTarget,
  SourceBOMInput,
  SourceBOMResult,
} from './types';

/**
 * Match a single ESXi host to the best-fit Classic bare metal CPU and RAM components.
 * CPU: smallest option where cores >= host cores.
 * RAM: smallest option where memoryGiB >= host memory.
 * Returns the mapping and any warnings.
 */
export function matchHostToClassicBM(
  host: VHostInfo,
  cpus: ClassicBareMetalCpu[],
  rams: ClassicBareMetalRam[],
): { mapping: HostMapping; warning?: string } {
  const hostMemoryGiB = Math.ceil(host.memoryMiB / 1024);
  const warnings: string[] = [];

  // Match CPU
  const cpuCandidates = cpus
    .filter(c => c.cores >= host.totalCpuCores)
    .sort((a, b) => a.cores - b.cores);

  let selectedCpu: ClassicBareMetalCpu;
  if (cpuCandidates.length > 0) {
    selectedCpu = cpuCandidates[0];
  } else {
    const sorted = [...cpus].sort((a, b) => b.cores - a.cores);
    selectedCpu = sorted[0];
    warnings.push(
      `Host "${host.name}" (${host.totalCpuCores} cores) exceeds the largest available Classic bare metal CPU "${selectedCpu.description}" (${selectedCpu.cores} cores)`
    );
  }

  // Match RAM
  const ramCandidates = rams
    .filter(r => r.memoryGiB >= hostMemoryGiB)
    .sort((a, b) => a.memoryGiB - b.memoryGiB);

  let selectedRam: ClassicBareMetalRam;
  if (ramCandidates.length > 0) {
    selectedRam = ramCandidates[0];
  } else {
    const sorted = [...rams].sort((a, b) => b.memoryGiB - a.memoryGiB);
    selectedRam = sorted[0];
    warnings.push(
      `Host "${host.name}" (${hostMemoryGiB} GiB) exceeds the largest available Classic bare metal RAM "${selectedRam.description}" (${selectedRam.memoryGiB} GiB)`
    );
  }

  const totalMonthlyCost = selectedCpu.monthlyRate + selectedRam.monthlyRate;

  const overProvisionCoresPct = host.totalCpuCores > 0
    ? Math.round(((selectedCpu.cores - host.totalCpuCores) / host.totalCpuCores) * 100)
    : 0;
  const overProvisionMemoryPct = hostMemoryGiB > 0
    ? Math.round(((selectedRam.memoryGiB - hostMemoryGiB) / hostMemoryGiB) * 100)
    : 0;

  return {
    mapping: {
      hostName: host.name,
      cluster: host.cluster,
      datacenter: host.datacenter,
      sourceCores: host.totalCpuCores,
      sourceMemoryGiB: hostMemoryGiB,
      sourceCpuModel: host.cpuModel,
      sourceVendor: host.vendor,
      sourceModel: host.model,
      matchedCpu: selectedCpu.description,
      matchedCpuCores: selectedCpu.cores,
      matchedRam: selectedRam.description,
      matchedRamGiB: selectedRam.memoryGiB,
      cpuMonthlyCost: selectedCpu.monthlyRate,
      ramMonthlyCost: selectedRam.monthlyRate,
      profileMonthlyCost: totalMonthlyCost,
      overProvisionCoresPct,
      overProvisionMemoryPct,
    },
    warning: warnings.length > 0 ? warnings.join('; ') : undefined,
  };
}

/**
 * Group host mappings by matched CPU+RAM combo for BOM line items.
 */
export function groupHostMappings(mappings: HostMapping[]): HostGroupLineItem[] {
  const groups = new Map<string, { hosts: string[]; mapping: HostMapping }>();

  for (const m of mappings) {
    const key = `${m.matchedCpu} + ${m.matchedRam}`;
    const existing = groups.get(key);
    if (existing) {
      existing.hosts.push(m.hostName);
    } else {
      groups.set(key, { hosts: [m.hostName], mapping: m });
    }
  }

  return Array.from(groups.entries()).map(([profile, { hosts, mapping }]) => ({
    profile,
    profileCores: mapping.matchedCpuCores,
    profileMemoryGiB: mapping.matchedRamGiB,
    quantity: hosts.length,
    hosts,
    unitMonthlyCost: mapping.profileMonthlyCost,
    totalMonthlyCost: mapping.profileMonthlyCost * hosts.length,
  }));
}

/**
 * Classify each datastore by IBM Cloud storage target and calculate cost.
 * - vSAN / VVOL → local NVMe (included in bare metal, $0)
 * - NFS → File Storage
 * - VMFS → Block Storage
 */
export function classifyDatastoreStorage(
  datastores: VDatastoreInfo[],
  fileStorageCostPerGBMonth: number,
  blockStorageCostPerGBMonth: number,
): StorageLineItem[] {
  return datastores.map(ds => {
    const capacityGiB = Math.ceil(ds.capacityMiB / 1024);
    const dsType = ds.type?.toLowerCase() ?? '';
    let target: DatastoreStorageTarget;
    let costPerGBMonth: number;

    if (dsType === 'vsan' || dsType === 'vvol') {
      target = 'local-nvme';
      costPerGBMonth = 0;
    } else if (dsType === 'nfs' || dsType === 'nfs41') {
      target = 'file-storage';
      costPerGBMonth = fileStorageCostPerGBMonth;
    } else {
      // VMFS and others → Block Storage
      target = 'block-storage';
      costPerGBMonth = blockStorageCostPerGBMonth;
    }

    return {
      datastoreName: ds.name,
      datastoreType: ds.type || 'Unknown',
      capacityGiB,
      ibmCloudTarget: target,
      costPerGBMonth,
      monthlyCost: Math.round(capacityGiB * costPerGBMonth * 100) / 100,
    };
  });
}

/**
 * Build a complete Source Infrastructure BOM using Classic bare metal components.
 */
export function buildSourceBOM(input: SourceBOMInput): SourceBOMResult {
  const warnings: string[] = [];

  if (input.classicCpus.length === 0) {
    warnings.push('No Classic bare metal CPU options available');
  }
  if (input.classicRam.length === 0) {
    warnings.push('No Classic bare metal RAM options available');
  }

  // Match hosts to Classic bare metal CPU + RAM
  const hostMappings: HostMapping[] = [];
  for (const host of input.hosts) {
    if (input.classicCpus.length === 0 || input.classicRam.length === 0) {
      continue;
    }
    const { mapping, warning } = matchHostToClassicBM(host, input.classicCpus, input.classicRam);
    hostMappings.push(mapping);
    if (warning) warnings.push(warning);
  }

  // Group host mappings
  const hostGroups = groupHostMappings(hostMappings);

  // Classify storage
  const storageItems = classifyDatastoreStorage(
    input.datastores,
    input.fileStorageCostPerGBMonth,
    input.blockStorageCostPerGBMonth,
  );

  // VCF licensing based on matched CPU cores
  const totalPhysicalCores = hostMappings.reduce((sum, m) => sum + m.matchedCpuCores, 0);
  const vcfTotalMonthly = Math.round(totalPhysicalCores * input.vcfPerCoreMonthly * 100) / 100;
  const vcfLicensing = {
    totalPhysicalCores,
    perCoreMonthly: input.vcfPerCoreMonthly,
    totalMonthly: vcfTotalMonthly,
  };

  // Build CostEstimate line items
  const lineItems: CostLineItem[] = [];

  // Compute line items (one per host group)
  for (const group of hostGroups) {
    lineItems.push({
      category: 'Compute',
      description: `Classic Bare Metal: ${group.profile}`,
      quantity: group.quantity,
      unit: 'servers',
      unitCost: group.unitMonthlyCost,
      monthlyCost: group.totalMonthlyCost,
      annualCost: group.totalMonthlyCost * 12,
      notes: `${group.profileCores} cores, ${group.profileMemoryGiB} GiB per server`,
    });
  }

  // Storage line items (aggregate by target type)
  const fileStorageItems = storageItems.filter(s => s.ibmCloudTarget === 'file-storage');
  const blockStorageItems = storageItems.filter(s => s.ibmCloudTarget === 'block-storage');

  if (fileStorageItems.length > 0) {
    const totalCapacity = fileStorageItems.reduce((sum, s) => sum + s.capacityGiB, 0);
    const totalCost = fileStorageItems.reduce((sum, s) => sum + s.monthlyCost, 0);
    lineItems.push({
      category: 'Storage',
      description: 'File Storage (NFS)',
      quantity: totalCapacity,
      unit: 'GB',
      unitCost: input.fileStorageCostPerGBMonth,
      monthlyCost: Math.round(totalCost * 100) / 100,
      annualCost: Math.round(totalCost * 12 * 100) / 100,
      notes: `${fileStorageItems.length} NFS datastore(s)`,
    });
  }

  if (blockStorageItems.length > 0) {
    const totalCapacity = blockStorageItems.reduce((sum, s) => sum + s.capacityGiB, 0);
    const totalCost = blockStorageItems.reduce((sum, s) => sum + s.monthlyCost, 0);
    lineItems.push({
      category: 'Storage',
      description: 'Block Storage (VMFS)',
      quantity: totalCapacity,
      unit: 'GB',
      unitCost: input.blockStorageCostPerGBMonth,
      monthlyCost: Math.round(totalCost * 100) / 100,
      annualCost: Math.round(totalCost * 12 * 100) / 100,
      notes: `${blockStorageItems.length} VMFS datastore(s)`,
    });
  }

  // VCF licensing
  lineItems.push({
    category: 'Licensing',
    description: 'VMware Cloud Foundation (VCF)',
    quantity: totalPhysicalCores,
    unit: 'cores',
    unitCost: input.vcfPerCoreMonthly,
    monthlyCost: vcfTotalMonthly,
    annualCost: Math.round(vcfTotalMonthly * 12 * 100) / 100,
    notes: `Per physical core per month`,
  });

  // Calculate totals
  const subtotalMonthly = lineItems.reduce((sum, li) => sum + li.monthlyCost, 0);
  const subtotalAnnual = lineItems.reduce((sum, li) => sum + li.annualCost, 0);

  const estimate: CostEstimate = {
    architecture: 'source-vcf',
    region: input.region,
    regionName: input.regionName,
    discountType: 'none',
    discountPct: 0,
    lineItems,
    subtotalMonthly: Math.round(subtotalMonthly * 100) / 100,
    subtotalAnnual: Math.round(subtotalAnnual * 100) / 100,
    discountAmountMonthly: 0,
    discountAmountAnnual: 0,
    totalMonthly: Math.round(subtotalMonthly * 100) / 100,
    totalAnnual: Math.round(subtotalAnnual * 100) / 100,
    metadata: {
      pricingVersion: new Date().toISOString().split('T')[0],
      generatedAt: new Date().toISOString(),
      notes: [
        'Source infrastructure BOM based on IBM Cloud Classic bare metal list pricing',
        `${hostMappings.length} hosts matched to ${hostGroups.length} Classic bare metal configuration(s)`,
        ...warnings,
      ],
    },
  };

  return {
    hostMappings,
    hostGroups,
    storageItems,
    vcfLicensing,
    estimate,
    warnings,
  };
}
