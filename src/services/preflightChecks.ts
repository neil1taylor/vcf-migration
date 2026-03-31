// Pre-flight check service for VM migration readiness assessment
import type {
  RVToolsData,
  VirtualMachine,
  VToolsInfo,
  VSnapshotInfo,
  VDiskInfo,
  VNetworkInfo,
  VCDInfo,
  VCPUInfo,
  VMemoryInfo,
} from '@/types/rvtools';
import { mibToGiB, getHardwareVersionNumber } from '@/utils/formatters';
import {
  HW_VERSION_MINIMUM,
  SNAPSHOT_BLOCKER_AGE_DAYS,
} from '@/utils/constants';
import { getROKSOSCompatibility, getVSIOSCompatibility } from '@/services/migration/osCompatibility';

// ===== TYPE DEFINITIONS =====

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'na';
export type CheckMode = 'roks' | 'vsi';

export interface CheckResult {
  status: CheckStatus;
  value?: string | number;
  threshold?: string | number;
  message?: string;
}

export interface VMCheckResults {
  // Index signature for TanStack Table compatibility
  [key: string]: unknown;
  id: string;
  vmName: string;
  powerState: string;
  cluster: string;
  host: string;
  guestOS: string;
  checks: Record<string, CheckResult>;
  blockerCount: number;
  warningCount: number;
}

export interface CheckDefinition {
  id: string;
  name: string;
  shortName: string;
  category: 'tools' | 'storage' | 'hardware' | 'config' | 'os';
  severity: 'blocker' | 'warning' | 'info';
  description: string;
  modes: CheckMode[];
}

// ===== CHECK DEFINITIONS =====

