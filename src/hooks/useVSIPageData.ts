// Hook that computes derived data for the VSI Migration page:
// profile mappings, sizing inputs, and AI data builders.

import { useMemo } from 'react';
import { mibToGiB } from '@/utils/formatters';
import { VPC_DATA_VOLUME_MIN_GB } from '@/services/migration/remediation';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { mapVMToVSIProfile, getVSIProfiles, classifyVMForFlex, findFlexProfile, findInstanceStorageVariant, findGpuProfile, findBandwidthUpgrade, getProfileFamilyFromName } from '@/services/migration';
import type { VSIProfile, VMProfileMapping, VMClassification } from '@/services/migration';
import type { VSISizingInput } from '@/services/costEstimation';
import type { VMDetail } from '@/services/export';
import type { InsightsInput, NetworkSummaryForAI, WaveSuggestionInput, CostOptimizationInput, RemediationInput } from '@/services/ai/types';
import type { VirtualMachine, VDiskInfo, VNetworkInfo, RVToolsData } from '@/types/rvtools';
import type { RemediationItem } from '@/components/common';
import type { ComplexityScore } from '@/services/migration';
import type { UseWavePlanningReturn } from '@/hooks/useWavePlanning';
import type { CustomProfile } from '@/hooks/useCustomProfiles';
import type { StorageTierType } from '@/utils/workloadClassification';
import { getVMWorkloadCategory, getCategoryDisplayName } from '@/utils/workloadClassification';

// ===== INPUT TYPE =====

export interface UseVSIPageDataConfig {
  poweredOnVMs: VirtualMachine[];
  allVmsRawLength: number;
  vmsLength: number;
  disks: VDiskInfo[];
  networks: VNetworkInfo[];
  rawData: RVToolsData | null;
  customProfiles: CustomProfile[];
  getEffectiveProfile: (vmName: string, autoMappedProfile: string) => string;
  hasOverride: (vmName: string) => boolean;
  getEffectiveStorageTier: (vmName: string, autoTier: StorageTierType) => StorageTierType;
  hasStorageTierOverride: (vmName: string) => boolean;
  isFlexCandidate?: (vmName: string) => boolean;
  isInstanceStoragePreferred?: (vmName: string) => boolean;
  isGpuRequired?: (vmName: string) => boolean;
  isBandwidthSensitive?: (vmName: string) => boolean;
  complexityScores: ComplexityScore[];
  blockerCount: number;
  warningCount: number;
  wavePlanning: UseWavePlanningReturn;
  remediationItems: RemediationItem[];
}

// ===== RETURN TYPE =====

export interface UseVSIPageDataReturn {
  vmProfileMappings: VMProfileMapping[];
  profileCounts: Record<string, number>;
  topProfiles: Array<{ label: string; value: number }>;
  familyCounts: Record<string, number>;
  familyChartData: Array<{ label: string; value: number }>;
  totalVSIs: number;
  uniqueProfiles: number;
  vsiTotalVCPUs: number;
  vsiTotalMemory: number;
  overriddenVMCount: number;
  vsiSizing: VSISizingInput;
  insightsData: InsightsInput | null;
  waveSuggestionData: WaveSuggestionInput | null;
  costOptimizationData: CostOptimizationInput | null;
  remediationAIData: RemediationInput | null;
  vmDetails: VMDetail[];
  vsiProfiles: ReturnType<typeof getVSIProfiles>;
}

// ===== HOOK =====

