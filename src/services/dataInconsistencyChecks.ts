// Client-side data quality checks for suspicious VM resource allocations.
// Pure functions, no AI dependency. Detects statistical outliers and
// name-resource mismatches that likely indicate data entry errors.

import type { VirtualMachine } from '@/types';

export type InconsistencySeverity = 'warning' | 'critical';
export type InconsistencyCategory =
  | 'memory-outlier'
  | 'cpu-outlier'
  | 'ratio-outlier'
  | 'name-resource-mismatch';

export interface DataInconsistencyWarning {
  vmName: string;
  category: InconsistencyCategory;
  severity: InconsistencySeverity;
  message: string;
  details: string;
  metric: string;
  expected: string;
}

export interface DataInconsistencyResult {
  warnings: DataInconsistencyWarning[];
  hasCritical: boolean;
}

// --- statistical helpers (same pattern as anomalyInputBuilder.ts) ---

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function zScore(value: number, m: number, sd: number): number {
  if (sd === 0) return 0;
  return (value - m) / sd;
}

// Name patterns that suggest small/utility workloads
const SMALL_WORKLOAD_PATTERN =
  /jump|bastion|test|dev|sandbox|demo|poc|temp/i;

/**
 * Analyse powered-on VMs for suspicious resource allocations.
 * Statistical rules (1-3, 5) require >= 5 VMs; rule 4 (name check) always runs.
 */
export function checkDataInconsistencies(
  vms: VirtualMachine[],
): DataInconsistencyResult {
  const warnings: DataInconsistencyWarning[] = [];

  if (vms.length === 0) {
    return { warnings, hasCritical: false };
  }

  const memGiBValues = vms.map((vm) => vm.memory / 1024);
  const cpuValues = vms.map((vm) => vm.cpus);
  const ratioValues = vms.map((vm) =>
    vm.cpus > 0 ? vm.memory / 1024 / vm.cpus : 0,
  );

  const medianMemGiB = median(memGiBValues);
  const medianCPUs = median(cpuValues);
  const medianRatio = median(ratioValues);

  const memMean = mean(memGiBValues);
  const memStd = stddev(memGiBValues);
  const cpuMean = mean(cpuValues);
  const cpuStd = stddev(cpuValues);

  const hasEnoughVMs = vms.length >= 5;

  for (let i = 0; i < vms.length; i++) {
    const vm = vms[i];
    const vmMemGiB = memGiBValues[i];
    const vmCPUs = cpuValues[i];
    const vmRatio = ratioValues[i];

    if (hasEnoughVMs) {
      // Rule 1: Memory >10x median
      if (medianMemGiB > 0 && vmMemGiB > 10 * medianMemGiB) {
        warnings.push({
          vmName: vm.vmName,
          category: 'memory-outlier',
          severity: 'critical',
          message: `Memory is ${Math.round(vmMemGiB / medianMemGiB)}x the median`,
          details: `This VM has ${vmMemGiB.toFixed(0)} GiB RAM while the median is ${medianMemGiB.toFixed(0)} GiB. This may indicate a data entry error (e.g., MiB entered as GiB).`,
          metric: `${vmMemGiB.toFixed(0)} GiB RAM`,
          expected: `median: ${medianMemGiB.toFixed(0)} GiB`,
        });
      }

      // Rule 2: CPU >10x median
      if (medianCPUs > 0 && vmCPUs > 10 * medianCPUs) {
        warnings.push({
          vmName: vm.vmName,
          category: 'cpu-outlier',
          severity: 'warning',
          message: `vCPU count is ${Math.round(vmCPUs / medianCPUs)}x the median`,
          details: `This VM has ${vmCPUs} vCPUs while the median is ${medianCPUs}. Verify this allocation is intentional.`,
          metric: `${vmCPUs} vCPUs`,
          expected: `median: ${medianCPUs}`,
        });
      }

      // Rule 3: Memory:CPU ratio >5x median ratio
      if (medianRatio > 0 && vmRatio > 5 * medianRatio) {
        warnings.push({
          vmName: vm.vmName,
          category: 'ratio-outlier',
          severity: 'warning',
          message: `Memory:CPU ratio is ${(vmRatio / medianRatio).toFixed(1)}x the median ratio`,
          details: `This VM has ${vmMemGiB.toFixed(0)} GiB / ${vmCPUs} vCPUs (${vmRatio.toFixed(1)} GiB/vCPU) while the median ratio is ${medianRatio.toFixed(1)} GiB/vCPU. One resource may be incorrectly sized.`,
          metric: `${vmRatio.toFixed(1)} GiB/vCPU`,
          expected: `median ratio: ${medianRatio.toFixed(1)} GiB/vCPU`,
        });
      }

      // Rule 5: Z-score >3 (memory or CPU)
      const memZ = zScore(vmMemGiB, memMean, memStd);
      const cpuZ = zScore(vmCPUs, cpuMean, cpuStd);

      if (memZ > 3) {
        // Only add if not already flagged by rule 1
        if (
          !warnings.some(
            (w) =>
              w.vmName === vm.vmName && w.category === 'memory-outlier',
          )
        ) {
          warnings.push({
            vmName: vm.vmName,
            category: 'memory-outlier',
            severity: 'warning',
            message: `Memory z-score of ${memZ.toFixed(1)} (>3 standard deviations)`,
            details: `This VM's ${vmMemGiB.toFixed(0)} GiB RAM is a statistical outlier (mean: ${memMean.toFixed(0)} GiB, stddev: ${memStd.toFixed(0)} GiB). Review for correctness.`,
            metric: `${vmMemGiB.toFixed(0)} GiB RAM`,
            expected: `mean: ${memMean.toFixed(0)} GiB (z=${memZ.toFixed(1)})`,
          });
        }
      }
      if (cpuZ > 3) {
        if (
          !warnings.some(
            (w) =>
              w.vmName === vm.vmName && w.category === 'cpu-outlier',
          )
        ) {
          warnings.push({
            vmName: vm.vmName,
            category: 'cpu-outlier',
            severity: 'warning',
            message: `CPU z-score of ${cpuZ.toFixed(1)} (>3 standard deviations)`,
            details: `This VM's ${vmCPUs} vCPUs is a statistical outlier (mean: ${cpuMean.toFixed(0)}, stddev: ${cpuStd.toFixed(0)}). Review for correctness.`,
            metric: `${vmCPUs} vCPUs`,
            expected: `mean: ${cpuMean.toFixed(0)} (z=${cpuZ.toFixed(1)})`,
          });
        }
      }
    }

    // Rule 4: Name suggests small workload + large resources (always runs)
    if (SMALL_WORKLOAD_PATTERN.test(vm.vmName)) {
      if (vmMemGiB > 64 || vmCPUs > 16) {
        warnings.push({
          vmName: vm.vmName,
          category: 'name-resource-mismatch',
          severity: vmMemGiB > 256 ? 'critical' : 'warning',
          message: `"${vm.vmName}" has unexpectedly large resources for its role`,
          details: `VM name suggests a utility/test workload, but it has ${vmMemGiB.toFixed(0)} GiB RAM and ${vmCPUs} vCPUs. This may be a configuration error.`,
          metric: `${vmMemGiB.toFixed(0)} GiB RAM, ${vmCPUs} vCPUs`,
          expected: 'typical for this role: <64 GiB RAM, <16 vCPUs',
        });
      }
    }
  }

  return {
    warnings,
    hasCritical: warnings.some((w) => w.severity === 'critical'),
  };
}
