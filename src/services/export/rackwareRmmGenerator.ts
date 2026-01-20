// RackWare RMM Wave CSV Generator for IBM Cloud VPC migrations
// Generates CSV files compatible with RackWare RMM Wave import functionality

import type { WaveGroup, VMWaveData } from '../migration/wavePlanning';
import type { VMDetail } from './bomXlsxGenerator';

/**
 * Configuration options for RackWare RMM export
 */
export interface RackwareRmmConfig {
  // Target environment settings
  vpc?: string;
  subnet?: string;
  zone?: string;
  sshKeyName?: string;
  securityGroup?: string;

  // Target naming pattern - uses {vmName} as placeholder
  targetNamePattern?: string;

  // Default Linux username (root or custom)
  linuxUsername?: string;

  // Include VSI profile for auto-provisioning
  includeProfile?: boolean;

  // Include wave information
  includeWave?: boolean;

  // Additional custom columns
  customColumns?: Record<string, string>;
}

/**
 * Extended VM data combining wave data and VM details for RackWare export
 */
export interface RackwareVMData {
  vmName: string;
  ipAddress: string;
  guestOS: string;
  profile?: string;
  vcpus: number;
  memoryGiB: number;
  storageGiB: number;
  waveName?: string;
  cluster?: string;
  networkName?: string;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<RackwareRmmConfig> = {
  vpc: '',
  subnet: '',
  zone: '',
  sshKeyName: '',
  securityGroup: '',
  targetNamePattern: '{vmName}',
  linuxUsername: 'root',
  includeProfile: true,
  includeWave: true,
  customColumns: {},
};

/**
 * Determine OS type for RackWare (windows or linux)
 */
function getOSType(guestOS: string): 'windows' | 'linux' {
  const osLower = guestOS.toLowerCase();
  if (osLower.includes('windows')) {
    return 'windows';
  }
  return 'linux';
}

/**
 * Get origin username based on OS type
 */
function getOriginUsername(osType: 'windows' | 'linux', linuxUsername: string): string {
  return osType === 'windows' ? 'SYSTEM' : linuxUsername;
}

/**
 * Sanitize VM name for RackWare (remove spaces and special characters)
 */
function sanitizeVMName(vmName: string): string {
  return vmName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
}

/**
 * Apply target naming pattern
 */
function applyTargetNamePattern(vmName: string, pattern: string): string {
  const sanitizedName = sanitizeVMName(vmName);
  return pattern.replace(/{vmName}/g, sanitizedName);
}

/**
 * Escape CSV field value (handle commas, quotes, newlines)
 */
function escapeCSVField(value: string | number | undefined): string {
  if (value === undefined || value === null) {
    return '';
  }
  const stringValue = String(value);
  // If the value contains comma, newline, or double quote, wrap in quotes and escape inner quotes
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Build CSV header row based on configuration
 */
function buildCSVHeader(config: Required<RackwareRmmConfig>): string[] {
  const headers = [
    'Origin Name',
    'Origin IP',
    'Target Name',
    'Origin Username',
    'OS',
  ];

  // Optional columns based on configuration
  if (config.includeWave) {
    headers.push('Wave');
  }

  if (config.includeProfile) {
    headers.push('Profile');
  }

  // IBM Cloud VPC specific columns
  if (config.vpc) {
    headers.push('VPC');
  }
  if (config.subnet) {
    headers.push('Subnet');
  }
  if (config.zone) {
    headers.push('Zone');
  }
  if (config.sshKeyName) {
    headers.push('SSH Key');
  }
  if (config.securityGroup) {
    headers.push('Security Group');
  }

  // Additional resource info
  headers.push('vCPUs', 'Memory (GiB)', 'Storage (GiB)', 'Cluster', 'Network');

  // Custom columns
  Object.keys(config.customColumns).forEach(key => {
    headers.push(key);
  });

  return headers;
}

/**
 * Build CSV data row for a VM
 */
function buildCSVRow(
  vm: RackwareVMData,
  config: Required<RackwareRmmConfig>
): string[] {
  const osType = getOSType(vm.guestOS);
  const originUsername = getOriginUsername(osType, config.linuxUsername);
  const targetName = applyTargetNamePattern(vm.vmName, config.targetNamePattern);

  const row = [
    sanitizeVMName(vm.vmName),
    vm.ipAddress || '',
    targetName,
    originUsername,
    osType,
  ];

  // Optional columns based on configuration
  if (config.includeWave) {
    row.push(vm.waveName || '');
  }

  if (config.includeProfile) {
    row.push(vm.profile || '');
  }

  // IBM Cloud VPC specific columns
  if (config.vpc) {
    row.push(config.vpc);
  }
  if (config.subnet) {
    row.push(config.subnet);
  }
  if (config.zone) {
    row.push(config.zone);
  }
  if (config.sshKeyName) {
    row.push(osType === 'linux' ? config.sshKeyName : '');
  }
  if (config.securityGroup) {
    row.push(config.securityGroup);
  }

  // Additional resource info
  row.push(
    String(vm.vcpus),
    String(vm.memoryGiB),
    String(Math.round(vm.storageGiB)),
    vm.cluster || '',
    vm.networkName || ''
  );

  // Custom columns
  Object.values(config.customColumns).forEach(value => {
    row.push(value);
  });

  return row;
}

/**
 * Combine wave data with VM details for export
 */
export function combineWaveAndVMData(
  waves: WaveGroup[],
  vmDetails?: VMDetail[]
): RackwareVMData[] {
  const vmDetailMap = new Map<string, VMDetail>();
  if (vmDetails) {
    vmDetails.forEach(vm => {
      vmDetailMap.set(vm.vmName, vm);
    });
  }

  const result: RackwareVMData[] = [];

  waves.forEach(wave => {
    wave.vms.forEach((waveVm: VMWaveData) => {
      const detail = vmDetailMap.get(waveVm.vmName);
      result.push({
        vmName: waveVm.vmName,
        ipAddress: waveVm.ipAddress || '',
        guestOS: detail?.guestOS || '',
        profile: detail?.profile,
        vcpus: waveVm.vcpus,
        memoryGiB: waveVm.memoryGiB,
        storageGiB: waveVm.storageGiB,
        waveName: wave.name,
        cluster: waveVm.cluster,
        networkName: waveVm.networkName,
      });
    });
  });

  return result;
}

/**
 * Generate RackWare RMM Wave CSV content
 */
export function generateRackwareRmmCSV(
  vmData: RackwareVMData[],
  config: Partial<RackwareRmmConfig> = {}
): string {
  const fullConfig: Required<RackwareRmmConfig> = { ...DEFAULT_CONFIG, ...config };

  const headers = buildCSVHeader(fullConfig);
  const rows = vmData.map(vm => buildCSVRow(vm, fullConfig));

  // Build CSV content
  const lines = [
    headers.map(escapeCSVField).join(','),
    ...rows.map(row => row.map(escapeCSVField).join(',')),
  ];

  return lines.join('\n');
}

/**
 * Generate RackWare RMM Wave CSV from wave groups and VM details
 */
export function generateRackwareRmmFromWaves(
  waves: WaveGroup[],
  vmDetails?: VMDetail[],
  config: Partial<RackwareRmmConfig> = {}
): string {
  const vmData = combineWaveAndVMData(waves, vmDetails);
  return generateRackwareRmmCSV(vmData, config);
}

/**
 * Download RackWare RMM Wave CSV file
 */
export function downloadRackwareRmmCSV(
  waves: WaveGroup[],
  vmDetails?: VMDetail[],
  config: Partial<RackwareRmmConfig> = {},
  filename: string = `rackware-rmm-waves-${new Date().toISOString().split('T')[0]}.csv`
): void {
  const csvContent = generateRackwareRmmFromWaves(waves, vmDetails, config);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Generate per-wave CSV files (returns a map of wave name to CSV content)
 */
export function generateRackwareRmmPerWave(
  waves: WaveGroup[],
  vmDetails?: VMDetail[],
  config: Partial<RackwareRmmConfig> = {}
): Map<string, string> {
  const result = new Map<string, string>();

  waves.forEach(wave => {
    const waveVmData = combineWaveAndVMData([wave], vmDetails);
    const csvContent = generateRackwareRmmCSV(waveVmData, config);
    // Sanitize wave name for filename
    const sanitizedWaveName = wave.name.replace(/[^a-zA-Z0-9-_\s]/g, '').replace(/\s+/g, '-');
    result.set(sanitizedWaveName, csvContent);
  });

  return result;
}

/**
 * Download per-wave CSV files as a ZIP archive
 * Note: This requires JSZip library. If not available, falls back to single file.
 */
export async function downloadRackwareRmmPerWaveZip(
  waves: WaveGroup[],
  vmDetails?: VMDetail[],
  config: Partial<RackwareRmmConfig> = {},
  filename: string = `rackware-rmm-waves-${new Date().toISOString().split('T')[0]}.zip`
): Promise<void> {
  try {
    // Dynamically import JSZip if available
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    const perWaveCSVs = generateRackwareRmmPerWave(waves, vmDetails, config);

    perWaveCSVs.forEach((csvContent, waveName) => {
      zip.file(`${waveName}.csv`, csvContent);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    // Fallback to single combined file if JSZip not available
    downloadRackwareRmmCSV(waves, vmDetails, config, filename.replace('.zip', '.csv'));
  }
}
