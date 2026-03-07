import { describe, it, expect } from 'vitest';
import { calculateNodesForProfile } from './nodeCalculation';
import type { NodeCalcParams, ProfileForNodeCalc } from './nodeCalculation';

const baseParams: NodeCalcParams = {
  totalVCPUs: 200,
  totalMemoryGiB: 1500,
  totalStorageGiB: 5000,
  evictionThreshold: 80,
  nodeRedundancy: 1,
  memoryOvercommit: 1,
  cpuOvercommit: 1,
  replicaFactor: 3,
  cephOverhead: 3,
  operationalCapacity: 75,
  odfTuningProfile: 'lean',
  odfCpuUnitMode: 'physical',
  htMultiplier: 1.25,
  useHyperthreading: true,
  includeRgw: false,
  systemReservedCpu: 4,
  systemReservedMemory: 8,
  odfReservedMemory: 40,
};

const largeProfile: ProfileForNodeCalc = {
  physicalCores: 96,
  memoryGiB: 768,
  hasNvme: true,
  nvmeDisks: 8,
  totalNvmeGiB: 25600,
};

const smallProfile: ProfileForNodeCalc = {
  physicalCores: 48,
  memoryGiB: 384,
  hasNvme: true,
  nvmeDisks: 4,
  totalNvmeGiB: 12800,
};

describe('calculateNodesForProfile', () => {
  it('returns at least 3 nodes (ODF minimum)', () => {
    const tinyWorkload: NodeCalcParams = {
      ...baseParams,
      totalVCPUs: 4,
      totalMemoryGiB: 8,
      totalStorageGiB: 50,
    };
    const result = calculateNodesForProfile(largeProfile, tinyWorkload);
    expect(result).toBeGreaterThanOrEqual(3);
    // With nodeRedundancy=1, minimum is ceil((3+1)/3)*3 = 6
    expect(result % 3).toBe(0);
  });

  it('returns a multiple of 3 (ODF rack fault domain)', () => {
    const result = calculateNodesForProfile(largeProfile, baseParams);
    expect(result % 3).toBe(0);
  });

  it('returns more nodes for a smaller profile', () => {
    const nodesLarge = calculateNodesForProfile(largeProfile, baseParams);
    const nodesSmall = calculateNodesForProfile(smallProfile, baseParams);
    expect(nodesSmall).toBeGreaterThanOrEqual(nodesLarge);
  });

  it('increases nodes as workload grows', () => {
    const smallWorkload = { ...baseParams, totalVCPUs: 100, totalMemoryGiB: 500, totalStorageGiB: 2000 };
    const largeWorkload = { ...baseParams, totalVCPUs: 500, totalMemoryGiB: 3000, totalStorageGiB: 20000 };
    const nodesSmall = calculateNodesForProfile(largeProfile, smallWorkload);
    const nodesLarge = calculateNodesForProfile(largeProfile, largeWorkload);
    expect(nodesLarge).toBeGreaterThan(nodesSmall);
  });

  it('handles profile with no NVMe (zero storage capacity)', () => {
    const noNvmeProfile: ProfileForNodeCalc = {
      physicalCores: 96,
      memoryGiB: 768,
      hasNvme: false,
    };
    // Should still return a valid node count based on CPU/memory
    const result = calculateNodesForProfile(noNvmeProfile, {
      ...baseParams,
      totalStorageGiB: 0,
    });
    expect(result).toBeGreaterThanOrEqual(3);
    expect(result % 3).toBe(0);
  });

  it('uses totalNvmeGB when totalNvmeGiB is not available', () => {
    const profileWithGB: ProfileForNodeCalc = {
      physicalCores: 96,
      memoryGiB: 768,
      hasNvme: true,
      nvmeDisks: 8,
      totalNvmeGB: 25600,
    };
    const nodesGiB = calculateNodesForProfile(largeProfile, baseParams);
    const nodesGB = calculateNodesForProfile(profileWithGB, baseParams);
    expect(nodesGB).toBe(nodesGiB);
  });

  it('accounts for nodeRedundancy', () => {
    const noRedundancy = { ...baseParams, nodeRedundancy: 0 };
    const withRedundancy = { ...baseParams, nodeRedundancy: 2 };
    const nodesNoRedundancy = calculateNodesForProfile(largeProfile, noRedundancy);
    const nodesWithRedundancy = calculateNodesForProfile(largeProfile, withRedundancy);
    expect(nodesWithRedundancy).toBeGreaterThanOrEqual(nodesNoRedundancy);
  });
});
