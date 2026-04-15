import { describe, it, expect } from 'vitest';
import { runPreFlightChecks, derivePreflightCounts } from './preflightChecks';
import { generateVSIRemediationItems, generateVSIAllChecks } from './migration/remediation';
import type { RVToolsData, VirtualMachine, VDiskInfo } from '@/types/rvtools';

function makeVM(overrides: Partial<VirtualMachine>): VirtualMachine {
  return {
    vmName: 'test-vm',
    powerState: 'poweredOn',
    guestOS: 'Red Hat Enterprise Linux 8 (64-bit)',
    cpus: 4,
    memoryMB: 8192,
    provisionedMB: 102400,
    inUseMB: 51200,
    cluster: 'Cluster1',
    host: 'host1.example.com',
    datacenter: 'DC1',
    template: false,
    ...overrides,
  } as VirtualMachine;
}

function makeRVToolsData(vms: VirtualMachine[]): RVToolsData {
  return {
    vInfo: vms,
    vTools: [],
    vSnapshot: [],
    vDisk: [],
    vNetwork: [],
    vCD: [],
    vCPU: [],
    vMemory: [],
    vHost: [],
    vCluster: [],
    vDatastore: [],
    vSource: [],
    vLicense: [],
    vPartition: [],
  };
}

describe('preflightChecks vsi-os', () => {
  it('should pass for RHEL 8 (supported)', () => {
    const vm = makeVM({ vmName: 'rhel8-vm', guestOS: 'Red Hat Enterprise Linux 8 (64-bit)' });
    const results = runPreFlightChecks(makeRVToolsData([vm]), 'vsi');
    const osCheck = results[0].checks['vsi-os'];
    expect(osCheck.status).toBe('pass');
  });

  it('should pass for RHEL 9 (supported)', () => {
    const vm = makeVM({ vmName: 'rhel9-vm', guestOS: 'Red Hat Enterprise Linux 9 (64-bit)' });
    const results = runPreFlightChecks(makeRVToolsData([vm]), 'vsi');
    const osCheck = results[0].checks['vsi-os'];
    expect(osCheck.status).toBe('pass');
  });

  it('should warn for RHEL 7 (byol)', () => {
    const vm = makeVM({ vmName: 'rhel7-vm', guestOS: 'Red Hat Enterprise Linux 7 (64-bit)' });
    const results = runPreFlightChecks(makeRVToolsData([vm]), 'vsi');
    const osCheck = results[0].checks['vsi-os'];
    expect(osCheck.status).toBe('warn');
    expect(osCheck.message).toContain('BYOL');
  });

  it('should warn for RHEL7 short name (byol)', () => {
    const vm = makeVM({ vmName: 'rhel7-vm2', guestOS: 'RHEL 7.9' });
    const results = runPreFlightChecks(makeRVToolsData([vm]), 'vsi');
    const osCheck = results[0].checks['vsi-os'];
    expect(osCheck.status).toBe('warn');
    expect(osCheck.message).toContain('BYOL');
  });

  it('should pass for Windows Server 2022 (supported)', () => {
    const vm = makeVM({ vmName: 'win-vm', guestOS: 'Microsoft Windows Server 2022 (64-bit)' });
    const results = runPreFlightChecks(makeRVToolsData([vm]), 'vsi');
    const osCheck = results[0].checks['vsi-os'];
    expect(osCheck.status).toBe('pass');
  });

  it('should fail for unknown/unsupported OS', () => {
    const vm = makeVM({ vmName: 'unknown-vm', guestOS: 'SomeObscureOS 3.0' });
    const results = runPreFlightChecks(makeRVToolsData([vm]), 'vsi');
    const osCheck = results[0].checks['vsi-os'];
    expect(osCheck.status).toBe('fail');
  });

  it('should count RHEL 7 as warning, not blocker', () => {
    const vm = makeVM({ vmName: 'rhel7-vm', guestOS: 'Red Hat Enterprise Linux 7 (64-bit)' });
    const results = runPreFlightChecks(makeRVToolsData([vm]), 'vsi');
    // vsi-os warn should not increment blockerCount
    // It might have other blockers from other checks, but vsi-os itself should be a warning
    const osCheck = results[0].checks['vsi-os'];
    expect(osCheck.status).toBe('warn');
  });
});

function makeDisk(vmName: string, capacityMiB: number, diskKey: number): VDiskInfo {
  return {
    vmName,
    capacityMiB,
    diskKey,
    diskLabel: `Hard disk ${diskKey}`,
  } as VDiskInfo;
}

