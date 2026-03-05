/**
 * Comparison Data Hook
 *
 * Splits VMs by target assignment (ROKS vs VSI) and computes
 * per-target metrics using existing service functions.
 */

import { useMemo } from 'react';
import type { VirtualMachine, VDiskInfo, VNetworkInfo, VSnapshotInfo, VToolsInfo } from '@/types/rvtools';
import type { VMClassification } from '@/services/migration/targetClassification';
import {
  calculateComplexityScores,
  getComplexityDistribution,
  calculateReadinessScore,
} from '@/services/migration/migrationAssessment';
import { countByOSStatus } from '@/services/migration/osCompatibility';
import { createComplexityWaves, buildVMWaveData } from '@/services/migration/wavePlanning';
import { getVMIdentifier } from '@/utils/vmIdentifier';

export interface TargetMetrics {
  vmCount: number;
  readinessScore: number;
  complexityDistribution: Record<string, number>;
  osStatusCounts: Record<string, number>;
  blockerCount: number;
  warningCount: number;
  estimatedWaveCount: number;
}

export interface ComparisonMetrics {
  roks: TargetMetrics;
  vsi: TargetMetrics;
}

function emptyMetrics(): TargetMetrics {
  return {
    vmCount: 0,
    readinessScore: 100,
    complexityDistribution: { Simple: 0, Moderate: 0, Complex: 0, Blocker: 0 },
    osStatusCounts: { supported: 0, partial: 0, unsupported: 0 },
    blockerCount: 0,
    warningCount: 0,
    estimatedWaveCount: 0,
  };
}

function computeMetrics(
  vms: VirtualMachine[],
  disks: VDiskInfo[],
  networks: VNetworkInfo[],
  snapshots: VSnapshotInfo[],
  tools: VToolsInfo[],
  mode: 'roks' | 'vsi',
): TargetMetrics {
  if (vms.length === 0) {
    return emptyMetrics();
  }

  // Filter disks and networks to only those belonging to these VMs
  const vmNameSet = new Set(vms.map(vm => vm.vmName.toLowerCase()));
  const filteredDisks = disks.filter(d => vmNameSet.has(d.vmName.toLowerCase()));
  const filteredNetworks = networks.filter(n => vmNameSet.has(n.vmName.toLowerCase()));
  const filteredSnapshots = snapshots.filter(s => vmNameSet.has(s.vmName.toLowerCase()));
  const filteredTools = tools.filter(t => vmNameSet.has(t.vmName.toLowerCase()));

  // Complexity scores and distribution
  const complexityScores = calculateComplexityScores(vms, filteredDisks, filteredNetworks, mode);
  const complexityDistribution = getComplexityDistribution(complexityScores);

  // OS status counts
  const osStatusCounts = countByOSStatus(vms, mode);

  // Blocker and warning counts
  const blockerCount = complexityDistribution['Blocker'] || 0;
  const warningCount = complexityDistribution['Complex'] || 0;

  // Unsupported OS count (key differs by mode)
  const unsupportedOSCount = mode === 'vsi'
    ? (osStatusCounts['unsupported'] || 0)
    : (osStatusCounts['unsupported'] || 0);

  // Readiness score
  const readinessScore = calculateReadinessScore(blockerCount, warningCount, unsupportedOSCount, vms.length);

  // Wave count
  const vmWaveData = buildVMWaveData(vms, complexityScores, filteredDisks, filteredSnapshots, filteredTools, filteredNetworks, mode);
  const waves = createComplexityWaves(vmWaveData, mode);
  const estimatedWaveCount = waves.filter(w => w.vms.length > 0).length;

  return {
    vmCount: vms.length,
    readinessScore,
    complexityDistribution,
    osStatusCounts,
    blockerCount,
    warningCount,
    estimatedWaveCount,
  };
}

export function useComparisonData(
  assignments: VMClassification[],
  allVMs: VirtualMachine[],
  disks: VDiskInfo[],
  networks: VNetworkInfo[],
  snapshots: VSnapshotInfo[],
  tools: VToolsInfo[],
): ComparisonMetrics {
  return useMemo(() => {
    if (assignments.length === 0 || allVMs.length === 0) {
      return { roks: emptyMetrics(), vsi: emptyMetrics() };
    }

    // Partition vmIds by target
    const roksIds = new Set<string>();
    const vsiIds = new Set<string>();
    for (const a of assignments) {
      if (a.target === 'roks') {
        roksIds.add(a.vmId);
      } else {
        vsiIds.add(a.vmId);
      }
    }

    // Split VMs using getVMIdentifier
    const roksVMs: VirtualMachine[] = [];
    const vsiVMs: VirtualMachine[] = [];
    for (const vm of allVMs) {
      const vmId = getVMIdentifier(vm);
      if (roksIds.has(vmId)) {
        roksVMs.push(vm);
      } else if (vsiIds.has(vmId)) {
        vsiVMs.push(vm);
      }
    }

    const roks = computeMetrics(roksVMs, disks, networks, snapshots, tools, 'roks');
    const vsi = computeMetrics(vsiVMs, disks, networks, snapshots, tools, 'vsi');

    return { roks, vsi };
  }, [assignments, allVMs, disks, networks, snapshots, tools]);
}
