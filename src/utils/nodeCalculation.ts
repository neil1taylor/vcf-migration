// Pure function for calculating the number of bare metal nodes required
// for a given workload on a specific profile. Extracted from useSizingCalculator
// to enable per-profile node count calculation in cost comparison tiles.

import { calculateOdfReservation } from '@/utils/odfCalculation';
import type { OdfTuningProfile, OdfCpuUnitMode } from '@/utils/odfCalculation';

export interface NodeCalcParams {
  totalVCPUs: number;
  totalMemoryGiB: number;
  totalStorageGiB: number;
  evictionThreshold: number;
  nodeRedundancy: number;
  memoryOvercommit: number;
  cpuOvercommit: number;
  replicaFactor: number;
  cephOverhead: number;
  operationalCapacity: number;
  odfTuningProfile: string;
  odfCpuUnitMode: string;
  htMultiplier: number;
  useHyperthreading: boolean;
  includeRgw: boolean;
  systemReservedCpu: number;
  systemReservedMemory: number;
  odfReservedMemory: number;
}

export interface ProfileForNodeCalc {
  physicalCores: number;
  memoryGiB: number;
  hasNvme: boolean;
  nvmeDisks?: number;
  totalNvmeGB?: number;
  totalNvmeGiB?: number;
}

/**
 * Calculate the number of nodes required for a specific bare metal profile
 * to host the given workload requirements.
 *
 * Returns totalNodes (rounded to multiples of 3 for ODF rack fault domains).
 */
export function calculateNodesForProfile(
  profile: ProfileForNodeCalc,
  params: NodeCalcParams,
): number {
  const {
    totalVCPUs,
    totalMemoryGiB,
    totalStorageGiB,
    evictionThreshold,
    nodeRedundancy,
    memoryOvercommit,
    cpuOvercommit,
    replicaFactor,
    cephOverhead,
    operationalCapacity,
    odfTuningProfile,
    odfCpuUnitMode,
    htMultiplier,
    useHyperthreading,
    includeRgw,
    systemReservedCpu,
    systemReservedMemory,
  } = params;

  // Calculate ODF reservation for this profile
  const nvmeDisks = profile.nvmeDisks ?? 0;
  const odf = calculateOdfReservation(
    odfTuningProfile as OdfTuningProfile,
    nvmeDisks,
    3, // Initial pass uses minimum 3 nodes
    includeRgw,
    odfCpuUnitMode as OdfCpuUnitMode,
    htMultiplier,
    useHyperthreading,
  );

  const odfReservedCpu = odf.totalCpu;
  const odfReservedMemory = odf.totalMemoryGiB;
  const totalReservedCpu = systemReservedCpu + odfReservedCpu;
  const totalReservedMemory = systemReservedMemory + odfReservedMemory;

  // CPU capacity (same logic as useSizingCalculator nodeCapacity)
  let effectiveCores: number;
  if (odfCpuUnitMode === 'physical') {
    const availableCores = Math.max(0, profile.physicalCores - totalReservedCpu);
    effectiveCores = useHyperthreading ? availableCores * htMultiplier : availableCores;
  } else {
    const totalVcpus = useHyperthreading
      ? profile.physicalCores * htMultiplier
      : profile.physicalCores;
    const systemReservedVcpu = useHyperthreading
      ? systemReservedCpu * htMultiplier
      : systemReservedCpu;
    effectiveCores = Math.max(0, totalVcpus - odfReservedCpu - systemReservedVcpu);
  }
  const vcpuCapacity = Math.floor(effectiveCores * cpuOvercommit);

  // Memory capacity
  const availableMemoryGiB = Math.max(0, profile.memoryGiB - totalReservedMemory);
  const memoryCapacity = Math.floor(availableMemoryGiB * memoryOvercommit);

  // Storage capacity (totalNvmeGB is actually GiB despite the field name)
  const rawStorageGiB = profile.totalNvmeGiB ?? (profile.totalNvmeGB ?? 0);
  const maxStorageEfficiency = (1 / replicaFactor) * (1 - cephOverhead / 100);
  const maxUsableStorageGiB = Math.floor(rawStorageGiB * maxStorageEfficiency);
  const usableStorageGiB = Math.floor(maxUsableStorageGiB * (operationalCapacity / 100));

  // N+X Redundancy Calculation
  const evictionFactor = evictionThreshold / 100;
  const effectiveCpuCapacity = vcpuCapacity * evictionFactor;
  const effectiveMemoryCapacity = memoryCapacity * evictionFactor;
  const effectiveStorageCapacity = usableStorageGiB;

  // Raw per-node vCPU capacity for fallback
  const rawVcpuPerNode = Math.floor(
    (useHyperthreading ? profile.physicalCores * htMultiplier : profile.physicalCores) * cpuOvercommit
  );

  // Nodes required for each dimension at eviction threshold
  const nodesForCPU = effectiveCpuCapacity > 0
    ? Math.ceil(totalVCPUs / effectiveCpuCapacity)
    : rawVcpuPerNode > 0 && totalVCPUs > 0
      ? Math.ceil(totalVCPUs / (rawVcpuPerNode * evictionFactor))
      : 0;
  const nodesForMemory = effectiveMemoryCapacity > 0
    ? Math.ceil(totalMemoryGiB / effectiveMemoryCapacity)
    : 0;
  const nodesForStorage = effectiveStorageCapacity > 0
    ? Math.ceil(totalStorageGiB / effectiveStorageCapacity)
    : 0;

  const minSurvivingNodes = Math.max(3, nodesForCPU, nodesForMemory, nodesForStorage);

  // ODF rack fault domain requires nodes in multiples of 3
  const roundUpToRackGroup = (n: number) => Math.ceil(n / 3) * 3;
  const preRoundingTotal = minSurvivingNodes + nodeRedundancy;
  return roundUpToRackGroup(preRoundingTotal);
}
