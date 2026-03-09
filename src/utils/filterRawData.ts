// Shared utility to filter RVToolsData by VM exclusion model
// Applies the 3-tier exclusion logic (force-include → manual exclude → auto-exclusion)
// to produce a filtered dataset for target/migration sections in exports and reports.

import type { RVToolsData, VirtualMachine } from '@/types/rvtools';
import { getVMIdentifier } from '@/utils/vmIdentifier';

export interface VMExclusionContext {
  isEffectivelyExcluded: (vmId: string, isAutoExcluded: boolean) => boolean;
}

export interface AutoExclusionLookup {
  getAutoExclusionById: (vmId: string) => { isAutoExcluded: boolean };
}

/**
 * Filter rawData to include only VMs that pass the 3-tier exclusion model.
 * Source sheets (vHost, vCluster, vDatastore, vSource, vLicense, vPartition) are preserved unfiltered.
 * VM-scoped sheets (vInfo, vDisk, vSnapshot, vTools, vNetwork, vCD, vCPU, vMemory) are filtered.
 */
export function filterRawDataByExclusions(
  rawData: RVToolsData,
  allVMs: VirtualMachine[],
  vmOverrides: VMExclusionContext,
  autoExclusion: AutoExclusionLookup,
): RVToolsData {
  const includedVMs = allVMs.filter(vm => {
    const vmId = getVMIdentifier(vm);
    const autoResult = autoExclusion.getAutoExclusionById(vmId);
    return !vmOverrides.isEffectivelyExcluded(vmId, autoResult.isAutoExcluded);
  });

  const includedNames = new Set(includedVMs.map(vm => vm.vmName));

  return {
    ...rawData,
    vInfo: includedVMs,
    vDisk: rawData.vDisk.filter(d => includedNames.has(d.vmName)),
    vSnapshot: rawData.vSnapshot.filter(s => includedNames.has(s.vmName)),
    vTools: rawData.vTools.filter(t => includedNames.has(t.vmName)),
    vNetwork: rawData.vNetwork.filter(n => includedNames.has(n.vmName)),
    vCD: rawData.vCD.filter(c => includedNames.has(c.vmName)),
    vCPU: rawData.vCPU.filter(c => includedNames.has(c.vmName)),
    vMemory: rawData.vMemory.filter(m => includedNames.has(m.vmName)),
  };
}
