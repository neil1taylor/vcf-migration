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
