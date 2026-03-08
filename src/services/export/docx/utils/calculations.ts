// DOCX Data Calculation Functions

import type { RVToolsData, VirtualMachine, VDiskInfo, VSnapshotInfo, VToolsInfo } from '@/types/rvtools';
import { mibToGiB, getHardwareVersionNumber } from '@/utils/formatters';
import { isVMwareInfrastructureVM } from '@/utils/autoExclusion';
import { HW_VERSION_MINIMUM, SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';
import ibmCloudConfig from '@/data/ibmCloudConfig.json';
import osCompatibilityData from '@/data/redhatOSCompatibility.json';
import {
  type MigrationMode,
  type PreflightCheckCounts,
  VPC_BOOT_DISK_MIN_GB,
  VPC_BOOT_DISK_MAX_GB,
  VPC_MAX_DISKS_PER_VM,
  getVSIOSCompatibility,
} from '@/services/migration';
import type { VMReadiness, ROKSSizing, VSIMapping } from '../types';
import { BOOT_DISK_SIZE_GIB, BOOT_STORAGE_COST_PER_GB, DATA_STORAGE_COST_PER_GB } from '../types';

function getOSCompatibility(guestOS: string) {
  const osLower = guestOS.toLowerCase();
  for (const entry of osCompatibilityData.osEntries) {
    if (entry.patterns.some((p: string) => osLower.includes(p))) {
      return entry;
    }
  }
  return osCompatibilityData.defaultEntry;
}

function mapVMToVSIProfile(vcpus: number, memoryGiB: number) {
  const vsiProfiles = ibmCloudConfig.vsiProfiles;
  const memToVcpuRatio = memoryGiB / vcpus;

  let family: 'balanced' | 'compute' | 'memory' = 'balanced';
  if (memToVcpuRatio <= 2.5) {
    family = 'compute';
  } else if (memToVcpuRatio >= 6) {
    family = 'memory';
  }

  const profiles = vsiProfiles[family];
  const bestFit = profiles.find(
    (p: { vcpus: number; memoryGiB: number }) => p.vcpus >= vcpus && p.memoryGiB >= memoryGiB
  );
  return { ...(bestFit || profiles[profiles.length - 1]), family };
}

function getVSIPricing(profileName: string): number {
  // Look up pricing from the profile definitions
  const allProfiles = [
    ...ibmCloudConfig.vsiProfiles.balanced,
    ...ibmCloudConfig.vsiProfiles.compute,
    ...ibmCloudConfig.vsiProfiles.memory,
  ];
  const profile = allProfiles.find((p: { name: string; monthlyRate?: number }) => p.name === profileName);
  return profile?.monthlyRate || 0;
}

function getBaremetalPricing(profileName: string): number {
  // Look up pricing from the bare metal profile definitions
  const allProfiles = [
    ...ibmCloudConfig.bareMetalProfiles.balanced,
    ...ibmCloudConfig.bareMetalProfiles.compute,
    ...ibmCloudConfig.bareMetalProfiles.memory,
  ];
  const profile = allProfiles.find((p: { name: string; monthlyRate?: number }) => p.name === profileName);
  return profile?.monthlyRate || 0;
}

export function calculateVMReadiness(rawData: RVToolsData): VMReadiness[] {
  const vms = rawData.vInfo.filter((vm) => vm.powerState === 'poweredOn' && !vm.template && !isVMwareInfrastructureVM(vm.vmName, vm.guestOS));
  const toolsMap = new Map(rawData.vTools.map((t: VToolsInfo) => [t.vmName, t]));
  const snapshotSet = new Set(
    rawData.vSnapshot
      .filter((s: VSnapshotInfo) => s.ageInDays > SNAPSHOT_BLOCKER_AGE_DAYS)
      .map((s: VSnapshotInfo) => s.vmName)
  );
  const rdmSet = new Set(rawData.vDisk.filter((d: VDiskInfo) => d.raw).map((d: VDiskInfo) => d.vmName));

  return vms.map((vm: VirtualMachine) => {
    const tool = toolsMap.get(vm.vmName);
    const osCompat = getOSCompatibility(vm.guestOS);
    const hwVersion = getHardwareVersionNumber(vm.hardwareVersion);

    const issues: string[] = [];
    let hasBlocker = false;
    let hasWarning = false;

    if (!tool || tool.toolsStatus === 'toolsNotInstalled') {
      issues.push('No VMware Tools');
      hasBlocker = true;
    }
    if (snapshotSet.has(vm.vmName)) {
      issues.push('Old Snapshots (>30d)');
      hasBlocker = true;
    }
    if (rdmSet.has(vm.vmName)) {
      issues.push('RDM Disk');
      hasBlocker = true;
    }
    if (osCompat.compatibilityStatus === 'unsupported') {
      issues.push('Unsupported OS');
      hasBlocker = true;
    }
    if (hwVersion < HW_VERSION_MINIMUM) {
      issues.push(`HW Version v${hwVersion}`);
      hasWarning = true;
    }
    if (tool?.toolsStatus === 'toolsOld') {
      issues.push('Outdated VMware Tools');
      hasWarning = true;
    }

    return {
      vmName: vm.vmName,
      cluster: vm.cluster || 'N/A',
      guestOS: vm.guestOS,
      cpus: vm.cpus,
      memoryGiB: Math.round(mibToGiB(vm.memory)),
      storageGiB: Math.round(mibToGiB(vm.provisionedMiB)),
      hasBlocker,
      hasWarning,
      issues,
    };
  });
}

export function calculateROKSSizing(rawData: RVToolsData): ROKSSizing {
  const { odfSizing, ocpVirtSizing, bareMetalProfiles: bmProfiles } = ibmCloudConfig;
  const bareMetalProfiles = [
    ...bmProfiles.balanced,
    ...bmProfiles.compute,
    ...bmProfiles.memory,
  ];
  const poweredOnVMs = rawData.vInfo.filter(
    (vm: VirtualMachine) => vm.powerState === 'poweredOn' && !vm.template && !isVMwareInfrastructureVM(vm.vmName, vm.guestOS)
  );

  const totalVCPUs = poweredOnVMs.reduce((sum: number, vm: VirtualMachine) => sum + vm.cpus, 0);
  const totalMemoryGiB = poweredOnVMs.reduce(
    (sum: number, vm: VirtualMachine) => sum + mibToGiB(vm.memory),
    0
  );
  const totalStorageGiB = poweredOnVMs.reduce(
    (sum: number, vm: VirtualMachine) => sum + mibToGiB(vm.provisionedMiB),
    0
  );

  const replicaFactor = odfSizing.replicaFactor;
  const operationalCapacity = odfSizing.operationalCapacityPercent / 100;
  const cephEfficiency = 1 - odfSizing.cephOverheadPercent / 100;
  const requiredRawStorageGiB = Math.ceil(
    (totalStorageGiB * replicaFactor) / operationalCapacity / cephEfficiency
  );
  const adjustedVCPUs = Math.ceil(totalVCPUs / ocpVirtSizing.cpuOvercommitConservative);

  const recommendedProfile = bareMetalProfiles.find(
    (p: { name: string }) => p.name === 'bx2d-metal-96x384'
  ) || bareMetalProfiles[0];

  const usableThreadsPerNode = Math.floor(recommendedProfile.vcpus * 0.85);
  const usableMemoryPerNode = recommendedProfile.memoryGiB - ocpVirtSizing.systemReservedMemoryGiB;
  const usableNvmePerNode = recommendedProfile.totalNvmeGiB || 0;

  const nodesForCPU = Math.ceil(adjustedVCPUs / usableThreadsPerNode);
  const nodesForMemory = Math.ceil(totalMemoryGiB / usableMemoryPerNode);
  const nodesForStorage = usableNvmePerNode > 0 ? Math.ceil(requiredRawStorageGiB / usableNvmePerNode) : 0;
  const baseNodeCount = Math.max(odfSizing.minOdfNodes, nodesForCPU, nodesForMemory, nodesForStorage);
  // ODF rack fault domain requires nodes in multiples of 3 (racks 0-2)
  const roundUpToRackGroup = (n: number) => Math.ceil(n / 3) * 3;
  const recommendedWorkers = roundUpToRackGroup(baseNodeCount + ocpVirtSizing.nodeRedundancy);

  const totalClusterNvmeGiB = recommendedWorkers * (recommendedProfile.totalNvmeGiB || 0);
  const odfUsableTiB =
    ((totalClusterNvmeGiB / replicaFactor) * operationalCapacity * cephEfficiency) / 1024;

  const monthlyCost = recommendedWorkers * getBaremetalPricing(recommendedProfile.name);

  return {
    workerNodes: recommendedWorkers,
    profileName: recommendedProfile.name,
    totalCores: recommendedWorkers * recommendedProfile.physicalCores,
    totalThreads: recommendedWorkers * recommendedProfile.vcpus,
    totalMemoryGiB: recommendedWorkers * recommendedProfile.memoryGiB,
    totalNvmeTiB: Math.round(totalClusterNvmeGiB / 1024),
    odfUsableTiB: parseFloat(odfUsableTiB.toFixed(1)),
    monthlyCost,
  };
}

export function calculateVSIMappings(rawData: RVToolsData): VSIMapping[] {
  const poweredOnVMs = rawData.vInfo.filter(
    (vm: VirtualMachine) => vm.powerState === 'poweredOn' && !vm.template && !isVMwareInfrastructureVM(vm.vmName, vm.guestOS)
  );

  return poweredOnVMs.map((vm: VirtualMachine) => {
    const memGiB = mibToGiB(vm.memory);
    const totalStorageGiB = mibToGiB(vm.inUseMiB || vm.provisionedMiB);
    const profile = mapVMToVSIProfile(vm.cpus, memGiB);
    const computeCost = getVSIPricing(profile.name);

    const bootDiskGiB = Math.min(BOOT_DISK_SIZE_GIB, Math.max(10, totalStorageGiB * 0.2));
    const bootStorageCost = bootDiskGiB * BOOT_STORAGE_COST_PER_GB;

    const dataDiskGiB = Math.max(0, totalStorageGiB - bootDiskGiB);
    const dataStorageCost = dataDiskGiB * DATA_STORAGE_COST_PER_GB;

    const storageCost = bootStorageCost + dataStorageCost;

    return {
      vmName: vm.vmName,
      sourceVcpus: vm.cpus,
      sourceMemoryGiB: Math.round(memGiB),
      sourceStorageGiB: Math.round(totalStorageGiB),
      bootDiskGiB: Math.round(bootDiskGiB),
      dataDiskGiB: Math.round(dataDiskGiB),
      profile: profile.name,
      profileVcpus: profile.vcpus,
      profileMemoryGiB: profile.memoryGiB,
      family: profile.family.charAt(0).toUpperCase() + profile.family.slice(1),
      computeCost,
      bootStorageCost,
      dataStorageCost,
      storageCost,
      monthlyCost: computeCost + storageCost,
    };
  });
}

/**
 * Check if VM name is RFC 1123 compliant (for ROKS)
 */
function isRFC1123Compliant(name: string): boolean {
  if (!name || name.length > 63) return false;
  const lowerName = name.toLowerCase();
  const rfc1123Pattern = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  return rfc1123Pattern.test(lowerName);
}

/**
 * Check if hostname is valid (for ROKS)
 */
function isValidHostname(hostname: string | null | undefined): boolean {
  const h = hostname?.toLowerCase()?.trim();
  return !!(h && h !== '' && h !== 'localhost' && h !== 'localhost.localdomain' && h !== 'localhost.local');
}

/**
 * Calculate pre-flight check counts (pure function, no React dependencies).
 * Replicates the logic from usePreflightChecks hook.
 */
export function calculatePreflightCounts(
  rawData: RVToolsData,
  mode: MigrationMode
): PreflightCheckCounts {
  const poweredOnVMs = rawData.vInfo.filter(
    (vm) => vm.powerState === 'poweredOn' && !vm.template && !isVMwareInfrastructureVM(vm.vmName, vm.guestOS)
  );
  const disks = rawData.vDisk;
  const snapshots = rawData.vSnapshot;
  const tools = rawData.vTools;
  const networks = rawData.vNetwork || [];
  const cdDrives = rawData.vCD || [];
  const cpuInfo = rawData.vCPU || [];
  const memoryInfo = rawData.vMemory || [];

  const toolsMap = new Map(tools.map((t: VToolsInfo) => [t.vmName, t]));

  // VMware Tools checks
  const vmsWithoutToolsList = poweredOnVMs.filter(vm => {
    const tool = toolsMap.get(vm.vmName);
    return !tool || tool.toolsStatus === 'toolsNotInstalled' || tool.toolsStatus === 'guestToolsNotInstalled';
  }).map(vm => vm.vmName);

  const vmsWithToolsNotRunningList = poweredOnVMs.filter(vm => {
    const tool = toolsMap.get(vm.vmName);
    return tool && (tool.toolsStatus === 'toolsNotRunning' || tool.toolsStatus === 'guestToolsNotRunning');
  }).map(vm => vm.vmName);

  // Snapshot checks
  const vmsWithOldSnapshotsList = [...new Set(
    snapshots.filter((s: VSnapshotInfo) => s.ageInDays > SNAPSHOT_BLOCKER_AGE_DAYS).map((s: VSnapshotInfo) => s.vmName)
  )];

  // Storage checks
  const vmsWithRDMList = [...new Set(disks.filter((d: VDiskInfo) => d.raw).map((d: VDiskInfo) => d.vmName))];
  const vmsWithSharedDisksList = [...new Set(disks.filter((d: VDiskInfo) =>
    d.sharingMode && d.sharingMode.toLowerCase() !== 'sharingnone'
  ).map((d: VDiskInfo) => d.vmName))];
  const vmsWithLargeDisksList = [...new Set(
    disks.filter((d: VDiskInfo) => mibToGiB(d.capacityMiB) > 2000).map((d: VDiskInfo) => d.vmName)
  )];

  // Hardware version
  const hwVersionOutdatedList: string[] = [];
  poweredOnVMs.forEach(vm => {
    const versionNum = getHardwareVersionNumber(vm.hardwareVersion);
    if (versionNum < HW_VERSION_MINIMUM) {
      hwVersionOutdatedList.push(vm.vmName);
    }
  });

  const counts: PreflightCheckCounts = {
    vmsWithoutTools: vmsWithoutToolsList.length,
    vmsWithoutToolsList,
    vmsWithToolsNotRunning: vmsWithToolsNotRunningList.length,
    vmsWithToolsNotRunningList,
    vmsWithOldSnapshots: vmsWithOldSnapshotsList.length,
    vmsWithOldSnapshotsList,
    vmsWithRDM: vmsWithRDMList.length,
    vmsWithRDMList,
    vmsWithSharedDisks: vmsWithSharedDisksList.length,
    vmsWithSharedDisksList,
    vmsWithLargeDisks: vmsWithLargeDisksList.length,
    vmsWithLargeDisksList,
    hwVersionOutdated: hwVersionOutdatedList.length,
    hwVersionOutdatedList,
  };

  // VSI-specific checks
  if (mode === 'vsi') {
    const vmsWithSmallBootDiskList = poweredOnVMs.filter(vm => {
      const vmDisks = disks.filter((d: VDiskInfo) => d.vmName === vm.vmName);
      if (vmDisks.length === 0) return false;
      const sortedDisks = [...vmDisks].sort((a, b) => (a.diskKey || 0) - (b.diskKey || 0));
      const bootDisk = sortedDisks[0];
      return bootDisk && mibToGiB(bootDisk.capacityMiB) < VPC_BOOT_DISK_MIN_GB;
    }).map(vm => vm.vmName);
    counts.vmsWithSmallBootDisk = vmsWithSmallBootDiskList.length;
    counts.vmsWithSmallBootDiskList = vmsWithSmallBootDiskList;

    const vmsWithLargeBootDiskList = poweredOnVMs.filter(vm => {
      const vmDisks = disks.filter((d: VDiskInfo) => d.vmName === vm.vmName);
      if (vmDisks.length === 0) return false;
      const sortedDisks = [...vmDisks].sort((a, b) => (a.diskKey || 0) - (b.diskKey || 0));
      const bootDisk = sortedDisks[0];
      return bootDisk && mibToGiB(bootDisk.capacityMiB) > VPC_BOOT_DISK_MAX_GB;
    }).map(vm => vm.vmName);
    counts.vmsWithLargeBootDisk = vmsWithLargeBootDiskList.length;
    counts.vmsWithLargeBootDiskList = vmsWithLargeBootDiskList;

    const vmsWithTooManyDisksList = poweredOnVMs.filter(vm => {
      const vmDiskCount = disks.filter((d: VDiskInfo) => d.vmName === vm.vmName).length;
      return vmDiskCount > VPC_MAX_DISKS_PER_VM;
    }).map(vm => vm.vmName);
    counts.vmsWithTooManyDisks = vmsWithTooManyDisksList.length;
    counts.vmsWithTooManyDisksList = vmsWithTooManyDisksList;

    const vmsWithLargeMemoryList = poweredOnVMs.filter(vm => mibToGiB(vm.memory) > 512).map(vm => vm.vmName);
    const vmsWithVeryLargeMemoryList = poweredOnVMs.filter(vm => mibToGiB(vm.memory) > 1024).map(vm => vm.vmName);
    counts.vmsWithLargeMemory = vmsWithLargeMemoryList.length;
    counts.vmsWithLargeMemoryList = vmsWithLargeMemoryList;
    counts.vmsWithVeryLargeMemory = vmsWithVeryLargeMemoryList.length;
    counts.vmsWithVeryLargeMemoryList = vmsWithVeryLargeMemoryList;

    const vmsWithUnsupportedOSList = poweredOnVMs.filter(vm => {
      const compat = getVSIOSCompatibility(vm.guestOS);
      return compat.status === 'unsupported';
    }).map(vm => vm.vmName);
    counts.vmsWithUnsupportedOS = vmsWithUnsupportedOSList.length;
    counts.vmsWithUnsupportedOSList = vmsWithUnsupportedOSList;
  }

  // ROKS-specific checks
  if (mode === 'roks') {
    const vmsWithCdConnectedList = [...new Set(cdDrives.filter(cd => cd.connected).map(cd => cd.vmName))];
    counts.vmsWithCdConnected = vmsWithCdConnectedList.length;
    counts.vmsWithCdConnectedList = vmsWithCdConnectedList;

    const vmsWithLegacyNICList = [...new Set(
      networks.filter(n => n.adapterType?.toLowerCase().includes('e1000')).map(n => n.vmName)
    )];
    counts.vmsWithLegacyNIC = vmsWithLegacyNICList.length;
    counts.vmsWithLegacyNICList = vmsWithLegacyNICList;

    const vmsWithoutCBTList = poweredOnVMs.filter(vm => !vm.cbtEnabled).map(vm => vm.vmName);
    counts.vmsWithoutCBT = vmsWithoutCBTList.length;
    counts.vmsWithoutCBTList = vmsWithoutCBTList;

    const vmsWithInvalidNamesList = poweredOnVMs.filter(vm => !isRFC1123Compliant(vm.vmName)).map(vm => vm.vmName);
    counts.vmsWithInvalidNames = vmsWithInvalidNamesList.length;
    counts.vmsWithInvalidNamesList = vmsWithInvalidNamesList;

    const cpuMap = new Map(cpuInfo.map(c => [c.vmName, c]));
    const vmsWithCPUHotPlugList = poweredOnVMs.filter(vm => cpuMap.get(vm.vmName)?.hotAddEnabled).map(vm => vm.vmName);
    counts.vmsWithCPUHotPlug = vmsWithCPUHotPlugList.length;
    counts.vmsWithCPUHotPlugList = vmsWithCPUHotPlugList;

    const memMap = new Map(memoryInfo.map(m => [m.vmName, m]));
    const vmsWithMemoryHotPlugList = poweredOnVMs.filter(vm => memMap.get(vm.vmName)?.hotAddEnabled).map(vm => vm.vmName);
    counts.vmsWithMemoryHotPlug = vmsWithMemoryHotPlugList.length;
    counts.vmsWithMemoryHotPlugList = vmsWithMemoryHotPlugList;

    const vmsWithIndependentDisksList = [...new Set(
      disks.filter((d: VDiskInfo) => d.diskMode?.toLowerCase().includes('independent')).map((d: VDiskInfo) => d.vmName)
    )];
    counts.vmsWithIndependentDisks = vmsWithIndependentDisksList.length;
    counts.vmsWithIndependentDisksList = vmsWithIndependentDisksList;

    const vmsWithInvalidHostnameList = poweredOnVMs.filter(vm => !isValidHostname(vm.guestHostname)).map(vm => vm.vmName);
    counts.vmsWithInvalidHostname = vmsWithInvalidHostnameList.length;
    counts.vmsWithInvalidHostnameList = vmsWithInvalidHostnameList;

    const vmsStaticIPPoweredOffList = rawData.vInfo.filter(vm =>
      vm.powerState === 'poweredOff' && vm.guestIP
    ).map(vm => vm.vmName);
    counts.vmsStaticIPPoweredOff = vmsStaticIPPoweredOffList.length;
    counts.vmsStaticIPPoweredOffList = vmsStaticIPPoweredOffList;
  }

  return counts;
}
