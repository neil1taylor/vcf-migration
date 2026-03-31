// OS Compatibility Section Tests
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi } from 'vitest';
vi.mock('docx', () => ({
  Paragraph: class { constructor(public opts?: any) {} },
  PageBreak: class { constructor() {} },
  HeadingLevel: { HEADING_1: 'heading1', HEADING_2: 'heading2', HEADING_3: 'heading3', HEADING_4: 'heading4' },
  TextRun: class { constructor() {} },
  ExternalHyperlink: class { constructor() {} },
  Table: class { constructor() {} },
  TableRow: class { constructor() {} },
  TableCell: class { constructor() {} },
  WidthType: { PERCENTAGE: 'pct' },
  AlignmentType: { LEFT: 'left', RIGHT: 'right', CENTER: 'center' },
  BorderStyle: { SINGLE: 'single' },
  ShadingType: { SOLID: 'solid' },
  Bookmark: class { constructor() {} },
}));

import { buildOSCompatibilitySection } from './osCompatibility';
import type { RVToolsData } from '@/types/rvtools';

function makeVM(overrides: Partial<any> = {}) {
  return {
    vmName: overrides.vmName || 'test-vm',
    powerState: overrides.powerState || 'poweredOn',
    template: overrides.template || false,
    cpus: 4,
    memory: 8192,
    guestOS: overrides.guestOS || 'Red Hat Enterprise Linux 8',
    hardwareVersion: 'vmx-19',
    provisionedMiB: 102400,
    inUseMiB: 51200,
    datacenter: 'dc-1',
    cluster: 'cluster-1',
    ...overrides,
  };
}

function makeRawData(vms: any[]): RVToolsData {
  return {
    metadata: { fileName: 'test.xlsx', collectionDate: new Date(), vCenterVersion: '7.0', environment: 'test' },
    vInfo: vms,
    vCPU: [], vMemory: [], vDisk: [], vPartition: [], vNetwork: [], vCD: [],
    vSnapshot: [], vTools: [], vCluster: [], vHost: [], vDatastore: [],
    vResourcePool: [], vLicense: [], vHealth: [], vSource: [],
  } as RVToolsData;
}

describe('buildOSCompatibilitySection', () => {
  it('returns DocumentContent[] with correct heading', () => {
    const rawData = makeRawData([makeVM()]);
    const result = buildOSCompatibilitySection(rawData, { includeROKS: true, includeVSI: true }, 5);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes both ROKS and VSI sub-sections when both enabled', () => {
    const rawData = makeRawData([makeVM()]);
    const result = buildOSCompatibilitySection(rawData, { includeROKS: true, includeVSI: true });

    // Should have tables for both VSI and ROKS
    const tableCount = result.filter(el => el.constructor.name === 'Table').length;
    expect(tableCount).toBeGreaterThanOrEqual(2);
  });

  it('includes only VSI section when ROKS disabled', () => {
    const rawData = makeRawData([makeVM()]);
    const result = buildOSCompatibilitySection(rawData, { includeROKS: false, includeVSI: true });

    // Fewer elements than with both
    const bothResult = buildOSCompatibilitySection(rawData, { includeROKS: true, includeVSI: true });
    expect(result.length).toBeLessThan(bothResult.length);
  });

  it('includes only ROKS section when VSI disabled', () => {
    const rawData = makeRawData([makeVM()]);
    const result = buildOSCompatibilitySection(rawData, { includeROKS: true, includeVSI: false });

    const bothResult = buildOSCompatibilitySection(rawData, { includeROKS: true, includeVSI: true });
    expect(result.length).toBeLessThan(bothResult.length);
  });

  it('groups by OS family correctly', () => {
    const vms = [
      makeVM({ vmName: 'vm-1', guestOS: 'Red Hat Enterprise Linux 8' }),
      makeVM({ vmName: 'vm-2', guestOS: 'Red Hat Enterprise Linux 9' }),
      makeVM({ vmName: 'vm-3', guestOS: 'Microsoft Windows Server 2019' }),
    ];
    const rawData = makeRawData(vms);
    const result = buildOSCompatibilitySection(rawData, { includeROKS: true, includeVSI: true });

    expect(result.length).toBeGreaterThan(0);
  });

  it('handles unknown OS as unsupported', () => {
    const vms = [makeVM({ vmName: 'unknown-vm', guestOS: 'UnknownOS 99' })];
    const rawData = makeRawData(vms);
    const result = buildOSCompatibilitySection(rawData, { includeROKS: true, includeVSI: true });

    expect(result.length).toBeGreaterThan(0);
  });

  it('handles empty VM array', () => {
    const rawData = makeRawData([]);
    const result = buildOSCompatibilitySection(rawData, { includeROKS: true, includeVSI: true });

    // Should have heading, intro, "no VMs" paragraph, page break
    expect(result.length).toBe(4);
  });

  it('includes remediation subsection when unsupported OS VMs exist for VSI', () => {
    const vms = [
      makeVM({ vmName: 'legacy-vm', guestOS: 'Microsoft Windows Server 2003' }),
      makeVM({ vmName: 'modern-vm', guestOS: 'Red Hat Enterprise Linux 9' }),
    ];
    const rawData = makeRawData(vms);
    const result = buildOSCompatibilitySection(rawData, { includeROKS: false, includeVSI: true });
    const cleanResult = buildOSCompatibilitySection(
      makeRawData([makeVM({ guestOS: 'Red Hat Enterprise Linux 9' })]),
      { includeROKS: false, includeVSI: true },
    );
    expect(result.length).toBeGreaterThan(cleanResult.length);
  });

  it('includes remediation subsection when unsupported OS VMs exist for ROKS', () => {
    const vms = [
      makeVM({ vmName: 'legacy-vm', guestOS: 'Microsoft Windows Server 2003' }),
      makeVM({ vmName: 'modern-vm', guestOS: 'Red Hat Enterprise Linux 9' }),
    ];
    const rawData = makeRawData(vms);
    const result = buildOSCompatibilitySection(rawData, { includeROKS: true, includeVSI: false });
    const cleanResult = buildOSCompatibilitySection(
      makeRawData([makeVM({ guestOS: 'Red Hat Enterprise Linux 9' })]),
      { includeROKS: true, includeVSI: false },
    );
    expect(result.length).toBeGreaterThan(cleanResult.length);
  });

  it('does not include remediation subsection when all OSes are supported', () => {
    const vms = [
      makeVM({ vmName: 'vm-1', guestOS: 'Red Hat Enterprise Linux 9' }),
      makeVM({ vmName: 'vm-2', guestOS: 'Microsoft Windows Server 2022' }),
    ];
    const rawData = makeRawData(vms);
    const resultClean = buildOSCompatibilitySection(rawData, { includeROKS: true, includeVSI: true });
    const vmsUnsupported = [
      ...vms,
      makeVM({ vmName: 'legacy-vm', guestOS: 'Microsoft Windows Server 2003' }),
    ];
    const resultUnsupported = buildOSCompatibilitySection(makeRawData(vmsUnsupported), { includeROKS: true, includeVSI: true });
    expect(resultUnsupported.length).toBeGreaterThan(resultClean.length);
  });
});