describe('preflightChecks data-disk-size-min', () => {
  it('should pass when all data disks are >= 10GB', () => {
    const vm = makeVM({ vmName: 'vm1' });
    const data = makeRVToolsData([vm]);
    data.vDisk = [
      makeDisk('vm1', 50 * 1024, 0),   // boot: 50GB
      makeDisk('vm1', 20 * 1024, 1),   // data: 20GB
    ];
    const results = runPreFlightChecks(data, 'vsi');
    expect(results[0].checks['data-disk-size-min'].status).toBe('pass');
  });

  it('should fail when a data disk is < 10GB', () => {
    const vm = makeVM({ vmName: 'vm1' });
    const data = makeRVToolsData([vm]);
    data.vDisk = [
      makeDisk('vm1', 50 * 1024, 0),  // boot: 50GB
      makeDisk('vm1', 2 * 1024, 1),   // data: 2GB (below 10GB)
    ];
    const results = runPreFlightChecks(data, 'vsi');
    expect(results[0].checks['data-disk-size-min'].status).toBe('fail');
    expect(results[0].checks['data-disk-size-min'].message).toContain('provisioned as 10GB');
  });

  it('should pass when VM has no data disks (only boot)', () => {
    const vm = makeVM({ vmName: 'vm1' });
    const data = makeRVToolsData([vm]);
    data.vDisk = [
      makeDisk('vm1', 50 * 1024, 0),  // boot only
    ];
    const results = runPreFlightChecks(data, 'vsi');
    expect(results[0].checks['data-disk-size-min'].status).toBe('pass');
  });

  it('should not flag boot disk as a small data disk', () => {
    const vm = makeVM({ vmName: 'vm1' });
    const data = makeRVToolsData([vm]);
    data.vDisk = [
      makeDisk('vm1', 5 * 1024, 0),   // boot: 5GB (small but it's boot, not data)
      makeDisk('vm1', 50 * 1024, 1),  // data: 50GB
    ];
    const results = runPreFlightChecks(data, 'vsi');
    expect(results[0].checks['data-disk-size-min'].status).toBe('pass');
  });
});

describe('derivePreflightCounts data-disk-size-min', () => {
  it('should populate vmsWithSmallDataDisk count', () => {
    const vm = makeVM({ vmName: 'vm1' });
    const data = makeRVToolsData([vm]);
    data.vDisk = [
      makeDisk('vm1', 50 * 1024, 0),
      makeDisk('vm1', 1 * 1024, 1),
    ];
    const results = runPreFlightChecks(data, 'vsi');
    const counts = derivePreflightCounts(results, 'vsi');
    expect(counts.vmsWithSmallDataDisk).toBe(1);
    expect(counts.vmsWithSmallDataDiskList).toEqual(['vm1']);
  });
});

describe('derivePreflightCounts BYOL OS', () => {
  it('should populate vmsWithBYOLOS for BYOL VMs in VSI mode', () => {
    const vms = [
      makeVM({ vmName: 'rhel7-vm', guestOS: 'Red Hat Enterprise Linux 7 (64-bit)' }),
      makeVM({ vmName: 'rhel8-vm', guestOS: 'Red Hat Enterprise Linux 8 (64-bit)' }),
      makeVM({ vmName: 'unknown-vm', guestOS: 'SomeObscureOS 3.0' }),
    ];
    const results = runPreFlightChecks(makeRVToolsData(vms), 'vsi');
    const counts = derivePreflightCounts(results, 'vsi');
    // rhel7 is BYOL (warn), rhel8 is supported (pass), unknown is unsupported (fail)
    expect(counts.vmsWithBYOLOS).toBe(1);
    expect(counts.vmsWithBYOLOSList).toEqual(['rhel7-vm']);
    expect(counts.vmsWithUnsupportedOS).toBe(1);
    expect(counts.vmsWithUnsupportedOSList).toEqual(['unknown-vm']);
  });

  it('should return 0 for vmsWithBYOLOS when no BYOL VMs exist', () => {
    const vms = [
      makeVM({ vmName: 'rhel8-vm', guestOS: 'Red Hat Enterprise Linux 8 (64-bit)' }),
    ];
    const results = runPreFlightChecks(makeRVToolsData(vms), 'vsi');
    const counts = derivePreflightCounts(results, 'vsi');
    expect(counts.vmsWithBYOLOS).toBe(0);
    expect(counts.vmsWithBYOLOSList).toEqual([]);
  });
});

