import { describe, it, expect } from 'vitest';
import { checkDataInconsistencies } from './dataInconsistencyChecks';
import type { VirtualMachine } from '@/types';

function makeVM(overrides: Partial<VirtualMachine> = {}): VirtualMachine {
  return {
    vmName: 'vm-default',
    powerState: 'poweredOn',
    template: false,
    srmPlaceholder: false,
    configStatus: 'green',
    dnsName: null,
    connectionState: 'connected',
    guestState: 'running',
    heartbeat: 'green',
    consolidationNeeded: false,
    powerOnDate: null,
    suspendedToMemory: false,
    suspendTime: null,
    creationDate: null,
    cpus: 4,
    memory: 8 * 1024, // 8 GiB in MiB
    nics: 1,
    disks: 1,
    resourcePool: null,
    folder: null,
    vApp: null,
    ftState: null,
    ftRole: null,
    cbrcEnabled: false,
    hardwareVersion: 'vmx-19',
    guestOS: 'Red Hat Enterprise Linux 8 (64-bit)',
    osToolsConfig: '',
    guestHostname: null,
    guestIP: null,
    annotation: null,
    datacenter: 'DC1',
    cluster: 'Cluster1',
    host: 'host1',
    provisionedMiB: 100 * 1024,
    inUseMiB: 50 * 1024,
    uuid: null,
    firmwareType: null,
    latencySensitivity: null,
    cbtEnabled: false,
    ...overrides,
  };
}

function makeTypicalSet(count: number): VirtualMachine[] {
  return Array.from({ length: count }, (_, i) =>
    makeVM({ vmName: `vm-${i}`, cpus: 4, memory: 8 * 1024 }),
  );
}

describe('checkDataInconsistencies', () => {
  it('returns no warnings for an empty list', () => {
    const result = checkDataInconsistencies([]);
    expect(result.warnings).toHaveLength(0);
    expect(result.hasCritical).toBe(false);
  });

  it('detects 10x median memory outlier', () => {
    const vms = [
      ...makeTypicalSet(9), // 9 VMs with 8 GiB
      makeVM({ vmName: 'big-mem', memory: 810 * 1024 }), // 810 GiB
    ];
    const result = checkDataInconsistencies(vms);
    const memWarnings = result.warnings.filter(
      (w) => w.vmName === 'big-mem' && w.category === 'memory-outlier',
    );
    expect(memWarnings.length).toBeGreaterThanOrEqual(1);
    expect(memWarnings[0].severity).toBe('critical');
  });

  it('detects 10x median CPU outlier', () => {
    const vms = [
      ...makeTypicalSet(9), // 9 VMs with 4 vCPUs
      makeVM({ vmName: 'big-cpu', cpus: 128 }),
    ];
    const result = checkDataInconsistencies(vms);
    const cpuWarnings = result.warnings.filter(
      (w) => w.vmName === 'big-cpu' && w.category === 'cpu-outlier',
    );
    expect(cpuWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it('detects memory:CPU ratio outlier', () => {
    // Most VMs: 8 GiB / 4 vCPUs = 2 GiB/vCPU ratio
    // Outlier: 810 GiB / 4 vCPUs = 202.5 GiB/vCPU (>5x median)
    const vms = [
      ...makeTypicalSet(9),
      makeVM({ vmName: 'ratio-outlier', cpus: 4, memory: 810 * 1024 }),
    ];
    const result = checkDataInconsistencies(vms);
    const ratioWarnings = result.warnings.filter(
      (w) => w.vmName === 'ratio-outlier' && w.category === 'ratio-outlier',
    );
    expect(ratioWarnings.length).toBe(1);
  });

  it('flags jumphost with 810 GiB as name-resource mismatch (critical)', () => {
    const vms = [
      makeVM({ vmName: 'ln04jumphost2', cpus: 4, memory: 810 * 1024 }),
    ];
    const result = checkDataInconsistencies(vms);
    const nameWarnings = result.warnings.filter(
      (w) => w.category === 'name-resource-mismatch',
    );
    expect(nameWarnings.length).toBe(1);
    expect(nameWarnings[0].severity).toBe('critical'); // >256 GiB
    expect(result.hasCritical).toBe(true);
  });

  it('does not flag jumphost with 8 GiB', () => {
    const vms = [
      makeVM({ vmName: 'jumphost', cpus: 2, memory: 8 * 1024 }),
    ];
    const result = checkDataInconsistencies(vms);
    const nameWarnings = result.warnings.filter(
      (w) => w.category === 'name-resource-mismatch',
    );
    expect(nameWarnings).toHaveLength(0);
  });

  it('does not false-positive a database VM with 512 GiB', () => {
    const vms = [
      ...makeTypicalSet(9),
      makeVM({ vmName: 'prod-db-oracle01', cpus: 32, memory: 512 * 1024 }),
    ];
    const result = checkDataInconsistencies(vms);
    const nameWarnings = result.warnings.filter(
      (w) =>
        w.vmName === 'prod-db-oracle01' &&
        w.category === 'name-resource-mismatch',
    );
    expect(nameWarnings).toHaveLength(0);
  });

  it('skips statistical rules for <5 VMs but still checks name patterns', () => {
    const vms = [
      makeVM({ vmName: 'vm1', cpus: 4, memory: 8 * 1024 }),
      makeVM({ vmName: 'vm2', cpus: 4, memory: 8 * 1024 }),
      makeVM({ vmName: 'big-mem', cpus: 4, memory: 810 * 1024 }),
    ];
    const result = checkDataInconsistencies(vms);
    // Should NOT have statistical outlier warnings (only 3 VMs)
    const statWarnings = result.warnings.filter(
      (w) =>
        w.category === 'memory-outlier' ||
        w.category === 'cpu-outlier' ||
        w.category === 'ratio-outlier',
    );
    expect(statWarnings).toHaveLength(0);
  });

  it('flags name-resource mismatch even with <5 VMs', () => {
    const vms = [
      makeVM({ vmName: 'test-vm', cpus: 4, memory: 128 * 1024 }),
    ];
    const result = checkDataInconsistencies(vms);
    const nameWarnings = result.warnings.filter(
      (w) => w.category === 'name-resource-mismatch',
    );
    expect(nameWarnings.length).toBe(1);
    expect(nameWarnings[0].severity).toBe('warning'); // 128 GiB < 256 threshold
  });
});
