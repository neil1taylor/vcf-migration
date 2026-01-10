// Parser for vRP tab - Resource Pool information
import type { VResourcePoolInfo } from '@/types';
import type { WorkSheet } from 'xlsx';
import { parseSheet, getStringValue, getNumberValue, getBooleanValue } from './utils';

const COLUMN_MAP: Record<string, keyof VResourcePoolInfo | null> = {
  // Name variations - RVTools uses "Resource Pool name"
  'Name': 'name',
  'Resource Pool': 'name',
  'Resource Pool Name': 'name',
  'Resource Pool name': 'name',
  'ResourcePool': 'name',
  'RP': 'name',
  'RP Name': 'name',
  // Config status
  'Config Status': 'configStatus',
  'Config status': 'configStatus',
  'ConfigStatus': 'configStatus',
  'Status': 'configStatus',
  // CPU Reservation - RVTools uses "CPU reservation"
  'CPU Reservation': 'cpuReservation',
  'CPU reservation': 'cpuReservation',
  'CPU Reservation MHz': 'cpuReservation',
  'CpuReservationMHz': 'cpuReservation',
  // CPU Limit - RVTools uses "CPU limit"
  'CPU Limit': 'cpuLimit',
  'CPU limit': 'cpuLimit',
  'CPU Limit MHz': 'cpuLimit',
  'CpuLimitMHz': 'cpuLimit',
  // CPU Expandable - RVTools uses "CPU expandableReservation"
  'CPU Expandable': 'cpuExpandable',
  'CPU expandableReservation': 'cpuExpandable',
  'CpuExpandableReservation': 'cpuExpandable',
  // CPU Shares - RVTools uses "CPU shares"
  'CPU Shares': 'cpuShares',
  'CPU shares': 'cpuShares',
  'NumCpuShares': 'cpuShares',
  'Num CPU Shares': 'cpuShares',
  '# CPU Shares': 'cpuShares',
  // Memory Reservation - RVTools uses "Mem reservation"
  'Memory Reservation': 'memoryReservation',
  'Mem reservation': 'memoryReservation',
  'Mem Reservation': 'memoryReservation',
  'Memory Reservation MB': 'memoryReservation',
  'MemReservationMB': 'memoryReservation',
  'Mem Reservation MB': 'memoryReservation',
  // Memory Limit - RVTools uses "Mem limit"
  'Memory Limit': 'memoryLimit',
  'Mem limit': 'memoryLimit',
  'Mem Limit': 'memoryLimit',
  'Memory Limit MB': 'memoryLimit',
  'MemLimitMB': 'memoryLimit',
  'Mem Limit MB': 'memoryLimit',
  // Memory Expandable - RVTools uses "Mem expandableReservation"
  'Memory Expandable': 'memoryExpandable',
  'Mem expandableReservation': 'memoryExpandable',
  'MemExpandableReservation': 'memoryExpandable',
  'Mem Expandable Reservation': 'memoryExpandable',
  // Memory Shares - RVTools uses "Mem shares"
  'Memory Shares': 'memoryShares',
  'Mem shares': 'memoryShares',
  'Mem Shares': 'memoryShares',
  'NumMemShares': 'memoryShares',
  'Num Mem Shares': 'memoryShares',
  '# Mem Shares': 'memoryShares',
  // VM Count - RVTools uses "# VMs" and "# VMs total"
  '# VMs': 'vmCount',
  '# VMs total': 'vmCount',
  'VMs': 'vmCount',
  'NumVMs': 'vmCount',
  'Num VMs': 'vmCount',
  'VM Count': 'vmCount',
  '# VM': 'vmCount',
  // Location
  'Datacenter': 'datacenter',
  'DataCenter': 'datacenter',
  'Data Center': 'datacenter',
  'Cluster': 'cluster',
  'Parent': 'parent',
  'Parent Pool': 'parent',
  'Parent Resource Pool': 'parent',
  // Resource Pool path - used to extract datacenter/cluster if not in separate columns
  'Resource Pool path': 'path',
  'Path': 'path',
  'RP Path': 'path',
};

// Extract datacenter and cluster from Resource Pool path
// Path formats vary:
//   /Datacenter/ClusterName/Resources/PoolName (IBM Cloud / VCF style)
//   /Datacenter/host/ClusterName/Resources/PoolName (traditional vSphere)
//   Datacenter/ClusterName/Resources/PoolName (no leading slash)
function extractFromPath(path: string): { datacenter: string; cluster: string } {
  if (!path) return { datacenter: '', cluster: '' };

  const parts = path.split('/').filter(p => p);
  let datacenter = '';
  let cluster = '';

  if (parts.length >= 1) {
    datacenter = parts[0];
  }

  // Find 'Resources' in the path - cluster is typically right before it
  const resourcesIndex = parts.indexOf('Resources');
  if (resourcesIndex > 0) {
    // Check if there's a 'host' segment before Resources
    const hostIndex = parts.indexOf('host');
    if (hostIndex !== -1 && hostIndex < resourcesIndex) {
      // Traditional vSphere: /Datacenter/host/Cluster/Resources/...
      cluster = parts[hostIndex + 1];
    } else if (resourcesIndex >= 2) {
      // VCF/IBM style: /Datacenter/Cluster/Resources/...
      // Cluster is right before Resources
      cluster = parts[resourcesIndex - 1];
    }
  } else if (parts.length >= 2) {
    // No 'Resources' found - try second element as cluster
    cluster = parts[1];
  }

  return { datacenter, cluster };
}

export function parseVRP(sheet: WorkSheet): VResourcePoolInfo[] {
  const rows = parseSheet(sheet, COLUMN_MAP);

  return rows.map((row): VResourcePoolInfo => {
    // Try to get datacenter/cluster from direct columns first
    let datacenter = getStringValue(row, 'datacenter');
    let cluster = getStringValue(row, 'cluster');

    // If not found, try to extract from path
    if (!datacenter || !cluster) {
      const path = getStringValue(row, 'path');
      const extracted = extractFromPath(path);
      if (!datacenter) datacenter = extracted.datacenter;
      if (!cluster) cluster = extracted.cluster;
    }

    return {
      name: getStringValue(row, 'name'),
      configStatus: getStringValue(row, 'configStatus'),
      cpuReservation: getNumberValue(row, 'cpuReservation'),
      cpuLimit: getNumberValue(row, 'cpuLimit'),
      cpuExpandable: getBooleanValue(row, 'cpuExpandable'),
      cpuShares: getNumberValue(row, 'cpuShares'),
      memoryReservation: getNumberValue(row, 'memoryReservation'),
      memoryLimit: getNumberValue(row, 'memoryLimit'),
      memoryExpandable: getBooleanValue(row, 'memoryExpandable'),
      memoryShares: getNumberValue(row, 'memoryShares'),
      vmCount: getNumberValue(row, 'vmCount'),
      datacenter,
      cluster,
      parent: getStringValue(row, 'parent') || null,
    };
  }).filter(rp => rp.name);
}
