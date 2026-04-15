// Shared sizing types used by BOM cache, export generators, and migration pages.
// Lives outside export/ to avoid circular dependencies (docx/types.ts imports bomCache.ts).

/** ROKS bare metal cluster sizing summary — computed by the sizing calculator on the ROKS page */
export interface ROKSSizing {
  workerNodes: number;
  profileName: string;
  totalCores: number;
  totalThreads: number;
  totalMemoryGiB: number;
  totalNvmeTiB: number;
  odfUsableTiB: number;
  monthlyCost: number;
  cpuOvercommit: number;
  // bm-disaggregated: dedicated storage pool details
  storageNodes?: number;
  storageProfileName?: string;
  storageTotalNvmeTiB?: number;
  solutionType?: string;
}

/** Per-VM VSI profile mapping with cost breakdown — computed by the VSI page */
export interface VSIMapping {
  vmName: string;
  sourceVcpus: number;
  sourceMemoryGiB: number;
  sourceStorageGiB: number;
  bootDiskGiB: number;
  dataDiskGiB: number;
  profile: string;
  profileVcpus: number;
  profileMemoryGiB: number;
  family: string;
  computeCost: number;
  bootStorageCost: number;
  dataStorageCost: number;
  storageCost: number;
  monthlyCost: number;
}
