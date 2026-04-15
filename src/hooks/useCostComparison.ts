// Hook that orchestrates source BOM + all ROKS/ROVe + VSI cost estimates
// for the Cost Comparison tab on the Migration Review page.

import { useMemo } from 'react';
import type { VirtualMachine, VDiskInfo, RVToolsData } from '@/types/rvtools';
import type { IBMCloudPricing } from '@/services/pricing/pricingCache';
import {
  calculateROKSCost,
  calculateVSICost,
  getBareMetalProfiles,
  FUTURE_SOLUTION_TYPES,
} from '@/services/costEstimation';
import type {
  ROKSSizingInput,
  VSISizingInput,
  RoksSolutionType,
  CostEstimate,
  RegionCode,
  DiscountType,
} from '@/services/costEstimation';
import { calculateNodesForProfile, calculateStorageNodesForProfile } from '@/utils/nodeCalculation';
import { mapVMToVSIProfile } from '@/services/migration';
import { getVMWorkloadCategory, getStorageTierForWorkload } from '@/utils/workloadClassification';
import type { StorageTierType } from '@/utils/workloadClassification';
import { mibToGiB } from '@/utils/formatters';
import { VPC_DATA_VOLUME_MIN_GB } from '@/services/migration/remediation';
import type { ClassicBillingData } from '@/services/billing/types';
import { useSourceBOM } from './useSourceBOM';

// ===== TYPES =====

const SOLUTION_TYPES: RoksSolutionType[] = [
  'nvme-converged', 'hybrid-vsi-odf', 'bm-block-csi',
  'bm-block-odf', 'bm-disaggregated', 'bm-nfs-csi',
];

const SOLUTION_LABELS: Record<RoksSolutionType, string> = {
  'nvme-converged': 'NVMe Converged',
  'hybrid-vsi-odf': 'Hybrid (BM+VSI)',
  'bm-block-csi': 'BM + Block (CSI)',
  'bm-block-odf': 'BM + Block + ODF',
  'bm-disaggregated': 'BM Disaggregated',
  'bm-nfs-csi': 'BM + NFS (CSI)',
};

export interface RoksEstimateEntry {
  solutionType: RoksSolutionType;
  label: string;
  variant: 'full' | 'rov';
  estimate: CostEstimate;
  isFuture: boolean;
}

export interface CheapestEntry {
  solutionType: string;
  label: string;
  totalMonthly: number;
}

export interface CostComparisonResult {
  sourceBOM: CostEstimate | null;
  roksEstimates: RoksEstimateEntry[];
  vsiEstimate: CostEstimate | null;
  cheapestRoks: CheapestEntry | null;
  cheapestRov: CheapestEntry | null;
  bestSavingsPct: number | null;
  region: string;
  regionName: string;
  discountType: string;
  pricingVersion: string | null;
  sourceWarnings: string[];
  sourceCostSource: 'estimated' | 'actual' | 'mixed';
}

// ===== HELPERS =====

