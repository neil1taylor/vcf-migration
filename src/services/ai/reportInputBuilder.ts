// Report input builder — assembles aggregated data for AI report generation
// Never sends individual VM names, IPs, or hostnames

import type { RVToolsData, AnalysisResults } from '@/types';
import type { ReportInput } from './types';

/**
 * Build report input from current app state
 */
export function buildReportInput(
  rawData: RVToolsData | null,
  analysis: AnalysisResults | null,
  options?: {
    workloadBreakdown?: Record<string, number>;
    costEstimate?: { monthly: number; annual: number; region: string };
    riskSummary?: { overallRisk: string; goNoGo: string };
    wavePlan?: { totalWaves: number; totalDuration: number };
    migrationTarget?: string;
  }
): ReportInput | null {
  if (!rawData) return null;

  const vms = rawData.vInfo || [];
  const disks = rawData.vDisk || [];
  const totalStorageMiB = disks.reduce((sum, d) => sum + (d.capacityMiB || 0), 0);

  const complexitySummary = { simple: 0, moderate: 0, complex: 0, blocker: 0 };
  if (analysis?.complexity) {
    for (const result of analysis.complexity) {
      const cat = result.category;
      if (cat in complexitySummary) {
        complexitySummary[cat as keyof typeof complexitySummary]++;
      }
    }
  }

  return {
    totalVMs: vms.length,
    totalVCPUs: vms.reduce((sum, vm) => sum + (vm.cpus || 0), 0),
    totalMemoryGiB: Math.round(vms.reduce((sum, vm) => sum + (vm.memory || 0), 0) / 1024),
    totalStorageTiB: Math.round((totalStorageMiB / 1024 / 1024) * 100) / 100,
    clusterCount: (rawData.vCluster || []).length,
    hostCount: (rawData.vHost || []).length,
    migrationTarget: options?.migrationTarget,
    workloadBreakdown: options?.workloadBreakdown,
    costEstimate: options?.costEstimate,
    riskSummary: options?.riskSummary,
    wavePlan: options?.wavePlan,
  };
}
