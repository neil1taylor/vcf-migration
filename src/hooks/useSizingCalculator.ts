// Custom hook extracting all state, computed values, and calculation logic
// from the SizingCalculator component for clean separation of concerns.

import { useState, useMemo, useEffect, useRef } from 'react';
import { useData, useDynamicProfiles, useDynamicPricing, useVMOverrides } from '@/hooks';
import { getVMIdentifier } from '@/utils/vmIdentifier';
import { getBareMetalProfiles as getPricedProfiles } from '@/services/costEstimation';
import { calculateNodesForProfile } from '@/utils/nodeCalculation';
import { createLogger } from '@/utils/logger';
import ibmCloudConfig from '@/data/ibmCloudConfig.json';
import virtualizationOverhead from '@/data/virtualizationOverhead.json';
import { calculateOdfReservation } from '@/utils/odfCalculation';
import type { OdfTuningProfile, OdfCpuUnitMode, OdfReservation } from '@/utils/odfCalculation';
import type { SizingResult } from '@/components/sizing/SizingCalculator';

const logger = createLogger('SizingCalculator');

const SIZING_STORAGE_KEY = 'vcf-sizing-settings';

interface SizingSettings {
  selectedProfileName: string | null;
  cpuOvercommit: number;
  memoryOvercommit: number;
  htMultiplier: number;
  useHyperthreading: boolean;
  replicaFactor: number;
  operationalCapacity: number;
  cephOverhead: number;
  nodeRedundancy: number;
  evictionThreshold: number;
  storageMetric: 'provisioned' | 'inUse' | 'diskCapacity';
  annualGrowthRate: number;
  planningHorizonYears: number;
  virtOverhead: number;
  odfTuningProfile: string;
  includeRgw: boolean;
  odfCpuUnitMode: string;
}

