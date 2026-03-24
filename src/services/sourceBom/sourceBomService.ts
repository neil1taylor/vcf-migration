import type { VHostInfo, VDatastoreInfo } from '@/types/rvtools';
import type { BareMetalProfile } from '@/services/pricing/pricingCache';
import type { CostEstimate, CostLineItem } from '@/services/costEstimation';
import type {
  HostMapping,
  HostGroupLineItem,
  StorageLineItem,
  DatastoreStorageTarget,
  SourceBOMInput,
  SourceBOMResult,
} from './types';

/**
 * Match a single ESXi host to the smallest adequate IBM Cloud bare metal profile.
 * Criteria: physicalCores >= host cores AND memoryGiB >= host memory.
 * Returns the mapping and any warnings.
 */
export function matchHostToBareMetal(
  host: VHostInfo,
  profiles: BareMetalProfile[],
): { mapping: HostMapping; warning?: string } {
  const hostMemoryGiB = Math.ceil(host.memoryMiB / 1024);

  // Filter profiles that meet or exceed the host's specs
  const candidates = profiles.filter(
    p => p.physicalCores >= host.totalCpuCores && p.memoryGiB >= hostMemoryGiB
  );

  let selectedProfile: BareMetalProfile;
  let warning: string | undefined;

  if (candidates.length > 0) {
    // Sort by cores ASC, then memory ASC — pick smallest adequate
    candidates.sort((a, b) => {
      if (a.physicalCores !== b.physicalCores) return a.physicalCores - b.physicalCores;
      return a.memoryGiB - b.memoryGiB;
    });
    selectedProfile = candidates[0];
  } else {
    // No adequate profile — pick the largest available
    const sorted = [...profiles].sort((a, b) => {
      if (a.physicalCores !== b.physicalCores) return b.physicalCores - a.physicalCores;
      return b.memoryGiB - a.memoryGiB;
    });
    selectedProfile = sorted[0];
    warning = `Host "${host.name}" (${host.totalCpuCores} cores, ${hostMemoryGiB} GiB) exceeds the largest available bare metal profile "${selectedProfile.profile}" (${selectedProfile.physicalCores} cores, ${selectedProfile.memoryGiB} GiB)`;
  }

  const overProvisionCoresPct = host.totalCpuCores > 0
    ? Math.round(((selectedProfile.physicalCores - host.totalCpuCores) / host.totalCpuCores) * 100)
    : 0;
  const overProvisionMemoryPct = hostMemoryGiB > 0
    ? Math.round(((selectedProfile.memoryGiB - hostMemoryGiB) / hostMemoryGiB) * 100)
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
      matchedProfile: selectedProfile.profile,
      matchedProfileCores: selectedProfile.physicalCores,
      matchedProfileMemoryGiB: selectedProfile.memoryGiB,
      profileMonthlyCost: selectedProfile.monthlyRate,
      overProvisionCoresPct,
      overProvisionMemoryPct,
    },
    warning,
  };
}

/**
 * Group host mappings by matched profile for BOM line items.
 */
export function groupHostMappings(mappings: HostMapping[]): HostGroupLineItem[] {
  const groups = new Map<string, { hosts: string[]; mapping: HostMapping }>();

  for (const m of mappings) {
    const existing = groups.get(m.matchedProfile);
    if (existing) {
      existing.hosts.push(m.hostName);
    } else {
      groups.set(m.matchedProfile, { hosts: [m.hostName], mapping: m });
    }
  }

  return Array.from(groups.entries()).map(([profile, { hosts, mapping }]) => ({
    profile,
    profileCores: mapping.matchedProfileCores,
    profileMemoryGiB: mapping.matchedProfileMemoryGiB,
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
 * Build a complete Source Infrastructure BOM.
 */
export function buildSourceBOM(input: SourceBOMInput): SourceBOMResult {
  const warnings: string[] = [];

  // Filter out custom/future profiles (no pricing) and profiles with $0 rates
  const availableProfiles = Object.values(input.bareMetalProfiles).filter(
    p => !p.isCustom && p.monthlyRate > 0
  );

  if (availableProfiles.length === 0) {
    warnings.push('No bare metal profiles with pricing available');
  }

  // Match hosts to bare metal profiles
  const hostMappings: HostMapping[] = [];
  for (const host of input.hosts) {
    if (availableProfiles.length === 0) {
      // Can't match without profiles — skip
      continue;
    }
    const { mapping, warning } = matchHostToBareMetal(host, availableProfiles);
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

  // VCF licensing
  const totalPhysicalCores = hostMappings.reduce((sum, m) => sum + m.matchedProfileCores, 0);
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
      description: `Bare Metal ${group.profile}`,
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
      description: 'File Storage for VPC (NFS)',
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
      description: 'Block Storage for VPC (VMFS)',
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
        'Source infrastructure BOM based on IBM Cloud list pricing',
        `${hostMappings.length} hosts matched to ${hostGroups.length} bare metal profile(s)`,
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
