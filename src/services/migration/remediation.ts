// Remediation item generation for migration pre-flight checks

import type { RemediationItem } from '@/components/common';
import mtvRequirements from '@/data/mtvRequirements.json';
import type { MigrationMode } from './osCompatibility';

// VPC VSI Limits
export const VPC_BOOT_DISK_MIN_GB = 10;
export const VPC_BOOT_DISK_MAX_GB = 250;
export const VPC_MAX_DISKS_PER_VM = 12;

// Documentation Links
export const VPC_DOCS = {
  ibmVpcImages: 'https://cloud.ibm.com/docs/vpc?topic=vpc-about-images',
  ibmVpcProfiles: 'https://cloud.ibm.com/docs/vpc?topic=vpc-profiles',
  ibmVpcBlockStorage: 'https://cloud.ibm.com/docs/vpc?topic=vpc-block-storage-profiles',
  ibmVpcMigration: 'https://cloud.ibm.com/docs/vpc?topic=vpc-migrate-vsi-to-vpc',
  fullvalenceMigration: 'https://fullvalence.com/2025/11/10/from-vmware-to-ibm-cloud-vpc-vsi-part-3-migrating-virtual-machines/',
  rackwareGuide: 'https://www.rackwareinc.com/rackware-rmm-getting-started-for-ibm-cloud',
  wancloudsMigration: 'https://cloud.ibm.com/docs/wanclouds-vpc-plus?topic=wanclouds-vpc-plus-planning-for-migration',
  ibmOnPremMigration: 'https://cloud.ibm.com/docs/cloud-infrastructure?topic=cloud-infrastructure-migrating-on-prem-cloud-vpc',
};

export interface PreflightCheckCounts {
  // Common checks
  vmsWithoutTools: number;
  vmsWithoutToolsList: string[];
  vmsWithToolsNotRunning: number;
  vmsWithToolsNotRunningList: string[];
  vmsWithOldSnapshots: number;
  vmsWithOldSnapshotsList: string[];
  vmsWithRDM: number;
  vmsWithRDMList: string[];
  vmsWithSharedDisks: number;
  vmsWithSharedDisksList: string[];
  vmsWithLargeDisks: number;
  vmsWithLargeDisksList: string[];
  hwVersionOutdated: number;
  hwVersionOutdatedList: string[];

  // VSI-specific checks
  vmsWithSmallBootDisk?: number;
  vmsWithSmallBootDiskList?: string[];
  vmsWithLargeBootDisk?: number;
  vmsWithLargeBootDiskList?: string[];
  vmsWithTooManyDisks?: number;
  vmsWithTooManyDisksList?: string[];
  vmsWithLargeMemory?: number;
  vmsWithLargeMemoryList?: string[];
  vmsWithVeryLargeMemory?: number;
  vmsWithVeryLargeMemoryList?: string[];
  vmsWithUnsupportedOS?: number;
  vmsWithUnsupportedOSList?: string[];

  // ROKS-specific checks
  vmsWithCdConnected?: number;
  vmsWithCdConnectedList?: string[];
  vmsWithLegacyNIC?: number;
  vmsWithLegacyNICList?: string[];
  vmsWithoutCBT?: number;
  vmsWithoutCBTList?: string[];
  vmsWithInvalidNames?: number;
  vmsWithInvalidNamesList?: string[];
  vmsWithCPUHotPlug?: number;
  vmsWithCPUHotPlugList?: string[];
  vmsWithMemoryHotPlug?: number;
  vmsWithMemoryHotPlugList?: string[];
  vmsWithIndependentDisks?: number;
  vmsWithIndependentDisksList?: string[];
  vmsWithInvalidHostname?: number;
  vmsWithInvalidHostnameList?: string[];
  vmsStaticIPPoweredOff?: number;
  vmsStaticIPPoweredOffList?: string[];
}

/**
 * Generate remediation items for VSI migration
 */
