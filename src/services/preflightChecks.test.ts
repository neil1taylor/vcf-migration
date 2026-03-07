import { describe, it, expect } from 'vitest';
import { runPreFlightChecks } from './preflightChecks';
import type { RVToolsData, VirtualMachine } from '@/types/rvtools';

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
