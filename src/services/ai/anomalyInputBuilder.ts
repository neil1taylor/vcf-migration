// Client-side statistical analysis for anomaly detection
// Computes mean/stddev/z-scores and flags config anomalies

import type { RVToolsData } from '@/types';
import type { AnomalyCandidate, AnomalyDetectionInput } from './types';

interface VMStats {
  vCPUs: number[];
  memoryMiB: number[];
  storageMiB: number[];
  nicCount: number[];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function zScore(value: number, m: number, sd: number): number {
  if (sd === 0) return 0;
  return (value - m) / sd;
}

/**
 * Build anomaly detection input from raw RVTools data.
 * All analysis is client-side; only aggregated anomaly descriptions
 * are sent to the AI (never VM names, IPs, or hostnames).
 */
export function buildAnomalyInput(rawData: RVToolsData): AnomalyDetectionInput {
  const vms = rawData.vInfo || [];
  const snapshots = rawData.vSnapshot || [];
  const tools = rawData.vTools || [];
  const cds = rawData.vCD || [];
  const disks = rawData.vDisk || [];

  const candidates: AnomalyCandidate[] = [];

  if (vms.length === 0) {
    return { anomalyCandidates: candidates, totalVMs: 0 };
  }

  // Collect stats
  const stats: VMStats = {
    vCPUs: vms.map(vm => vm.cpus || 0),
    memoryMiB: vms.map(vm => vm.memory || 0),
    storageMiB: [],
    nicCount: [],
  };

  // Disk capacity per VM
  const vmDiskMap = new Map<string, number>();
  for (const d of disks) {
    const name = d.vmName || '';
    vmDiskMap.set(name, (vmDiskMap.get(name) || 0) + (d.capacityMiB || 0));
  }
  stats.storageMiB = vms.map(vm => vmDiskMap.get(vm.vmName || '') || 0);

  // NIC count per VM from vNetwork
  const networks = rawData.vNetwork || [];
  const vmNicMap = new Map<string, number>();
  for (const n of networks) {
    const name = n.vmName || '';
    vmNicMap.set(name, (vmNicMap.get(name) || 0) + 1);
  }
  stats.nicCount = vms.map(vm => vmNicMap.get(vm.vmName || '') || 0);

  // Resource outliers (z-score > 2)
  const cpuMean = mean(stats.vCPUs);
  const cpuStd = stddev(stats.vCPUs);
  const memMean = mean(stats.memoryMiB);
  const memStd = stddev(stats.memoryMiB);

  const cpuOutliers = vms.filter(vm => Math.abs(zScore(vm.cpus || 0, cpuMean, cpuStd)) > 2).length;
  if (cpuOutliers > 0) {
    candidates.push({
      category: 'resource-misconfig',
      description: `${cpuOutliers} VMs with CPU allocation >2 std deviations from mean (mean: ${cpuMean.toFixed(1)} vCPUs, stddev: ${cpuStd.toFixed(1)})`,
      affectedCount: cpuOutliers,
      stats: `mean=${cpuMean.toFixed(1)}, stddev=${cpuStd.toFixed(1)}`,
    });
  }

  const memOutliers = vms.filter(vm => Math.abs(zScore(vm.memory || 0, memMean, memStd)) > 2).length;
  if (memOutliers > 0) {
    candidates.push({
      category: 'resource-misconfig',
      description: `${memOutliers} VMs with memory allocation >2 std deviations from mean (mean: ${(memMean / 1024).toFixed(1)} GiB, stddev: ${(memStd / 1024).toFixed(1)} GiB)`,
      affectedCount: memOutliers,
      stats: `mean=${(memMean / 1024).toFixed(1)}GiB, stddev=${(memStd / 1024).toFixed(1)}GiB`,
    });
  }

  // Old snapshots (>30 days)
  const now = Date.now();
  const oldSnapshots = snapshots.filter(s => {
    if (!s.dateTime) return false;
    const age = (now - new Date(s.dateTime).getTime()) / (1000 * 60 * 60 * 24);
    return age > 30;
  });
  if (oldSnapshots.length > 0) {
    const uniqueVMs = new Set(oldSnapshots.map(s => s.vmName)).size;
    const oldestDays = Math.max(...oldSnapshots.map(s =>
      s.dateTime ? Math.floor((now - new Date(s.dateTime).getTime()) / (1000 * 60 * 60 * 24)) : 0
    ));
    candidates.push({
      category: 'storage-anomaly',
      description: `${oldSnapshots.length} snapshots older than 30 days across ${uniqueVMs} VMs`,
      affectedCount: uniqueVMs,
      stats: `oldest=${oldestDays} days`,
    });
  }

  // Missing VMware Tools
  const missingTools = tools.filter(t => {
    const status = (t.toolsStatus || '').toLowerCase();
    return status.includes('notrunning') || status.includes('notinstalled') || status.includes('not running') || status.includes('not installed');
  });
  if (missingTools.length > 0) {
    candidates.push({
      category: 'security-concern',
      description: `${missingTools.length} VMs with VMware Tools not running or not installed`,
      affectedCount: missingTools.length,
    });
  }

  // CD-ROMs connected
  const connectedCDs = cds.filter(cd => cd.connected);
  if (connectedCDs.length > 0) {
    const uniqueVMs = new Set(connectedCDs.map(cd => cd.vmName)).size;
    candidates.push({
      category: 'configuration-drift',
      description: `${connectedCDs.length} CD-ROM devices connected across ${uniqueVMs} VMs`,
      affectedCount: uniqueVMs,
    });
  }

  // VMs with many NICs (>3)
  const manyNicVMs = vms.filter(vm => (vmNicMap.get(vm.vmName || '') || 0) > 3).length;
  if (manyNicVMs > 0) {
    candidates.push({
      category: 'network-anomaly',
      description: `${manyNicVMs} VMs with more than 3 network adapters`,
      affectedCount: manyNicVMs,
    });
  }

  // Templates counted as VMs
  const templates = vms.filter(vm => vm.template).length;
  if (templates > 0) {
    candidates.push({
      category: 'configuration-drift',
      description: `${templates} VM templates in the inventory (typically excluded from migration)`,
      affectedCount: templates,
    });
  }

  // Powered off VMs
  const poweredOff = vms.filter(vm => {
    const state = (vm.powerState || '').toLowerCase();
    return state.includes('off') || state.includes('suspended');
  }).length;
  if (poweredOff > 0) {
    candidates.push({
      category: 'migration-risk',
      description: `${poweredOff} VMs in powered-off or suspended state`,
      affectedCount: poweredOff,
    });
  }

  return {
    anomalyCandidates: candidates,
    totalVMs: vms.length,
    totalHosts: (rawData.vHost || []).length,
    totalClusters: (rawData.vCluster || []).length,
  };
}
