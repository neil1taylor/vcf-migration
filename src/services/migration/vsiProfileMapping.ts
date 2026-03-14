// VSI Profile mapping services

import { mibToGiB } from '@/utils/formatters';
import ibmCloudConfig from '@/data/ibmCloudConfig.json';
import type { StorageTierType } from '@/utils/workloadClassification';

export interface VSIProfile {
  name: string;
  vcpus: number;
  memoryGiB: number;
  bandwidthGbps: number;
  hourlyRate: number;
  monthlyRate: number;
}

export interface CustomProfile {
  name: string;
  vcpus: number;
  memoryGiB: number;
  bandwidth?: number;
}

export type ProfileRecommendation = 'burstable' | 'standard';

export interface VMClassification {
  recommendation: ProfileRecommendation;
  reasons: string[];
  note: string;
}

export interface VMProfileMapping {
  vmName: string;
  vcpus: number;
  memoryGiB: number;
  nics: number;
  guestOS: string;
  firmwareType: string | null;
  autoProfile: VSIProfile;
  burstableProfile: VSIProfile | null;
  profile: VSIProfile;
  effectiveProfileName: string;
  isOverridden: boolean;
  classification: VMClassification;
  storageTier: StorageTierType;
  autoStorageTier: StorageTierType;
  isStorageTierOverridden: boolean;
  workloadCategory: string | null;
  provisionedStorageGiB: number;
  inUseStorageGiB: number;
}

export type ProfileFamily = 'balanced' | 'compute' | 'memory';

// Patterns to detect network appliances (case-insensitive)
const NETWORK_APPLIANCE_PATTERNS = [
  /firewall/i,
  /router/i,
  /loadbalancer/i,
  /load[-_]?balancer/i,
  /f5[-_]?/i,
  /bigip/i,
  /paloalto/i,
  /pan[-_]?/i,
  /checkpoint/i,
  /fortinet/i,
  /fortigate/i,
  /citrix[-_]?adc/i,
  /netscaler/i,
  /nginx[-_]?lb/i,
  /haproxy/i,
  /asa[-_]?/i,
  /vpn[-_]?/i,
  /proxy/i,
  /waf[-_]?/i,
  /ids[-_]?/i,
  /ips[-_]?/i,
];

// Patterns to detect enterprise applications (case-insensitive)
const ENTERPRISE_APP_PATTERNS = [
  /oracle/i,
  /\bsap[-_]/i,
  /sql[-_]?server/i,
  /mssql/i,
  /db2/i,
  /websphere/i,
  /weblogic/i,
  /jboss/i,
  /exchange/i,
  /sharepoint/i,
  /dynamics/i,
  /scom/i,
  /sccm/i,
  /domain[-_]?controller/i,
  /active[-_]?directory/i,
  /dns[-_]?server/i,
  /dhcp[-_]?server/i,
];

/**
 * Classify a VM to determine if burstable profiles are suitable
 */
export function classifyVMForBurstable(
  vmName: string,
  nics: number
): VMClassification {
  const reasons: string[] = [];

  // Check NIC count - more than 2 NICs suggests network appliance or complex networking
  if (nics > 2) {
    reasons.push(`Multiple NICs (${nics})`);
  }

  // Check for network appliance patterns in VM name
  for (const pattern of NETWORK_APPLIANCE_PATTERNS) {
    if (pattern.test(vmName)) {
      reasons.push('Network appliance');
      break;
    }
  }

  // Check for enterprise app patterns in VM name
  for (const pattern of ENTERPRISE_APP_PATTERNS) {
    if (pattern.test(vmName)) {
      reasons.push('Enterprise app');
      break;
    }
  }

  // Determine recommendation
  if (reasons.length > 0) {
    return {
      recommendation: 'standard',
      reasons,
      note: `Standard profile recommended — dedicated CPU for sustained performance. Reasons: ${reasons.join(', ')}`,
    };
  }

  return {
    recommendation: 'burstable',
    reasons: [],
    note: 'Burstable profile recommended — shared CPU, lower cost. Suitable for variable workloads without sustained high CPU demand.',
  };
}

/**
 * Get all VSI profiles from config
 */
