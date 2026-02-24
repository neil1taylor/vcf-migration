// Hook that transforms RVToolsData into typed table rows
import { useMemo } from 'react';
import { mibToGiB } from '@/utils/formatters';
import type { RVToolsData } from '@/types/rvtools';
import type {
  VMRow,
  DatastoreRow,
  SnapshotRow,
  HostRow,
  NetworkRow,
  ResourcePoolRow,
  ClusterRow,
  VCPURow,
  VMemoryRow,
  VDiskRow,
  VCDRow,
  VToolsRow,
  VLicenseRow,
  VSourceRow,
} from '@/pages/tables/tableDefinitions';

export interface TablesData {
  vmData: VMRow[];
  datastoreData: DatastoreRow[];
  snapshotData: SnapshotRow[];
  hostData: HostRow[];
  networkData: NetworkRow[];
  resourcePoolData: ResourcePoolRow[];
  clusterData: ClusterRow[];
  vcpuData: VCPURow[];
  vmemoryData: VMemoryRow[];
  vdiskData: VDiskRow[];
  vcdData: VCDRow[];
  vtoolsData: VToolsRow[];
  vlicenseData: VLicenseRow[];
  vsourceData: VSourceRow[];
}

export function useTablesData(rawData: RVToolsData | null): TablesData {
  // Prepare VM data
  const vmData: VMRow[] = useMemo(() =>
    (rawData?.vInfo ?? []).map((vm, index) => ({
      id: String(index),
      name: vm.vmName,
      powerState: vm.powerState,
      cpus: vm.cpus,
      memoryGiB: Math.round(mibToGiB(vm.memory) * 10) / 10,
      storageGiB: Math.round(mibToGiB(vm.provisionedMiB)),
      guestOS: vm.guestOS || 'Unknown',
      cluster: vm.cluster || 'N/A',
      host: vm.host || 'N/A',
      datacenter: vm.datacenter || 'N/A',
    })),
  [rawData?.vInfo]);

  // Prepare datastore data
  const datastoreData: DatastoreRow[] = useMemo(() =>
    (rawData?.vDatastore ?? []).map((ds, index) => ({
      id: String(index),
      name: ds.name,
      type: ds.type || 'Unknown',
      capacityGiB: Math.round(mibToGiB(ds.capacityMiB)),
      usedGiB: Math.round(mibToGiB(ds.inUseMiB)),
      freePercent: Math.round(ds.freePercent * 10) / 10,
      vmCount: ds.vmCount,
      hostCount: ds.hostCount,
      datacenter: ds.datacenter || 'N/A',
    })),
  [rawData?.vDatastore]);

  // Prepare snapshot data
  const snapshotData: SnapshotRow[] = useMemo(() =>
    (rawData?.vSnapshot ?? []).map((snap, index) => ({
      id: String(index),
      vmName: snap.vmName,
      snapshotName: snap.snapshotName,
      sizeMiB: Math.round(snap.sizeTotalMiB),
      ageInDays: snap.ageInDays,
      dateTime: snap.dateTime instanceof Date ? snap.dateTime.toLocaleDateString() : String(snap.dateTime),
      quiesced: snap.quiesced,
      cluster: snap.cluster || 'N/A',
    })),
  [rawData?.vSnapshot]);

  // Prepare host data
  const hostData: HostRow[] = useMemo(() =>
    (rawData?.vHost ?? []).map((host, index) => ({
      id: String(index),
      name: host.name,
      powerState: host.powerState,
      connectionState: host.connectionState,
      cpuCores: host.totalCpuCores,
      memoryGiB: Math.round(mibToGiB(host.memoryMiB)),
      vmCount: host.vmCount,
      esxiVersion: host.esxiVersion || 'Unknown',
      vendor: host.vendor || 'Unknown',
      model: host.model || 'Unknown',
      cluster: host.cluster || 'N/A',
      datacenter: host.datacenter || 'N/A',
    })),
  [rawData?.vHost]);

  // Prepare network data
  const networkData: NetworkRow[] = useMemo(() =>
    (rawData?.vNetwork ?? []).map((nic, index) => ({
      id: String(index),
      vmName: nic.vmName,
      powerState: nic.powerState,
      nicLabel: nic.nicLabel,
      adapterType: nic.adapterType,
      networkName: nic.networkName || 'N/A',
      switchName: nic.switchName || 'N/A',
      connected: nic.connected,
      macAddress: nic.macAddress,
      ipv4Address: nic.ipv4Address || 'N/A',
      datacenter: nic.datacenter || 'N/A',
      cluster: nic.cluster || 'N/A',
    })),
  [rawData?.vNetwork]);

  // Prepare resource pool data
  const resourcePoolData: ResourcePoolRow[] = useMemo(() =>
    (rawData?.vResourcePool ?? []).map((rp, index) => ({
      id: String(index),
      name: rp.name,
      configStatus: rp.configStatus,
      cpuReservation: rp.cpuReservation,
      cpuLimit: rp.cpuLimit,
      memoryReservationGiB: Math.round(mibToGiB(rp.memoryReservation) * 10) / 10,
      memoryLimitGiB: rp.memoryLimit === -1 ? -1 : Math.round(mibToGiB(rp.memoryLimit) * 10) / 10,
      vmCount: rp.vmCount,
      datacenter: rp.datacenter || 'N/A',
      cluster: rp.cluster || 'N/A',
    })),
  [rawData?.vResourcePool]);

  // Prepare cluster data
  const clusterData: ClusterRow[] = useMemo(() =>
    (rawData?.vCluster ?? []).map((cluster, index) => ({
      id: String(index),
      name: cluster.name,
      configStatus: cluster.configStatus,
      overallStatus: cluster.overallStatus,
      vmCount: cluster.vmCount,
      hostCount: cluster.hostCount,
      totalCpuCores: cluster.numCpuCores,
      totalMemoryGiB: Math.round(mibToGiB(cluster.totalMemoryMiB)),
      haEnabled: cluster.haEnabled,
      drsEnabled: cluster.drsEnabled,
      datacenter: cluster.datacenter || 'N/A',
    })),
  [rawData?.vCluster]);

  // Prepare vCPU data
  const vcpuData: VCPURow[] = useMemo(() =>
    (rawData?.vCPU ?? []).map((cpu, index) => ({
      id: String(index),
      vmName: cpu.vmName,
      powerState: cpu.powerState,
      cpus: cpu.cpus,
      sockets: cpu.sockets,
      coresPerSocket: cpu.coresPerSocket,
      shares: cpu.shares,
      reservation: cpu.reservation,
      limit: cpu.limit,
      hotAddEnabled: cpu.hotAddEnabled,
    })),
  [rawData?.vCPU]);

  // Prepare vMemory data
  const vmemoryData: VMemoryRow[] = useMemo(() =>
    (rawData?.vMemory ?? []).map((mem, index) => ({
      id: String(index),
      vmName: mem.vmName,
      powerState: mem.powerState,
      memoryGiB: Math.round(mibToGiB(mem.memoryMiB) * 10) / 10,
      shares: mem.shares,
      reservationGiB: Math.round(mibToGiB(mem.reservation) * 10) / 10,
      limitGiB: mem.limit === -1 ? -1 : Math.round(mibToGiB(mem.limit) * 10) / 10,
      hotAddEnabled: mem.hotAddEnabled,
      activeGiB: mem.active !== null ? Math.round(mibToGiB(mem.active) * 10) / 10 : 0,
      consumedGiB: mem.consumed !== null ? Math.round(mibToGiB(mem.consumed) * 10) / 10 : 0,
    })),
  [rawData?.vMemory]);

  // Prepare vDisk data
  const vdiskData: VDiskRow[] = useMemo(() =>
    (rawData?.vDisk ?? []).map((disk, index) => ({
      id: String(index),
      vmName: disk.vmName,
      powerState: disk.powerState,
      diskLabel: disk.diskLabel,
      capacityGiB: Math.round(mibToGiB(disk.capacityMiB) * 10) / 10,
      thin: disk.thin,
      diskMode: disk.diskMode,
      controllerType: disk.controllerType,
      datacenter: disk.datacenter || 'N/A',
      cluster: disk.cluster || 'N/A',
    })),
  [rawData?.vDisk]);

  // Prepare vCD data
  const vcdData: VCDRow[] = useMemo(() =>
    (rawData?.vCD ?? []).map((cd, index) => ({
      id: String(index),
      vmName: cd.vmName,
      powerState: cd.powerState,
      deviceNode: cd.deviceNode,
      connected: cd.connected,
      deviceType: cd.deviceType,
      datacenter: cd.datacenter || 'N/A',
      cluster: cd.cluster || 'N/A',
    })),
  [rawData?.vCD]);

  // Prepare vTools data
  const vtoolsData: VToolsRow[] = useMemo(() =>
    (rawData?.vTools ?? []).map((tools, index) => ({
      id: String(index),
      vmName: tools.vmName,
      powerState: tools.powerState,
      toolsStatus: tools.toolsStatus,
      toolsVersion: tools.toolsVersion || 'N/A',
      upgradeable: tools.upgradeable,
      upgradePolicy: tools.upgradePolicy,
      syncTime: tools.syncTime,
    })),
  [rawData?.vTools]);

  // Prepare vLicense data
  const vlicenseData: VLicenseRow[] = useMemo(() =>
    (rawData?.vLicense ?? []).map((license, index) => ({
      id: String(index),
      name: license.name,
      licenseKey: license.licenseKey,
      total: license.total,
      used: license.used,
      expirationDate: license.expirationDate instanceof Date
        ? license.expirationDate.toLocaleDateString()
        : license.expirationDate || 'Never',
      productName: license.productName,
      productVersion: license.productVersion,
    })),
  [rawData?.vLicense]);

  // Prepare vSource data
  const vsourceData: VSourceRow[] = useMemo(() =>
    (rawData?.vSource ?? []).map((source, index) => ({
      id: String(index),
      server: source.server,
      ipAddress: source.ipAddress || 'N/A',
      version: source.version || 'N/A',
      build: source.build || 'N/A',
      osType: source.osType || 'N/A',
      apiVersion: source.apiVersion || 'N/A',
    })),
  [rawData?.vSource]);

  return {
    vmData,
    datastoreData,
    snapshotData,
    hostData,
    networkData,
    resourcePoolData,
    clusterData,
    vcpuData,
    vmemoryData,
    vdiskData,
    vcdData,
    vtoolsData,
    vlicenseData,
    vsourceData,
  };
}
