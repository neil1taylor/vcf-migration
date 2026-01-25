/**
 * VM Identifier Utilities
 *
 * Provides stable VM identification across RVTools exports.
 * Uses composite keys to uniquely identify VMs even when UUID is unavailable.
 */

import type { VirtualMachine, RVToolsData } from '@/types/rvtools';

/**
 * Generate a unique identifier for a VM.
 * Uses UUID when available, otherwise falls back to datacenter::cluster::vmName.
 */
export function getVMIdentifier(vm: VirtualMachine): string {
  if (vm.uuid) {
    return `${vm.vmName}::${vm.uuid}`;
  }
  return `${vm.vmName}::${vm.datacenter}::${vm.cluster}`;
}

/**
 * Parse a VM identifier back into its components.
 */
export function parseVMIdentifier(id: string): { vmName: string; uuid?: string; datacenter?: string; cluster?: string } {
  const parts = id.split('::');
  if (parts.length === 2) {
    // Format: vmName::uuid
    return { vmName: parts[0], uuid: parts[1] };
  } else if (parts.length === 3) {
    // Format: vmName::datacenter::cluster
    return { vmName: parts[0], datacenter: parts[1], cluster: parts[2] };
  }
  // Fallback for malformed identifiers
  return { vmName: id };
}

/**
 * Environment Fingerprinting
 *
 * Creates a fingerprint from RVTools data to identify the source vCenter/environment.
 * Used to determine if saved overrides should apply to the current dataset.
 */
export function getEnvironmentFingerprint(data: RVToolsData): string {
  // Get vCenter server info
  const server = data.vSource[0]?.server || 'unknown';
  const instanceUuid = data.vSource[0]?.instanceUuid || '';

  // Get sorted cluster names for consistency
  const clusters = data.vCluster
    .map(c => c.name)
    .sort()
    .join(',');

  return `${server}::${instanceUuid}::${clusters}`;
}

/**
 * Create a shorter fingerprint for display purposes (first 8 chars of hash).
 */
export function getShortFingerprint(data: RVToolsData): string {
  const full = getEnvironmentFingerprint(data);
  // Simple hash for display
  let hash = 0;
  for (let i = 0; i < full.length; i++) {
    const char = full.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).substring(0, 8).toUpperCase();
}

/**
 * Check if two fingerprints match.
 */
export function fingerprintsMatch(fp1: string, fp2: string): boolean {
  return fp1 === fp2;
}

/**
 * Extract environment metadata for display.
 */
export function getEnvironmentMetadata(data: RVToolsData): {
  server: string;
  clusterCount: number;
  vmCount: number;
} {
  return {
    server: data.vSource[0]?.server || 'Unknown',
    clusterCount: data.vCluster.length,
    vmCount: data.vInfo.filter(vm => !vm.template).length,
  };
}