export const CHECK_DEFINITIONS: CheckDefinition[] = [
  // ROKS checks (MTV/OpenShift Virtualization)
  {
    id: 'tools-installed',
    name: 'VMware Tools Installed',
    shortName: 'Tools',
    category: 'tools',
    severity: 'blocker',
    description: 'VMware Tools must be installed for migration',
    modes: ['roks'],
  },
  {
    id: 'tools-running',
    name: 'VMware Tools Running',
    shortName: 'Tools Run',
    category: 'tools',
    severity: 'warning',
    description: 'VMware Tools should be running for best results',
    modes: ['roks'],
  },
  {
    id: 'old-snapshots',
    name: 'Old Snapshots (>30d)',
    shortName: 'Snapshots',
    category: 'storage',
    severity: 'blocker',
    description: 'Snapshots older than 30 days should be consolidated',
    modes: ['roks', 'vsi'],
  },
  {
    id: 'rdm-disks',
    name: 'RDM Disks',
    shortName: 'RDM',
    category: 'storage',
    severity: 'blocker',
    description: 'Raw Device Mapping disks are not supported',
    modes: ['roks', 'vsi'],
  },
  {
    id: 'shared-disks',
    name: 'Shared Disks',
    shortName: 'Shared',
    category: 'storage',
    severity: 'blocker',
    description: 'Shared/multi-writer disks are not supported',
    modes: ['roks', 'vsi'],
  },
  {
    id: 'independent-disks',
    name: 'Independent Disk Mode',
    shortName: 'Indep Disk',
    category: 'storage',
    severity: 'blocker',
    description: 'Independent disk mode is not supported for migration',
    modes: ['roks'],
  },
  {
    id: 'cd-connected',
    name: 'CD-ROM Connected',
    shortName: 'CD-ROM',
    category: 'hardware',
    severity: 'warning',
    description: 'CD-ROM should be disconnected before migration',
    modes: ['roks'],
  },
  {
    id: 'hw-version',
    name: 'Hardware Version',
    shortName: 'HW Ver',
    category: 'hardware',
    severity: 'warning',
    description: `Hardware version should be ${HW_VERSION_MINIMUM} or higher`,
    modes: ['roks'],
  },
  {
    id: 'cbt-enabled',
    name: 'CBT Enabled',
    shortName: 'CBT',
    category: 'config',
    severity: 'warning',
    description: 'Changed Block Tracking should be enabled for warm migration',
    modes: ['roks'],
  },
  {
    id: 'rfc1123-name',
    name: 'RFC 1123 Name',
    shortName: 'Name',
    category: 'config',
    severity: 'warning',
    description: 'VM name should be RFC 1123 compliant (lowercase, alphanumeric, hyphens)',
    modes: ['roks'],
  },
  {
    id: 'cpu-hotplug',
    name: 'CPU Hot Plug',
    shortName: 'CPU HP',
    category: 'config',
    severity: 'warning',
    description: 'CPU hot plug will be disabled after migration',
    modes: ['roks'],
  },
  {
    id: 'mem-hotplug',
    name: 'Memory Hot Plug',
    shortName: 'Mem HP',
    category: 'config',
    severity: 'warning',
    description: 'Memory hot plug will be disabled after migration',
    modes: ['roks'],
  },
  {
    id: 'hostname-valid',
    name: 'Valid Hostname',
    shortName: 'Hostname',
    category: 'config',
    severity: 'warning',
    description: 'Guest hostname should be configured (not localhost)',
    modes: ['roks'],
  },
  {
    id: 'os-compatible',
    name: 'OS Compatible',
    shortName: 'OS',
    category: 'os',
    severity: 'blocker',
    description: 'Operating system compatibility with OpenShift Virtualization — unsupported OS will fail MTV migration',
    modes: ['roks'],
  },

  // VSI checks (IBM Cloud VPC)
  {
    id: 'boot-disk-size-min',
    name: 'Boot Disk ≥10GB',
    shortName: 'Boot Min',
    category: 'storage',
    severity: 'blocker',
    description: 'VPC VSI boot disk requires minimum 10GB',
    modes: ['vsi'],
  },
  {
    id: 'boot-disk-size',
    name: 'Boot Disk ≤250GB',
    shortName: 'Boot Max',
    category: 'storage',
    severity: 'blocker',
    description: 'VPC VSI boot disk limited to 250GB maximum',
    modes: ['vsi'],
  },
  {
    id: 'disk-count',
    name: 'Disk Count ≤12',
    shortName: 'Disk Cnt',
    category: 'storage',
    severity: 'blocker',
    description: 'VPC VSI limited to 12 disks per instance',
    modes: ['vsi'],
  },
  {
    id: 'memory-1tb',
    name: 'Memory ≤1TB',
    shortName: 'Mem 1TB',
    category: 'hardware',
    severity: 'blocker',
    description: 'VPC VSI maximum memory is 1TB',
    modes: ['vsi'],
  },
  {
    id: 'memory-512gb',
    name: 'Memory ≤512GB',
    shortName: 'Mem 512G',
    category: 'hardware',
    severity: 'warning',
    description: 'Memory >512GB requires high-memory profiles with limited availability',
    modes: ['vsi'],
  },
  {
    id: 'large-disks',
    name: 'Disks ≤2TB',
    shortName: 'Disk 2TB',
    category: 'storage',
    severity: 'warning',
    description: 'Disks larger than 2TB may require splitting or multiple volumes',
    modes: ['vsi'],
  },
  {
    id: 'vsi-os',
    name: 'VPC OS Supported',
    shortName: 'VPC OS',
    category: 'os',
    severity: 'blocker',
    description: 'Operating system must be supported by IBM Cloud VPC',
    modes: ['vsi'],
  },
  {
    id: 'data-disk-size-min',
    name: 'Data Disk ≥10GB',
    shortName: 'Data Min',
    category: 'storage',
    severity: 'warning',
    description: 'VPC block storage volumes require minimum 10GB; smaller disks will be provisioned as 10GB',
    modes: ['vsi'],
  },
  {
    id: 'vsi-tools',
    name: 'VMware Tools',
    shortName: 'Tools',
    category: 'tools',
    severity: 'warning',
    description: 'VMware Tools needed for clean VM export and shutdown',
    modes: ['vsi'],
  },
];

// ===== HELPER FUNCTIONS =====

function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const groupKey = String(item[key]);
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function isRFC1123Compliant(name: string): boolean {
  if (!name || name.length > 63) return false;
  const lowerName = name.toLowerCase();
  const rfc1123Pattern = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  return rfc1123Pattern.test(lowerName);
}

// OS compatibility check now delegated to canonical service in osCompatibility.ts


// ===== CHECK CONTEXT =====

interface CheckContext {
  tools?: VToolsInfo;
  snapshots: VSnapshotInfo[];
  disks: VDiskInfo[];
  networks: VNetworkInfo[];
  cds: VCDInfo[];
  cpu?: VCPUInfo;
  memory?: VMemoryInfo;
}

