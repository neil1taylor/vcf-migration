// Executive Summary Slide — table of RVTools environment highlights

import type PptxGenJS from 'pptxgenjs';
import type { RVToolsData, VirtualMachine } from '@/types/rvtools';
import { addSlideTitle, addTable, fmt } from '../utils';

export function addExecutiveSummarySlide(
  pres: PptxGenJS,
  rawData: RVToolsData
): void {
  const slide = pres.addSlide({ masterName: 'CONTENT' });
  addSlideTitle(slide, 'Executive Summary');

  // Compute stats from ALL vInfo VMs (not filtered)
  const allVMs = rawData.vInfo;
  const totalVMs = allVMs.length;
  const hostCount = rawData.vHost.length;
  const clusterCount = rawData.vCluster.length;
  const datastoreCount = rawData.vDatastore.length;
  const datacenterCount = new Set(allVMs.map((vm: VirtualMachine) => vm.datacenter).filter(Boolean)).size;
  const templateCount = allVMs.filter((vm: VirtualMachine) => vm.template).length;

  const totalVCPUs = allVMs.reduce((sum: number, vm: VirtualMachine) => sum + (vm.cpus || 0), 0);
  const totalMemoryMiB = allVMs.reduce((sum: number, vm: VirtualMachine) => sum + (vm.memory || 0), 0);
  const totalMemoryGiB = totalMemoryMiB / 1024;

  // Disk capacity from vDisk sheet
  const totalDiskCapacityMiB = rawData.vDisk.reduce((sum: number, d) => sum + (d.capacityMiB || 0), 0);
  const totalDiskCapacityGiB = totalDiskCapacityMiB / 1024;

  // In Use and Provisioned from vInfo
  const totalInUseMiB = allVMs.reduce((sum: number, vm: VirtualMachine) => sum + (vm.inUseMiB || 0), 0);
  const totalInUseGiB = totalInUseMiB / 1024;
  const totalProvisionedMiB = allVMs.reduce((sum: number, vm: VirtualMachine) => sum + (vm.provisionedMiB || 0), 0);
  const totalProvisionedGiB = totalProvisionedMiB / 1024;

  // Format storage values — use TiB if >= 1024 GiB
  const fmtStorage = (gib: number): string => {
    if (gib >= 1024) {
      return `${(gib / 1024).toFixed(1)} TiB`;
    }
    return `${fmt(Math.round(gib))} GiB`;
  };

  // Format memory — use TiB if >= 1024 GiB
  const fmtMemory = (gib: number): string => {
    if (gib >= 1024) {
      return `${(gib / 1024).toFixed(1)} TiB`;
    }
    return `${fmt(Math.round(gib))} GiB`;
  };

  const avgMemPerVM = totalVMs > 0 ? totalMemoryGiB / totalVMs : 0;
  const avgVCPUsPerVM = totalVMs > 0 ? totalVCPUs / totalVMs : 0;
  const avgStoragePerVM = totalVMs > 0 ? totalInUseGiB / totalVMs : 0;

  const rows: [string, string][] = [
    ['ESXi Hosts', fmt(hostCount)],
    ['Clusters', fmt(clusterCount)],
    ['Datacenters', fmt(datacenterCount)],
    ['Datastores', fmt(datastoreCount)],
    ['Templates', fmt(templateCount)],
    ['Total VMs', fmt(totalVMs)],
    ['Total vCPUs', fmt(totalVCPUs)],
    ['Total Memory', fmtMemory(totalMemoryGiB)],
    ['Disk Capacity', fmtStorage(totalDiskCapacityGiB)],
    ['In Use', fmtStorage(totalInUseGiB)],
    ['Provisioned', fmtStorage(totalProvisionedGiB)],
    ['Avg Memory per VM', `${avgMemPerVM.toFixed(1)} GiB`],
    ['Avg vCPUs per VM', avgVCPUsPerVM.toFixed(1)],
    ['Avg Storage per VM (In Use)', `${avgStoragePerVM.toFixed(1)} GiB`],
  ];

  addTable(slide, ['Metric', 'Value'], rows, {
    y: 0.9,
    colW: [4.5, 4.5],
    fontSize: 9,
  });
}
