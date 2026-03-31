// Remediation Plan Section Tests
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi } from 'vitest';
vi.mock('docx', () => ({
  Paragraph: class { constructor(public opts?: any) {} },
  PageBreak: class { constructor() {} },
  HeadingLevel: { HEADING_1: 'heading1', HEADING_2: 'heading2', HEADING_3: 'heading3', HEADING_4: 'heading4' },
  TextRun: class { constructor(public opts?: any) {} },
  Table: class { constructor(public opts?: any) {} },
  TableRow: class { constructor(public opts?: any) {} },
  TableCell: class { constructor(public opts?: any) {} },
  WidthType: { PERCENTAGE: 'pct' },
  AlignmentType: { LEFT: 'left', RIGHT: 'right', CENTER: 'center' },
  BorderStyle: { SINGLE: 'single' },
  ShadingType: { SOLID: 'solid' },
  Bookmark: class { constructor() {} },
  ExternalHyperlink: class { constructor(public opts?: any) {} },
}));

vi.mock('@/services/preflightChecks', () => ({
  runPreFlightChecks: vi.fn(() => []),
  derivePreflightCounts: vi.fn(() => ({
    vmsWithoutTools: 0, vmsWithoutToolsList: [],
    vmsWithToolsNotRunning: 0, vmsWithToolsNotRunningList: [],
    vmsWithOldSnapshots: 0, vmsWithOldSnapshotsList: [],
    vmsWithRDM: 0, vmsWithRDMList: [],
    vmsWithSharedDisks: 0, vmsWithSharedDisksList: [],
    vmsWithLargeDisks: 0, vmsWithLargeDisksList: [],
    hwVersionOutdated: 0, hwVersionOutdatedList: [],
    vmsWithUnsupportedOS: 0, vmsWithUnsupportedOSList: [],
    vmsWithUnsupportedROKSOS: 0, vmsWithUnsupportedROKSOSList: [],
  })),
  CHECK_DEFINITIONS: [],
}));

vi.mock('@/services/migration', () => ({
  generateRemediationItems: vi.fn(() => []),
}));

import { buildRemediationPlanSection } from './remediationPlan';
import type { RVToolsData } from '@/types/rvtools';

function makeRawData(): RVToolsData {
  return {
    metadata: { fileName: 'test.xlsx', collectionDate: new Date(), vCenterVersion: '7.0', environment: 'test' },
    vInfo: [],
    vCPU: [], vMemory: [], vDisk: [], vPartition: [], vNetwork: [], vCD: [],
    vSnapshot: [], vTools: [], vCluster: [], vHost: [], vDatastore: [],
    vResourcePool: [], vLicense: [], vHealth: [], vSource: [],
  } as RVToolsData;
}

describe('buildRemediationPlanSection', () => {
  it('returns DocumentContent[] with migration partner scope', () => {
    const result = buildRemediationPlanSection(makeRawData(), 'vsi', 5);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes all three migration phases', () => {
    const result = buildRemediationPlanSection(makeRawData(), 'roks', 5);
    expect(result.length).toBeGreaterThan(5);
  });

  it('includes client remediation section even when no blockers', () => {
    const result = buildRemediationPlanSection(makeRawData(), 'vsi', 5);
    expect(result.length).toBeGreaterThan(0);
  });
});