export function getVSIProfiles(): Record<ProfileFamily, VSIProfile[]> {
  return ibmCloudConfig.vsiProfiles as Record<ProfileFamily, VSIProfile[]>;
}

/**
 * Check if a profile is a z-series (s390x) profile — not x86, wrong architecture for VMware migrations
 */
export function isZSeriesProfile(profileName: string): boolean {
  const prefix = profileName.split('-')[0];
  return prefix.includes('z');
}

/**
 * Check if a profile is a burstable/flex profile
 */
export function isBurstableProfile(profileName: string): boolean {
  const prefix = profileName.split('-')[0];
  // Flex profiles: bxf (balanced flex), cxf (compute flex), mxf (memory flex)
  return prefix.endsWith('f') && (prefix.startsWith('bx') || prefix.startsWith('cx') || prefix.startsWith('mx'));
}

/**
 * Check if a profile is a standard (non-burstable, non-z-series) profile
 */
export function isStandardProfile(profileName: string): boolean {
  return !isBurstableProfile(profileName) && !isZSeriesProfile(profileName);
}

/**
 * Check if a profile is a preferred (gen3) generation.
 * Gen3 profiles use 4th Gen Intel Xeon (Sapphire Rapids), DDR5, PCIe Gen5.
 * Prefixes: bx3d, bx3dc, cx3d, cx3dc, mx3d
 */
export function isPreferredGeneration(profileName: string): boolean {
  const prefix = profileName.split('-')[0];
  return prefix.includes('3');
}

/**
 * Determine profile family based on memory to vCPU ratio
 */
export function determineProfileFamily(vcpus: number, memoryGiB: number): ProfileFamily {
  const memToVcpuRatio = memoryGiB / vcpus;

  if (memToVcpuRatio <= 2.5) {
    return 'compute';
  } else if (memToVcpuRatio >= 6) {
    return 'memory';
  }
  return 'balanced';
}

/**
 * Find the best-fit burstable (flex) profile for given requirements
 */
export function findBurstableProfile(vcpus: number, memoryGiB: number): VSIProfile | null {
  const vsiProfiles = getVSIProfiles();
  const family = determineProfileFamily(vcpus, memoryGiB);
  const profiles = vsiProfiles[family];

  // Filter to only burstable profiles, sorted by vcpus
  const burstableProfiles = profiles
    .filter(p => isBurstableProfile(p.name))
    .sort((a, b) => a.vcpus - b.vcpus || a.memoryGiB - b.memoryGiB);

  // Find first profile that meets requirements
  const bestFit = burstableProfiles.find(p => p.vcpus >= vcpus && p.memoryGiB >= memoryGiB);
  return bestFit || null;
}

/**
 * Check if a firmware type indicates BIOS (non-UEFI) boot mode.
 * Gen3 profiles require UEFI — BIOS VMs must use Gen2.
 */
export function isBIOSFirmware(firmwareType: string | null | undefined): boolean {
  if (!firmwareType) return false; // null/unknown → optimistic (allow Gen3)
  return !firmwareType.toLowerCase().includes('efi');
}

/**
 * Find the instance storage (d-suffix) variant of a profile.
 * For gen3 profiles, all are already d-suffix so returns the same profile.
 * For gen2, converts e.g. cx2-2x4 → cx2d-2x4.
 */
export function findInstanceStorageVariant(profile: VSIProfile): VSIProfile {
  if (hasInstanceStorage(profile.name)) return profile;

  // Build the d-variant name: e.g. "cx2" → "cx2d", then reattach the size part
  const [prefix, ...rest] = profile.name.split('-');
  const dPrefix = prefix + 'd';
  const dName = [dPrefix, ...rest].join('-');

  const found = findProfileByName(dName);
  return found || profile;
}

/**
 * Find the best-fit standard (non-burstable) profile for given requirements.
 * Prefers gen3 (Sapphire Rapids) over gen2 (Cascade Lake).
 * Falls back to gen2 only when no gen3 profile can fit the requirements.
 *
 * When firmwareType indicates BIOS boot, gen3 is skipped because gen3 profiles
 * require UEFI boot mode exclusively.
 */
