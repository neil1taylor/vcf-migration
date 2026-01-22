// VSI Profile mapping services

import { mibToGiB } from '@/utils/formatters';
import ibmCloudConfig from '@/data/ibmCloudConfig.json';

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
  autoProfile: VSIProfile;
  burstableProfile: VSIProfile | null;
  profile: VSIProfile;
  effectiveProfileName: string;
  isOverridden: boolean;
  classification: VMClassification;
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
  /sap[-_]?/i,
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

// OS patterns indicating enterprise/production workloads
const ENTERPRISE_OS_PATTERNS = [
  /windows.*server/i,
  /red\s*hat.*enterprise/i,
  /rhel/i,
  /oracle.*linux/i,
  /suse.*enterprise/i,
  /sles/i,
];

/**
 * Classify a VM to determine if burstable profiles are suitable
 */
export function classifyVMForBurstable(
  vmName: string,
  guestOS: string,
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
      reasons.push('Network appliance detected');
      break;
    }
  }

  // Check for enterprise app patterns in VM name
  for (const pattern of ENTERPRISE_APP_PATTERNS) {
    if (pattern.test(vmName)) {
      reasons.push('Enterprise application detected');
      break;
    }
  }

  // Check for enterprise OS
  for (const pattern of ENTERPRISE_OS_PATTERNS) {
    if (pattern.test(guestOS)) {
      reasons.push('Enterprise OS');
      break;
    }
  }

  // Determine recommendation
  if (reasons.length > 0) {
    return {
      recommendation: 'standard',
      reasons,
      note: `Standard profile recommended: ${reasons.join(', ')}. These workloads typically require sustained CPU performance.`,
    };
  }

  return {
    recommendation: 'burstable',
    reasons: [],
    note: 'Burstable (Flex) profile recommended for cost optimization. Suitable for variable workloads that don\'t require sustained high CPU.',
  };
}

/**
 * Get all VSI profiles from config
 */
export function getVSIProfiles(): Record<ProfileFamily, VSIProfile[]> {
  return ibmCloudConfig.vsiProfiles as Record<ProfileFamily, VSIProfile[]>;
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
 * Check if a profile is a standard (non-burstable) profile
 */
export function isStandardProfile(profileName: string): boolean {
  const prefix = profileName.split('-')[0];
  // Standard profiles: bx2, bx2d, bx3d, cx2, cx2d, mx2, mx2d, etc. (not ending in 'f')
  return !prefix.endsWith('f');
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
 * Find the best-fit standard (non-burstable) profile for given requirements
 */
export function findStandardProfile(vcpus: number, memoryGiB: number): VSIProfile {
  const vsiProfiles = getVSIProfiles();
  const family = determineProfileFamily(vcpus, memoryGiB);
  const profiles = vsiProfiles[family];

  // Filter to only standard profiles, sorted by vcpus
  const standardProfiles = profiles
    .filter(p => isStandardProfile(p.name))
    .sort((a, b) => a.vcpus - b.vcpus || a.memoryGiB - b.memoryGiB);

  // Find first profile that meets requirements
  const bestFit = standardProfiles.find(p => p.vcpus >= vcpus && p.memoryGiB >= memoryGiB);
  return bestFit || standardProfiles[standardProfiles.length - 1];
}

/**
 * Map a VM to the best-fit VSI profile (returns standard profile)
 */
export function mapVMToVSIProfile(vcpus: number, memoryGiB: number): VSIProfile {
  return findStandardProfile(vcpus, memoryGiB);
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

export interface VMInput {
  vmName: string;
  cpus: number;
  memory: number; // in MiB
  nics?: number;
  guestOS?: string;
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

    // Classify VM for burstable eligibility
    const classification = classifyVMForBurstable(vm.vmName, guestOS, nics);

    // Get both standard and burstable profiles
    const standardProfile = findStandardProfile(vm.cpus, memoryGiB);
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
      autoProfile,
      burstableProfile,
      profile: effectiveProfile,
      effectiveProfileName,
      isOverridden,
      classification,
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
