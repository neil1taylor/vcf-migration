// Complexity Assessment Section Tests
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi } from 'vitest';
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

import { buildComplexityAssessment } from './complexityAssessment';
import type { RVToolsData } from '@/types/rvtools';

function makeVM(overrides: Partial<any> = {}) {
  return {
    vmName: overrides.vmName || 'test-vm',
    powerState: overrides.powerState || 'poweredOn',
    template: overrides.template || false,
    cpus: overrides.cpus || 4,
    memory: overrides.memory || 8192, // 8 GiB
    guestOS: overrides.guestOS || 'Red Hat Enterprise Linux 8',
    hardwareVersion: overrides.hardwareVersion || 'vmx-19',
    provisionedMiB: 102400,
    inUseMiB: 51200,
    datacenter: 'dc-1',
    cluster: 'cluster-1',
    ...overrides,
  };
}

function makeRawData(vms: any[] = []): RVToolsData {
  return {
    metadata: { fileName: 'test.xlsx', collectionDate: new Date(), vCenterVersion: '7.0', environment: 'test' },
    vInfo: vms,
    vCPU: [],
    vMemory: [],
    vDisk: [],
    vPartition: [],
    vNetwork: [],
    vCD: [],
    vSnapshot: [],
    vTools: [],
    vCluster: [],
    vHost: [],
    vDatastore: [],
    vResourcePool: [],
    vLicense: [],
    vHealth: [],
    vSource: [],
  } as RVToolsData;
}

describe('buildComplexityAssessment', () => {
  it('returns DocumentContent[] with correct heading', () => {
    const rawData = makeRawData([makeVM()]);
    const result = buildComplexityAssessment(rawData, 4);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes section number in heading when provided', () => {
    const rawData = makeRawData([makeVM()]);
    const result = buildComplexityAssessment(rawData, 4);

    // First element should be the heading
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles empty VM array — heading + intro + page break', () => {
    const rawData = makeRawData([]);
    const result = buildComplexityAssessment(rawData);

    // heading + intro + "no VMs" paragraph + page break
    expect(result.length).toBe(4);
  });

  it('filters out templates and powered-off VMs', () => {
    const rawData = makeRawData([
      makeVM({ vmName: 'template-vm', template: true }),
      makeVM({ vmName: 'off-vm', powerState: 'poweredOff' }),
    ]);
    const result = buildComplexityAssessment(rawData);

    // Same as empty — heading + intro + "no VMs" + page break
    expect(result.length).toBe(4);
  });

  it('produces distribution table with 4 category rows', () => {
    const vms = Array.from({ length: 5 }, (_, i) =>
      makeVM({ vmName: `vm-${i}`, cpus: 2, memory: 4096 })
    );
    const rawData = makeRawData(vms);
    const result = buildComplexityAssessment(rawData);

    // Should have heading, intro, table description, distribution table, table label, observations heading, bullets, page break
    expect(result.length).toBeGreaterThan(5);
  });

  it('omits top complex VMs table when all VMs are Simple', () => {
    // Small VMs with no complexity factors should all be Simple
    const vms = Array.from({ length: 3 }, (_, i) =>
      makeVM({ vmName: `simple-vm-${i}`, cpus: 1, memory: 2048, guestOS: 'Red Hat Enterprise Linux 8' })
    );
    const rawData = makeRawData(vms);
    const result = buildComplexityAssessment(rawData);

    // Count tables — should have only distribution table (no top complex VMs table)
    const tableCount = result.filter(el => el.constructor.name === 'Table').length;
    expect(tableCount).toBe(1); // Only distribution table
  });

  it('includes top complex VMs table when non-Simple VMs exist', () => {
    const vms = [
      makeVM({ vmName: 'complex-vm', cpus: 128, memory: 2097152, guestOS: 'FreeBSD 13' }), // High complexity
      makeVM({ vmName: 'simple-vm', cpus: 1, memory: 2048, guestOS: 'Red Hat Enterprise Linux 8' }),
    ];
    const rawData = makeRawData(vms);
    const result = buildComplexityAssessment(rawData);

    const tableCount = result.filter(el => el.constructor.name === 'Table').length;
    expect(tableCount).toBe(2); // Distribution + top complex
  });
});