export function findStandardProfile(vcpus: number, memoryGiB: number, firmwareType?: string | null): VSIProfile {
  const vsiProfiles = getVSIProfiles();
  const family = determineProfileFamily(vcpus, memoryGiB);
  const profiles = vsiProfiles[family];

  // Filter to only standard x86 profiles (excludes z-series and burstable)
  // When specs are equal, prefer profiles without instance storage (d-suffix)
  // since NVMe instance storage is ephemeral and unnecessary for most workloads
  const standardProfiles = profiles
    .filter(p => isStandardProfile(p.name))
    .sort((a, b) => a.vcpus - b.vcpus || a.memoryGiB - b.memoryGiB || Number(hasInstanceStorage(a.name)) - Number(hasInstanceStorage(b.name)));

  // BIOS firmware cannot boot on Gen3 (UEFI-only) — skip Gen3
  const skipGen3 = isBIOSFirmware(firmwareType);

  if (!skipGen3) {
    // Try gen3 first
    const gen3Profiles = standardProfiles.filter(p => isPreferredGeneration(p.name));
    const gen3Fit = gen3Profiles.find(p => p.vcpus >= vcpus && p.memoryGiB >= memoryGiB);
    if (gen3Fit) return gen3Fit;
  }

  // Fall back to any standard profile (gen2) if gen3 can't fit or is skipped
  const gen2Profiles = standardProfiles.filter(p => !isPreferredGeneration(p.name));
  const gen2Fit = gen2Profiles.find(p => p.vcpus >= vcpus && p.memoryGiB >= memoryGiB);
  if (gen2Fit) return gen2Fit;

  // If gen3 was skipped due to BIOS, last resort is largest gen2
  if (skipGen3) {
    return gen2Profiles[gen2Profiles.length - 1] || standardProfiles[standardProfiles.length - 1];
  }

  // Last resort: largest available profile (gen3 preferred)
  const gen3Profiles = standardProfiles.filter(p => isPreferredGeneration(p.name));
  return gen3Profiles[gen3Profiles.length - 1] || standardProfiles[standardProfiles.length - 1];
}

/**
 * Map a VM to the best-fit VSI profile (returns standard profile)
 */
export function mapVMToVSIProfile(vcpus: number, memoryGiB: number, firmwareType?: string | null): VSIProfile {
  return findStandardProfile(vcpus, memoryGiB, firmwareType);
}

/**
 * Find a profile by name across all families
 */
export function findProfileByName(name: string): VSIProfile | undefined {
  const vsiProfiles = getVSIProfiles();
  const allProfiles = [
    ...vsiProfiles.balanced,
    ...vsiProfiles.compute,
    ...vsiProfiles.memory,
  ];
  return allProfiles.find(p => p.name === name);
}

/**
 * Get profile family from profile name prefix
 */
export function getProfileFamilyFromName(profileName: string): string {
  const prefix = profileName.split('-')[0];
  // Handle all balanced variants: bx2, bx2d, bx3d, bxf, bz2, etc.
  if (prefix.startsWith('bx') || prefix.startsWith('bz')) {
    return 'Balanced';
  }
  // Handle all compute variants: cx2, cx2d, cx3d, cxf, cz2, etc.
  if (prefix.startsWith('cx') || prefix.startsWith('cz')) {
    return 'Compute';
  }
  // Handle all memory variants: mx2, mx2d, mx3d, mxf, mz2, etc.
  if (prefix.startsWith('mx') || prefix.startsWith('mz')) {
    return 'Memory';
  }
  return 'Other';
}

/**
 * Get profile type (burstable vs standard) from profile name
 */
export function getProfileTypeFromName(profileName: string): 'Burstable' | 'Standard' {
  return isBurstableProfile(profileName) ? 'Burstable' : 'Standard';
}

/**
 * Check if a profile has NVMe instance storage (d-suffix in prefix, but not flex profiles).
 * NVMe instance storage provides high IOPS local storage but is ephemeral on stop/start.
 */
export function hasInstanceStorage(profileName: string): boolean {
  const prefix = profileName.split('-')[0];
  // d-suffix profiles (bx2d, bx3d, bx3dc, mx2d, etc.) have NVMe, but flex profiles (bxf) do not
  if (isBurstableProfile(profileName)) return false;
  return prefix.includes('d');
}