function buildROKSSizingFromVMs(
  vms: VirtualMachine[],
  disks: VDiskInfo[],
): ROKSSizingInput {
  const totalVCPUs = vms.reduce((sum, vm) => sum + vm.cpus, 0);
  const totalMemoryGiB = vms.reduce((sum, vm) => sum + mibToGiB(vm.memory), 0);
  const totalStorageGiB = vms.reduce((sum, vm) => sum + mibToGiB(vm.inUseMiB), 0);

  // Count boot + data volumes from disk data
  const vmNames = new Set(vms.map(v => v.vmName));
  const vmDisks = disks.filter(d => vmNames.has(d.vmName));
  const vmDiskMap = new Map<string, VDiskInfo[]>();
  for (const d of vmDisks) {
    const arr = vmDiskMap.get(d.vmName);
    if (arr) arr.push(d);
    else vmDiskMap.set(d.vmName, [d]);
  }

  let bootVolumeCount = 0;
  let bootVolumeCapacityGiB = 0;
  let dataVolumeCount = 0;
  let dataVolumeCapacityGiB = 0;

  for (const vm of vms) {
    const vmDiskList = vmDiskMap.get(vm.vmName);
    if (!vmDiskList || vmDiskList.length === 0) continue;
    const sorted = [...vmDiskList].sort((a, b) => (a.diskKey || 0) - (b.diskKey || 0));
    // Boot = first disk
    bootVolumeCount++;
    bootVolumeCapacityGiB += Math.round(mibToGiB(sorted[0].capacityMiB));
    // Data = rest
    for (let i = 1; i < sorted.length; i++) {
      dataVolumeCount++;
      dataVolumeCapacityGiB += Math.max(Math.round(mibToGiB(sorted[i].capacityMiB)), VPC_DATA_VOLUME_MIN_GB);
    }
  }

  return {
    computeNodes: 3,
    computeProfile: 'mx2d.metal.96x768',
    solutionType: 'nvme-converged',
    useNvme: true,
    storageTiB: Math.ceil(totalStorageGiB / 1024),
    odfTier: 'advanced',
    nodeCalcParams: {
      totalVCPUs,
      totalMemoryGiB,
      totalStorageGiB,
      evictionThreshold: 0.1,
      nodeRedundancy: 1,
      memoryOvercommit: 1,
      cpuOvercommit: 1,
      replicaFactor: 3,
      cephOverhead: 0.33,
      operationalCapacity: 0.75,
      odfTuningProfile: 'balanced',
      odfCpuUnitMode: 'physical',
      htMultiplier: 2,
      useHyperthreading: true,
      includeRgw: false,
      systemReservedCpu: 4,
      systemReservedMemory: 16,
      odfReservedMemory: 5,
    },
    bootVolumeCount,
    bootVolumeCapacityGiB,
    dataVolumeCount,
    dataVolumeCapacityGiB,
  };
}

function buildVSISizingFromVMs(
  vms: VirtualMachine[],
  disks: VDiskInfo[],
): VSISizingInput {
  // Map each VM to a standard VSI profile
  const profileCounts: Record<string, number> = {};
  for (const vm of vms) {
    const profile = mapVMToVSIProfile(vm.cpus, mibToGiB(vm.memory), vm.firmwareType);
    profileCounts[profile.name] = (profileCounts[profile.name] || 0) + 1;
  }
  const vmProfiles = Object.entries(profileCounts).map(([profile, count]) => ({ profile, count }));

  // Per-VM boot/data disk breakdown with per-tier storage
  const vmNames = new Set(vms.map(v => v.vmName));
  let totalBootStorageGiB = 0;
  const storageByTierGiB: Record<string, number> = {};

  // Build per-VM disk map
  const vmDiskMap = new Map<string, VDiskInfo[]>();
  for (const d of disks) {
    if (!vmNames.has(d.vmName)) continue;
    const arr = vmDiskMap.get(d.vmName);
    if (arr) arr.push(d);
    else vmDiskMap.set(d.vmName, [d]);
  }

  for (const vm of vms) {
    const vmDisks = vmDiskMap.get(vm.vmName);
    if (!vmDisks || vmDisks.length === 0) continue;
    const sorted = [...vmDisks].sort((a, b) => (a.diskKey || 0) - (b.diskKey || 0));

    // Boot disk: lowest diskKey, always general-purpose
    const isWindows = (vm.guestOS || '').toLowerCase().includes('windows');
    const bootGiB = Math.min(
      Math.max(Math.round(mibToGiB(sorted[0].capacityMiB)), isWindows ? 120 : 100),
      250,
    );
    totalBootStorageGiB += bootGiB;

    // Data disks: use VM's workload-based storage tier
    const dataDisks = sorted.slice(1);
    if (dataDisks.length > 0) {
      const category = getVMWorkloadCategory(vm.vmName);
      const tier: StorageTierType = getStorageTierForWorkload(category);
      const dataGiB = dataDisks.reduce(
        (sum, d) => sum + Math.max(Math.round(mibToGiB(d.capacityMiB)), VPC_DATA_VOLUME_MIN_GB),
        0,
      );
      storageByTierGiB[tier] = (storageByTierGiB[tier] || 0) + dataGiB;
    }
  }

  // Convert GiB → TiB
  const storageByTier: Record<string, number> = {};
  for (const [tier, gib] of Object.entries(storageByTierGiB)) {
    storageByTier[tier] = Math.ceil(gib / 1024);
  }

  const totalStorageGiB = disks
    .filter(d => vmNames.has(d.vmName))
    .reduce((sum, d) => sum + mibToGiB(d.capacityMiB), 0);

  return {
    vmProfiles,
    storageTiB: Math.ceil(totalStorageGiB / 1024),
    bootStorageGiB: totalBootStorageGiB,
    storageByTier,
  };
}