// ===== INDIVIDUAL CHECK EVALUATORS =====

function evaluateCheck(
  checkId: string,
  vm: VirtualMachine,
  context: CheckContext
): CheckResult {
  switch (checkId) {
    // ===== TOOLS CHECKS =====
    case 'tools-installed':
    case 'vsi-tools': {
      if (!context.tools) {
        return {
          status: 'fail',
          value: 'No data',
          message: 'No VMware Tools info found for this VM',
        };
      }
      const status = context.tools.toolsStatus?.toLowerCase() || '';
      // Check for various "not installed" status values
      if (!status || status.includes('notinstalled') || status === '') {
        return {
          status: 'fail',
          value: context.tools.toolsStatus || 'Unknown',
          message: 'VMware Tools not installed',
        };
      }
      // Tools are installed (could be toolsOk, toolsOld, toolsRunning, guestToolsCurrent, etc.)
      return { status: 'pass', value: context.tools.toolsStatus };
    }

    case 'tools-running': {
      const status = context.tools?.toolsStatus;
      if (status === 'toolsNotRunning' || status === 'guestToolsNotRunning') {
        return {
          status: 'fail',
          value: status,
          message: 'VMware Tools installed but not running',
        };
      }
      if (!status || status === 'toolsNotInstalled') {
        return { status: 'na', message: 'Tools not installed' };
      }
      return { status: 'pass', value: status };
    }

    // ===== SNAPSHOT CHECKS =====
    case 'old-snapshots': {
      const oldSnapshots = context.snapshots.filter(s => s.ageInDays > SNAPSHOT_BLOCKER_AGE_DAYS);
      if (oldSnapshots.length > 0) {
        const oldest = Math.max(...oldSnapshots.map(s => s.ageInDays));
        return {
          status: 'fail',
          value: `${oldSnapshots.length} snapshots`,
          threshold: `>${SNAPSHOT_BLOCKER_AGE_DAYS} days`,
          message: `Oldest snapshot: ${oldest} days`,
        };
      }
      if (context.snapshots.length > 0) {
        return {
          status: 'pass',
          value: `${context.snapshots.length} snapshots`,
          message: 'All snapshots within age limit',
        };
      }
      return { status: 'pass', value: 'No snapshots' };
    }

    // ===== STORAGE CHECKS =====
    case 'rdm-disks': {
      const rdmDisks = context.disks.filter(d => d.raw);
      if (rdmDisks.length > 0) {
        return {
          status: 'fail',
          value: `${rdmDisks.length} RDM disk(s)`,
          message: rdmDisks.map(d => d.diskLabel).join(', '),
        };
      }
      return { status: 'pass', value: 'No RDM disks' };
    }

    case 'shared-disks': {
      const sharedDisks = context.disks.filter(
        d => d.sharingMode && d.sharingMode.toLowerCase() !== 'sharingnone'
      );
      if (sharedDisks.length > 0) {
        return {
          status: 'fail',
          value: `${sharedDisks.length} shared disk(s)`,
          message: sharedDisks.map(d => `${d.diskLabel}: ${d.sharingMode}`).join(', '),
        };
      }
      return { status: 'pass', value: 'No shared disks' };
    }

    case 'independent-disks': {
      const independentDisks = context.disks.filter(
        d => d.diskMode?.toLowerCase().includes('independent')
      );
      if (independentDisks.length > 0) {
        return {
          status: 'fail',
          value: `${independentDisks.length} independent disk(s)`,
          message: independentDisks.map(d => `${d.diskLabel}: ${d.diskMode}`).join(', '),
        };
      }
      return { status: 'pass', value: 'No independent disks' };
    }

    case 'boot-disk-size-min': {
      const VPC_BOOT_DISK_MIN_GB = 10;
      if (context.disks.length === 0) {
        return { status: 'na', message: 'No disk info available' };
      }
      // Sort by disk key to find boot disk (typically key 0 or 2000)
      const sortedDisks = [...context.disks].sort((a, b) => (a.diskKey || 0) - (b.diskKey || 0));
      const bootDisk = sortedDisks[0];
      const bootDiskGB = Math.round(mibToGiB(bootDisk.capacityMiB));
      if (bootDiskGB < VPC_BOOT_DISK_MIN_GB) {
        return {
          status: 'fail',
          value: `${bootDiskGB} GB`,
          threshold: `${VPC_BOOT_DISK_MIN_GB} GB`,
          message: `Boot disk below VPC minimum`,
        };
      }
      return { status: 'pass', value: `${bootDiskGB} GB` };
    }

    case 'boot-disk-size': {
      const VPC_BOOT_DISK_MAX_GB = 250;
      if (context.disks.length === 0) {
        return { status: 'na', message: 'No disk info available' };
      }
      // Sort by disk key to find boot disk (typically key 0 or 2000)
      const sortedDisks = [...context.disks].sort((a, b) => (a.diskKey || 0) - (b.diskKey || 0));
      const bootDisk = sortedDisks[0];
      const bootDiskGB = Math.round(mibToGiB(bootDisk.capacityMiB));
      if (bootDiskGB > VPC_BOOT_DISK_MAX_GB) {
        return {
          status: 'fail',
          value: `${bootDiskGB} GB`,
          threshold: `${VPC_BOOT_DISK_MAX_GB} GB`,
          message: `Boot disk exceeds VPC limit`,
        };
      }
      return { status: 'pass', value: `${bootDiskGB} GB` };
    }

    case 'data-disk-size-min': {
      const VPC_DATA_VOL_MIN_GB = 10;
      if (context.disks.length <= 1) {
        return { status: 'pass', value: 'No data disks' };
      }
      const sortedDisks = [...context.disks].sort((a, b) => (a.diskKey || 0) - (b.diskKey || 0));
      const dataDisks = sortedDisks.slice(1); // skip boot disk
      const smallDataDisks = dataDisks.filter(d => Math.round(mibToGiB(d.capacityMiB)) < VPC_DATA_VOL_MIN_GB);
      if (smallDataDisks.length > 0) {
        const smallest = Math.round(Math.min(...smallDataDisks.map(d => mibToGiB(d.capacityMiB))));
        return {
          status: 'fail',
          value: `${smallDataDisks.length} disk(s) < ${VPC_DATA_VOL_MIN_GB}GB`,
          threshold: `${VPC_DATA_VOL_MIN_GB} GB`,
          message: `Smallest: ${smallest} GB — will be provisioned as ${VPC_DATA_VOL_MIN_GB}GB`,
        };
      }
      return { status: 'pass', value: 'All data disks ≥10GB' };
    }

    case 'disk-count': {
      const VPC_MAX_DISKS = 12;
      const diskCount = context.disks.length;
      if (diskCount > VPC_MAX_DISKS) {
        return {
          status: 'fail',
          value: diskCount,
          threshold: VPC_MAX_DISKS,
          message: `Exceeds VPC disk limit`,
        };
      }
      return { status: 'pass', value: diskCount };
    }

    case 'large-disks': {
      const LARGE_DISK_THRESHOLD_GB = 2000;
      const largeDisks = context.disks.filter(d => mibToGiB(d.capacityMiB) > LARGE_DISK_THRESHOLD_GB);
      if (largeDisks.length > 0) {
        const maxSize = Math.round(Math.max(...largeDisks.map(d => mibToGiB(d.capacityMiB))));
        return {
          status: 'fail',
          value: `${largeDisks.length} disk(s) > 2TB`,
          threshold: '2TB',
          message: `Largest: ${maxSize} GB`,
        };
      }
      return { status: 'pass', value: 'All disks ≤2TB' };
    }

    // ===== HARDWARE CHECKS =====
    case 'cd-connected': {
      const connectedCDs = context.cds.filter(cd => cd.connected);
      if (connectedCDs.length > 0) {
        return {
          status: 'fail',
          value: `${connectedCDs.length} CD(s) connected`,
          message: 'Disconnect CD-ROM before migration',
        };
      }
      return { status: 'pass', value: 'No CD connected' };
    }

    case 'hw-version': {
      const versionNum = getHardwareVersionNumber(vm.hardwareVersion);
      if (versionNum < HW_VERSION_MINIMUM) {
        return {
          status: 'fail',
          value: `v${versionNum}`,
          threshold: `v${HW_VERSION_MINIMUM}+`,
          message: `Hardware version too old`,
        };
      }
      return { status: 'pass', value: `v${versionNum}` };
    }

    case 'memory-1tb': {
      const memoryGB = mibToGiB(vm.memory);
      if (memoryGB > 1024) {
        return {
          status: 'fail',
          value: `${Math.round(memoryGB)} GB`,
          threshold: '1024 GB',
          message: 'Exceeds VPC maximum',
        };
      }
      return { status: 'pass', value: `${Math.round(memoryGB)} GB` };
    }

    case 'memory-512gb': {
      const memoryGB = mibToGiB(vm.memory);
      if (memoryGB > 1024) {
        return { status: 'na', message: 'Checked by memory-1tb' };
      }
      if (memoryGB > 512) {
        return {
          status: 'fail',
          value: `${Math.round(memoryGB)} GB`,
          threshold: '512 GB',
          message: 'Requires high-memory profile',
        };
      }
      return { status: 'pass', value: `${Math.round(memoryGB)} GB` };
    }

    // ===== CONFIG CHECKS =====
    case 'cbt-enabled': {
      if (!vm.cbtEnabled) {
        return {
          status: 'fail',
          value: 'Disabled',
          message: 'Enable CBT for warm migration',
        };
      }
      return { status: 'pass', value: 'Enabled' };
    }

    case 'rfc1123-name': {
      if (!isRFC1123Compliant(vm.vmName)) {
        const issues: string[] = [];
        if (vm.vmName.length > 63) issues.push('too long');
        if (vm.vmName !== vm.vmName.toLowerCase()) issues.push('uppercase');
        if (/[^a-z0-9-]/.test(vm.vmName.toLowerCase())) issues.push('invalid chars');
        return {
          status: 'fail',
          value: vm.vmName.substring(0, 20) + (vm.vmName.length > 20 ? '...' : ''),
          message: issues.join(', '),
        };
      }
      return { status: 'pass', value: 'Compliant' };
    }

    case 'cpu-hotplug': {
      if (context.cpu?.hotAddEnabled) {
        return {
          status: 'fail',
          value: 'Enabled',
          message: 'Will be disabled after migration',
        };
      }
      return { status: 'pass', value: 'Disabled' };
    }

    case 'mem-hotplug': {
      if (context.memory?.hotAddEnabled) {
        return {
          status: 'fail',
          value: 'Enabled',
          message: 'Will be disabled after migration',
        };
      }
      return { status: 'pass', value: 'Disabled' };
    }

    case 'hostname-valid': {
      // Check guestHostname first, then fall back to dnsName
      const hostname = (vm.guestHostname || vm.dnsName)?.toLowerCase()?.trim();
      if (!hostname || hostname === '' || hostname === 'localhost' ||
          hostname === 'localhost.localdomain' || hostname === 'localhost.local') {
        return {
          status: 'fail',
          value: hostname || 'Not set',
          message: 'Configure valid hostname',
        };
      }
      return { status: 'pass', value: hostname.substring(0, 30) };
    }

    // ===== OS CHECKS =====
    case 'os-compatible': {
      const compat = getROKSOSCompatibility(vm.guestOS);
      if (compat.compatibilityStatus === 'unsupported') {
        return {
          status: 'fail',
          value: vm.guestOS.substring(0, 30),
          message: compat.notes || 'Not supported by OpenShift Virtualization',
        };
      }
      if (compat.compatibilityStatus === 'supported-with-caveats') {
        const parts: (string | undefined)[] = [compat.notes];
        if (compat.recommendedUpgrade) parts.push(compat.recommendedUpgrade);
        return {
          status: 'warn',
          value: vm.guestOS.substring(0, 30),
          message: parts.filter(Boolean).join('. '),
        };
      }
      return { status: 'pass', value: vm.guestOS.substring(0, 30) };
    }

    case 'vsi-os': {
      const compat = getVSIOSCompatibility(vm.guestOS);
      if (compat.status === 'unsupported') {
        return {
          status: 'fail',
          value: vm.guestOS.substring(0, 30),
          message: compat.notes,
        };
      }
      if (compat.status === 'byol') {
        return {
          status: 'warn',
          value: vm.guestOS.substring(0, 30),
          message: `${compat.notes} — BYOL custom image required`,
        };
      }
      return { status: 'pass', value: vm.guestOS.substring(0, 30), message: compat.notes };
    }

    default:
      return { status: 'na', message: 'Check not implemented' };
  }
}

