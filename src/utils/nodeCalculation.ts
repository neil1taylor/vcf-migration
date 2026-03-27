// Pure function for calculating the number of bare metal nodes required
// for a given workload on a specific profile. Extracted from useSizingCalculator
// to enable per-profile node count calculation in cost comparison tiles.

import { calculateOdfReservation } from '@/utils/odfCalculation';
import type { OdfTuningProfile, OdfCpuUnitMode } from '@/utils/odfCalculation';
import type { RoksSolutionType } from '@/services/costEstimation';

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
  solutionType?: RoksSolutionType;
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
 * For NVMe-converged and bm-block-odf solutions, returns totalNodes rounded
 * to multiples of 3 (ODF rack fault domain). For bm-block-csi (no ODF),
 * returns N + redundancy without round-to-3.
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
    solutionType,
  } = params;

  // bm-disaggregated compute nodes: no ODF (runs on separate storage pool), no per-node storage
  const hasOdf = solutionType !== 'bm-block-csi' && solutionType !== 'bm-disaggregated';
  const isExternalStorage = solutionType === 'bm-block-csi' || solutionType === 'bm-block-odf' || solutionType === 'bm-disaggregated';

  // Calculate ODF reservation for this profile
  // For bm-block-csi (no ODF): skip reservation entirely
  // For bm-block-odf: ODF on block storage, use 1 OSD per node (block volumes)
  // For nvme-converged: use actual NVMe disk count
  // For hybrid-vsi-odf / undefined: use NVMe disk count (existing behavior)
  let odfReservedCpu = 0;
  let odfReservedMemory = 0;

  if (hasOdf) {
    const osdCount = solutionType === 'bm-block-odf' ? 1 : (profile.nvmeDisks ?? 0);
    const odf = calculateOdfReservation(
      odfTuningProfile as OdfTuningProfile,
      osdCount,
      3, // Initial pass uses minimum 3 nodes
      includeRgw,
      odfCpuUnitMode as OdfCpuUnitMode,
      htMultiplier,
      useHyperthreading,
    );
    odfReservedCpu = odf.totalCpu;
    odfReservedMemory = odf.totalMemoryGiB;
  }

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

  // Storage capacity — for external block storage solutions, storage is not per-node constrained
  let usableStorageGiB = 0;
  if (!isExternalStorage) {
    const rawStorageGiB = profile.totalNvmeGiB ?? (profile.totalNvmeGB ?? 0);
    const maxStorageEfficiency = (1 / replicaFactor) * (1 - cephOverhead / 100);
    const maxUsableStorageGiB = Math.floor(rawStorageGiB * maxStorageEfficiency);
    usableStorageGiB = Math.floor(maxUsableStorageGiB * (operationalCapacity / 100));
  }

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
  // External storage: no per-node storage constraint
  const nodesForStorage = (!isExternalStorage && effectiveStorageCapacity > 0)
    ? Math.ceil(totalStorageGiB / effectiveStorageCapacity)
    : 0;

  const minNodes = hasOdf ? 3 : 1; // ODF requires minimum 3 nodes for quorum
  const minSurvivingNodes = Math.max(minNodes, nodesForCPU, nodesForMemory, nodesForStorage);

  const preRoundingTotal = minSurvivingNodes + nodeRedundancy;

  // ODF rack fault domain requires nodes in multiples of 3
  if (hasOdf) {
    const roundUpToRackGroup = (n: number) => Math.ceil(n / 3) * 3;
    return roundUpToRackGroup(preRoundingTotal);
  }

  // No ODF (bm-block-csi / bm-disaggregated compute): just N + redundancy, no round-to-3
  return preRoundingTotal;
}

export interface StorageNodeCalcParams {
  totalStorageGiB: number;
  replicaFactor: number;
  cephOverhead: number;
  operationalCapacity: number;
  nodeRedundancy: number;
  odfTuningProfile: string;
  odfCpuUnitMode: string;
  htMultiplier: number;
  useHyperthreading: boolean;
  includeRgw: boolean;
}

/**
 * Calculate the number of dedicated NVMe storage nodes required for the
 * bm-disaggregated solution type. These nodes run ODF only (no VM workloads).
 *
 * Returns node count rounded to multiples of 3 (ODF rack fault domain),
 * with a minimum of 3 for ODF quorum.
 */
export function calculateStorageNodesForProfile(
  profile: ProfileForNodeCalc,
  params: StorageNodeCalcParams,
): number {
  const {
    totalStorageGiB,
    replicaFactor,
    cephOverhead,
    operationalCapacity,
    nodeRedundancy,
  } = params;

  // Storage capacity per node from NVMe
  const rawStorageGiB = profile.totalNvmeGiB ?? (profile.totalNvmeGB ?? 0);
  const maxStorageEfficiency = (1 / replicaFactor) * (1 - cephOverhead / 100);
  const maxUsableStorageGiB = Math.floor(rawStorageGiB * maxStorageEfficiency);
  const usableStorageGiB = Math.floor(maxUsableStorageGiB * (operationalCapacity / 100));

  // Nodes required for storage
  const nodesForStorage = usableStorageGiB > 0
    ? Math.ceil(totalStorageGiB / usableStorageGiB)
    : 0;

  // ODF requires minimum 3 nodes for quorum
  const minSurvivingNodes = Math.max(3, nodesForStorage);
  const preRoundingTotal = minSurvivingNodes + nodeRedundancy;

  // ODF rack fault domain: round to multiples of 3
  return Math.ceil(preRoundingTotal / 3) * 3;
}