export function generateVSIRemediationItems(counts: PreflightCheckCounts): RemediationItem[] {
  const items: RemediationItem[] = [];

  // BLOCKERS

  if (counts.vmsWithSmallBootDisk && counts.vmsWithSmallBootDisk > 0) {
    items.push({
      id: 'boot-disk-too-small',
      name: `Boot Disk Below ${VPC_BOOT_DISK_MIN_GB}GB Minimum`,
      severity: 'blocker',
      description: `VPC VSI boot volumes require a minimum of ${VPC_BOOT_DISK_MIN_GB}GB. VMs with smaller boot disks cannot be migrated directly.`,
      remediation: 'Increase the boot disk size to at least 10GB before migration.',
      documentationLink: VPC_DOCS.fullvalenceMigration,
      affectedCount: counts.vmsWithSmallBootDisk,
      affectedVMs: counts.vmsWithSmallBootDiskList || [],
    });
  }

  if (counts.vmsWithLargeBootDisk && counts.vmsWithLargeBootDisk > 0) {
    items.push({
      id: 'boot-disk-too-large',
      name: `Boot Disk Exceeds ${VPC_BOOT_DISK_MAX_GB}GB Limit`,
      severity: 'blocker',
      description: `VPC VSI boot volumes are limited to ${VPC_BOOT_DISK_MAX_GB}GB maximum. VMs with larger boot disks cannot be migrated directly.`,
      remediation: 'Reduce boot disk size by moving data to secondary disks, or restructure the VM to use a smaller boot volume with separate data volumes.',
      documentationLink: VPC_DOCS.fullvalenceMigration,
      affectedCount: counts.vmsWithLargeBootDisk,
      affectedVMs: counts.vmsWithLargeBootDiskList || [],
    });
  }

  if (counts.vmsWithTooManyDisks && counts.vmsWithTooManyDisks > 0) {
    items.push({
      id: 'too-many-disks',
      name: `Exceeds ${VPC_MAX_DISKS_PER_VM} Disk Limit`,
      severity: 'blocker',
      description: `VPC VSI supports a maximum of ${VPC_MAX_DISKS_PER_VM} disks per instance. VMs with more disks cannot be migrated directly.`,
      remediation: 'Consolidate disks or consider using file storage for some data volumes. Alternatively, split workloads across multiple VSIs.',
      documentationLink: VPC_DOCS.fullvalenceMigration,
      affectedCount: counts.vmsWithTooManyDisks,
      affectedVMs: counts.vmsWithTooManyDisksList || [],
    });
  }

  if (counts.vmsWithRDM > 0) {
    items.push({
      id: 'no-rdm',
      name: 'RDM Disks Detected',
      severity: 'blocker',
      description: 'Raw Device Mapping disks cannot be migrated to VPC VSI. Only VMDK disks are supported.',
      remediation: 'Convert RDM disks to VMDK before migration using VMware vSphere or vCenter.',
      documentationLink: VPC_DOCS.ibmOnPremMigration,
      affectedCount: counts.vmsWithRDM,
      affectedVMs: counts.vmsWithRDMList,
    });
  }

  if (counts.vmsWithSharedDisks > 0) {
    items.push({
      id: 'no-shared-disks',
      name: 'Shared Disks Detected',
      severity: 'blocker',
      description: 'VPC VSI does not support shared block volumes. File storage is available as an alternative but does not support Windows clients.',
      remediation: 'Reconfigure shared storage to use VPC file storage (Linux only), or deploy a custom VSI with iSCSI targets for shared storage requirements.',
      documentationLink: VPC_DOCS.fullvalenceMigration,
      affectedCount: counts.vmsWithSharedDisks,
      affectedVMs: counts.vmsWithSharedDisksList,
    });
  }

  if (counts.vmsWithVeryLargeMemory && counts.vmsWithVeryLargeMemory > 0) {
    items.push({
      id: 'very-large-memory',
      name: 'Very Large Memory VMs (>1TB)',
      severity: 'warning',
      description: 'VMs with >1TB memory require Ultra High Memory profiles (ux2d family) which support up to 5.6TB (e.g., ux2d-200x5600). These profiles have limited regional availability.',
      remediation: 'Verify ux2d profiles are available in your target region. If unavailable, consider bare metal servers or splitting workloads across multiple VSIs.',
      documentationLink: VPC_DOCS.ibmVpcProfiles,
      affectedCount: counts.vmsWithVeryLargeMemory,
      affectedVMs: counts.vmsWithVeryLargeMemoryList || [],
    });
  }

  if (counts.vmsWithUnsupportedOS && counts.vmsWithUnsupportedOS > 0) {
    items.push({
      id: 'unsupported-os',
      name: 'Unsupported Operating System',
      severity: 'blocker',
      description: 'These VMs have operating systems without IBM stock images. IBM provides validated stock images for Windows Server 2012+, RHEL 7+, Ubuntu 18.04+, CentOS 7+, Debian 10+, SLES, Rocky Linux, and AlmaLinux. Most 64-bit x86-64 operating systems can run on VPC VSIs, but custom images require customer validation.',
      remediation: 'For supported OS: Use IBM stock images or import a validated custom image. For unsupported OS: You can import custom images (including unsupported operating systems), but it is the customer\'s responsibility to validate functionality and compatibility for those imported or unsupported OS images. Consider OS upgrades for full IBM support.',
      documentationLink: VPC_DOCS.ibmVpcImages,
      affectedCount: counts.vmsWithUnsupportedOS,
      affectedVMs: counts.vmsWithUnsupportedOSList || [],
    });
  }

  // WARNINGS

  if (counts.vmsWithoutTools > 0) {
    items.push({
      id: 'tools-installed',
      name: 'VMware Tools Not Installed',
      severity: 'warning',
      description: 'VMware Tools required for clean VM export, proper shutdown, and accurate guest OS detection. Windows VMs must be cleanly shut down for virt-v2v processing.',
      remediation: 'Install VMware Tools before exporting the VM. For Windows, ensure a clean shutdown before migration. For Linux, verify virtio drivers are present.',
      documentationLink: VPC_DOCS.rackwareGuide,
      affectedCount: counts.vmsWithoutTools,
      affectedVMs: counts.vmsWithoutToolsList,
    });
  }

  const largeMemoryOnly = (counts.vmsWithLargeMemory || 0) - (counts.vmsWithVeryLargeMemory || 0);
  if (largeMemoryOnly > 0) {
    const largeMemoryOnlyList = (counts.vmsWithLargeMemoryList || []).filter(
      vm => !(counts.vmsWithVeryLargeMemoryList || []).includes(vm)
    );
    items.push({
      id: 'large-memory-warning',
      name: 'Large Memory VMs (>512GB)',
      severity: 'warning',
      description: 'VMs with >512GB memory require high-memory profiles (mx2 or ux2 families) which may have limited regional availability.',
      remediation: 'Verify mx2-128x1024 or similar high-memory profile is available in your target region before migration.',
      documentationLink: VPC_DOCS.ibmVpcProfiles,
      affectedCount: largeMemoryOnly,
      affectedVMs: largeMemoryOnlyList,
    });
  }

  if (counts.vmsWithLargeDisks > 0) {
    items.push({
      id: 'large-disks',
      name: 'Large Disks (>2TB)',
      severity: 'warning',
      description: 'Disks larger than 2TB may require multiple block volumes or file storage. VPC block storage volumes support up to 16TB each.',
      remediation: 'Plan for disk migration strategy: use multiple block volumes, leverage file storage for large data sets, or consider object storage for archival data.',
      documentationLink: VPC_DOCS.ibmVpcBlockStorage,
      affectedCount: counts.vmsWithLargeDisks,
      affectedVMs: counts.vmsWithLargeDisksList,
    });
  }

  if (counts.vmsWithOldSnapshots > 0) {
    items.push({
      id: 'old-snapshots',
      name: 'Old Snapshots (>30 days)',
      severity: 'warning',
      description: 'Snapshots should be consolidated before export for best migration results and reduced storage requirements.',
      remediation: 'Delete or consolidate snapshots older than 30 days before VM export. This reduces disk size and migration time.',
      documentationLink: VPC_DOCS.wancloudsMigration,
      affectedCount: counts.vmsWithOldSnapshots,
      affectedVMs: counts.vmsWithOldSnapshotsList,
    });
  }

  return items;
}

