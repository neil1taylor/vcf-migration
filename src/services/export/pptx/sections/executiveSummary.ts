// Executive Summary Slide — KPI tiles + table of RVTools environment highlights

import type PptxGenJS from 'pptxgenjs';
import type { RVToolsData, VirtualMachine } from '@/types/rvtools';
import { COLORS, FONTS } from '../types';
import { addSlideTitle, addTable, addKPINumber, fmt } from '../utils';

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

  // Blue subtitle
  slide.addText('Source Environment Overview', {
    x: 0.5, y: 0.47, w: 9.0, h: 0.35,
    fontSize: FONTS.bodySize,
    fontFace: FONTS.face,
    color: COLORS.ibmBlue,
    bold: true,
  });

  // Explanatory paragraph
  slide.addText('A summary of the VMware environment captured from the RVTools export, including compute, storage, and infrastructure metrics across all discovered virtual machines.', {
    x: 0.5, y: 0.77, w: 9.0, h: 0.5,
    fontSize: FONTS.smallSize,
    fontFace: FONTS.face,
    color: COLORS.darkGray,
  });

  // 4 KPI tiles — evenly spaced across 9" width
  const kpiY = 1.2;
  const kpiW = 2.25;
  addKPINumber(slide, 'Total VMs', fmt(totalVMs), { x: 0.5, y: kpiY, w: kpiW });
  addKPINumber(slide, 'Total vCPUs', fmt(totalVCPUs), { x: 0.5 + kpiW, y: kpiY, w: kpiW });
  addKPINumber(slide, 'Total Memory', fmtMemory(totalMemoryGiB), { x: 0.5 + kpiW * 2, y: kpiY, w: kpiW });
  addKPINumber(slide, 'Disk In Use', fmtStorage(totalInUseGiB), { x: 0.5 + kpiW * 3, y: kpiY, w: kpiW });

  // Table rows — infrastructure and averages (KPI values removed from table)
  const rows: [string, string][] = [
    ['ESXi Hosts', fmt(hostCount)],
    ['Clusters', fmt(clusterCount)],
    ['Datacenters', fmt(datacenterCount)],
    ['Datastores', fmt(datastoreCount)],
    ['Templates', fmt(templateCount)],
    ['Disk Capacity', fmtStorage(totalDiskCapacityGiB)],
    ['In Use', fmtStorage(totalInUseGiB)],
    ['Provisioned', fmtStorage(totalProvisionedGiB)],
    ['Avg Memory per VM', `${avgMemPerVM.toFixed(1)} GiB`],
    ['Avg vCPUs per VM', avgVCPUsPerVM.toFixed(1)],
    ['Avg Storage per VM (In Use)', `${avgStoragePerVM.toFixed(1)} GiB`],
  ];

  addTable(slide, ['Metric', 'Value'], rows, {
    y: 2.0,
    colW: [4.5, 4.5],
    fontSize: 8,
  });
}