// ===== MAIN SERVICE FUNCTION =====

export function runPreFlightChecks(
  rawData: RVToolsData,
  mode: CheckMode
): VMCheckResults[] {
  const vms = rawData.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template);
  const checksForMode = CHECK_DEFINITIONS.filter(c => c.modes.includes(mode));

  // Build lookup maps for efficient access
  // Use case-insensitive lookup for tools to handle potential case mismatches
  const toolsMap = new Map(rawData.vTools.map(t => [t.vmName, t]));
  const toolsMapLower = new Map(rawData.vTools.map(t => [t.vmName.toLowerCase(), t]));
  const snapshotsByVM = groupBy(rawData.vSnapshot, 'vmName');
  const disksByVM = groupBy(rawData.vDisk, 'vmName');
  const networksByVM = groupBy(rawData.vNetwork, 'vmName');
  const cdByVM = groupBy(rawData.vCD, 'vmName');
  const cpuByVM = new Map(rawData.vCPU.map(c => [c.vmName, c]));
  const memByVM = new Map(rawData.vMemory.map(m => [m.vmName, m]));

  // Helper to find tools with case-insensitive fallback
  const findTools = (vmName: string) => {
    return toolsMap.get(vmName) || toolsMapLower.get(vmName.toLowerCase());
  };

  return vms.map((vm, index) => {
    const checks: Record<string, CheckResult> = {};
    let blockerCount = 0;
    let warningCount = 0;

    const context: CheckContext = {
      tools: findTools(vm.vmName),
      snapshots: snapshotsByVM[vm.vmName] || [],
      disks: disksByVM[vm.vmName] || [],
      networks: networksByVM[vm.vmName] || [],
      cds: cdByVM[vm.vmName] || [],
      cpu: cpuByVM.get(vm.vmName),
      memory: memByVM.get(vm.vmName),
    };

    checksForMode.forEach(checkDef => {
      const result = evaluateCheck(checkDef.id, vm, context);
      checks[checkDef.id] = result;

      if (result.status === 'fail') {
        if (checkDef.severity === 'blocker') {
          blockerCount++;
        } else {
          warningCount++;
        }
      } else if (result.status === 'warn') {
        warningCount++;
      }
    });

    return {
      id: `vm-${index}`,
      vmName: vm.vmName,
      powerState: vm.powerState,
      cluster: vm.cluster || 'N/A',
      host: vm.host || 'N/A',
      guestOS: vm.guestOS || 'Unknown',
      checks,
      blockerCount,
      warningCount,
    };
  });
}