function loadSizingSettings(): SizingSettings | null {
  try {
    const stored = localStorage.getItem(SIZING_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return null;
}

function saveSizingSettings(settings: SizingSettings): void {
  try {
    localStorage.setItem(SIZING_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export interface BareMetalProfile {
  name: string;
  physicalCores: number;
  vcpus: number;
  memoryGiB: number;
  hasNvme: boolean;
  nvmeDisks?: number;
  nvmeSizeGiB?: number;
  totalNvmeGiB?: number;
  roksSupported?: boolean;
  isCustom?: boolean;
  tag?: string;
  useCase?: string;
  description?: string;
}

export interface NodeCapacity {
  vcpuCapacity: number;
  memoryCapacity: number;
  maxUsableStorageGiB: number;
  usableStorageGiB: number;
  rawStorageGiB: number;
  maxStorageEfficiency: number;
  effectiveCores: number;
  availableCores: number;
  availableMemoryGiB: number;
}

export interface NodeRequirements {
  baseVCPUs: number;
  baseMemoryGiB: number;
  cpuVirtOverheadFixed: number;
  cpuVirtOverheadProportional: number;
  cpuVirtOverheadTotal: number;
  memoryVirtOverheadTotalGiB: number;
  totalVCPUs: number;
  totalMemoryGiB: number;
  baseStorageGiB: number;
  totalStorageGiB: number;
  provisionedStorageGiB: number;
  inUseStorageGiB: number;
  diskCapacityGiB: number;
  growthMultiplier: number;
  virtOverheadMultiplier: number;
  nodesForCPU: number;
  nodesForMemory: number;
  nodesForStorage: number;
  nodesForCPUAtThreshold: number;
  nodesForMemoryAtThreshold: number;
  nodesForStorageAtThreshold: number;
  minSurvivingNodes: number;
  preRoundingTotal: number;
  baseNodes: number;
  totalNodes: number;
  limitingFactor: 'cpu' | 'memory' | 'storage';
  vmCount: number;
  cpuCapacityExceeded: boolean;
}

export interface RedundancyValidation {
  totalNodes: number;
  failedNodes: number;
  survivingNodes: number;
  evictionThreshold: number;
  storageOperationalThreshold: number;
  cpuUtilHealthy: number;
  memoryUtilHealthy: number;
  storageUtilHealthy: number;
  cpuUtilAfterFailure: number;
  memoryUtilAfterFailure: number;
  storageUtilAfterFailure: number;
  cpuPasses: boolean;
  memoryPasses: boolean;
  storagePasses: boolean;
  odfQuorumPasses: boolean;
  allPass: boolean;
}

export interface VMFitValidation {
  allFit: boolean;
  oversizedVMs: Array<{
    vmName: string;
    resource: 'memory' | 'cpu' | 'both';
    vmMemoryGiB: number;
    vmCPUs: number;
    nodeMemoryCapacity: number;
    nodeCPUCapacity: number;
  }>;
}

export interface ProfileItem {
  id: string;
  text: string;
}

export interface UseSizingCalculatorReturn {
  // Data availability
  hasData: boolean;

  // Profile selection
  bareMetalProfiles: BareMetalProfile[];
  selectedProfile: BareMetalProfile;
  selectedProfileName: string;
  setSelectedProfileName: (name: string) => void;
  hasUserSelectedProfileRef: React.MutableRefObject<boolean>;
  profileItems: ProfileItem[];

  // Dynamic profiles state
  isRefreshingProfiles: boolean;
  profilesLastUpdated: Date | null;
  profilesSource: ReturnType<typeof useDynamicProfiles>['source'];
  refreshProfiles: () => Promise<void>;
  isProfilesApiAvailable: boolean | null;
  profilesError: string | null;
  profileCounts: { vsi: number; bareMetal: number };

  // Settings state + setters
  cpuOvercommit: number;
  setCpuOvercommit: (value: number) => void;
  memoryOvercommit: number;
  setMemoryOvercommit: (value: number) => void;
  htMultiplier: number;
  setHtMultiplier: (value: number) => void;
  useHyperthreading: boolean;
  setUseHyperthreading: (value: boolean) => void;
  replicaFactor: number;
  setReplicaFactor: (value: number) => void;
  operationalCapacity: number;
  setOperationalCapacity: (value: number) => void;
  cephOverhead: number;
  setCephOverhead: (value: number) => void;
  nodeRedundancy: number;
  setNodeRedundancy: (value: number) => void;
  evictionThreshold: number;
  setEvictionThreshold: (value: number) => void;
  storageMetric: 'provisioned' | 'inUse' | 'diskCapacity';
  setStorageMetric: (value: 'provisioned' | 'inUse' | 'diskCapacity') => void;
  annualGrowthRate: number;
  setAnnualGrowthRate: (value: number) => void;
  planningHorizonYears: number;
  setPlanningHorizonYears: (value: number) => void;
  virtOverhead: number;
  setVirtOverhead: (value: number) => void;

  // System reserved constants
  systemReservedMemory: number;
  systemReservedCpu: number;

  // ODF tuning profile
  odfTuningProfile: OdfTuningProfile;
  setOdfTuningProfile: (profile: OdfTuningProfile) => void;
  includeRgw: boolean;
  setIncludeRgw: (value: boolean) => void;
  odfCpuUnitMode: OdfCpuUnitMode;
  setOdfCpuUnitMode: (mode: OdfCpuUnitMode) => void;
  odfReservation: OdfReservation;

  // ODF reserved
  odfReservedCpu: number;
  odfReservedMemory: number;
  totalReservedCpu: number;
  totalReservedMemory: number;

  // Virtualization overhead config
  cpuFixedPerVM: number;
  cpuProportionalPercent: number;
  memoryFixedPerVMMiB: number;
  memoryProportionalPercent: number;

  // Computed results
  nodeCapacity: NodeCapacity;
  nodeRequirements: NodeRequirements | null;
  redundancyValidation: RedundancyValidation | null;
  vmFitValidation: VMFitValidation | null;
}

interface UseSizingCalculatorParams {
  onSizingChange?: (sizing: SizingResult) => void;
  requestedProfile?: string | null;
  onRequestedProfileHandled?: () => void;
}

export function useSizingCalculator({
  onSizingChange,
  requestedProfile,
  onRequestedProfileHandled,
}: UseSizingCalculatorParams): UseSizingCalculatorReturn {
  const { rawData } = useData();
  const hasData = !!rawData;
  const vmOverrides = useVMOverrides();

  // Dynamic profiles hook for refreshing from API
  const {
    profiles: dynamicProfiles,
    isRefreshing: isRefreshingProfiles,
    lastUpdated: profilesLastUpdated,
    source: profilesSource,
    refreshProfiles,
    isApiAvailable: isProfilesApiAvailable,
    error: profilesError,
    profileCounts,
  } = useDynamicProfiles();

  // Dynamic pricing hook for best-value default selection
  const { pricing } = useDynamicPricing();

  // Get bare metal profiles (flatten from family-organized structure)
  // Use dynamic profiles from API if available, otherwise fall back to static config
  const bareMetalProfiles = useMemo(() => {
    const profiles: BareMetalProfile[] = [];
    // Use dynamic profiles from API (updated via useDynamicProfiles hook)
    const bmProfiles = dynamicProfiles.bareMetalProfiles;
    for (const family of Object.keys(bmProfiles) as Array<keyof typeof bmProfiles>) {
      profiles.push(...(bmProfiles[family] as BareMetalProfile[]));
    }

    // Sort order: Custom/Future profiles FIRST (at top of list for visibility)
    // 1. Custom profiles with roksSupported (by memory desc)
    // 2. Custom profiles without roksSupported (by memory desc)
    // 3. Standard ROKS-supported profiles (by memory desc)
    // 4. Standard non-ROKS profiles (by memory desc)
    const sorted = profiles.sort((a, b) => {
      const aGroup = a.isCustom
        ? (a.roksSupported ? 1 : 2)
        : (a.roksSupported ? 3 : 4);
      const bGroup = b.isCustom
        ? (b.roksSupported ? 1 : 2)
        : (b.roksSupported ? 3 : 4);
      if (aGroup !== bGroup) return aGroup - bGroup;
      // Within same group: NVMe first, then by memory desc
      if (a.hasNvme && !b.hasNvme) return -1;
      if (!a.hasNvme && b.hasNvme) return 1;
      return b.memoryGiB - a.memoryGiB;
    });

    // Debug: log profile counts
    const customCount = sorted.filter(p => p.isCustom).length;
    logger.debug('[Sizing Calculator] Bare metal profiles:', {
      total: sorted.length,
      custom: customCount,
      firstFive: sorted.slice(0, 5).map(p => p.name),
    });

    return sorted;
  }, [dynamicProfiles.bareMetalProfiles]);

  const defaults = ibmCloudConfig.defaults;

  // Default to best-value profile: cheapest ROKS+NVMe profile by monthly rate
  const defaultProfileName = useMemo(() => {
    const pricedProfiles = getPricedProfiles(pricing).data;
    // Find cheapest ROKS+NVMe profile with actual pricing
    const candidates = pricedProfiles
      .filter(p => p.hasNvme && p.roksSupported && p.monthlyRate > 0);
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.monthlyRate - b.monthlyRate);
      return candidates[0].id;
    }
    // Fallback: first ROKS+NVMe profile from the display list
    const fallback = bareMetalProfiles.find(p => p.hasNvme && p.roksSupported) || bareMetalProfiles[0];
    return fallback?.name || '';
  }, [bareMetalProfiles, pricing]);

  // Load persisted sizing settings (once, via lazy initializer)
  const storedSizingRef = useRef(loadSizingSettings());

  // Store only the profile NAME (string) to avoid object reference issues
  const [selectedProfileName, setSelectedProfileName] = useState<string>(() => {
    const stored = storedSizingRef.current;
    if (stored?.selectedProfileName) return stored.selectedProfileName;
    return defaultProfileName;
  });
  const hasUserSelectedProfileRef = useRef(storedSizingRef.current?.selectedProfileName != null);


  // Apply requested profile from parent (e.g., clicking a tile in Cost Estimation)
  useEffect(() => {
    if (requestedProfile && bareMetalProfiles.some(p => p.name === requestedProfile)) {
      hasUserSelectedProfileRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync parent-requested profile selection
      setSelectedProfileName(requestedProfile);
      onRequestedProfileHandled?.();
    }
  }, [requestedProfile, bareMetalProfiles, onRequestedProfileHandled]);

  // Derive the full profile object from the name
  const selectedProfile = useMemo(() => {
    return bareMetalProfiles.find(p => p.name === selectedProfileName) || bareMetalProfiles[0];
  }, [bareMetalProfiles, selectedProfileName]);

  const ss = storedSizingRef.current; // shorthand for stored settings
  const [cpuOvercommit, setCpuOvercommit] = useState(ss?.cpuOvercommit ?? defaults.cpuOvercommitRatio);
  const [memoryOvercommit, setMemoryOvercommit] = useState(ss?.memoryOvercommit ?? defaults.memoryOvercommitRatio);
  const [htMultiplier, setHtMultiplier] = useState(ss?.htMultiplier ?? 1.25);
  const [useHyperthreading, setUseHyperthreading] = useState(ss?.useHyperthreading ?? true);
  const [replicaFactor, setReplicaFactor] = useState(ss?.replicaFactor ?? defaults.odfReplicationFactor);
  const [operationalCapacity, setOperationalCapacity] = useState(ss?.operationalCapacity ?? defaults.odfOperationalCapacity * 100);
  const [cephOverhead, setCephOverhead] = useState(ss?.cephOverhead ?? defaults.odfCephOverhead * 100);

  // System reserved resources (fixed values - not exposed in UI as they rarely change)
  const systemReservedMemory = 4; // GiB for kubelet, monitoring, etc. (not ODF)
  const systemReservedCpu = 1; // Cores for OpenShift system processes

  const [nodeRedundancy, setNodeRedundancy] = useState(ss?.nodeRedundancy ?? defaults.nodeRedundancy);
  const [evictionThreshold, setEvictionThreshold] = useState(ss?.evictionThreshold ?? 96);
  const [storageMetric, setStorageMetric] = useState<'provisioned' | 'inUse' | 'diskCapacity'>(ss?.storageMetric ?? 'inUse');
  const [annualGrowthRate, setAnnualGrowthRate] = useState(ss?.annualGrowthRate ?? 20);
  const [planningHorizonYears, setPlanningHorizonYears] = useState(ss?.planningHorizonYears ?? 2);
  const [virtOverhead, setVirtOverhead] = useState(ss?.virtOverhead ?? 15);

  // Virtualization overhead values from config (not user-adjustable)
  const virtOverheadConfig = virtualizationOverhead;
  const cpuFixedPerVM = virtOverheadConfig.cpuOverhead.totalFixedPerVM; // 0.27 vCPU per VM
  const cpuProportionalPercent = virtOverheadConfig.cpuOverhead.proportional.emulationOverhead.percent; // 3%
  const memoryFixedPerVMMiB = virtOverheadConfig.memoryOverhead.totalFixedPerVM; // 378 MiB per VM
  const memoryProportionalPercent = virtOverheadConfig.memoryOverhead.totalProportionalPercent; // 3%

  // ODF tuning profile state
  const [odfTuningProfile, setOdfTuningProfile] = useState<OdfTuningProfile>((ss?.odfTuningProfile as OdfTuningProfile) ?? 'balanced');
  const [includeRgw, setIncludeRgw] = useState(ss?.includeRgw ?? false);
  const [odfCpuUnitMode, setOdfCpuUnitMode] = useState<OdfCpuUnitMode>((ss?.odfCpuUnitMode as OdfCpuUnitMode) ?? 'physical');

  // Persist sizing settings to localStorage
  useEffect(() => {
    saveSizingSettings({
      selectedProfileName: hasUserSelectedProfileRef.current ? selectedProfileName : null,
      cpuOvercommit,
      memoryOvercommit,
      htMultiplier,
      useHyperthreading,
      replicaFactor,
      operationalCapacity,
      cephOverhead,
      nodeRedundancy,
      evictionThreshold,
      storageMetric,
      annualGrowthRate,
      planningHorizonYears,
      virtOverhead,
      odfTuningProfile,
      includeRgw,
      odfCpuUnitMode,
    });
  }, [selectedProfileName, cpuOvercommit, memoryOvercommit, htMultiplier, useHyperthreading, replicaFactor, operationalCapacity, cephOverhead, nodeRedundancy, evictionThreshold, storageMetric, annualGrowthRate, planningHorizonYears, virtOverhead, odfTuningProfile, includeRgw, odfCpuUnitMode]);

  // ODF resource reservations — two-pass calculation for cluster-wide distribution
  // Pass 1: estimate with minimum 3 nodes to get initial node count
  // Pass 2: recalculate with actual node count for accurate cluster-wide distribution
  const odfReservation = useMemo(() => {
    return calculateOdfReservation(
      odfTuningProfile,
      selectedProfile.nvmeDisks ?? 0,
      3, // Initial pass uses minimum 3 nodes
      includeRgw,
      odfCpuUnitMode,
      htMultiplier,
      useHyperthreading,
    );
  }, [odfTuningProfile, selectedProfile.nvmeDisks, includeRgw, odfCpuUnitMode, htMultiplier, useHyperthreading]);

  const odfReservedCpu = odfReservation.totalCpu;
  const odfReservedMemory = odfReservation.totalMemoryGiB;

  // Total infrastructure reserved (system + ODF)
  const totalReservedCpu = systemReservedCpu + odfReservedCpu;
  const totalReservedMemory = systemReservedMemory + odfReservedMemory;

  // Calculate per-node capacities
  const nodeCapacity = useMemo<NodeCapacity>(() => {
    // CPU capacity calculation depends on ODF CPU unit mode:
    // Physical mode: ODF reservation is in physical cores, subtract from physical cores directly
    // vCPU mode: ODF reservation is in vCPUs, subtract after HT conversion
    let availableCores: number;
    let effectiveCores: number;
    if (odfCpuUnitMode === 'physical') {
      // ODF + system reserved are in physical cores
      availableCores = Math.max(0, selectedProfile.physicalCores - totalReservedCpu);
      effectiveCores = useHyperthreading
        ? availableCores * htMultiplier
        : availableCores;
    } else {
      // vCPU mode: convert physical cores to vCPUs first, then subtract ODF in vCPU space
      const totalVcpus = useHyperthreading
        ? selectedProfile.physicalCores * htMultiplier
        : selectedProfile.physicalCores;
      // System reserved is in physical cores, convert to vCPU space
      const systemReservedVcpu = useHyperthreading
        ? systemReservedCpu * htMultiplier
        : systemReservedCpu;
      effectiveCores = Math.max(0, totalVcpus - odfReservedCpu - systemReservedVcpu);
      availableCores = useHyperthreading
        ? effectiveCores / htMultiplier
        : effectiveCores;
    }
    const vcpuCapacity = Math.floor(effectiveCores * cpuOvercommit);

    // Memory capacity calculation
    // (Total memory - total reserved) x memory overcommit
    const availableMemoryGiB = Math.max(0, selectedProfile.memoryGiB - totalReservedMemory);
    const memoryCapacity = Math.floor(availableMemoryGiB * memoryOvercommit);

    // Storage capacity calculation (per odf.md methodology)
    const rawStorageGiB = selectedProfile.totalNvmeGiB ?? 0;
    const maxStorageEfficiency = (1 / replicaFactor) * (1 - cephOverhead / 100);
    const maxUsableStorageGiB = Math.floor(rawStorageGiB * maxStorageEfficiency);
    const usableStorageGiB = Math.floor(maxUsableStorageGiB * (operationalCapacity / 100));

    return {
      vcpuCapacity,
      memoryCapacity,
      maxUsableStorageGiB,
      usableStorageGiB,
      rawStorageGiB,
      maxStorageEfficiency,
      effectiveCores,
      availableCores,
      availableMemoryGiB,
    };
  }, [
    selectedProfile,
    cpuOvercommit,
    memoryOvercommit,
    htMultiplier,
    useHyperthreading,
    replicaFactor,
    operationalCapacity,
    cephOverhead,
    totalReservedCpu,
    totalReservedMemory,
    odfCpuUnitMode,
    odfReservedCpu,
    systemReservedCpu,
  ]);

  // Calculate required nodes based on uploaded data
  const nodeRequirements = useMemo<NodeRequirements | null>(() => {
    if (!hasData || !rawData) return null;

    // Filter to only powered-on VMs (non-templates), excluding user-excluded VMs
    const vms = rawData.vInfo.filter(vm => {
      if (vm.template || vm.powerState !== 'poweredOn') return false;
      const vmId = getVMIdentifier(vm);
      return !vmOverrides.isExcluded(vmId);
    });
    const vmNames = new Set(vms.map(vm => vm.vmName));

    // Calculate base totals directly from rawData (before overhead)
    const baseVCPUs = vms.reduce((sum, vm) => sum + vm.cpus, 0);
    const baseMemoryMiB = vms.reduce((sum, vm) => sum + vm.memory, 0);
    const baseMemoryGiB = baseMemoryMiB / 1024;
    const provisionedStorageGiB = vms.reduce((sum, vm) => sum + vm.provisionedMiB, 0) / 1024;
    const inUseStorageGiB = vms.reduce((sum, vm) => sum + vm.inUseMiB, 0) / 1024;
    const vmCount = vms.length;

    // Calculate virtualization overhead using fixed + proportional formula from config
    const cpuVirtOverheadFixed = vmCount * cpuFixedPerVM;
    const cpuVirtOverheadProportional = baseVCPUs * (cpuProportionalPercent / 100);
    const cpuVirtOverheadTotal = cpuVirtOverheadFixed + cpuVirtOverheadProportional;
    const totalVCPUs = Math.ceil(baseVCPUs + cpuVirtOverheadTotal);

    const memoryVirtOverheadFixedMiB = vmCount * memoryFixedPerVMMiB;
    const memoryVirtOverheadProportionalMiB = baseMemoryMiB * (memoryProportionalPercent / 100);
    const memoryVirtOverheadTotalMiB = memoryVirtOverheadFixedMiB + memoryVirtOverheadProportionalMiB;
    const memoryVirtOverheadTotalGiB = memoryVirtOverheadTotalMiB / 1024;
    const totalMemoryGiB = baseMemoryGiB + memoryVirtOverheadTotalGiB;

    // Calculate disk capacity from vDisk sheet (filter to powered-on VMs)
    const diskCapacityGiB = rawData.vDisk
      .filter(disk => vmNames.has(disk.vmName))
      .reduce((sum, disk) => sum + disk.capacityMiB, 0) / 1024;

    // Select base storage based on metric choice
    const baseStorageGiB = storageMetric === 'provisioned'
      ? provisionedStorageGiB
      : storageMetric === 'diskCapacity'
        ? diskCapacityGiB
        : inUseStorageGiB;

    // Apply growth factor: (1 + rate)^years
    const growthMultiplier = Math.pow(1 + annualGrowthRate / 100, planningHorizonYears);

    // Apply virtualization overhead (snapshots, clones, live migration scratch space)
    const virtOverheadMultiplier = 1 + virtOverhead / 100;

    // Total storage with all factors applied
    const totalStorageGiB = baseStorageGiB * growthMultiplier * virtOverheadMultiplier;

    // N+X Redundancy Calculation
    const evictionFactor = evictionThreshold / 100;
    const effectiveCpuCapacity = nodeCapacity.vcpuCapacity * evictionFactor;
    const effectiveMemoryCapacity = nodeCapacity.memoryCapacity * evictionFactor;
    const effectiveStorageCapacity = nodeCapacity.usableStorageGiB;

    // Raw per-node vCPU capacity (before ODF/system subtraction) for fallback calculation
    const rawVcpuPerNode = Math.floor(
      (useHyperthreading ? selectedProfile.physicalCores * htMultiplier : selectedProfile.physicalCores) * cpuOvercommit
    );

    // Nodes required for each dimension at eviction threshold
    const nodesForCPUAtThreshold = effectiveCpuCapacity > 0
      ? Math.ceil(totalVCPUs / effectiveCpuCapacity)
      : rawVcpuPerNode > 0 && totalVCPUs > 0
        ? Math.ceil(totalVCPUs / (rawVcpuPerNode * evictionFactor))
        : 0;
    const nodesForMemoryAtThreshold = effectiveMemoryCapacity > 0
      ? Math.ceil(totalMemoryGiB / effectiveMemoryCapacity)
      : 0;
    const nodesForStorageAtThreshold = effectiveStorageCapacity > 0
      ? Math.ceil(totalStorageGiB / effectiveStorageCapacity)
      : 0;

    // Minimum surviving nodes needed (at least 3 for ODF quorum)
    const minSurvivingNodes = Math.max(3, nodesForCPUAtThreshold, nodesForMemoryAtThreshold, nodesForStorageAtThreshold);

    // ODF rack fault domain requires nodes in multiples of 3 (racks 0-2)
    const roundUpToRackGroup = (n: number) => Math.ceil(n / 3) * 3;

    // Total nodes = surviving nodes + redundancy buffer, rounded to rack group
    const preRoundingTotal = minSurvivingNodes + nodeRedundancy;
    const totalNodes = roundUpToRackGroup(preRoundingTotal);

    // Also calculate base nodes without redundancy consideration (for display)
    const nodesForCPU = nodeCapacity.vcpuCapacity > 0
      ? Math.ceil(totalVCPUs / nodeCapacity.vcpuCapacity)
      : rawVcpuPerNode > 0 && totalVCPUs > 0
        ? Math.ceil(totalVCPUs / rawVcpuPerNode)
        : 0;
    const nodesForMemory = nodeCapacity.memoryCapacity > 0
      ? Math.ceil(totalMemoryGiB / nodeCapacity.memoryCapacity)
      : 0;
    const nodesForStorage = nodeCapacity.usableStorageGiB > 0
      ? Math.ceil(totalStorageGiB / nodeCapacity.usableStorageGiB)
      : 0;

    const baseNodes = roundUpToRackGroup(Math.max(3, nodesForCPU, nodesForMemory, nodesForStorage));

    // Determine limiting factor (based on threshold calculation)
    let limitingFactor: 'cpu' | 'memory' | 'storage' = 'cpu';
    if (nodesForMemoryAtThreshold >= nodesForCPUAtThreshold && nodesForMemoryAtThreshold >= nodesForStorageAtThreshold) {
      limitingFactor = 'memory';
    } else if (nodesForStorageAtThreshold >= nodesForCPUAtThreshold && nodesForStorageAtThreshold >= nodesForMemoryAtThreshold) {
      limitingFactor = 'storage';
    }

    return {
      baseVCPUs,
      baseMemoryGiB,
      cpuVirtOverheadFixed,
      cpuVirtOverheadProportional,
      cpuVirtOverheadTotal,
      memoryVirtOverheadTotalGiB,
      totalVCPUs,
      totalMemoryGiB,
      baseStorageGiB,
      totalStorageGiB,
      provisionedStorageGiB,
      inUseStorageGiB,
      diskCapacityGiB,
      growthMultiplier,
      virtOverheadMultiplier,
      nodesForCPU,
      nodesForMemory,
      nodesForStorage,
      nodesForCPUAtThreshold,
      nodesForMemoryAtThreshold,
      nodesForStorageAtThreshold,
      minSurvivingNodes,
      preRoundingTotal,
      baseNodes,
      totalNodes,
      limitingFactor,
      vmCount,
      cpuCapacityExceeded: nodeCapacity.vcpuCapacity === 0 && totalVCPUs > 0,
    };
  }, [hasData, rawData, nodeCapacity, nodeRedundancy, evictionThreshold, storageMetric, annualGrowthRate, planningHorizonYears, virtOverhead, cpuFixedPerVM, cpuProportionalPercent, memoryFixedPerVMMiB, memoryProportionalPercent, vmOverrides, cpuOvercommit, htMultiplier, selectedProfile.physicalCores, useHyperthreading]);

  // Best-value profile: lowest total cost (nodeCount × monthlyRate) once workload data is available
  const bestValueProfileName = useMemo(() => {
    if (!nodeRequirements) return null;
    const pricedProfiles = getPricedProfiles(pricing).data;
    const candidates = pricedProfiles.filter(p => p.hasNvme && p.roksSupported && p.monthlyRate > 0);
    if (candidates.length === 0) return null;

    const nodeCalcParams = {
      totalVCPUs: nodeRequirements.totalVCPUs,
      totalMemoryGiB: nodeRequirements.totalMemoryGiB,
      totalStorageGiB: nodeRequirements.totalStorageGiB,
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
      odfReservedMemory,
    };

    let bestId = candidates[0].id;
    let bestCost = Infinity;
    for (const p of candidates) {
      const nodes = calculateNodesForProfile(
        { physicalCores: p.physicalCores, memoryGiB: p.memoryGiB, hasNvme: p.hasNvme, nvmeDisks: p.nvmeDisks, totalNvmeGB: p.totalNvmeGB },
        nodeCalcParams,
      );
      const totalCost = nodes * p.monthlyRate;
      if (totalCost < bestCost) {
        bestCost = totalCost;
        bestId = p.id;
      }
    }
    return bestId;
  }, [nodeRequirements, pricing, evictionThreshold, nodeRedundancy, memoryOvercommit, cpuOvercommit, replicaFactor, cephOverhead, operationalCapacity, odfTuningProfile, odfCpuUnitMode, htMultiplier, useHyperthreading, includeRgw, systemReservedCpu, systemReservedMemory, odfReservedMemory]);

  // Update default when pricing loads or best-value is computed (only if user hasn't manually changed)
  useEffect(() => {
    if (!hasUserSelectedProfileRef.current) {
      const target = bestValueProfileName || defaultProfileName;
      if (target) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sync default when pricing/workload data loads async
        setSelectedProfileName(target);
      }
    }
  }, [defaultProfileName, bestValueProfileName]);

  // Second pass: recalculate ODF reservation with actual node count for accurate cluster-wide distribution.
  // This affects the displayed component breakdown but not the node count calculation
  // (cluster-wide components are small relative to OSD, so the initial 3-node estimate is sufficient).
  const finalOdfReservation = useMemo(() => {
    const actualNodes = nodeRequirements?.totalNodes ?? 3;
    return calculateOdfReservation(
      odfTuningProfile,
      selectedProfile.nvmeDisks ?? 0,
      actualNodes,
      includeRgw,
      odfCpuUnitMode,
      htMultiplier,
      useHyperthreading,
    );
  }, [nodeRequirements?.totalNodes, odfTuningProfile, selectedProfile.nvmeDisks, includeRgw, odfCpuUnitMode, htMultiplier, useHyperthreading]);

  // N+X Validation - checks if cluster can handle workload after nodeRedundancy failures
  const redundancyValidation = useMemo<RedundancyValidation | null>(() => {
    if (!nodeRequirements) return null;

    const totalNodes = nodeRequirements.totalNodes;
    const failedNodes = nodeRedundancy;
    const survivingNodes = Math.max(0, totalNodes - failedNodes);

    // Per-node workload after failures
    const cpuPerNodeAfterFailure = survivingNodes > 0
      ? nodeRequirements.totalVCPUs / survivingNodes
      : Infinity;
    const memoryPerNodeAfterFailure = survivingNodes > 0
      ? nodeRequirements.totalMemoryGiB / survivingNodes
      : Infinity;
    const storagePerNodeAfterFailure = survivingNodes > 0
      ? nodeRequirements.totalStorageGiB / survivingNodes
      : Infinity;

    // Utilization percentages after failures
    const cpuUtilAfterFailure = nodeCapacity.vcpuCapacity > 0
      ? (cpuPerNodeAfterFailure / nodeCapacity.vcpuCapacity) * 100
      : nodeRequirements.totalVCPUs > 0 ? 100 : 0;
    const memoryUtilAfterFailure = nodeCapacity.memoryCapacity > 0
      ? (memoryPerNodeAfterFailure / nodeCapacity.memoryCapacity) * 100
      : 0;
    const storageUtilAfterFailure = nodeCapacity.maxUsableStorageGiB > 0
      ? (storagePerNodeAfterFailure / nodeCapacity.maxUsableStorageGiB) * 100
      : 0;

    // Check if each resource passes validation
    const cpuPasses = cpuUtilAfterFailure <= evictionThreshold;
    const memoryPasses = memoryUtilAfterFailure <= evictionThreshold;
    const storagePasses = storageUtilAfterFailure <= operationalCapacity || nodeCapacity.maxUsableStorageGiB === 0;
    const odfQuorumPasses = survivingNodes >= 3;

    // Overall validation
    const allPass = cpuPasses && memoryPasses && storagePasses && odfQuorumPasses;

    // Also calculate healthy state utilization
    const cpuUtilHealthy = nodeCapacity.vcpuCapacity > 0
      ? (nodeRequirements.totalVCPUs / totalNodes / nodeCapacity.vcpuCapacity) * 100
      : nodeRequirements.totalVCPUs > 0 ? 100 : 0;
    const memoryUtilHealthy = nodeCapacity.memoryCapacity > 0
      ? (nodeRequirements.totalMemoryGiB / totalNodes / nodeCapacity.memoryCapacity) * 100
      : 0;
    const storageUtilHealthy = nodeCapacity.maxUsableStorageGiB > 0
      ? (nodeRequirements.totalStorageGiB / totalNodes / nodeCapacity.maxUsableStorageGiB) * 100
      : 0;

    return {
      totalNodes,
      failedNodes,
      survivingNodes,
      evictionThreshold,
      storageOperationalThreshold: operationalCapacity,
      cpuUtilHealthy,
      memoryUtilHealthy,
      storageUtilHealthy,
      cpuUtilAfterFailure,
      memoryUtilAfterFailure,
      storageUtilAfterFailure,
      cpuPasses,
      memoryPasses,
      storagePasses,
      odfQuorumPasses,
      allPass,
    };
  }, [nodeRequirements, nodeCapacity, nodeRedundancy, evictionThreshold, operationalCapacity]);

  // Per-VM fit validation — check if any individual VM exceeds node capacity
  const vmFitValidation = useMemo<VMFitValidation | null>(() => {
    if (!hasData || !rawData) return null;

    const vms = rawData.vInfo.filter(vm => {
      if (vm.template || vm.powerState !== 'poweredOn') return false;
      const vmId = getVMIdentifier(vm);
      return !vmOverrides.isExcluded(vmId);
    });

    const oversizedVMs: VMFitValidation['oversizedVMs'] = [];

    for (const vm of vms) {
      // Add per-VM virtualization overhead
      const vmMemGiB = vm.memory / 1024;
      const vmWithOverheadMemGiB =
        vmMemGiB * (1 + memoryProportionalPercent / 100) +
        memoryFixedPerVMMiB / 1024;
      const vmWithOverheadCPUs =
        vm.cpus * (1 + cpuProportionalPercent / 100) + cpuFixedPerVM;

      const exceedsMemory = vmWithOverheadMemGiB > nodeCapacity.memoryCapacity;
      const exceedsCPU = vmWithOverheadCPUs > nodeCapacity.vcpuCapacity;

      if (exceedsMemory || exceedsCPU) {
        oversizedVMs.push({
          vmName: vm.vmName,
          resource: exceedsMemory && exceedsCPU ? 'both' : exceedsMemory ? 'memory' : 'cpu',
          vmMemoryGiB: Math.round(vmWithOverheadMemGiB * 10) / 10,
          vmCPUs: Math.round(vmWithOverheadCPUs * 10) / 10,
          nodeMemoryCapacity: nodeCapacity.memoryCapacity,
          nodeCPUCapacity: nodeCapacity.vcpuCapacity,
        });
      }
    }

    // Sort by how much they exceed capacity (worst first)
    oversizedVMs.sort((a, b) => {
      const aMemExcess = a.nodeMemoryCapacity > 0 ? a.vmMemoryGiB / a.nodeMemoryCapacity : 0;
      const bMemExcess = b.nodeMemoryCapacity > 0 ? b.vmMemoryGiB / b.nodeMemoryCapacity : 0;
      return bMemExcess - aMemExcess;
    });

    return { allFit: oversizedVMs.length === 0, oversizedVMs };
  }, [hasData, rawData, nodeCapacity, vmOverrides, cpuFixedPerVM, cpuProportionalPercent, memoryFixedPerVMMiB, memoryProportionalPercent]);

  // Track previous sizing to avoid unnecessary parent updates
  const prevSizingRef = useRef<string>('');

  // Notify parent component of sizing changes - only when values actually change
  useEffect(() => {
    if (onSizingChange && nodeRequirements) {
      const newSizing = {
        computeNodes: nodeRequirements.totalNodes,
        computeProfile: selectedProfileName,
        storageTiB: Math.ceil(nodeRequirements.totalStorageGiB / 1024),
        useNvme: true,
        odfSettings: {
          odfTuningProfile,
          odfCpuUnitMode,
          htMultiplier,
          useHyperthreading,
          includeRgw,
          systemReservedCpu,
          cpuOvercommit,
        },
        nodeCalcParams: {
          totalVCPUs: nodeRequirements.totalVCPUs,
          totalMemoryGiB: nodeRequirements.totalMemoryGiB,
          totalStorageGiB: nodeRequirements.totalStorageGiB,
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
          odfReservedMemory,
        },
      };
      // Only call parent if values actually changed
      const sizingKey = `${newSizing.computeNodes}-${newSizing.computeProfile}-${newSizing.storageTiB}-${odfTuningProfile}-${odfCpuUnitMode}-${htMultiplier}-${useHyperthreading}-${includeRgw}-${systemReservedCpu}-${cpuOvercommit}-${evictionThreshold}-${nodeRedundancy}-${memoryOvercommit}-${replicaFactor}-${cephOverhead}-${operationalCapacity}-${systemReservedMemory}-${odfReservedMemory}`;
      if (sizingKey !== prevSizingRef.current) {
        prevSizingRef.current = sizingKey;
        onSizingChange(newSizing);
      }
    }
  }, [nodeRequirements, selectedProfileName, onSizingChange, odfTuningProfile, odfCpuUnitMode, htMultiplier, useHyperthreading, includeRgw, systemReservedCpu, cpuOvercommit, evictionThreshold, nodeRedundancy, memoryOvercommit, replicaFactor, cephOverhead, operationalCapacity, systemReservedMemory, odfReservedMemory]);

  // Profile dropdown items - memoized to maintain stable references for Carbon Dropdown
  const profileItems = useMemo(() => bareMetalProfiles.map((p) => {
    const nvmeLabel = p.hasNvme ? `${p.nvmeDisks}\u00d7${p.nvmeSizeGiB} GiB NVMe` : 'No NVMe';
    const roksLabel = p.roksSupported ? 'ROKS' : 'VPC Only';
    const tagLabel = p.isCustom
      ? `${p.tag || 'Custom'} | ${roksLabel}`
      : (p.roksSupported ? '\u2713 ROKS' : '\u2717 VPC Only');
    return {
      id: p.name,
      text: `${p.name} (${p.physicalCores}c/${p.vcpus}t, ${p.memoryGiB} GiB, ${nvmeLabel}) [${tagLabel}]`,
    };
  }), [bareMetalProfiles]);

  return {
    hasData,
    bareMetalProfiles,
    selectedProfile,
    selectedProfileName,
    setSelectedProfileName,
    hasUserSelectedProfileRef,
    profileItems,
    isRefreshingProfiles,
    profilesLastUpdated,
    profilesSource,
    refreshProfiles,
    isProfilesApiAvailable,
    profilesError,
    profileCounts,
    cpuOvercommit,
    setCpuOvercommit,
    memoryOvercommit,
    setMemoryOvercommit,
    htMultiplier,
    setHtMultiplier,
    useHyperthreading,
    setUseHyperthreading,
    replicaFactor,
    setReplicaFactor,
    operationalCapacity,
    setOperationalCapacity,
    cephOverhead,
    setCephOverhead,
    nodeRedundancy,
    setNodeRedundancy,
    evictionThreshold,
    setEvictionThreshold,
    storageMetric,
    setStorageMetric,
    annualGrowthRate,
    setAnnualGrowthRate,
    planningHorizonYears,
    setPlanningHorizonYears,
    virtOverhead,
    setVirtOverhead,
    systemReservedMemory,
    systemReservedCpu,
    odfTuningProfile,
    setOdfTuningProfile,
    includeRgw,
    setIncludeRgw,
    odfCpuUnitMode,
    setOdfCpuUnitMode,
    odfReservation: finalOdfReservation,
    odfReservedCpu,
    odfReservedMemory,
    totalReservedCpu,
    totalReservedMemory,
    cpuFixedPerVM,
    cpuProportionalPercent,
    memoryFixedPerVMMiB,
    memoryProportionalPercent,
    nodeCapacity,
    nodeRequirements,
    redundancyValidation,
    vmFitValidation,
  };
}
