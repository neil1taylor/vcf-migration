import type { VHostInfo, VDatastoreInfo } from '@/types/rvtools';
import type { BareMetalProfile } from '@/services/pricing/pricingCache';
import type { CostEstimate } from '@/services/costEstimation';

export interface HostMapping {
  hostName: string;
  cluster: string;
  datacenter: string;
  sourceCores: number;
  sourceMemoryGiB: number;
  sourceCpuModel: string;
  sourceVendor: string;
  sourceModel: string;
  matchedProfile: string;
  matchedProfileCores: number;
  matchedProfileMemoryGiB: number;
  profileMonthlyCost: number;
  overProvisionCoresPct: number;
  overProvisionMemoryPct: number;
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
  bareMetalProfiles: Record<string, BareMetalProfile>;
  fileStorageCostPerGBMonth: number;
  blockStorageCostPerGBMonth: number;
  vcfPerCoreMonthly: number;
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
}
