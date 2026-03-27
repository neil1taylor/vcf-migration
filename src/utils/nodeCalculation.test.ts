import { describe, it, expect } from 'vitest';
import { calculateNodesForProfile, calculateStorageNodesForProfile } from './nodeCalculation';
import type { NodeCalcParams, ProfileForNodeCalc, StorageNodeCalcParams } from './nodeCalculation';

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

  describe('solutionType support', () => {
    const noNvmeProfile: ProfileForNodeCalc = {
      physicalCores: 96,
      memoryGiB: 768,
      hasNvme: false,
    };

    it('bm-block-csi skips ODF reservation and storage constraint', () => {
      const params = { ...baseParams, solutionType: 'bm-block-csi' as const, totalStorageGiB: 50000 };
      const result = calculateNodesForProfile(noNvmeProfile, params);
      // No round-to-3 for bm-block-csi (no ODF)
      // Minimum 1 node (not 3) + redundancy
      // Storage should not be a constraint since it's external
      const paramsNoStorage = { ...params, totalStorageGiB: 0 };
      const resultNoStorage = calculateNodesForProfile(noNvmeProfile, paramsNoStorage);
      // With massive storage, result should be the same since storage is external
      expect(result).toBe(resultNoStorage);
    });

    it('bm-block-csi does not require multiples of 3', () => {
      const tinyParams = {
        ...baseParams,
        solutionType: 'bm-block-csi' as const,
        totalVCPUs: 4,
        totalMemoryGiB: 8,
        totalStorageGiB: 50,
        nodeRedundancy: 1,
      };
      const result = calculateNodesForProfile(noNvmeProfile, tinyParams);
      // Minimum 1 + 1 redundancy = 2, no round-to-3
      expect(result).toBe(2);
    });

    it('bm-block-odf rounds to multiples of 3 (ODF rack fault domain)', () => {
      const tinyParams = {
        ...baseParams,
        solutionType: 'bm-block-odf' as const,
        totalVCPUs: 4,
        totalMemoryGiB: 8,
        totalStorageGiB: 50,
        nodeRedundancy: 1,
      };
      const result = calculateNodesForProfile(noNvmeProfile, tinyParams);
      // Minimum 3 for ODF + 1 redundancy = 4, rounded to 6
      expect(result % 3).toBe(0);
      expect(result).toBeGreaterThanOrEqual(6);
    });

    it('bm-block-odf uses 1 OSD per node for ODF reservation', () => {
      // Compare with nvme-converged which uses profile.nvmeDisks
      const nvmeProfile: ProfileForNodeCalc = {
        physicalCores: 96,
        memoryGiB: 768,
        hasNvme: true,
        nvmeDisks: 8,
        totalNvmeGiB: 25600,
      };
      const odfParams = { ...baseParams, solutionType: 'bm-block-odf' as const };
      const nvmeParams = { ...baseParams, solutionType: 'nvme-converged' as const };
      const odfResult = calculateNodesForProfile(noNvmeProfile, odfParams);
      const nvmeResult = calculateNodesForProfile(nvmeProfile, nvmeParams);
      // bm-block-odf with 1 OSD should have lower ODF overhead than 8 NVMe disks
      // This means more available CPU, potentially fewer nodes
      expect(odfResult).toBeLessThanOrEqual(nvmeResult);
    });

    it('nvme-converged backward compat (no solutionType)', () => {
      // Without solutionType, should behave same as before (default path)
      const withType = calculateNodesForProfile(largeProfile, { ...baseParams, solutionType: 'nvme-converged' });
      const withoutType = calculateNodesForProfile(largeProfile, baseParams);
      expect(withType).toBe(withoutType);
    });

    describe('bm-disaggregated compute nodes', () => {
      const disklessProfile: ProfileForNodeCalc = {
        physicalCores: 96,
        memoryGiB: 768,
        hasNvme: false,
      };

      it('sizes by CPU and memory only, no ODF overhead', () => {
        const params = { ...baseParams, solutionType: 'bm-disaggregated' as const, totalStorageGiB: 50000 };
        const paramsNoStorage = { ...params, totalStorageGiB: 0 };
        const result = calculateNodesForProfile(disklessProfile, params);
        const resultNoStorage = calculateNodesForProfile(disklessProfile, paramsNoStorage);
        // Storage is external (on separate storage pool), so changing it should not affect compute nodes
        expect(result).toBe(resultNoStorage);
      });

      it('does not round to multiples of 3 (no ODF on compute)', () => {
        const tinyParams = {
          ...baseParams,
          solutionType: 'bm-disaggregated' as const,
          totalVCPUs: 4,
          totalMemoryGiB: 8,
          totalStorageGiB: 0,
          nodeRedundancy: 1,
        };
        const result = calculateNodesForProfile(disklessProfile, tinyParams);
        // Minimum 1 + 1 redundancy = 2, no round-to-3
        expect(result).toBe(2);
      });

      it('has no ODF reservation (more capacity than nvme-converged)', () => {
        const disaggregatedParams = { ...baseParams, solutionType: 'bm-disaggregated' as const, totalStorageGiB: 0 };
        const convergedParams = { ...baseParams, solutionType: 'nvme-converged' as const, totalStorageGiB: 0 };
        const disaggResult = calculateNodesForProfile(disklessProfile, disaggregatedParams);
        const convergedResult = calculateNodesForProfile(largeProfile, convergedParams);
        // Disaggregated compute should need fewer or equal nodes (no ODF overhead)
        expect(disaggResult).toBeLessThanOrEqual(convergedResult);
      });
    });
  });
});