/**
 * Get the hardware generation of a profile.
 * Gen3 profiles use 4th Gen Intel Xeon (Sapphire Rapids), DDR5, PCIe Gen5.
 * Gen2 profiles use 2nd Gen Intel Xeon (Cascade Lake), DDR4, PCIe Gen4.
 */
export function getProfileGeneration(profileName: string): 2 | 3 {
  const prefix = profileName.split('-')[0];
  return prefix.includes('3') ? 3 : 2;
}

export interface VMInput {
  vmName: string;
  cpus: number;
  memory: number; // in MiB
  nics?: number;
  guestOS?: string;
  firmwareType?: string | null;
}

/**
 * Create profile mappings for a list of VMs
 */
export function createVMProfileMappings(
  vms: VMInput[],
  customProfiles: CustomProfile[],
  getEffectiveProfile: (vmName: string, autoProfile: string) => string,
  hasOverride: (vmName: string) => boolean
): VMProfileMapping[] {
  return vms.map(vm => {
    const memoryGiB = mibToGiB(vm.memory);
    const nics = vm.nics ?? 1;
    const guestOS = vm.guestOS ?? '';
    const firmwareType = vm.firmwareType ?? null;

    // Classify VM for burstable eligibility
    const classification = classifyVMForBurstable(vm.vmName, nics);

    // Get both standard and burstable profiles (firmware-aware)
    const standardProfile = findStandardProfile(vm.cpus, memoryGiB, firmwareType);
    const burstableProfile = findBurstableProfile(vm.cpus, memoryGiB);

    // Default auto profile based on classification
    const autoProfile = classification.recommendation === 'burstable' && burstableProfile
      ? burstableProfile
      : standardProfile;

    const effectiveProfileName = getEffectiveProfile(vm.vmName, autoProfile.name);
    const isOverridden = hasOverride(vm.vmName);

    // Look up profile details
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
        const matchedProfile = findProfileByName(effectiveProfileName);
        if (matchedProfile) {
          effectiveProfile = matchedProfile;
        }
      }
    }

    return {
      vmName: vm.vmName,
      vcpus: vm.cpus,
      memoryGiB: Math.round(memoryGiB),
      nics,
      guestOS,
      firmwareType,
      autoProfile,
      burstableProfile,
      profile: effectiveProfile,
      effectiveProfileName,
      isOverridden,
      classification,
      storageTier: 'general-purpose' as StorageTierType,
      autoStorageTier: 'general-purpose' as StorageTierType,
      isStorageTierOverridden: false,
      workloadCategory: null,
      provisionedStorageGiB: 0,
      inUseStorageGiB: 0,
    };
  });
}

/**
 * Count VMs by profile name
 */
export function countByProfile(mappings: VMProfileMapping[]): Record<string, number> {
  return mappings.reduce((acc, mapping) => {
    acc[mapping.profile.name] = (acc[mapping.profile.name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Count VMs by profile family
 */
export function countByFamily(mappings: VMProfileMapping[]): Record<string, number> {
  return mappings.reduce((acc, mapping) => {
    const familyName = getProfileFamilyFromName(mapping.profile.name);
    acc[familyName] = (acc[familyName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Get top N profiles by VM count
 */
export function getTopProfiles(
  mappings: VMProfileMapping[],
  count: number = 10
): Array<{ label: string; value: number }> {
  const profileCounts = countByProfile(mappings);
  return Object.entries(profileCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, count);
}

/**
 * Get family distribution chart data
 */
export function getFamilyChartData(mappings: VMProfileMapping[]): Array<{ label: string; value: number }> {
  const familyCounts = countByFamily(mappings);
  return Object.entries(familyCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Calculate totals from profile mappings
 */
export function calculateProfileTotals(mappings: VMProfileMapping[]): {
  totalVSIs: number;
  uniqueProfiles: number;
  totalVCPUs: number;
  totalMemory: number;
  overriddenCount: number;
} {
  const profileCounts = countByProfile(mappings);

  return {
    totalVSIs: mappings.length,
    uniqueProfiles: Object.keys(profileCounts).length,
    totalVCPUs: mappings.reduce((sum, m) => sum + m.profile.vcpus, 0),
    totalMemory: mappings.reduce((sum, m) => sum + m.profile.memoryGiB, 0),
    overriddenCount: mappings.filter(m => m.isOverridden).length,
  };
}
