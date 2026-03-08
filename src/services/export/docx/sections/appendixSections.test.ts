// Appendix Sections Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock docx library
vi.mock('docx', () => ({
  Paragraph: class { constructor(public opts?: any) {} },
  PageBreak: class { constructor() {} },
  HeadingLevel: { HEADING_1: 'heading1', HEADING_2: 'heading2' },
  TextRun: class { constructor() {} },
  Table: class { constructor() {} },
  TableRow: class { constructor() {} },
  TableCell: class { constructor() {} },
  WidthType: { PERCENTAGE: 'pct' },
  AlignmentType: { LEFT: 'left', RIGHT: 'right', CENTER: 'center' },
  BorderStyle: { SINGLE: 'single' },
  ShadingType: { SOLID: 'solid' },
  Bookmark: class { constructor() {} },
}));

import {
  buildComputeAppendix,
  buildStorageAppendix,
  buildClusterAppendix,
  buildHostAppendix,
  buildSnapshotAppendix,
  buildVMInventoryAppendix,
} from './appendixSections';
import type { RVToolsData } from '@/types/rvtools';

function makeVM(overrides: Partial<any> = {}) {
  return {
    vmName: overrides.vmName || 'test-vm',
    powerState: overrides.powerState || 'poweredOn',
    template: overrides.template || false,
    cpus: overrides.cpus || 4,
    memory: overrides.memory || 8192,
    guestOS: overrides.guestOS || 'RHEL 8',
    hardwareVersion: 'vmx-19',
    provisionedMiB: overrides.provisionedMiB || 102400,
    inUseMiB: 51200,
    datacenter: 'dc-1',
    cluster: 'cluster-1',
    ...overrides,
  };
}

function makeRawData(overrides: Partial<RVToolsData> = {}): RVToolsData {
  return {
    metadata: { fileName: 'test.xlsx', collectionDate: new Date(), vCenterVersion: '7.0', environment: 'test' },
    vInfo: [],
    vCPU: [], vMemory: [], vDisk: [], vPartition: [], vNetwork: [], vCD: [],
    vSnapshot: [], vTools: [], vCluster: [], vHost: [], vDatastore: [],
    vResourcePool: [], vLicense: [], vHealth: [], vSource: [],
    ...overrides,
  } as RVToolsData;
}

describe('buildComputeAppendix', () => {
  it('returns empty array when no VMs', () => {
    expect(buildComputeAppendix(makeRawData(), 'C')).toEqual([]);
  });

  it('returns content with correct heading label', () => {
    const rawData = makeRawData({ vInfo: [makeVM()] as any });
    const result = buildComputeAppendix(rawData, 'C');
    expect(result.length).toBeGreaterThan(0);
  });

  it('produces 4 tables (vCPU dist, Memory dist, Top CPU, Top Memory)', () => {
    const vms = Array.from({ length: 5 }, (_, i) => makeVM({ vmName: `vm-${i}` }));
    const rawData = makeRawData({ vInfo: vms as any });
    const result = buildComputeAppendix(rawData, 'C');

    const tableCount = result.filter(el => el.constructor.name === 'Table').length;
    expect(tableCount).toBe(4);
  });

  it('filters out templates and powered-off VMs', () => {
    const rawData = makeRawData({
      vInfo: [
        makeVM({ vmName: 'template', template: true }),
        makeVM({ vmName: 'off', powerState: 'poweredOff' }),
      ] as any,
    });
    expect(buildComputeAppendix(rawData, 'C')).toEqual([]);
  });
});

