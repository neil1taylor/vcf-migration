// Parser for vCluster tab - cluster information
import type { VClusterInfo } from '@/types';
import type { WorkSheet } from 'xlsx';
import { parseSheet, getStringValue, getNumberValue, getBooleanValue } from './utils';

const COLUMN_MAP: Record<string, keyof VClusterInfo | null> = {
  // Name - RVTools typically uses "Cluster" or "Name"
  'Name': 'name',
  'Cluster': 'name',
  'Cluster Name': 'name',
  'Cluster name': 'name',
  // Config/Overall Status
  'Config Status': 'configStatus',
  'Config status': 'configStatus',
  'ConfigStatus': 'configStatus',
  'Status': 'configStatus',
  'Overall Status': 'overallStatus',
  'Overall status': 'overallStatus',
  'OverallStatus': 'overallStatus',
  // VM Count
  '# VMs': 'vmCount',
  '# VMs total': 'vmCount',
  'VMs': 'vmCount',
  'VM Count': 'vmCount',
  'NumVMs': 'vmCount',
  'Num VMs': 'vmCount',
  // Host Count
  '# Hosts': 'hostCount',
  'Hosts': 'hostCount',
  'Host Count': 'hostCount',
  'NumHosts': 'hostCount',
  'Num Hosts': 'hostCount',
  // Effective Hosts
  '# Effective Hosts': 'numEffectiveHosts',
  'Effective Hosts': 'numEffectiveHosts',
  'NumEffectiveHosts': 'numEffectiveHosts',
  'numEffectiveHosts': 'numEffectiveHosts',
  'Num Effective Hosts': 'numEffectiveHosts',
  // Total CPU
  'Total CPU': 'totalCpuMHz',
  'Total CPU MHz': 'totalCpuMHz',
  'TotalCpu': 'totalCpuMHz',
  'Total CPU (MHz)': 'totalCpuMHz',
  // CPU Cores
  '# CPU Cores': 'numCpuCores',
  'CPU Cores': 'numCpuCores',
  'NumCpuCores': 'numCpuCores',
  'Num CPU Cores': 'numCpuCores',
  '# Cores': 'numCpuCores',
  // CPU Threads
  '# CPU Threads': 'numCpuThreads',
  'CPU Threads': 'numCpuThreads',
  'NumCpuThreads': 'numCpuThreads',
  'Num CPU Threads': 'numCpuThreads',
  '# Threads': 'numCpuThreads',
  // Effective CPU
  'Effective CPU': 'effectiveCpuMHz',
  'Effective CPU MHz': 'effectiveCpuMHz',
  'EffectiveCpu': 'effectiveCpuMHz',
  'Effective CPU (MHz)': 'effectiveCpuMHz',
  // Total Memory
  'Total Memory': 'totalMemoryMiB',
  'Total Memory MiB': 'totalMemoryMiB',
  'Total Memory MB': 'totalMemoryMiB',
  'TotalMemory': 'totalMemoryMiB',
  'Total Mem': 'totalMemoryMiB',
  'Total Memory (MB)': 'totalMemoryMiB',
  // Effective Memory
  'Effective Memory': 'effectiveMemoryMiB',
  'Effective Memory MiB': 'effectiveMemoryMiB',
  'Effective Memory MB': 'effectiveMemoryMiB',
  'EffectiveMemory': 'effectiveMemoryMiB',
  'Effective Mem': 'effectiveMemoryMiB',
  'Effective Memory (MB)': 'effectiveMemoryMiB',
  // HA Settings
  'HA Enabled': 'haEnabled',
  'HA enabled': 'haEnabled',
  'HAEnabled': 'haEnabled',
  'HA': 'haEnabled',
  'HA Failover Level': 'haFailoverLevel',
  'HA failover level': 'haFailoverLevel',
  'HAFailoverLevel': 'haFailoverLevel',
  // DRS Settings
  'DRS Enabled': 'drsEnabled',
  'DRS enabled': 'drsEnabled',
  'DRSEnabled': 'drsEnabled',
  'DRS': 'drsEnabled',
  'DRS Behavior': 'drsBehavior',
  'DRS behaviour': 'drsBehavior',
  'DRS behavior': 'drsBehavior',
  'DRSBehavior': 'drsBehavior',
  // EVC Mode
  'EVC Mode': 'evcMode',
  'EVC mode': 'evcMode',
  'EVC': 'evcMode',
  'EVCMode': 'evcMode',
  // Datacenter
  'Datacenter': 'datacenter',
  'DataCenter': 'datacenter',
  'Data Center': 'datacenter',
  'DC': 'datacenter',
};

export function parseVCluster(sheet: WorkSheet): VClusterInfo[] {
  const rows = parseSheet(sheet, COLUMN_MAP);

  return rows.map((row): VClusterInfo => ({
    name: getStringValue(row, 'name'),
    configStatus: getStringValue(row, 'configStatus'),
    overallStatus: getStringValue(row, 'overallStatus'),
    vmCount: getNumberValue(row, 'vmCount'),
    hostCount: getNumberValue(row, 'hostCount'),
    numEffectiveHosts: getNumberValue(row, 'numEffectiveHosts'),
    totalCpuMHz: getNumberValue(row, 'totalCpuMHz'),
    numCpuCores: getNumberValue(row, 'numCpuCores'),
    numCpuThreads: getNumberValue(row, 'numCpuThreads'),
    effectiveCpuMHz: getNumberValue(row, 'effectiveCpuMHz'),
    totalMemoryMiB: getNumberValue(row, 'totalMemoryMiB'),
    effectiveMemoryMiB: getNumberValue(row, 'effectiveMemoryMiB'),
    haEnabled: getBooleanValue(row, 'haEnabled'),
    haFailoverLevel: getNumberValue(row, 'haFailoverLevel'),
    drsEnabled: getBooleanValue(row, 'drsEnabled'),
    drsBehavior: getStringValue(row, 'drsBehavior'),
    evcMode: getStringValue(row, 'evcMode') || null,
    datacenter: getStringValue(row, 'datacenter'),
  })).filter(cluster => cluster.name);
}
