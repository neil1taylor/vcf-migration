// Chat context builder - extracts relevant context from DataContext state
// Only sends aggregated summaries, never individual VM names or IPs

import type { ChatContext } from './types';
import type { RVToolsData, AnalysisResults } from '@/types';

/**
 * Build chat context from current app state.
 * This runs on each message send, extracting relevant aggregates.
 * Enriched context includes network, OS, storage, and snapshot summaries
 * when available — all aggregated, never per-VM.
 */
export function buildChatContext(
  rawData: RVToolsData | null,
  analysis: AnalysisResults | null,
  currentPage: string
): ChatContext | undefined {
  if (!rawData) return undefined;

  const vms = rawData.vInfo || [];

  // Build summary
  const totalVMs = vms.length;
  const totalVCPUs = vms.reduce((sum, vm) => sum + (vm.cpus || 0), 0);
  const totalMemoryMiB = vms.reduce((sum, vm) => sum + (vm.memory || 0), 0);

  // Calculate storage from vDisk
  const disks = rawData.vDisk || [];
  const totalStorageMiB = disks.reduce((sum, d) => sum + (d.capacityMiB || 0), 0);

  const clusters = rawData.vCluster || [];
  const hosts = rawData.vHost || [];
  const datastores = rawData.vDatastore || [];

  // Build workload breakdown from analysis if available
  const workloadBreakdown: Record<string, number> = {};

  // Build complexity summary from analysis
  const complexitySummary = {
    simple: 0,
    moderate: 0,
    complex: 0,
    blocker: 0,
  };

  if (analysis?.complexity) {
    for (const result of analysis.complexity) {
      const category = result.category;
      if (category in complexitySummary) {
        complexitySummary[category as keyof typeof complexitySummary]++;
      }
    }
  }

  // Build blocker summary
  const blockerSummary: string[] = [];
  if (complexitySummary.blocker > 0) {
    blockerSummary.push(`${complexitySummary.blocker} VMs with migration blockers`);
  }

  // Enriched context: network topology (aggregated port group counts)
  const networkTopology: string[] = [];
  const networks = rawData.vNetwork || [];
  if (networks.length > 0) {
    const portGroupCounts = new Map<string, number>();
    for (const n of networks) {
      const pg = n.networkName || 'unknown';
      portGroupCounts.set(pg, (portGroupCounts.get(pg) || 0) + 1);
    }
    const sorted = [...portGroupCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [pg, count] of sorted.slice(0, 10)) {
      networkTopology.push(`${pg}: ${count} NICs`);
    }
  }

  // Enriched context: OS distribution (aggregated counts)
  const osDistribution: string[] = [];
  const osCounts = new Map<string, number>();
  for (const vm of vms) {
    const os = vm.guestOS || 'Unknown';
    osCounts.set(os, (osCounts.get(os) || 0) + 1);
  }
  const sortedOS = [...osCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [os, count] of sortedOS.slice(0, 10)) {
    osDistribution.push(`${os}: ${count}`);
  }

  // Enriched context: top resource consumers (anonymized — specs + workload type only)
  const topResourceConsumers: string[] = [];
  const byMemory = [...vms].sort((a, b) => (b.memory || 0) - (a.memory || 0)).slice(0, 5);
  for (const vm of byMemory) {
    topResourceConsumers.push(
      `${vm.cpus || 0} vCPUs, ${Math.round((vm.memory || 0) / 1024)} GiB RAM`
    );
  }

  // Enriched context: snapshot summary
  const snapshots = rawData.vSnapshot || [];
  let snapshotSummary: string | undefined;
  if (snapshots.length > 0) {
    const now = Date.now();
    const oldSnaps = snapshots.filter(s => {
      if (!s.dateTime) return false;
      const age = (now - new Date(s.dateTime).getTime()) / (1000 * 60 * 60 * 24);
      return age > 30;
    }).length;
    snapshotSummary = `${snapshots.length} total snapshots, ${oldSnaps} older than 30 days`;
  }

  // Enriched context: datastore summary
  let datastoreSummary: string | undefined;
  if (datastores.length > 0) {
    const totalCapacityGiB = datastores.reduce((sum, d) => sum + (d.capacityMiB || 0) / 1024, 0);
    const totalFreeGiB = datastores.reduce((sum, d) => sum + (d.freeMiB || 0) / 1024, 0);
    const usagePercent = totalCapacityGiB > 0 ? Math.round(((totalCapacityGiB - totalFreeGiB) / totalCapacityGiB) * 100) : 0;
    datastoreSummary = `${datastores.length} datastores, ${Math.round(totalCapacityGiB)} GiB total, ${usagePercent}% used`;
  }

  return {
    summary: {
      totalVMs,
      totalExcluded: 0,
      totalVCPUs,
      totalMemoryGiB: Math.round(totalMemoryMiB / 1024),
      totalStorageTiB: Math.round((totalStorageMiB / 1024 / 1024) * 100) / 100,
      clusterCount: clusters.length,
      hostCount: hosts.length,
      datastoreCount: datastores.length,
    },
    workloadBreakdown,
    complexitySummary,
    blockerSummary,
    currentPage,
    // Enriched data slices (sent only when relevant to the current page/question)
    networkTopology: networkTopology.length > 0 ? networkTopology : undefined,
    osDistribution: osDistribution.length > 0 ? osDistribution : undefined,
    topResourceConsumers: topResourceConsumers.length > 0 ? topResourceConsumers : undefined,
    snapshotSummary,
    datastoreSummary,
  };
}
