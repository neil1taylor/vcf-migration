// DOCX Data Calculation Functions

import type { RVToolsData, VirtualMachine } from '@/types/rvtools';
import { mibToGiB } from '@/utils/formatters';
import { isVMwareInfrastructureVM } from '@/utils/autoExclusion';
import ibmCloudConfig from '@/data/ibmCloudConfig.json';
import { runPreFlightChecks, CHECK_DEFINITIONS } from '@/services/preflightChecks';
import type { CheckMode } from '@/services/preflightChecks';
import { mapVMToVSIProfile, getProfileFamilyFromName } from '@/services/migration/vsiProfileMapping';
import type { VMReadiness, ROKSSizing, VSIMapping } from '../types';
import { BOOT_DISK_SIZE_GIB, BOOT_STORAGE_COST_PER_GB, DATA_STORAGE_COST_PER_GB } from '../types';

export function calculateVMReadiness(
  rawData: RVToolsData,
  modeFlags?: { includeROKS?: boolean; includeVSI?: boolean }
): VMReadiness[] {
  const includeROKS = modeFlags?.includeROKS ?? true;
  const includeVSI = modeFlags?.includeVSI ?? true;

  // Determine which modes to run
  const modes: CheckMode[] = [];
  if (includeROKS) modes.push('roks');
  if (includeVSI) modes.push('vsi');
  if (modes.length === 0) modes.push('roks', 'vsi');

  // Run checks using the existing preflight service (same as UI)
  const allResults = modes.map(mode => runPreFlightChecks(rawData, mode));

  // Build a map of vmName → merged issues across all modes
  const vmMap = new Map<string, VMReadiness>();

  for (const results of allResults) {
    for (const result of results) {
      // Skip VMware infrastructure VMs (DOCX excludes these)
      const vm = rawData.vInfo.find(v => v.vmName === result.vmName);
      if (vm && isVMwareInfrastructureVM(vm.vmName, vm.guestOS)) continue;

      const existing = vmMap.get(result.vmName);

      // Convert check results to issue strings
      const issues: string[] = [];
      let hasBlocker = false;
      let hasWarning = false;

      for (const [checkId, checkResult] of Object.entries(result.checks)) {
        if (checkResult.status === 'fail' || checkResult.status === 'warn') {
          const def = CHECK_DEFINITIONS.find(d => d.id === checkId);
          if (def) {
            const label = def.shortName || def.name;
            if (checkResult.status === 'fail' && def.severity === 'blocker') {
              hasBlocker = true;
              issues.push(label);
            } else {
              hasWarning = true;
              issues.push(label);
            }
          }
        }
      }

      if (existing) {
        // Merge: union of issues
        existing.hasBlocker = existing.hasBlocker || hasBlocker;
        existing.hasWarning = existing.hasWarning || hasWarning;
        for (const issue of issues) {
          if (!existing.issues.includes(issue)) existing.issues.push(issue);
        }
      } else {
        vmMap.set(result.vmName, {
          vmName: result.vmName,
          cluster: result.cluster,
          guestOS: vm?.guestOS || '',
          cpus: vm?.cpus || 0,
          memoryGiB: vm ? Math.round(mibToGiB(vm.memory)) : 0,
          storageGiB: vm ? Math.round(mibToGiB(vm.provisionedMiB)) : 0,
          hasBlocker,
          hasWarning,
          issues,
        });
      }
    }
  }

  return Array.from(vmMap.values());
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
  const cpuOvercommit = ibmCloudConfig.defaults.cpuOvercommitRatio;
  const adjustedVCPUs = Math.ceil(totalVCPUs / cpuOvercommit);

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

  const monthlyCost = recommendedWorkers * (recommendedProfile.monthlyRate || 0);

  return {
    workerNodes: recommendedWorkers,
    profileName: recommendedProfile.name,
    totalCores: recommendedWorkers * recommendedProfile.physicalCores,
    totalThreads: recommendedWorkers * recommendedProfile.vcpus,
    totalMemoryGiB: recommendedWorkers * recommendedProfile.memoryGiB,
    totalNvmeTiB: Math.round(totalClusterNvmeGiB / 1024),
    odfUsableTiB: parseFloat(odfUsableTiB.toFixed(1)),
    monthlyCost,
    cpuOvercommit,
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
    const computeCost = profile.monthlyRate;

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
      family: getProfileFamilyFromName(profile.name),
      computeCost,
      bootStorageCost,
      dataStorageCost,
      storageCost,
      monthlyCost: computeCost + storageCost,
    };
  });
}