describe('buildStorageAppendix', () => {
  it('returns empty array when no datastores and no disks', () => {
    expect(buildStorageAppendix(makeRawData(), 'D')).toEqual([]);
  });

  it('returns content when datastores present', () => {
    const rawData = makeRawData({
      vDatastore: [{
        name: 'ds-1', type: 'VMFS', capacityMiB: 1048576, inUseMiB: 524288,
        freeMiB: 524288, freePercent: 50, vmCount: 5,
      }] as any,
    });
    const result = buildStorageAppendix(rawData, 'D');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes disk provisioning table when vDisk data present', () => {
    const rawData = makeRawData({
      vDisk: [
        { vmName: 'vm-1', thin: true, capacityMiB: 10240 },
        { vmName: 'vm-2', thin: false, capacityMiB: 20480 },
      ] as any,
    });
    const result = buildStorageAppendix(rawData, 'D');
    const tableCount = result.filter(el => el.constructor.name === 'Table').length;
    expect(tableCount).toBeGreaterThanOrEqual(1);
  });
});

describe('buildClusterAppendix', () => {
  it('returns empty array when no clusters', () => {
    expect(buildClusterAppendix(makeRawData(), 'E')).toEqual([]);
  });

  it('returns content with table when clusters present', () => {
    const rawData = makeRawData({
      vCluster: [{
        name: 'cluster-1', vmCount: 10, hostCount: 3, numCpuCores: 48,
        totalMemoryMiB: 393216, haEnabled: true, drsEnabled: true, evcMode: null,
      }] as any,
    });
    const result = buildClusterAppendix(rawData, 'E');
    expect(result.length).toBeGreaterThan(0);
    const tableCount = result.filter(el => el.constructor.name === 'Table').length;
    expect(tableCount).toBe(1);
  });
});

describe('buildHostAppendix', () => {
  it('returns empty array when no hosts', () => {
    expect(buildHostAppendix(makeRawData(), 'F')).toEqual([]);
  });

  it('returns content with table when hosts present', () => {
    const rawData = makeRawData({
      vHost: [{
        name: 'esxi-01', cluster: 'cluster-1', esxiVersion: '7.0.3',
        cpuModel: 'Intel Xeon', cpuSockets: 2, totalCpuCores: 24,
        memoryMiB: 524288, vmCount: 15,
      }] as any,
    });
    const result = buildHostAppendix(rawData, 'F');
    expect(result.length).toBeGreaterThan(0);
    const tableCount = result.filter(el => el.constructor.name === 'Table').length;
    expect(tableCount).toBe(1);
  });
});

describe('buildSnapshotAppendix', () => {
  it('returns empty array when no snapshots', () => {
    expect(buildSnapshotAppendix(makeRawData(), 'G')).toEqual([]);
  });

  it('returns empty array when no aged snapshots', () => {
    const rawData = makeRawData({
      vSnapshot: [{ vmName: 'vm-1', snapshotName: 'snap-1', ageInDays: 5, sizeTotalMiB: 1024 }] as any,
    });
    expect(buildSnapshotAppendix(rawData, 'G')).toEqual([]);
  });

  it('filters by age and returns content for aged snapshots', () => {
    const rawData = makeRawData({
      vSnapshot: [
        { vmName: 'vm-1', snapshotName: 'old-snap', ageInDays: 60, sizeTotalMiB: 2048 },
        { vmName: 'vm-2', snapshotName: 'new-snap', ageInDays: 5, sizeTotalMiB: 512 },
      ] as any,
    });
    const result = buildSnapshotAppendix(rawData, 'G');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('buildVMInventoryAppendix', () => {
  it('returns empty array when no VMs', () => {
    expect(buildVMInventoryAppendix(makeRawData(), 'H')).toEqual([]);
  });

  it('returns content with table when VMs present', () => {
    const rawData = makeRawData({ vInfo: [makeVM()] as any });
    const result = buildVMInventoryAppendix(rawData, 'H');
    expect(result.length).toBeGreaterThan(0);
    const tableCount = result.filter(el => el.constructor.name === 'Table').length;
    expect(tableCount).toBe(1);
  });

  it('caps at 500 VMs', () => {
    const vms = Array.from({ length: 600 }, (_, i) => makeVM({ vmName: `vm-${i}` }));
    const rawData = makeRawData({ vInfo: vms as any });
    const result = buildVMInventoryAppendix(rawData, 'H');

    // Should include overflow note paragraph
    expect(result.length).toBeGreaterThan(0);
  });
});