/**
 * Generate remediation items for ROKS migration
 */
export function generateROKSRemediationItems(counts: PreflightCheckCounts): RemediationItem[] {
  const items: RemediationItem[] = [];

  // BLOCKERS

  if (counts.vmsWithoutTools > 0) {
    items.push({
      id: 'tools-installed',
      name: mtvRequirements.checks['tools-installed'].name,
      severity: 'blocker',
      description: mtvRequirements.checks['tools-installed'].description,
      remediation: mtvRequirements.checks['tools-installed'].remediation,
      documentationLink: mtvRequirements.checks['tools-installed'].documentationLink,
      affectedCount: counts.vmsWithoutTools,
      affectedVMs: counts.vmsWithoutToolsList,
    });
  }

  if (counts.vmsWithOldSnapshots > 0) {
    items.push({
      id: 'old-snapshots',
      name: mtvRequirements.checks['old-snapshots'].name,
      severity: 'blocker',
      description: mtvRequirements.checks['old-snapshots'].description,
      remediation: mtvRequirements.checks['old-snapshots'].remediation,
      documentationLink: mtvRequirements.checks['old-snapshots'].documentationLink,
      affectedCount: counts.vmsWithOldSnapshots,
      affectedVMs: counts.vmsWithOldSnapshotsList,
    });
  }

  if (counts.vmsWithRDM > 0) {
    items.push({
      id: 'no-rdm',
      name: mtvRequirements.checks['no-rdm'].name,
      severity: 'blocker',
      description: mtvRequirements.checks['no-rdm'].description,
      remediation: mtvRequirements.checks['no-rdm'].remediation,
      documentationLink: mtvRequirements.checks['no-rdm'].documentationLink,
      affectedCount: counts.vmsWithRDM,
      affectedVMs: counts.vmsWithRDMList,
    });
  }

  if (counts.vmsWithSharedDisks > 0) {
    items.push({
      id: 'no-shared-disks',
      name: mtvRequirements.checks['no-shared-disks'].name,
      severity: 'blocker',
      description: mtvRequirements.checks['no-shared-disks'].description,
      remediation: mtvRequirements.checks['no-shared-disks'].remediation,
      documentationLink: mtvRequirements.checks['no-shared-disks'].documentationLink,
      affectedCount: counts.vmsWithSharedDisks,
      affectedVMs: counts.vmsWithSharedDisksList,
    });
  }

  if (counts.vmsWithIndependentDisks && counts.vmsWithIndependentDisks > 0) {
    items.push({
      id: 'independent-disk',
      name: mtvRequirements.checks['independent-disk'].name,
      severity: 'blocker',
      description: mtvRequirements.checks['independent-disk'].description,
      remediation: mtvRequirements.checks['independent-disk'].remediation,
      documentationLink: mtvRequirements.checks['independent-disk'].documentationLink,
      affectedCount: counts.vmsWithIndependentDisks,
      affectedVMs: counts.vmsWithIndependentDisksList || [],
    });
  }

  // WARNINGS

  if (counts.vmsWithToolsNotRunning > 0) {
    items.push({
      id: 'tools-running',
      name: mtvRequirements.checks['tools-running'].name,
      severity: 'warning',
      description: mtvRequirements.checks['tools-running'].description,
      remediation: mtvRequirements.checks['tools-running'].remediation,
      documentationLink: mtvRequirements.checks['tools-running'].documentationLink,
      affectedCount: counts.vmsWithToolsNotRunning,
      affectedVMs: counts.vmsWithToolsNotRunningList,
    });
  }

  if (counts.vmsWithCdConnected && counts.vmsWithCdConnected > 0) {
    items.push({
      id: 'cd-disconnected',
      name: mtvRequirements.checks['cd-disconnected'].name,
      severity: 'warning',
      description: mtvRequirements.checks['cd-disconnected'].description,
      remediation: mtvRequirements.checks['cd-disconnected'].remediation,
      documentationLink: mtvRequirements.checks['cd-disconnected'].documentationLink,
      affectedCount: counts.vmsWithCdConnected,
      affectedVMs: counts.vmsWithCdConnectedList || [],
    });
  }

  if (counts.hwVersionOutdated > 0) {
    items.push({
      id: 'hw-version',
      name: mtvRequirements.checks['hw-version'].name,
      severity: 'warning',
      description: mtvRequirements.checks['hw-version'].description,
      remediation: mtvRequirements.checks['hw-version'].remediation,
      documentationLink: mtvRequirements.checks['hw-version'].documentationLink,
      affectedCount: counts.hwVersionOutdated,
      affectedVMs: counts.hwVersionOutdatedList,
    });
  }

  if (counts.vmsWithLegacyNIC && counts.vmsWithLegacyNIC > 0) {
    items.push({
      id: 'network-adapter',
      name: mtvRequirements.checks['network-adapter'].name,
      severity: 'info',
      description: mtvRequirements.checks['network-adapter'].description,
      remediation: mtvRequirements.checks['network-adapter'].remediation,
      documentationLink: mtvRequirements.checks['network-adapter'].documentationLink,
      affectedCount: counts.vmsWithLegacyNIC,
      affectedVMs: counts.vmsWithLegacyNICList || [],
    });
  }

  if (counts.vmsWithoutCBT && counts.vmsWithoutCBT > 0) {
    items.push({
      id: 'cbt-enabled',
      name: mtvRequirements.checks['cbt-enabled'].name,
      severity: 'warning',
      description: mtvRequirements.checks['cbt-enabled'].description,
      remediation: mtvRequirements.checks['cbt-enabled'].remediation,
      documentationLink: mtvRequirements.checks['cbt-enabled'].documentationLink,
      affectedCount: counts.vmsWithoutCBT,
      affectedVMs: counts.vmsWithoutCBTList || [],
    });
  }

  if (counts.vmsWithInvalidNames && counts.vmsWithInvalidNames > 0) {
    items.push({
      id: 'vm-name-rfc1123',
      name: mtvRequirements.checks['vm-name-rfc1123'].name,
      severity: 'warning',
      description: mtvRequirements.checks['vm-name-rfc1123'].description,
      remediation: mtvRequirements.checks['vm-name-rfc1123'].remediation,
      documentationLink: mtvRequirements.checks['vm-name-rfc1123'].documentationLink,
      affectedCount: counts.vmsWithInvalidNames,
      affectedVMs: counts.vmsWithInvalidNamesList || [],
    });
  }

  if (counts.vmsWithCPUHotPlug && counts.vmsWithCPUHotPlug > 0) {
    items.push({
      id: 'cpu-hot-plug',
      name: mtvRequirements.checks['cpu-hot-plug'].name,
      severity: 'warning',
      description: mtvRequirements.checks['cpu-hot-plug'].description,
      remediation: mtvRequirements.checks['cpu-hot-plug'].remediation,
      documentationLink: mtvRequirements.checks['cpu-hot-plug'].documentationLink,
      affectedCount: counts.vmsWithCPUHotPlug,
      affectedVMs: counts.vmsWithCPUHotPlugList || [],
    });
  }

  if (counts.vmsWithMemoryHotPlug && counts.vmsWithMemoryHotPlug > 0) {
    items.push({
      id: 'memory-hot-plug',
      name: mtvRequirements.checks['memory-hot-plug'].name,
      severity: 'warning',
      description: mtvRequirements.checks['memory-hot-plug'].description,
      remediation: mtvRequirements.checks['memory-hot-plug'].remediation,
      documentationLink: mtvRequirements.checks['memory-hot-plug'].documentationLink,
      affectedCount: counts.vmsWithMemoryHotPlug,
      affectedVMs: counts.vmsWithMemoryHotPlugList || [],
    });
  }

  if (counts.vmsWithInvalidHostname && counts.vmsWithInvalidHostname > 0) {
    items.push({
      id: 'hostname-missing',
      name: mtvRequirements.checks['hostname-missing'].name,
      severity: 'warning',
      description: mtvRequirements.checks['hostname-missing'].description,
      remediation: mtvRequirements.checks['hostname-missing'].remediation,
      documentationLink: mtvRequirements.checks['hostname-missing'].documentationLink,
      affectedCount: counts.vmsWithInvalidHostname,
      affectedVMs: counts.vmsWithInvalidHostnameList || [],
    });
  }

  if (counts.vmsStaticIPPoweredOff && counts.vmsStaticIPPoweredOff > 0) {
    items.push({
      id: 'static-ip-powered-off',
      name: mtvRequirements.checks['static-ip-powered-off'].name,
      severity: 'warning',
      description: mtvRequirements.checks['static-ip-powered-off'].description,
      remediation: mtvRequirements.checks['static-ip-powered-off'].remediation,
      documentationLink: mtvRequirements.checks['static-ip-powered-off'].documentationLink,
      affectedCount: counts.vmsStaticIPPoweredOff,
      affectedVMs: counts.vmsStaticIPPoweredOffList || [],
    });
  }

  return items;
}