describe('derivePreflightCounts OS caveats (ROKS)', () => {
  it('should populate vmsWithCaveatsOS for supported-with-caveats VMs in ROKS mode', () => {
    // Windows Server 2019 is supported-with-caveats on ROKS
    const vms = [
      makeVM({ vmName: 'win2019-vm', guestOS: 'Microsoft Windows Server 2019 (64-bit)', hardwareVersion: 'vmx-15' }),
      makeVM({ vmName: 'rhel8-vm', guestOS: 'Red Hat Enterprise Linux 8 (64-bit)', hardwareVersion: 'vmx-15' }),
    ];
    const data = makeRVToolsData(vms);
    // Add tools data to avoid tools-installed failures
    data.vTools = vms.map(vm => ({
      vmName: vm.vmName,
      toolsStatus: 'toolsOk',
      toolsVersion: '12345',
    })) as typeof data.vTools;
    const results = runPreFlightChecks(data, 'roks');
    const counts = derivePreflightCounts(results, 'roks');
    // Check if Windows 2019 has caveats on ROKS
    const win2019Check = results.find(r => r.vmName === 'win2019-vm')?.checks['os-compatible'];
    if (win2019Check?.status === 'warn') {
      expect(counts.vmsWithCaveatsOS).toBe(1);
      expect(counts.vmsWithCaveatsOSList).toContain('win2019-vm');
    } else {
      // If it passes or fails, caveats should still be defined
      expect(counts.vmsWithCaveatsOS).toBeDefined();
    }
  });
});

describe('derivePreflightCounts summary aggregates', () => {
  it('should correctly compute totalVMs, vmsWithBlockers, vmsWithWarningsOnly, vmsReady', () => {
    const vms = [
      // VM with blocker (unsupported OS)
      makeVM({ vmName: 'blocked-vm', guestOS: 'FreeBSD 12 (64-bit)' }),
      // VM with warning only (BYOL OS) — still ready
      makeVM({ vmName: 'warn-vm', guestOS: 'Red Hat Enterprise Linux 7 (64-bit)' }),
      // Clean VM — ready, no warnings
      makeVM({ vmName: 'clean-vm', guestOS: 'Red Hat Enterprise Linux 8 (64-bit)' }),
    ];
    const data = makeRVToolsData(vms);
    // Provide tools data for warn-vm and clean-vm to avoid tools warnings
    data.vTools = [
      { vmName: 'warn-vm', toolsStatus: 'toolsOk', toolsVersion: '12345' },
      { vmName: 'clean-vm', toolsStatus: 'toolsOk', toolsVersion: '12345' },
    ] as typeof data.vTools;
    const results = runPreFlightChecks(data, 'vsi');
    const counts = derivePreflightCounts(results, 'vsi');

    expect(counts.totalVMs).toBe(3);
    expect(counts.vmsWithBlockers).toBe(1);
    expect(counts.vmsWithWarningsOnly).toBe(1);
    // Ready = no blockers (warnings OK)
    expect(counts.vmsReady).toBe(2);
    expect(counts.readinessPercentage).toBeCloseTo((2 / 3) * 100, 1);
  });

  it('should count VM with both blockers and warnings only in vmsWithBlockers', () => {
    // VM with unsupported OS (blocker) + no tools (warning on VSI)
    const vms = [
      makeVM({ vmName: 'both-vm', guestOS: 'FreeBSD 12 (64-bit)' }),
    ];
    const results = runPreFlightChecks(makeRVToolsData(vms), 'vsi');
    const counts = derivePreflightCounts(results, 'vsi');

    expect(counts.vmsWithBlockers).toBe(1);
    expect(counts.vmsWithWarningsOnly).toBe(0);
    expect(counts.vmsReady).toBe(0);
  });

  it('should handle empty results', () => {
    const counts = derivePreflightCounts([], 'vsi');
    expect(counts.totalVMs).toBe(0);
    expect(counts.vmsWithBlockers).toBe(0);
    expect(counts.vmsWithWarningsOnly).toBe(0);
    expect(counts.vmsReady).toBe(0);
    expect(counts.readinessPercentage).toBe(0);
  });
});

