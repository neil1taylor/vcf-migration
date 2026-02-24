// Hook for computing all memoized dashboard data
import { useMemo, useCallback } from 'react';
import { useData, useVMs, useChartFilter, useVMOverrides, useAutoExclusion } from '@/hooks';
import { HW_VERSION_MINIMUM, SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';
import { mibToGiB, mibToTiB, getHardwareVersionNumber, formatHardwareVersion } from '@/utils/formatters';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { getVMIdentifier } from '@/utils/vmIdentifier';
import { POWER_STATE_CHART_COLORS } from '@/utils/chartConfig';
import type { RVToolsData, VirtualMachine, VToolsInfo, VSnapshotInfo, VSourceInfo } from '@/types/rvtools';
import type { ChartFilter } from '@/hooks';
import type { InsightsInput, NetworkSummaryForAI } from '@/services/ai/types';

// ===== TYPES =====

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ConfigAnalysis {
  toolsNotInstalled: number;
  toolsCurrent: number;
  outdatedHWCount: number;
  snapshotsBlockers: number;
  vmsWithSnapshots: number;
  vmsWithCdConnected: number;
  vmsNeedConsolidation: number;
  configIssuesCount: number;
}

export interface DashboardData {
  // Raw data / context
  rawData: RVToolsData | null;
  vms: VirtualMachine[];
  chartFilter: ChartFilter | null;
  setFilter: (dimension: string, value: string, source: string) => void;
  clearFilter: () => void;
  autoExcludedCount: number;
  autoExcludedBreakdown: {
    templates: number;
    poweredOff: number;
    vmwareInfrastructure: number;
    windowsInfrastructure: number;
  };

  // Basic metrics
  totalVMs: number;
  poweredOnVMs: number;
  poweredOffVMs: number;
  suspendedVMs: number;
  templates: number;
  totalVCPUs: number;
  totalMemoryMiB: number;
  totalMemoryGiB: number;
  totalMemoryTiB: number;
  totalProvisionedMiB: number;
  totalProvisionedTiB: number;
  totalInUseMiB: number;
  totalInUseTiB: number;
  totalDiskCapacityMiB: number;
  totalDiskCapacityTiB: number;
  uniqueClusters: number;
  uniqueDatacenters: number;

  // Chart data
  clusterData: Map<string, { vmCount: number; totalCores: number; vmCpus: number; hostMemoryMiB: number; vmMemoryMiB: number }>;
  vmsByClusterData: ChartDataPoint[];
  cpuOvercommitData: ChartDataPoint[];
  memOvercommitData: ChartDataPoint[];
  powerStateData: ChartDataPoint[];
  powerStateColors: string[];
  filteredVMs: VirtualMachine[];
  osChartData: ChartDataPoint[];
  hwVersionChartData: ChartDataPoint[];
  toolsChartData: ChartDataPoint[];
  firmwareChartData: ChartDataPoint[];

  // Configuration analysis
  configAnalysis: ConfigAnalysis;

  // Derived raw data arrays
  tools: VToolsInfo[];
  snapshots: VSnapshotInfo[];
  vSources: VSourceInfo[];

  // AI insights
  insightsData: InsightsInput | null;

  // Handlers
  handlePowerStateClick: (label: string) => void;
}

// Map label to power state
const labelToPowerState: Record<string, string> = {
  'Powered On': 'poweredOn',
  'Powered Off': 'poweredOff',
  'Suspended': 'suspended',
};

export function useDashboardData(): DashboardData {
  const { rawData } = useData();
  const vms = useVMs();
  const { chartFilter, setFilter, clearFilter } = useChartFilter();
  const vmOverrides = useVMOverrides();
  const { autoExcludedCount, autoExcludedBreakdown } = useAutoExclusion();

  // Calculate basic metrics (safe with empty vms array)
  const totalVMs = vms.length;
  const poweredOnVMs = vms.filter(vm => vm.powerState === 'poweredOn').length;
  const poweredOffVMs = vms.filter(vm => vm.powerState === 'poweredOff').length;
  const suspendedVMs = vms.filter(vm => vm.powerState === 'suspended').length;
  const templates = (rawData?.vInfo ?? []).filter(vm => vm.template).length;

  const totalVCPUs = vms.reduce((sum, vm) => sum + vm.cpus, 0);
  const totalMemoryMiB = vms.reduce((sum, vm) => sum + vm.memory, 0);
  const totalMemoryGiB = mibToGiB(totalMemoryMiB);
  const totalMemoryTiB = mibToTiB(totalMemoryMiB);

  const totalProvisionedMiB = vms.reduce((sum, vm) => sum + vm.provisionedMiB, 0);
  const totalProvisionedTiB = mibToTiB(totalProvisionedMiB);
  const totalInUseMiB = vms.reduce((sum, vm) => sum + vm.inUseMiB, 0);
  const totalInUseTiB = mibToTiB(totalInUseMiB);

  // Disk capacity from vDisk sheet (filtered to non-template, powered-on VMs)
  const vmNames = new Set(vms.map(vm => vm.vmName));
  const totalDiskCapacityMiB = (rawData?.vDisk ?? [])
    .filter(disk => vmNames.has(disk.vmName))
    .reduce((sum, disk) => sum + disk.capacityMiB, 0);
  const totalDiskCapacityTiB = mibToTiB(totalDiskCapacityMiB);

  const uniqueClusters = new Set(vms.map(vm => vm.cluster).filter(Boolean)).size;
  const uniqueDatacenters = new Set(vms.map(vm => vm.datacenter).filter(Boolean)).size;

  // Cluster metrics from vHost data (memoized)
  const hosts = useMemo(() => rawData?.vHost ?? [], [rawData?.vHost]);
  const clusterData = useMemo(() => {
    const data = new Map<string, { vmCount: number; totalCores: number; vmCpus: number; hostMemoryMiB: number; vmMemoryMiB: number }>();

    // Aggregate host data by cluster
    hosts.forEach(host => {
      const cluster = host.cluster || 'No Cluster';
      if (!data.has(cluster)) {
        data.set(cluster, { vmCount: 0, totalCores: 0, vmCpus: 0, hostMemoryMiB: 0, vmMemoryMiB: 0 });
      }
      const entry = data.get(cluster)!;
      entry.totalCores += host.totalCpuCores || 0;
      entry.vmCpus += host.vmCpuCount || 0;
      entry.hostMemoryMiB += host.memoryMiB || 0;
      entry.vmMemoryMiB += host.vmMemoryMiB || 0;
    });

    // Count VMs per cluster
    vms.forEach(vm => {
      const cluster = vm.cluster || 'No Cluster';
      if (data.has(cluster)) {
        data.get(cluster)!.vmCount++;
      } else {
        data.set(cluster, { vmCount: 1, totalCores: 0, vmCpus: 0, hostMemoryMiB: 0, vmMemoryMiB: 0 });
      }
    });

    return data;
  }, [hosts, vms]);

  // VM distribution by cluster (memoized)
  const vmsByClusterData = useMemo(() =>
    Array.from(clusterData.entries())
      .map(([cluster, data]) => ({ label: cluster, value: data.vmCount }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    [clusterData]
  );

  // CPU overcommitment by cluster (memoized)
  const cpuOvercommitData = useMemo(() =>
    Array.from(clusterData.entries())
      .filter(([, data]) => data.totalCores > 0)
      .map(([cluster, data]) => ({
        label: cluster,
        value: parseFloat((data.vmCpus / data.totalCores).toFixed(2)),
      }))
      .sort((a, b) => b.value - a.value),
    [clusterData]
  );

  // Memory overcommitment by cluster (memoized)
  const memOvercommitData = useMemo(() =>
    Array.from(clusterData.entries())
      .filter(([, data]) => data.hostMemoryMiB > 0)
      .map(([cluster, data]) => ({
        label: cluster,
        value: parseFloat((data.vmMemoryMiB / data.hostMemoryMiB).toFixed(2)),
      }))
      .sort((a, b) => b.value - a.value),
    [clusterData]
  );

  // Power state chart data
  const powerStateData = [
    { label: 'Powered On', value: poweredOnVMs },
    { label: 'Powered Off', value: poweredOffVMs },
    { label: 'Suspended', value: suspendedVMs },
  ].filter(d => d.value > 0);

  const powerStateColors = [
    POWER_STATE_CHART_COLORS.poweredOn,
    POWER_STATE_CHART_COLORS.poweredOff,
    POWER_STATE_CHART_COLORS.suspended,
  ];

  // Filter VMs based on active chart filter (memoized)
  const filteredVMs = useMemo(() =>
    chartFilter && chartFilter.dimension === 'powerState'
      ? vms.filter(vm => vm.powerState === labelToPowerState[chartFilter.value])
      : vms,
    [chartFilter, vms]
  );

  // OS distribution data (from filtered VMs) - memoized
  const osChartData = useMemo(() => {
    const osDistribution = filteredVMs.reduce((acc, vm) => {
      const os = vm.guestOS || 'Unknown';
      // Simplify OS names
      let category = os;
      if (os.toLowerCase().includes('windows server 2019')) category = 'Windows Server 2019';
      else if (os.toLowerCase().includes('windows server 2016')) category = 'Windows Server 2016';
      else if (os.toLowerCase().includes('windows server 2022')) category = 'Windows Server 2022';
      else if (os.toLowerCase().includes('windows server')) category = 'Windows Server (Other)';
      else if (os.toLowerCase().includes('windows 10')) category = 'Windows 10';
      else if (os.toLowerCase().includes('windows 11')) category = 'Windows 11';
      else if (os.toLowerCase().includes('rhel') || os.toLowerCase().includes('red hat')) category = 'RHEL';
      else if (os.toLowerCase().includes('centos')) category = 'CentOS';
      else if (os.toLowerCase().includes('ubuntu')) category = 'Ubuntu';
      else if (os.toLowerCase().includes('debian')) category = 'Debian';
      else if (os.toLowerCase().includes('sles') || os.toLowerCase().includes('suse')) category = 'SLES';
      else if (os.toLowerCase().includes('linux')) category = 'Linux (Other)';
      else if (os.toLowerCase().includes('freebsd')) category = 'FreeBSD';
      else if (!os || os === 'Unknown') category = 'Unknown';

      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(osDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value]) => ({ label, value }));
  }, [filteredVMs]);

  // Click handler for power state chart (memoized with useCallback)
  const handlePowerStateClick = useCallback((label: string) => {
    if (chartFilter?.value === label && chartFilter?.dimension === 'powerState') {
      clearFilter();
    } else {
      setFilter('powerState', label, 'powerStateChart');
    }
  }, [chartFilter, clearFilter, setFilter]);

  // vCenter source info
  const vSources = useMemo(() => rawData?.vSource ?? [], [rawData?.vSource]);

  // ===== CONFIGURATION ANALYSIS =====
  const tools = useMemo(() => rawData?.vTools ?? [], [rawData?.vTools]);
  const snapshots = useMemo(() => rawData?.vSnapshot ?? [], [rawData?.vSnapshot]);
  const cdDrives = useMemo(() => rawData?.vCD ?? [], [rawData?.vCD]);

  // Configuration analysis metrics (memoized)
  const configAnalysis = useMemo(() => {
    // VMware Tools status
    const toolsNotInstalled = tools.filter(t =>
      t.toolsStatus?.toLowerCase().includes('notinstalled')
    ).length;
    const toolsCurrent = tools.filter(t =>
      t.toolsStatus?.toLowerCase().includes('ok') ||
      t.toolsStatus?.toLowerCase() === 'toolsok'
    ).length;

    // Hardware version compliance
    const outdatedHWCount = vms.filter(vm =>
      getHardwareVersionNumber(vm.hardwareVersion) < HW_VERSION_MINIMUM
    ).length;

    // Snapshot issues
    const snapshotsBlockers = snapshots.filter(s => s.ageInDays > SNAPSHOT_BLOCKER_AGE_DAYS).length;
    const vmsWithSnapshots = new Set(snapshots.map(s => s.vmName)).size;

    // CD-ROM connected
    const vmsWithCdConnected = new Set(cdDrives.filter(cd => cd.connected).map(cd => cd.vmName)).size;

    // Consolidation needed
    const vmsNeedConsolidation = vms.filter(vm => vm.consolidationNeeded).length;

    // Count of issues (for summary)
    const configIssuesCount = toolsNotInstalled + snapshotsBlockers + vmsWithCdConnected + outdatedHWCount;

    return {
      toolsNotInstalled,
      toolsCurrent,
      outdatedHWCount,
      snapshotsBlockers,
      vmsWithSnapshots,
      vmsWithCdConnected,
      vmsNeedConsolidation,
      configIssuesCount,
    };
  }, [tools, vms, snapshots, cdDrives]);

  // Hardware version distribution for chart (memoized)
  const hwVersionChartData = useMemo(() => {
    const hwVersions = vms.reduce((acc, vm) => {
      const version = formatHardwareVersion(vm.hardwareVersion);
      acc[version] = (acc[version] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(hwVersions)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => {
        const aNum = parseInt(a.label.replace('v', ''));
        const bNum = parseInt(b.label.replace('v', ''));
        return bNum - aNum;
      });
  }, [vms]);

  // VMware Tools status distribution for chart (memoized)
  const toolsChartData = useMemo(() => {
    const toolsStatusMap = tools.reduce((acc, t) => {
      const status = t.toolsStatus || 'unknown';
      const normalizedStatus = status.toLowerCase().includes('ok') ? 'Current' :
                              status.toLowerCase().includes('old') ? 'Outdated' :
                              status.toLowerCase().includes('notrunning') ? 'Not Running' :
                              status.toLowerCase().includes('notinstalled') ? 'Not Installed' : 'Unknown';
      acc[normalizedStatus] = (acc[normalizedStatus] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(toolsStatusMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [tools]);

  // AI Insights data (only compute when proxy is configured)
  const insightsData = useMemo<InsightsInput | null>(() => {
    if (!isAIProxyConfigured() || !rawData) return null;

    const excludedCount = vms.filter(vm => vmOverrides.isExcluded(getVMIdentifier(vm))).length;

    // Build workload breakdown from OS distribution
    const workloadBreakdown: Record<string, number> = {};
    vms.forEach(vm => {
      const os = vm.guestOS || 'Unknown';
      if (os.toLowerCase().includes('windows')) workloadBreakdown['Windows'] = (workloadBreakdown['Windows'] || 0) + 1;
      else if (os.toLowerCase().includes('linux') || os.toLowerCase().includes('rhel') || os.toLowerCase().includes('centos') || os.toLowerCase().includes('ubuntu')) workloadBreakdown['Linux'] = (workloadBreakdown['Linux'] || 0) + 1;
      else workloadBreakdown['Other'] = (workloadBreakdown['Other'] || 0) + 1;
    });

    // Build network summary from vNetwork data
    const networkSummary: NetworkSummaryForAI[] = [];
    const portGroupMap = new Map<string, { ips: Set<string>; vmNames: Set<string> }>();
    rawData.vNetwork.forEach(nic => {
      const pg = nic.networkName || 'Unknown';
      if (!portGroupMap.has(pg)) portGroupMap.set(pg, { ips: new Set(), vmNames: new Set() });
      const entry = portGroupMap.get(pg)!;
      entry.vmNames.add(nic.vmName);
      if (nic.ipv4Address) entry.ips.add(nic.ipv4Address);
    });
    portGroupMap.forEach((data, portGroup) => {
      const prefixes = new Set<string>();
      data.ips.forEach(ip => {
        const parts = ip.split('.');
        if (parts.length >= 3) prefixes.add(`${parts[0]}.${parts[1]}.${parts[2]}.0/24`);
      });
      networkSummary.push({
        portGroup,
        subnet: prefixes.size > 0 ? Array.from(prefixes).sort().join(', ') : 'N/A',
        vmCount: data.vmNames.size,
      });
    });

    return {
      totalVMs,
      totalExcluded: excludedCount,
      totalVCPUs,
      totalMemoryGiB: Math.round(totalMemoryGiB),
      totalStorageTiB: Math.round(totalInUseTiB * 100) / 100,
      clusterCount: uniqueClusters,
      hostCount: rawData.vHost.length,
      datastoreCount: rawData.vDatastore.length,
      workloadBreakdown,
      complexitySummary: { simple: 0, moderate: 0, complex: 0, blocker: 0 },
      blockerSummary: configAnalysis.configIssuesCount > 0 ? [`${configAnalysis.configIssuesCount} configuration issues detected`] : [],
      networkSummary,
      migrationTarget: 'both',
    };
  }, [totalVMs, totalVCPUs, totalMemoryGiB, totalInUseTiB, uniqueClusters, rawData, vms, vmOverrides, configAnalysis.configIssuesCount]);

  // Firmware type distribution for chart (memoized)
  const firmwareChartData = useMemo(() => {
    const firmwareDistribution = vms.reduce((acc, vm) => {
      const firmware = vm.firmwareType || 'BIOS';
      const normalizedFirmware = firmware.toLowerCase().includes('efi') ? 'UEFI' : 'BIOS';
      acc[normalizedFirmware] = (acc[normalizedFirmware] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(firmwareDistribution)
      .map(([label, value]) => ({ label, value }))
      .filter(d => d.value > 0);
  }, [vms]);

  return {
    rawData,
    vms,
    chartFilter,
    setFilter,
    clearFilter,
    autoExcludedCount,
    autoExcludedBreakdown,
    totalVMs,
    poweredOnVMs,
    poweredOffVMs,
    suspendedVMs,
    templates,
    totalVCPUs,
    totalMemoryMiB,
    totalMemoryGiB,
    totalMemoryTiB,
    totalProvisionedMiB,
    totalProvisionedTiB,
    totalInUseMiB,
    totalInUseTiB,
    totalDiskCapacityMiB,
    totalDiskCapacityTiB,
    uniqueClusters,
    uniqueDatacenters,
    clusterData,
    vmsByClusterData,
    cpuOvercommitData,
    memOvercommitData,
    powerStateData,
    powerStateColors,
    filteredVMs,
    osChartData,
    configAnalysis,
    hwVersionChartData,
    toolsChartData,
    firmwareChartData,
    insightsData,
    tools,
    snapshots,
    vSources,
    handlePowerStateClick,
  };
}