// ===== HOOK =====

export function useCostComparison(
  rawData: RVToolsData | null,
  vms: VirtualMachine[],
  disks: VDiskInfo[],
  pricing: IBMCloudPricing | null,
  region: RegionCode,
  discountType: DiscountType,
  billingData?: ClassicBillingData | null,
): CostComparisonResult {
  // Source BOM
  const sourceBOMResult = useSourceBOM(rawData, region, pricing, billingData);

  // ROKS/ROVe estimates for all 6 solution types × 2 variants
  const roksEstimates = useMemo<RoksEstimateEntry[]>(() => {
    const poweredOn = vms.filter(vm => vm.powerState === 'poweredOn');
    if (poweredOn.length === 0 || !pricing) return [];

    const baseInput = buildROKSSizingFromVMs(poweredOn, disks);
    const pricedProfiles = getBareMetalProfiles(pricing).data;

    const entries: RoksEstimateEntry[] = [];

    for (const st of SOLUTION_TYPES) {
      const isFuture = FUTURE_SOLUTION_TYPES.has(st);
      const computeNeedsNvme = st === 'nvme-converged' || st === 'hybrid-vsi-odf';

      // Find best-value compute profile
      const candidates = pricedProfiles.filter(p =>
        (computeNeedsNvme ? p.hasNvme : !p.hasNvme) && p.roksSupported && p.monthlyRate > 0,
      );

      let bestProfile = candidates[0];
      let bestNodeCount = baseInput.computeNodes;

      if (candidates.length > 0 && baseInput.nodeCalcParams) {
        let bestCost = Infinity;
        for (const p of candidates) {
          const nodes = calculateNodesForProfile(
            { physicalCores: p.physicalCores, memoryGiB: p.memoryGiB, hasNvme: p.hasNvme, nvmeDisks: p.nvmeDisks, totalNvmeGB: p.totalNvmeGB },
            { ...baseInput.nodeCalcParams, solutionType: st },
          );
          const totalCost = nodes * p.monthlyRate;
          if (totalCost < bestCost) {
            bestCost = totalCost;
            bestProfile = p;
            bestNodeCount = nodes;
          }
        }
      }

      const profileName = bestProfile?.id || baseInput.computeProfile;

      // For bm-disaggregated: find best-value NVMe storage profile
      let storageNodes: number | undefined;
      let storageProfileName: string | undefined;
      if (st === 'bm-disaggregated' && baseInput.nodeCalcParams) {
        const nvmeCandidates = pricedProfiles.filter(p => p.hasNvme && p.roksSupported && p.monthlyRate > 0);
        let bestStorageCost = Infinity;
        for (const p of nvmeCandidates) {
          const sNodes = calculateStorageNodesForProfile(
            { physicalCores: p.physicalCores, memoryGiB: p.memoryGiB, hasNvme: p.hasNvme, nvmeDisks: p.nvmeDisks, totalNvmeGB: p.totalNvmeGB },
            {
              totalStorageGiB: baseInput.nodeCalcParams.totalStorageGiB,
              replicaFactor: baseInput.nodeCalcParams.replicaFactor,
              cephOverhead: baseInput.nodeCalcParams.cephOverhead,
              operationalCapacity: baseInput.nodeCalcParams.operationalCapacity,
              nodeRedundancy: baseInput.nodeCalcParams.nodeRedundancy,
              odfTuningProfile: baseInput.nodeCalcParams.odfTuningProfile,
              odfCpuUnitMode: baseInput.nodeCalcParams.odfCpuUnitMode,
              htMultiplier: baseInput.nodeCalcParams.htMultiplier,
              useHyperthreading: baseInput.nodeCalcParams.useHyperthreading,
              includeRgw: baseInput.nodeCalcParams.includeRgw,
            },
          );
          const storageCost = sNodes * p.monthlyRate;
          if (storageCost < bestStorageCost) {
            bestStorageCost = storageCost;
            storageNodes = sNodes;
            storageProfileName = p.id;
          }
        }
      }

      const input: ROKSSizingInput = {
        ...baseInput,
        solutionType: st,
        computeProfile: profileName,
        computeNodes: bestNodeCount,
        useNvme: st === 'nvme-converged',
        ...(st === 'bm-disaggregated' && storageNodes && storageProfileName ? {
          storageNodes,
          storageProfile: storageProfileName,
        } : {}),
      };

      for (const variant of ['full', 'rov'] as const) {
        const estimate = calculateROKSCost(input, region, discountType, pricing, variant);
        entries.push({
          solutionType: st,
          label: SOLUTION_LABELS[st],
          variant,
          estimate,
          isFuture,
        });
      }
    }

    return entries;
  }, [vms, disks, pricing, region, discountType]);

  // VSI estimate
  const vsiEstimate = useMemo<CostEstimate | null>(() => {
    const poweredOn = vms.filter(vm => vm.powerState === 'poweredOn');
    if (poweredOn.length === 0 || !pricing) return null;

    const sizing = buildVSISizingFromVMs(poweredOn, disks);
    return calculateVSICost(sizing, region, discountType, pricing);
  }, [vms, disks, pricing, region, discountType]);

  // Derived summaries
  const { cheapestRoks, cheapestRov, bestSavingsPct } = useMemo(() => {
    const sourceMonthlyCost = sourceBOMResult?.estimate.totalMonthly ?? null;

    // Find cheapest non-future ROKS and ROVe
    const availableRoks = roksEstimates.filter(e => !e.isFuture && e.variant === 'full');
    const availableRov = roksEstimates.filter(e => !e.isFuture && e.variant === 'rov');

    let cheapestRoks: CheapestEntry | null = null;
    let cheapestRov: CheapestEntry | null = null;

    if (availableRoks.length > 0) {
      const min = availableRoks.reduce((a, b) => a.estimate.totalMonthly < b.estimate.totalMonthly ? a : b);
      cheapestRoks = { solutionType: min.solutionType, label: min.label, totalMonthly: min.estimate.totalMonthly };
    }
    if (availableRov.length > 0) {
      const min = availableRov.reduce((a, b) => a.estimate.totalMonthly < b.estimate.totalMonthly ? a : b);
      cheapestRov = { solutionType: min.solutionType, label: min.label, totalMonthly: min.estimate.totalMonthly };
    }

    // Best savings relative to source
    let bestSavingsPct: number | null = null;
    if (sourceMonthlyCost && sourceMonthlyCost > 0) {
      const allTargetMonthlyCosts = [
        ...(cheapestRoks ? [cheapestRoks.totalMonthly] : []),
        ...(cheapestRov ? [cheapestRov.totalMonthly] : []),
        ...(vsiEstimate ? [vsiEstimate.totalMonthly] : []),
      ];
      if (allTargetMonthlyCosts.length > 0) {
        const lowestTarget = Math.min(...allTargetMonthlyCosts);
        bestSavingsPct = ((sourceMonthlyCost - lowestTarget) / sourceMonthlyCost) * 100;
      }
    }

    return { cheapestRoks, cheapestRov, bestSavingsPct };
  }, [sourceBOMResult, roksEstimates, vsiEstimate]);

  const regionName = pricing?.regions[region]?.name ?? region;
  const pricingVersion = pricing?.pricingVersion ?? null;
  const sourceWarnings = sourceBOMResult?.warnings ?? [];

  return {
    sourceBOM: sourceBOMResult?.estimate ?? null,
    roksEstimates,
    vsiEstimate,
    cheapestRoks,
    cheapestRov,
    bestSavingsPct,
    region,
    regionName,
    discountType,
    pricingVersion,
    sourceWarnings,
    sourceCostSource: sourceBOMResult?.costSource ?? 'estimated',
  };
}