export function useVSIPageData(config: UseVSIPageDataConfig): UseVSIPageDataReturn {
  const {
    poweredOnVMs,
    allVmsRawLength,
    vmsLength,
    disks,
    networks,
    rawData,
    customProfiles,
    getEffectiveProfile,
    hasOverride,
    getEffectiveStorageTier,
    hasStorageTierOverride,
    isFlexCandidate,
    isInstanceStoragePreferred,
    isGpuRequired,
    isBandwidthSensitive,
    complexityScores,
    blockerCount,
    warningCount,
    wavePlanning,
    remediationItems,
  } = config;

  const vsiProfiles = getVSIProfiles();

  // ===== VPC VSI PROFILE MAPPING =====
  const vmProfileMappings = useMemo<VMProfileMapping[]>(() => {
    // Build per-VM disk lookup for storage info
    const vmDiskMap = new Map<string, VDiskInfo[]>();
    for (const d of disks) {
      const existing = vmDiskMap.get(d.vmName);
      if (existing) existing.push(d);
      else vmDiskMap.set(d.vmName, [d]);
    }

    return poweredOnVMs.map(vm => {
      const memoryGiB = mibToGiB(vm.memory);

      // Classify VM for flex eligibility (kept for transparency in tooltips)
      const classification: VMClassification = classifyVMForFlex(vm.vmName, vm.nics);

      // Get both standard and flex profiles (firmware-aware: BIOS → Gen2)
      const standardProfile: VSIProfile = mapVMToVSIProfile(vm.cpus, memoryGiB, vm.firmwareType);
      const flexProfile = findFlexProfile(vm.cpus, memoryGiB);

      // User's explicit flex selection drives the profile default
      const isFlex = isFlexCandidate?.(vm.vmName) ?? false;
      let autoProfile = isFlex && flexProfile
        ? flexProfile
        : standardProfile;

      // User's explicit instance storage selection: switch to d-suffix variant
      const wantsInstanceStorage = isInstanceStoragePreferred?.(vm.vmName) ?? false;
      if (wantsInstanceStorage) {
        autoProfile = findInstanceStorageVariant(autoProfile);
      }

      // GPU workload → gx family (diagram step 1)
      const needsGpu = isGpuRequired?.(vm.vmName) ?? false;
      if (needsGpu) {
        const gpuProfile = findGpuProfile(vm.cpus, memoryGiB);
        if (gpuProfile) autoProfile = gpuProfile;
      }

      // Bandwidth-sensitive → size up one step (diagram step 6)
      const needsBandwidth = isBandwidthSensitive?.(vm.vmName) ?? false;
      if (needsBandwidth) {
        autoProfile = findBandwidthUpgrade(autoProfile);
      }

      const effectiveProfileName = getEffectiveProfile(vm.vmName, autoProfile.name);
      const isOverridden = hasOverride(vm.vmName);

      let effectiveProfile = autoProfile;
      if (isOverridden) {
        const customProfile = customProfiles.find(p => p.name === effectiveProfileName);
        if (customProfile) {
          effectiveProfile = {
            name: customProfile.name,
            vcpus: customProfile.vcpus,
            memoryGiB: customProfile.memoryGiB,
            bandwidthGbps: customProfile.bandwidth || 16,
            hourlyRate: 0,
            monthlyRate: 0,
          };
        } else {
          const allProfiles = [...vsiProfiles.balanced, ...vsiProfiles.compute, ...vsiProfiles.memory, ...(vsiProfiles.gpu || [])];
          const matchedProfile = allProfiles.find(p => p.name === effectiveProfileName);
          if (matchedProfile) effectiveProfile = matchedProfile;
        }
      }

      // Workload category (for display, not storage tier)
      const workloadCategory = getVMWorkloadCategory(vm.vmName);

      // Storage tier — Discovery is the single source of truth.
      // Default is general-purpose; overrides come from vmOverrides.dataStorageTier (set in Discovery or VSI table).
      const storageTier = getEffectiveStorageTier(vm.vmName, 'general-purpose' as StorageTierType);
      const isStorageTierOverridden = hasStorageTierOverride(vm.vmName);

      // Storage capacity
      const vmDisks = vmDiskMap.get(vm.vmName) || [];
      const provisionedStorageGiB = Math.round(vmDisks.reduce((sum, d) => sum + mibToGiB(d.capacityMiB), 0));
      const inUseStorageGiB = Math.round(mibToGiB(vm.inUseMiB));

      return {
        vmName: vm.vmName,
        vcpus: vm.cpus,
        memoryGiB: Math.round(memoryGiB),
        nics: vm.nics,
        guestOS: vm.guestOS,
        firmwareType: vm.firmwareType,
        autoProfile,
        flexProfile,
        profile: effectiveProfile,
        effectiveProfileName,
        isOverridden,
        classification,
        storageTier,
        autoStorageTier: 'general-purpose' as StorageTierType,
        isStorageTierOverridden,
        workloadCategory,
        provisionedStorageGiB,
        inUseStorageGiB,
        gpuRequired: needsGpu,
        bandwidthSensitive: needsBandwidth,
      };
    });
  }, [poweredOnVMs, customProfiles, getEffectiveProfile, hasOverride, getEffectiveStorageTier, hasStorageTierOverride, isFlexCandidate, isInstanceStoragePreferred, isGpuRequired, isBandwidthSensitive, vsiProfiles, disks]);

  // ===== PROFILE COUNTS & CHART DATA =====
  const profileCounts = useMemo(() => vmProfileMappings.reduce((acc, mapping) => {
    acc[mapping.profile.name] = (acc[mapping.profile.name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [vmProfileMappings]);

  const topProfiles = useMemo(() => Object.entries(profileCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10), [profileCounts]);

  const familyCounts = useMemo(() => vmProfileMappings.reduce((acc, mapping) => {
    const familyName = getProfileFamilyFromName(mapping.profile.name);
    acc[familyName] = (acc[familyName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [vmProfileMappings]);

  const familyChartData = useMemo(() => Object.entries(familyCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value), [familyCounts]);

  // ===== SUMMARY METRICS =====
  const totalVSIs = poweredOnVMs.length;
  const uniqueProfiles = Object.keys(profileCounts).length;
  const vsiTotalVCPUs = useMemo(() => vmProfileMappings.reduce((sum, m) => sum + m.profile.vcpus, 0), [vmProfileMappings]);
  const vsiTotalMemory = useMemo(() => vmProfileMappings.reduce((sum, m) => sum + m.profile.memoryGiB, 0), [vmProfileMappings]);
  const overriddenVMCount = useMemo(() => vmProfileMappings.filter(m => m.isOverridden).length, [vmProfileMappings]);

  // ===== VSI SIZING FOR COST ESTIMATION =====
  const vsiSizing = useMemo<VSISizingInput>(() => {
    const profileGroupings = vmProfileMappings.reduce((acc, mapping) => {
      acc[mapping.profile.name] = (acc[mapping.profile.name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const vmProfiles = Object.entries(profileGroupings).map(([profile, count]) => ({ profile, count }));

    // Compute per-VM boot/data disk breakdown with per-tier storage
    let totalBootStorageGiB = 0;
    const storageByTierGiB: Record<string, number> = {};
    const poweredOnVMNames = new Set(poweredOnVMs.map(vm => vm.vmName));

    for (const mapping of vmProfileMappings) {
      const vmDisks = disks
        .filter(d => d.vmName === mapping.vmName && poweredOnVMNames.has(d.vmName))
        .sort((a, b) => (a.diskKey || 0) - (b.diskKey || 0));

      if (vmDisks.length === 0) continue;

      // Boot disk: lowest diskKey, always general-purpose
      const bootDisk = vmDisks[0];
      const isWindows = mapping.guestOS.toLowerCase().includes('windows');
      const bootGiB = Math.min(
        Math.max(Math.round(mibToGiB(bootDisk.capacityMiB)), isWindows ? 120 : 100),
        250
      );
      totalBootStorageGiB += bootGiB;

      // Data disks: use VM's workload-based tier, floor to VPC minimum
      const dataDisks = vmDisks.slice(1);
      if (dataDisks.length > 0) {
        const dataGiB = dataDisks.reduce((sum, d) => sum + Math.max(Math.round(mibToGiB(d.capacityMiB)), VPC_DATA_VOLUME_MIN_GB), 0);
        const tier = mapping.storageTier;
        storageByTierGiB[tier] = (storageByTierGiB[tier] || 0) + dataGiB;
      }
    }

    // Convert GiB to TiB for the storageByTier map
    const storageByTier: Record<string, number> = {};
    for (const [tier, gib] of Object.entries(storageByTierGiB)) {
      storageByTier[tier] = Math.ceil(gib / 1024);
    }

    // Total storage in TiB (for backward compatibility)
    const totalStorageGiB = disks
      .filter(d => poweredOnVMNames.has(d.vmName))
      .reduce((sum, d) => sum + mibToGiB(d.capacityMiB), 0);

    return {
      vmProfiles,
      storageTiB: Math.ceil(totalStorageGiB / 1024),
      bootStorageGiB: totalBootStorageGiB,
      storageByTier,
    };
  }, [vmProfileMappings, disks, poweredOnVMs]);

  // ===== AI INSIGHTS DATA =====
  const insightsData = useMemo<InsightsInput | null>(() => {
    if (!isAIProxyConfigured()) return null;
    const totalStorageGiB = poweredOnVMs.reduce((sum, vm) => sum + mibToGiB(vm.inUseMiB), 0);
    const scores = Array.isArray(complexityScores) ? complexityScores : [];
    const complexSimple = scores.filter(s => s.category === 'Simple').length;
    const complexModerate = scores.filter(s => s.category === 'Moderate').length;
    const complexHigh = scores.filter(s => s.category === 'Complex').length;
    const complexBlocker = scores.filter(s => s.category === 'Blocker').length;
    const blockerSummary: string[] = [];
    if (blockerCount > 0) blockerSummary.push(`${blockerCount} pre-flight blockers`);
    if (warningCount > 0) blockerSummary.push(`${warningCount} warnings`);
    // Build network summary
    const networkSummary: NetworkSummaryForAI[] = [];
    const pgMap = new Map<string, { ips: Set<string>; vmNames: Set<string> }>();
    networks.forEach(nic => {
      const pg = nic.networkName || 'Unknown';
      if (!pgMap.has(pg)) pgMap.set(pg, { ips: new Set(), vmNames: new Set() });
      const entry = pgMap.get(pg)!;
      entry.vmNames.add(nic.vmName);
      if (nic.ipv4Address) entry.ips.add(nic.ipv4Address);
    });
    pgMap.forEach((data, portGroup) => {
      const prefixes = new Set<string>();
      data.ips.forEach(ip => {
        const parts = ip.split('.');
        if (parts.length >= 3) prefixes.add(`${parts[0]}.${parts[1]}.${parts[2]}.0/24`);
      });
      networkSummary.push({ portGroup, subnet: prefixes.size > 0 ? Array.from(prefixes).sort().join(', ') : 'N/A', vmCount: data.vmNames.size });
    });

    // Build workload classification breakdown from VM names
    const workloadClassificationBreakdown: Record<string, number> = {};
    for (const vm of poweredOnVMs) {
      const categoryKey = getVMWorkloadCategory(vm.vmName);
      const displayName = getCategoryDisplayName(categoryKey) || 'Unclassified';
      workloadClassificationBreakdown[displayName] = (workloadClassificationBreakdown[displayName] || 0) + 1;
    }

    // Build preflight summary from remediation items
    const preflightSummary = remediationItems.length > 0 ? {
      totalBlockers: blockerCount,
      totalWarnings: warningCount,
      topIssues: remediationItems.map(item => ({
        checkId: item.name,
        severity: item.severity,
        affectedCount: item.affectedCount,
      })),
    } : undefined;

    return {
      totalVMs: poweredOnVMs.length,
      totalExcluded: allVmsRawLength - vmsLength,
      totalVCPUs: vsiTotalVCPUs,
      totalMemoryGiB: vsiTotalMemory,
      totalStorageTiB: Math.ceil(totalStorageGiB / 1024),
      clusterCount: new Set(poweredOnVMs.map(vm => vm.cluster).filter(Boolean)).size,
      hostCount: rawData?.vHost.length ?? 0,
      datastoreCount: rawData?.vDatastore.length ?? 0,
      workloadBreakdown: familyCounts,
      complexitySummary: { simple: complexSimple, moderate: complexModerate, complex: complexHigh, blocker: complexBlocker },
      blockerSummary,
      networkSummary,
      workloadClassificationBreakdown,
      preflightSummary,
      migrationTarget: 'vsi',
    };
  }, [poweredOnVMs, allVmsRawLength, vmsLength, vsiTotalVCPUs, vsiTotalMemory, complexityScores, blockerCount, warningCount, familyCounts, networks, rawData, remediationItems]);

  // ===== AI WAVE SUGGESTIONS DATA =====
  const waveSuggestionData = useMemo<WaveSuggestionInput | null>(() => {
    if (!isAIProxyConfigured()) return null;
    const activeWaves = wavePlanning.wavePlanningMode === 'network' ? wavePlanning.networkWaves : wavePlanning.complexityWaves;
    if (!activeWaves || activeWaves.length === 0) return null;
    return {
      waves: wavePlanning.waveResources.map(w => ({
        name: w.name,
        vmCount: w.vmCount,
        totalVCPUs: w.vcpus,
        totalMemoryGiB: w.memoryGiB,
        totalStorageGiB: w.storageGiB,
        avgComplexity: 0,
        hasBlockers: w.hasBlockers,
        workloadTypes: [],
      })),
      totalVMs: poweredOnVMs.length,
      migrationTarget: 'vsi',
    };
  }, [wavePlanning.wavePlanningMode, wavePlanning.networkWaves, wavePlanning.complexityWaves, wavePlanning.waveResources, poweredOnVMs.length]);

  // ===== AI COST OPTIMIZATION DATA =====
  const costOptimizationData = useMemo<CostOptimizationInput | null>(() => {
    if (!isAIProxyConfigured()) return null;
    if (vmProfileMappings.length === 0) return null;
    const costProfileCounts = new Map<string, { count: number; workloadType: string }>();
    vmProfileMappings.forEach(m => {
      const key = m.profile.name;
      const existing = costProfileCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        const family = key.startsWith('mx') ? 'memory' : key.startsWith('cx') ? 'compute' : 'balanced';
        costProfileCounts.set(key, { count: 1, workloadType: family });
      }
    });
    return {
      vmProfiles: Array.from(costProfileCounts.entries()).map(([profile, data]) => ({
        profile,
        count: data.count,
        workloadType: data.workloadType,
      })),
      totalMonthlyCost: 0,
      migrationTarget: 'vsi',
      region: 'us-south',
    };
  }, [vmProfileMappings]);

  // ===== AI REMEDIATION DATA =====
  const remediationAIData = useMemo<RemediationInput | null>(() => {
    if (!isAIProxyConfigured()) return null;
    if (remediationItems.length === 0) return null;
    return {
      blockers: remediationItems.map(item => ({
        type: item.name,
        affectedVMCount: item.affectedCount,
        details: item.description,
      })),
      migrationTarget: 'vsi',
    };
  }, [remediationItems]);

  // ===== VM DETAILS FOR BOM EXPORT =====
  const vmDetails = useMemo<VMDetail[]>(() => poweredOnVMs.map(vm => {
    const mapping = vmProfileMappings.find(m => m.vmName === vm.vmName);
    const vmDisks = disks.filter(d => d.vmName === vm.vmName);
    const sortedDisks = [...vmDisks].sort((a, b) => (a.diskKey || 0) - (b.diskKey || 0));
    const bootDisk = sortedDisks[0];
    const dataDisks = sortedDisks.slice(1);
    const isWindows = vm.guestOS.toLowerCase().includes('windows');
    const bootVolumeGiB = bootDisk
      ? Math.max(Math.round(mibToGiB(bootDisk.capacityMiB)), isWindows ? 120 : 100)
      : (isWindows ? 120 : 100);
    const dataVolumes = dataDisks.map(d => ({ sizeGiB: Math.round(mibToGiB(d.capacityMiB)) }));

    return {
      vmName: vm.vmName,
      guestOS: vm.guestOS,
      profile: mapping?.profile.name || 'bx2-2x8',
      vcpus: mapping?.profile.vcpus || vm.cpus,
      memoryGiB: mapping?.profile.memoryGiB || Math.round(mibToGiB(vm.memory)),
      bootVolumeGiB,
      dataVolumes,
    };
  }), [poweredOnVMs, vmProfileMappings, disks]);

  return {
    vmProfileMappings,
    profileCounts,
    topProfiles,
    familyCounts,
    familyChartData,
    totalVSIs,
    uniqueProfiles,
    vsiTotalVCPUs,
    vsiTotalMemory,
    overriddenVMCount,
    vsiSizing,
    insightsData,
    waveSuggestionData,
    costOptimizationData,
    remediationAIData,
    vmDetails,
    vsiProfiles,
  };
}