describe('calculateStorageNodesForProfile', () => {
  const nvmeProfile: ProfileForNodeCalc = {
    physicalCores: 96,
    memoryGiB: 768,
    hasNvme: true,
    nvmeDisks: 8,
    totalNvmeGiB: 25600,
  };

  const baseStorageParams: StorageNodeCalcParams = {
    totalStorageGiB: 5000,
    replicaFactor: 3,
    cephOverhead: 3,
    operationalCapacity: 75,
    nodeRedundancy: 1,
    odfTuningProfile: 'lean',
    odfCpuUnitMode: 'physical',
    htMultiplier: 1.25,
    useHyperthreading: true,
    includeRgw: false,
  };

  it('returns at least 3 nodes (ODF quorum)', () => {
    const tinyStorage = { ...baseStorageParams, totalStorageGiB: 50 };
    const result = calculateStorageNodesForProfile(nvmeProfile, tinyStorage);
    expect(result).toBeGreaterThanOrEqual(3);
  });

  it('returns multiples of 3 (ODF rack fault domain)', () => {
    const result = calculateStorageNodesForProfile(nvmeProfile, baseStorageParams);
    expect(result % 3).toBe(0);
  });

  it('increases nodes as storage requirement grows', () => {
    const small = calculateStorageNodesForProfile(nvmeProfile, { ...baseStorageParams, totalStorageGiB: 2000 });
    const large = calculateStorageNodesForProfile(nvmeProfile, { ...baseStorageParams, totalStorageGiB: 50000 });
    expect(large).toBeGreaterThan(small);
  });

  it('returns min 3 + redundancy even with zero storage', () => {
    const result = calculateStorageNodesForProfile(nvmeProfile, { ...baseStorageParams, totalStorageGiB: 0 });
    // Min 3 + 1 redundancy = 4, rounded to 6
    expect(result).toBe(6);
  });

  it('accounts for nodeRedundancy', () => {
    const noRedundancy = calculateStorageNodesForProfile(nvmeProfile, { ...baseStorageParams, nodeRedundancy: 0 });
    const withRedundancy = calculateStorageNodesForProfile(nvmeProfile, { ...baseStorageParams, nodeRedundancy: 2 });
    expect(withRedundancy).toBeGreaterThanOrEqual(noRedundancy);
  });

  it('handles smaller NVMe profile (needs more nodes)', () => {
    const smallNvme: ProfileForNodeCalc = {
      physicalCores: 48,
      memoryGiB: 384,
      hasNvme: true,
      nvmeDisks: 4,
      totalNvmeGiB: 12800,
    };
    const nodesLarge = calculateStorageNodesForProfile(nvmeProfile, baseStorageParams);
    const nodesSmall = calculateStorageNodesForProfile(smallNvme, baseStorageParams);
    expect(nodesSmall).toBeGreaterThanOrEqual(nodesLarge);
  });
});