// ===== UTILITY FUNCTIONS =====

export function getChecksForMode(mode: CheckMode): CheckDefinition[] {
  return CHECK_DEFINITIONS.filter(c => c.modes.includes(mode));
}

export function getCheckDefinition(checkId: string): CheckDefinition | undefined {
  return CHECK_DEFINITIONS.find(c => c.id === checkId);
}

/**
 * Derive PreflightCheckCounts from VMCheckResults[].
 * Maps check IDs to the count fields expected by generateRemediationItems.
 */
export function derivePreflightCounts(
  results: VMCheckResults[],
  mode: CheckMode
): import('@/services/migration/remediation').PreflightCheckCounts {
  // Helper: collect VM names where a specific check failed
  const failedVMs = (checkId: string): string[] =>
    results
      .filter(r => r.checks[checkId]?.status === 'fail')
      .map(r => r.vmName);

  const vmsWithoutToolsList = failedVMs(mode === 'vsi' ? 'vsi-tools' : 'tools-installed');
  const vmsWithToolsNotRunningList = failedVMs('tools-running');
  const vmsWithOldSnapshotsList = failedVMs('old-snapshots');
  const vmsWithRDMList = failedVMs('rdm-disks');
  const vmsWithSharedDisksList = failedVMs('shared-disks');
  const vmsWithLargeDisksList = failedVMs('large-disks');
  const hwVersionOutdatedList = failedVMs('hw-version');

  const counts: import('@/services/migration/remediation').PreflightCheckCounts = {
    vmsWithoutTools: vmsWithoutToolsList.length,
    vmsWithoutToolsList,
    vmsWithToolsNotRunning: vmsWithToolsNotRunningList.length,
    vmsWithToolsNotRunningList,
    vmsWithOldSnapshots: vmsWithOldSnapshotsList.length,
    vmsWithOldSnapshotsList,
    vmsWithRDM: vmsWithRDMList.length,
    vmsWithRDMList,
    vmsWithSharedDisks: vmsWithSharedDisksList.length,
    vmsWithSharedDisksList,
    vmsWithLargeDisks: vmsWithLargeDisksList.length,
    vmsWithLargeDisksList,
    hwVersionOutdated: hwVersionOutdatedList.length,
    hwVersionOutdatedList,
  };

  if (mode === 'vsi') {
    const vmsWithSmallBootDiskList = failedVMs('boot-disk-size-min');
    counts.vmsWithSmallBootDisk = vmsWithSmallBootDiskList.length;
    counts.vmsWithSmallBootDiskList = vmsWithSmallBootDiskList;

    const vmsWithLargeBootDiskList = failedVMs('boot-disk-size');
    counts.vmsWithLargeBootDisk = vmsWithLargeBootDiskList.length;
    counts.vmsWithLargeBootDiskList = vmsWithLargeBootDiskList;

    const vmsWithTooManyDisksList = failedVMs('disk-count');
    counts.vmsWithTooManyDisks = vmsWithTooManyDisksList.length;
    counts.vmsWithTooManyDisksList = vmsWithTooManyDisksList;

    const vmsWithVeryLargeMemoryList = failedVMs('memory-1tb');
    counts.vmsWithVeryLargeMemory = vmsWithVeryLargeMemoryList.length;
    counts.vmsWithVeryLargeMemoryList = vmsWithVeryLargeMemoryList;

    const vmsWithLargeMemoryList = failedVMs('memory-512gb');
    counts.vmsWithLargeMemory = vmsWithLargeMemoryList.length;
    counts.vmsWithLargeMemoryList = vmsWithLargeMemoryList;

    const vmsWithUnsupportedOSList = failedVMs('vsi-os');
    counts.vmsWithUnsupportedOS = vmsWithUnsupportedOSList.length;
    counts.vmsWithUnsupportedOSList = vmsWithUnsupportedOSList;

    const vmsWithSmallDataDiskList = failedVMs('data-disk-size-min');
    counts.vmsWithSmallDataDisk = vmsWithSmallDataDiskList.length;
    counts.vmsWithSmallDataDiskList = vmsWithSmallDataDiskList;
  }

  if (mode === 'roks') {
    const vmsWithCdConnectedList = failedVMs('cd-connected');
    counts.vmsWithCdConnected = vmsWithCdConnectedList.length;
    counts.vmsWithCdConnectedList = vmsWithCdConnectedList;

    const vmsWithoutCBTList = failedVMs('cbt-enabled');
    counts.vmsWithoutCBT = vmsWithoutCBTList.length;
    counts.vmsWithoutCBTList = vmsWithoutCBTList;

    const vmsWithInvalidNamesList = failedVMs('rfc1123-name');
    counts.vmsWithInvalidNames = vmsWithInvalidNamesList.length;
    counts.vmsWithInvalidNamesList = vmsWithInvalidNamesList;

    const vmsWithCPUHotPlugList = failedVMs('cpu-hotplug');
    counts.vmsWithCPUHotPlug = vmsWithCPUHotPlugList.length;
    counts.vmsWithCPUHotPlugList = vmsWithCPUHotPlugList;

    const vmsWithMemoryHotPlugList = failedVMs('mem-hotplug');
    counts.vmsWithMemoryHotPlug = vmsWithMemoryHotPlugList.length;
    counts.vmsWithMemoryHotPlugList = vmsWithMemoryHotPlugList;

    const vmsWithIndependentDisksList = failedVMs('independent-disks');
    counts.vmsWithIndependentDisks = vmsWithIndependentDisksList.length;
    counts.vmsWithIndependentDisksList = vmsWithIndependentDisksList;

    const vmsWithInvalidHostnameList = failedVMs('hostname-valid');
    counts.vmsWithInvalidHostname = vmsWithInvalidHostnameList.length;
    counts.vmsWithInvalidHostnameList = vmsWithInvalidHostnameList;

    const vmsWithUnsupportedROKSOSList = failedVMs('os-compatible');
    counts.vmsWithUnsupportedROKSOS = vmsWithUnsupportedROKSOSList.length;
    counts.vmsWithUnsupportedROKSOSList = vmsWithUnsupportedROKSOSList;
  }

  return counts;
}