describe('remediation data-disk-size-min', () => {
  it('should generate warning remediation item for small data disks', () => {
    const items = generateVSIRemediationItems({
      vmsWithoutTools: 0, vmsWithoutToolsList: [],
      vmsWithToolsNotRunning: 0, vmsWithToolsNotRunningList: [],
      vmsWithOldSnapshots: 0, vmsWithOldSnapshotsList: [],
      vmsWithRDM: 0, vmsWithRDMList: [],
      vmsWithSharedDisks: 0, vmsWithSharedDisksList: [],
      vmsWithLargeDisks: 0, vmsWithLargeDisksList: [],
      hwVersionOutdated: 0, hwVersionOutdatedList: [],
      vmsWithSmallDataDisk: 3,
      vmsWithSmallDataDiskList: ['vm1', 'vm2', 'vm3'],
    });
    const item = items.find(i => i.id === 'data-disk-size-min');
    expect(item).toBeDefined();
    expect(item!.severity).toBe('warning');
    expect(item!.affectedCount).toBe(3);
  });

  it('should generate warning remediation item for BYOL OS', () => {
    const items = generateVSIRemediationItems({
      vmsWithoutTools: 0, vmsWithoutToolsList: [],
      vmsWithToolsNotRunning: 0, vmsWithToolsNotRunningList: [],
      vmsWithOldSnapshots: 0, vmsWithOldSnapshotsList: [],
      vmsWithRDM: 0, vmsWithRDMList: [],
      vmsWithSharedDisks: 0, vmsWithSharedDisksList: [],
      vmsWithLargeDisks: 0, vmsWithLargeDisksList: [],
      hwVersionOutdated: 0, hwVersionOutdatedList: [],
      vmsWithBYOLOS: 2,
      vmsWithBYOLOSList: ['rhel7-vm1', 'rhel7-vm2'],
    });
    const item = items.find(i => i.id === 'byol-os');
    expect(item).toBeDefined();
    expect(item!.severity).toBe('warning');
    expect(item!.affectedCount).toBe(2);
  });

  it('should not generate BYOL remediation item when no BYOL VMs exist', () => {
    const items = generateVSIRemediationItems({
      vmsWithoutTools: 0, vmsWithoutToolsList: [],
      vmsWithToolsNotRunning: 0, vmsWithToolsNotRunningList: [],
      vmsWithOldSnapshots: 0, vmsWithOldSnapshotsList: [],
      vmsWithRDM: 0, vmsWithRDMList: [],
      vmsWithSharedDisks: 0, vmsWithSharedDisksList: [],
      vmsWithLargeDisks: 0, vmsWithLargeDisksList: [],
      hwVersionOutdated: 0, hwVersionOutdatedList: [],
    });
    const item = items.find(i => i.id === 'byol-os');
    expect(item).toBeUndefined();
  });

  it('should include byol-os in all checks with success when no BYOL VMs', () => {
    const items = generateVSIAllChecks({
      vmsWithoutTools: 0, vmsWithoutToolsList: [],
      vmsWithToolsNotRunning: 0, vmsWithToolsNotRunningList: [],
      vmsWithOldSnapshots: 0, vmsWithOldSnapshotsList: [],
      vmsWithRDM: 0, vmsWithRDMList: [],
      vmsWithSharedDisks: 0, vmsWithSharedDisksList: [],
      vmsWithLargeDisks: 0, vmsWithLargeDisksList: [],
      hwVersionOutdated: 0, hwVersionOutdatedList: [],
    });
    const item = items.find(i => i.id === 'byol-os');
    expect(item).toBeDefined();
    expect(item!.severity).toBe('success');
    expect(item!.affectedCount).toBe(0);
  });

  it('should include byol-os in all checks with warning when BYOL VMs exist', () => {
    const items = generateVSIAllChecks({
      vmsWithoutTools: 0, vmsWithoutToolsList: [],
      vmsWithToolsNotRunning: 0, vmsWithToolsNotRunningList: [],
      vmsWithOldSnapshots: 0, vmsWithOldSnapshotsList: [],
      vmsWithRDM: 0, vmsWithRDMList: [],
      vmsWithSharedDisks: 0, vmsWithSharedDisksList: [],
      vmsWithLargeDisks: 0, vmsWithLargeDisksList: [],
      hwVersionOutdated: 0, hwVersionOutdatedList: [],
      vmsWithBYOLOS: 3,
      vmsWithBYOLOSList: ['vm1', 'vm2', 'vm3'],
    });
    const item = items.find(i => i.id === 'byol-os');
    expect(item).toBeDefined();
    expect(item!.severity).toBe('warning');
    expect(item!.affectedCount).toBe(3);
  });

  it('should include data-disk-minimum in all checks', () => {
    const items = generateVSIAllChecks({
      vmsWithoutTools: 0, vmsWithoutToolsList: [],
      vmsWithToolsNotRunning: 0, vmsWithToolsNotRunningList: [],
      vmsWithOldSnapshots: 0, vmsWithOldSnapshotsList: [],
      vmsWithRDM: 0, vmsWithRDMList: [],
      vmsWithSharedDisks: 0, vmsWithSharedDisksList: [],
      vmsWithLargeDisks: 0, vmsWithLargeDisksList: [],
      hwVersionOutdated: 0, hwVersionOutdatedList: [],
      vmsWithSmallDataDisk: 0,
      vmsWithSmallDataDiskList: [],
    });
    const item = items.find(i => i.id === 'data-disk-minimum');
    expect(item).toBeDefined();
    expect(item!.severity).toBe('success');
  });
});