/**
 * Generate ALL VSI check items (including passed checks for display)
 * This shows all VPC checks as dropdowns with their status
 */
export function generateVSIAllChecks(counts: PreflightCheckCounts): RemediationItem[] {
  const items: RemediationItem[] = [];

  // Boot Disk Minimum (10GB)
  if ((counts.vmsWithSmallBootDisk || 0) > 0) {
    items.push({
      id: 'boot-disk-minimum',
      name: `Boot Disk Minimum (${VPC_BOOT_DISK_MIN_GB}GB)`,
      severity: 'blocker',
      description: `VPC VSI boot volumes require a minimum of ${VPC_BOOT_DISK_MIN_GB}GB. VMs with smaller boot disks cannot be migrated directly.`,
      remediation: 'Increase the boot disk size to at least 10GB before migration.',
      documentationLink: VPC_DOCS.fullvalenceMigration,
      affectedCount: counts.vmsWithSmallBootDisk || 0,
      affectedVMs: counts.vmsWithSmallBootDiskList || [],
    });
  } else {
    items.push({
      id: 'boot-disk-minimum',
      name: `Boot Disk Minimum (${VPC_BOOT_DISK_MIN_GB}GB)`,
      severity: 'success',
      description: `VPC VSI boot volumes require a minimum of ${VPC_BOOT_DISK_MIN_GB}GB. All VMs have boot disks meeting this requirement.`,
      remediation: 'No action required. All boot disks meet the minimum size requirement for VPC VSI migration.',
      documentationLink: VPC_DOCS.fullvalenceMigration,
      affectedCount: 0,
      affectedVMs: [],
    });
  }

  // Boot Disk Maximum (250GB)
  if ((counts.vmsWithLargeBootDisk || 0) > 0) {
    items.push({
      id: 'boot-disk-maximum',
      name: `Boot Disk Maximum (${VPC_BOOT_DISK_MAX_GB}GB)`,
      severity: 'blocker',
      description: `VPC VSI boot volumes are limited to ${VPC_BOOT_DISK_MAX_GB}GB maximum. VMs with larger boot disks cannot be migrated directly.`,
      remediation: 'Reduce boot disk size by moving data to secondary disks, or restructure the VM to use a smaller boot volume with separate data volumes.',
      documentationLink: VPC_DOCS.fullvalenceMigration,
      affectedCount: counts.vmsWithLargeBootDisk || 0,
      affectedVMs: counts.vmsWithLargeBootDiskList || [],
    });
  } else {
    items.push({
      id: 'boot-disk-maximum',
      name: `Boot Disk Maximum (${VPC_BOOT_DISK_MAX_GB}GB)`,
      severity: 'success',
      description: `VPC VSI boot volumes are limited to ${VPC_BOOT_DISK_MAX_GB}GB maximum. All VMs have boot disks within this limit.`,
      remediation: 'No action required. All boot disks are within the VPC VSI maximum size limit.',
      documentationLink: VPC_DOCS.fullvalenceMigration,
      affectedCount: 0,
      affectedVMs: [],
    });
  }

  // Disk Count (12 max)
  if ((counts.vmsWithTooManyDisks || 0) > 0) {
    items.push({
      id: 'disk-count',
      name: `Disk Count Maximum (${VPC_MAX_DISKS_PER_VM})`,
      severity: 'blocker',
      description: `VPC VSI supports a maximum of ${VPC_MAX_DISKS_PER_VM} disks per instance. VMs with more disks cannot be migrated directly.`,
      remediation: 'Consolidate disks or consider using file storage for some data volumes. Alternatively, split workloads across multiple VSIs.',
      documentationLink: VPC_DOCS.fullvalenceMigration,
      affectedCount: counts.vmsWithTooManyDisks || 0,
      affectedVMs: counts.vmsWithTooManyDisksList || [],
    });
  } else {
    items.push({
      id: 'disk-count',
      name: `Disk Count Maximum (${VPC_MAX_DISKS_PER_VM})`,
      severity: 'success',
      description: `VPC VSI supports a maximum of ${VPC_MAX_DISKS_PER_VM} disks per instance. All VMs are within this limit.`,
      remediation: 'No action required. All VMs have 12 or fewer disks, meeting VPC VSI requirements.',
      documentationLink: VPC_DOCS.fullvalenceMigration,
      affectedCount: 0,
      affectedVMs: [],
    });
  }

  // Large Disks (>2TB)
  if (counts.vmsWithLargeDisks > 0) {
    items.push({
      id: 'large-disks',
      name: 'Disk Size (2TB Threshold)',
      severity: 'warning',
      description: 'Disks larger than 2TB may require multiple block volumes or file storage. VPC block storage volumes support up to 16TB each.',
      remediation: 'Plan for disk migration strategy: use multiple block volumes, leverage file storage for large data sets, or consider object storage for archival data.',
      documentationLink: VPC_DOCS.ibmVpcBlockStorage,
      affectedCount: counts.vmsWithLargeDisks,
      affectedVMs: counts.vmsWithLargeDisksList,
    });
  } else {
    items.push({
      id: 'large-disks',
      name: 'Disk Size (2TB Threshold)',
      severity: 'success',
      description: 'VPC block storage volumes support up to 16TB each. All VMs have disks within typical sizing limits.',
      remediation: 'No action required. All disks are 2TB or smaller, allowing straightforward block volume mapping.',
      documentationLink: VPC_DOCS.ibmVpcBlockStorage,
      affectedCount: 0,
      affectedVMs: [],
    });
  }

  // RDM Disks
  if (counts.vmsWithRDM > 0) {
    items.push({
      id: 'rdm-disks',
      name: 'No RDM Disks',
      severity: 'blocker',
      description: 'Raw Device Mapping disks cannot be migrated to VPC VSI. Only VMDK disks are supported.',
      remediation: 'Convert RDM disks to VMDK before migration using VMware vSphere or vCenter.',
      documentationLink: VPC_DOCS.ibmOnPremMigration,
      affectedCount: counts.vmsWithRDM,
      affectedVMs: counts.vmsWithRDMList,
    });
  } else {
    items.push({
      id: 'rdm-disks',
      name: 'No RDM Disks',
      severity: 'success',
      description: 'Raw Device Mapping disks cannot be migrated to VPC VSI. No RDM disks detected.',
      remediation: 'No action required. All disks are standard VMDK format and compatible with VPC VSI migration.',
      documentationLink: VPC_DOCS.ibmOnPremMigration,
      affectedCount: 0,
      affectedVMs: [],
    });
  }

  // Shared Disks
  if (counts.vmsWithSharedDisks > 0) {
    items.push({
      id: 'shared-disks',
      name: 'No Shared Disks',
      severity: 'blocker',
      description: 'VPC VSI does not support shared block volumes. File storage is available as an alternative but does not support Windows clients.',
      remediation: 'Reconfigure shared storage to use VPC file storage (Linux only), or deploy a custom VSI with iSCSI targets for shared storage requirements.',
      documentationLink: VPC_DOCS.fullvalenceMigration,
      affectedCount: counts.vmsWithSharedDisks,
      affectedVMs: counts.vmsWithSharedDisksList,
    });
  } else {
    items.push({
      id: 'shared-disks',
      name: 'No Shared Disks',
      severity: 'success',
      description: 'VPC VSI does not support shared block volumes. No shared disks detected.',
      remediation: 'No action required. All disks are non-shared and compatible with VPC block storage.',
      documentationLink: VPC_DOCS.fullvalenceMigration,
      affectedCount: 0,
      affectedVMs: [],
    });
  }

  // Memory >1TB (warning - requires ultra-high memory profiles)
  if ((counts.vmsWithVeryLargeMemory || 0) > 0) {
    items.push({
      id: 'memory-1tb',
      name: 'Memory (>1TB)',
      severity: 'warning',
      description: 'VMs with >1TB memory require Ultra High Memory profiles (ux2d family) which support up to 5.6TB. These profiles have limited regional availability and higher costs.',
      remediation: 'Verify ux2d profiles (e.g., ux2d-200x5600) are available in your target region. Consider bare metal servers if ultra-high memory profiles are unavailable, or split workloads across multiple VSIs.',
      documentationLink: VPC_DOCS.ibmVpcProfiles,
      affectedCount: counts.vmsWithVeryLargeMemory || 0,
      affectedVMs: counts.vmsWithVeryLargeMemoryList || [],
    });
  } else {
    items.push({
      id: 'memory-1tb',
      name: 'Memory (>1TB)',
      severity: 'success',
      description: 'VMs with >1TB memory require Ultra High Memory profiles (ux2d family). No VMs exceed this threshold.',
      remediation: 'No action required. Standard memory profiles support up to 1TB.',
      documentationLink: VPC_DOCS.ibmVpcProfiles,
      affectedCount: 0,
      affectedVMs: [],
    });
  }

  // Memory >512GB (warning)
  const largeMemoryOnly = (counts.vmsWithLargeMemory || 0) - (counts.vmsWithVeryLargeMemory || 0);
  if (largeMemoryOnly > 0) {
    const largeMemoryOnlyList = (counts.vmsWithLargeMemoryList || []).filter(
      vm => !(counts.vmsWithVeryLargeMemoryList || []).includes(vm)
    );
    items.push({
      id: 'memory-512gb',
      name: 'Memory (>512GB)',
      severity: 'warning',
      description: 'VMs with >512GB memory require high-memory profiles (mx2 or ux2 families) which may have limited regional availability.',
      remediation: 'Verify mx2-128x1024 or similar high-memory profile is available in your target region before migration.',
      documentationLink: VPC_DOCS.ibmVpcProfiles,
      affectedCount: largeMemoryOnly,
      affectedVMs: largeMemoryOnlyList,
    });
  } else {
    items.push({
      id: 'memory-512gb',
      name: 'Memory (>512GB)',
      severity: 'success',
      description: 'VMs with >512GB memory require high-memory profiles. No VMs exceed this threshold.',
      remediation: 'No action required. All VMs have 512GB or less memory, compatible with standard VSI profiles.',
      documentationLink: VPC_DOCS.ibmVpcProfiles,
      affectedCount: 0,
      affectedVMs: [],
    });
  }

  // OS Compatibility
  if ((counts.vmsWithUnsupportedOS || 0) > 0) {
    items.push({
      id: 'os-compatibility',
      name: 'OS Compatibility',
      severity: 'blocker',
      description: 'Most 64-bit operating systems built for the x86-64 architecture can run on IBM Cloud VPC Virtual Server Instances (VSIs). IBM provides and validates support for a set of stock x86-64 OS images that are tested to boot and operate on VSIs. While you can import and use your own custom images (including unsupported operating systems), it is the customer’s responsibility to validate functionality and compatibility for those imported or unsupported OS images.These VMs have operating systems without IBM stock images. IBM provides validated stock images for Windows Server 2012+, RHEL 7+, Ubuntu 18.04+, CentOS 7+, Debian 10+, SLES, Rocky Linux, and AlmaLinux.',
      remediation: 'For supported OS: Use IBM stock images or import a validated custom image. For unsupported OS: You can import custom images (including unsupported operating systems), but it is the customer\'s responsibility to validate functionality and compatibility for those imported or unsupported OS images. Consider OS upgrades for full IBM support.',
      documentationLink: VPC_DOCS.ibmVpcImages,
      affectedCount: counts.vmsWithUnsupportedOS || 0,
      affectedVMs: counts.vmsWithUnsupportedOSList || [],
    });
  } else {
    items.push({
      id: 'os-compatibility',
      name: 'OS Compatibility',
      severity: 'success',
      description: 'All VMs have operating systems with IBM stock images available. Most 64-bit x86-64 operating systems can run on VPC VSIs. IBM provides and validates support for a set of stock x86-64 OS images tested to boot and operate on VSIs.',
      remediation: 'No action required. All detected operating systems have IBM stock images available. While you can also import custom images, IBM stock images are recommended for validated compatibility and support.',
      documentationLink: VPC_DOCS.ibmVpcImages,
      affectedCount: 0,
      affectedVMs: [],
    });
  }

  // VMware Tools
  if (counts.vmsWithoutTools > 0) {
    items.push({
      id: 'vmware-tools',
      name: 'VMware Tools',
      severity: 'warning',
      description: 'VMware Tools required for clean VM export, proper shutdown, and accurate guest OS detection. Windows VMs must be cleanly shut down for virt-v2v processing.',
      remediation: 'Install VMware Tools before exporting the VM. For Windows, ensure a clean shutdown before migration. For Linux, verify virtio drivers are present.',
      documentationLink: VPC_DOCS.rackwareGuide,
      affectedCount: counts.vmsWithoutTools,
      affectedVMs: counts.vmsWithoutToolsList,
    });
  } else {
    items.push({
      id: 'vmware-tools',
      name: 'VMware Tools',
      severity: 'success',
      description: 'VMware Tools is installed on all VMs, enabling clean export and proper shutdown.',
      remediation: 'No action required. VMware Tools is installed and will enable clean VM shutdown during export.',
      documentationLink: VPC_DOCS.rackwareGuide,
      affectedCount: 0,
      affectedVMs: [],
    });
  }

  // Old Snapshots
  if (counts.vmsWithOldSnapshots > 0) {
    items.push({
      id: 'snapshots',
      name: 'Snapshot Status',
      severity: 'warning',
      description: 'Snapshots should be consolidated before export for best migration results and reduced storage requirements.',
      remediation: 'Delete or consolidate snapshots older than 30 days before VM export. This reduces disk size and migration time.',
      documentationLink: VPC_DOCS.wancloudsMigration,
      affectedCount: counts.vmsWithOldSnapshots,
      affectedVMs: counts.vmsWithOldSnapshotsList,
    });
  } else {
    items.push({
      id: 'snapshots',
      name: 'Snapshot Status',
      severity: 'success',
      description: 'No old snapshots (>30 days) detected that could impact migration.',
      remediation: 'No action required. VMs have no stale snapshots that would increase migration time or disk size.',
      documentationLink: VPC_DOCS.wancloudsMigration,
      affectedCount: 0,
      affectedVMs: [],
    });
  }

  // Virtio Drivers (unknown - cannot be checked via RVTools)
  items.push({
    id: 'virtio-drivers',
    name: 'Virtio Drivers Preparation',
    severity: 'unknown',
    description: 'VPC VSI uses virtio drivers for storage and networking. Linux VMs typically include these drivers. Windows VMs require RedHat virtio drivers to be installed or injected during migration. This cannot be verified from RVTools data.',
    remediation: 'For Linux: Verify virtio drivers are loaded with "lsmod | grep virtio". Most modern distributions (RHEL 7+, Ubuntu 18.04+) include these by default. For Windows: Download RedHat virtio drivers from https://fedorapeople.org/groups/virt/virtio-win/. Migration tools like virt-v2v and RackWare can inject these drivers automatically during migration.',
    documentationLink: VPC_DOCS.fullvalenceMigration,
    affectedCount: 0,
    affectedVMs: [],
    isUnverifiable: true,
  });

  // Cloud-init/Cloudbase-init (unknown - cannot be checked via RVTools)
  items.push({
    id: 'cloud-init',
    name: 'Cloud-init / Cloudbase-init',
    severity: 'unknown',
    description: 'VPC VSI uses cloud-init (Linux) or cloudbase-init (Windows) for initial configuration including network setup, SSH key injection, and user data processing. This cannot be verified from RVTools data.',
    remediation: 'For Linux: Install cloud-init package ("yum install cloud-init" or "apt install cloud-init"). Remove stale network configs from /etc/sysconfig/network-scripts/ or /etc/NetworkManager/system-connections/. For Windows: Install cloudbase-init from https://cloudbase.it/cloudbase-init/. Ensure clean shutdown before migration to prevent stale network state.',
    documentationLink: VPC_DOCS.fullvalenceMigration,
    affectedCount: 0,
    affectedVMs: [],
    isUnverifiable: true,
  });

  // Cold Migration Warning (unknown - operational consideration)
  items.push({
    id: 'cold-migration',
    name: 'Migration Downtime Planning',
    severity: 'unknown',
    description: 'VPC VSI migration requires cold migration (VM must be stopped). There are no warm migration approaches for VMware to IBM Cloud VPC. Plan for sufficient outage windows based on VM disk sizes and network bandwidth.',
    remediation: 'Plan migration windows to include: 1) Stop the source VM cleanly, 2) Export disks to VMDK/OVA format, 3) Transfer to IBM Cloud Object Storage, 4) Convert images using virt-v2v or migration tools, 5) Create VSI from custom image, 6) Validate and test. Consider RackWare RMM or WanClouds VPC+ for automated orchestration and reduced downtime.',
    documentationLink: VPC_DOCS.ibmVpcMigration,
    affectedCount: 0,
    affectedVMs: [],
    isUnverifiable: true,
  });

  return items;
}

/**
 * Generate remediation items based on migration mode
 */
export function generateRemediationItems(
  counts: PreflightCheckCounts,
  mode: MigrationMode,
  includeAllChecks: boolean = false
): RemediationItem[] {
  if (mode === 'vsi') {
    return includeAllChecks
      ? generateVSIAllChecks(counts)
      : generateVSIRemediationItems(counts);
  }
  return generateROKSRemediationItems(counts);
}

/**
 * Count blockers and warnings from remediation items
 */
export function countRemediationSeverity(items: RemediationItem[]): { blockers: number; warnings: number; info: number } {
  return items.reduce(
    (acc, item) => {
      if (item.severity === 'blocker') acc.blockers += item.affectedCount;
      else if (item.severity === 'warning') acc.warnings += item.affectedCount;
      else if (item.severity === 'info') acc.info += item.affectedCount;
      return acc;
    },
    { blockers: 0, warnings: 0, info: 0 }
  );
}
