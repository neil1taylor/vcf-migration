import type { VHostInfo, VDatastoreInfo } from '@/types/rvtools';
import type { CostEstimate, CostLineItem } from '@/services/costEstimation';
import type { BillingMatchResult } from '@/services/billing/types';

export interface ClassicBareMetalCpu {
  keyName: string;
  description: string;
  cores: number;
  hourlyRate?: number;
  monthlyRate: number;
}

export interface ClassicBareMetalRam {
  keyName: string;
  description: string;
  memoryGiB: number;
  monthlyRate: number;
}

export interface HostMapping {
  hostName: string;
  cluster: string;
  datacenter: string;
  sourceCores: number;
  sourceMemoryGiB: number;
  sourceCpuModel: string;
  sourceVendor: string;
  sourceModel: string;
  matchedCpu: string;
  matchedCpuCores: number;
  matchedRam: string;
  matchedRamGiB: number;
  cpuMonthlyCost: number;
  ramMonthlyCost: number;
  profileMonthlyCost: number;
  overProvisionCoresPct: number;
  overProvisionMemoryPct: number;
  actualMonthlyCost?: number;
  costSource: 'estimated' | 'actual';
}

export interface HostGroupLineItem {
  profile: string;
  profileCores: number;
  profileMemoryGiB: number;
  quantity: number;
  hosts: string[];
  unitMonthlyCost: number;
  totalMonthlyCost: number;
}

export type DatastoreStorageTarget = 'file-storage' | 'block-storage' | 'local-nvme';

export interface StorageLineItem {
  datastoreName: string;
  datastoreType: string;
  capacityGiB: number;
  ibmCloudTarget: DatastoreStorageTarget;
  costPerGBMonth: number;
  monthlyCost: number;
}

export interface SourceBOMInput {
  hosts: VHostInfo[];
  datastores: VDatastoreInfo[];
  region: string;
  regionName: string;
  classicCpus: ClassicBareMetalCpu[];
  classicRam: ClassicBareMetalRam[];
  fileStorageCostPerGBMonth: number;
  blockStorageCostPerGBMonth: number;
  vcfPerCoreMonthly: number;
}

/** Additional cost categories surfaced only when billing data is loaded */
export interface AdditionalBillingCosts {
  lineItems: CostLineItem[];
  totalMonthly: number;
}

export interface SourceBOMResult {
  hostMappings: HostMapping[];
  hostGroups: HostGroupLineItem[];
  storageItems: StorageLineItem[];
  vcfLicensing: {
    totalPhysicalCores: number;
    perCoreMonthly: number;
    totalMonthly: number;
  };
  estimate: CostEstimate;
  warnings: string[];
  costSource: 'estimated' | 'actual' | 'mixed';
  additionalBillingCosts?: AdditionalBillingCosts;
  billingMatchResult?: BillingMatchResult;
}
