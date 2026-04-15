// Builds InsightsInput from RVToolsData for use in export flows
// Only sends aggregated summaries, never individual VM names or IPs

import type { InsightsInput } from './types';
import type { RVToolsData } from '@/types/rvtools';
import type { ComplexityScore } from '@/services/migration/migrationAssessment';
import type { VMCheckResults } from '@/services/preflightChecks';
import { mibToGiB } from '@/utils/formatters';
import { isVMwareInfrastructureVM } from '@/utils/autoExclusion';
import { getVMWorkloadCategory, getCategoryDisplayName } from '@/utils/workloadClassification';

export interface InsightsEnrichment {
  complexityScores?: ComplexityScore[];
  preflightResults?: VMCheckResults[];
  workloadClassifications?: Record<string, string>;  // vmId -> workloadType
  targetClassifications?: Array<{ target: string }>;
  costEstimate?: { monthly: number; annual: number; region: string };
  migrationTarget?: 'roks' | 'vsi' | 'both';
}

/**
 * Build an InsightsInput from raw RVTools data.
 * Used by export flows (DOCX, PDF, Excel) to fetch AI insights.
 * Optional enrichment parameter adds complexity, preflight, and classification data.
 */
export function buildInsightsInput(rawData: RVToolsData, enrichment?: InsightsEnrichment): InsightsInput {
  const allVMs = rawData.vInfo.filter(vm => !vm.template && !isVMwareInfrastructureVM(vm.vmName, vm.guestOS));
  const poweredOnVMs = allVMs.filter(vm => vm.powerState === 'poweredOn');

  const totalVCPUs = poweredOnVMs.reduce((sum, vm) => sum + vm.cpus, 0);
  const totalMemoryGiB = Math.round(poweredOnVMs.reduce((sum, vm) => sum + mibToGiB(vm.memory), 0));
  const totalStorageTiB = Math.round((poweredOnVMs.reduce((sum, vm) => sum + mibToGiB(vm.provisionedMiB), 0) / 1024) * 100) / 100;
  const excludedCount = rawData.vInfo.length - allVMs.length;

  // Build OS distribution (workloadBreakdown)
  const workloadBreakdown: Record<string, number> = {};
  for (const vm of poweredOnVMs) {
    const os = vm.guestOS?.toLowerCase() || '';
    let category = 'Other';
    if (os.includes('windows server')) category = 'Windows Server';
    else if (os.includes('windows')) category = 'Windows Desktop';
    else if (os.includes('rhel') || os.includes('red hat')) category = 'RHEL';
    else if (os.includes('centos')) category = 'CentOS';
    else if (os.includes('ubuntu')) category = 'Ubuntu';
    else if (os.includes('sles') || os.includes('suse')) category = 'SLES';
    else if (os.includes('linux')) category = 'Linux (Other)';

    workloadBreakdown[category] = (workloadBreakdown[category] || 0) + 1;
  }

  // Build blocker summary
  const blockerSummary: string[] = [];
  const templatesCount = rawData.vInfo.filter(vm => vm.template).length;
  if (templatesCount > 0) {
    blockerSummary.push(`${templatesCount} VM templates excluded`);
  }
  const poweredOffCount = allVMs.filter(vm => vm.powerState !== 'poweredOn').length;
  if (poweredOffCount > 0) {
    blockerSummary.push(`${poweredOffCount} VMs powered off`);
  }

  // Build network summary
  const networkSummary = rawData.vNetwork?.length > 0
    ? buildNetworkSummary(rawData)
    : undefined;

  // Compute complexity summary from enrichment
  const complexitySummary = { simple: 0, moderate: 0, complex: 0, blocker: 0 };
  if (enrichment?.complexityScores) {
    for (const s of enrichment.complexityScores) {
      const key = s.category.toLowerCase() as keyof typeof complexitySummary;
      if (key in complexitySummary) complexitySummary[key]++;
    }
  }

  // Compute workload classification breakdown from enrichment or pattern matching
  let workloadClassificationBreakdown: Record<string, number> | undefined;
  if (enrichment?.workloadClassifications) {
    workloadClassificationBreakdown = {};
    for (const type of Object.values(enrichment.workloadClassifications)) {
      workloadClassificationBreakdown[type] = (workloadClassificationBreakdown[type] || 0) + 1;
    }
  } else {
    // Auto-classify from VM names using pattern matching
    const breakdown: Record<string, number> = {};
    for (const vm of poweredOnVMs) {
      const categoryKey = getVMWorkloadCategory(vm.vmName);
      const displayName = getCategoryDisplayName(categoryKey) || 'Unclassified';
      breakdown[displayName] = (breakdown[displayName] || 0) + 1;
    }
    // Only include if we classified at least some VMs
    const classifiedCount = Object.entries(breakdown)
      .filter(([k]) => k !== 'Unclassified')
      .reduce((sum, [, v]) => sum + v, 0);
    if (classifiedCount > 0) {
      workloadClassificationBreakdown = breakdown;
    }
  }

  // Compute preflight summary from enrichment
  let preflightSummary: InsightsInput['preflightSummary'];
  if (enrichment?.preflightResults && enrichment.preflightResults.length > 0) {
    let totalBlockers = 0;
    let totalWarnings = 0;
    const issueCounts = new Map<string, { severity: string; count: number }>();

    for (const vm of enrichment.preflightResults) {
      totalBlockers += vm.blockerCount;
      totalWarnings += vm.warningCount;
      for (const [checkId, check] of Object.entries(vm.checks)) {
        if (check.status !== 'pass') {
          const existing = issueCounts.get(checkId);
          if (existing) {
            existing.count++;
          } else {
            issueCounts.set(checkId, { severity: check.status === 'fail' ? 'blocker' : 'warning', count: 1 });
          }
        }
      }
    }

    const topIssues = Array.from(issueCounts.entries())
      .map(([checkId, { severity, count }]) => ({ checkId, severity, affectedCount: count }))
      .sort((a, b) => {
        if (a.severity === 'blocker' && b.severity !== 'blocker') return -1;
        if (b.severity === 'blocker' && a.severity !== 'blocker') return 1;
        return b.affectedCount - a.affectedCount;
      })
      .slice(0, 10);

    preflightSummary = { totalBlockers, totalWarnings, topIssues };
  }

  // Compute target split from enrichment
  let targetSplit: InsightsInput['targetSplit'];
  if (enrichment?.targetClassifications) {
    const split = { roks: 0, vsi: 0, powervs: 0 };
    for (const c of enrichment.targetClassifications) {
      const t = c.target.toLowerCase();
      if (t === 'roks') split.roks++;
      else if (t === 'vsi') split.vsi++;
      else if (t === 'powervs') split.powervs++;
    }
    targetSplit = split;
  }

  return {
    totalVMs: poweredOnVMs.length,
    totalExcluded: excludedCount,
    totalVCPUs,
    totalMemoryGiB,
    totalStorageTiB,
    clusterCount: rawData.vCluster.length,
    hostCount: rawData.vHost.length,
    datastoreCount: rawData.vDatastore.length,
    workloadBreakdown,
    complexitySummary,
    blockerSummary,
    networkSummary,
    workloadClassificationBreakdown,
    preflightSummary,
    targetSplit,
    costEstimate: enrichment?.costEstimate,
    migrationTarget: enrichment?.migrationTarget || 'both',
  };
}

function buildNetworkSummary(rawData: RVToolsData) {
  const portGroupMap = new Map<string, { vmNames: Set<string>; ips: string[] }>();

  for (const nic of rawData.vNetwork) {
    const pg = nic.networkName || 'Unknown';
    if (!portGroupMap.has(pg)) {
      portGroupMap.set(pg, { vmNames: new Set(), ips: [] });
    }
    const data = portGroupMap.get(pg)!;
    data.vmNames.add(nic.vmName);
    if (nic.ipv4Address) {
      data.ips.push(nic.ipv4Address);
    }
  }

  return Array.from(portGroupMap.entries()).map(([portGroup, data]) => {
    let subnet = 'N/A';
    if (data.ips.length > 0) {
      const prefixCounts = new Map<string, number>();
      for (const ip of data.ips) {
        const parts = ip.split('.');
        if (parts.length >= 3) {
          const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
          prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
        }
      }
      let maxCount = 0;
      let mostCommonPrefix = '';
      prefixCounts.forEach((count, prefix) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonPrefix = prefix;
        }
      });
      if (mostCommonPrefix) {
        subnet = `${mostCommonPrefix}.0/24`;
      }
    }
    return { portGroup, vmCount: data.vmNames.size, subnet };
  });
}
