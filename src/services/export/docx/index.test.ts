// DOCX Generator Tests
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all the section builders before importing the module
vi.mock('./sections', () => ({
  buildCoverPage: vi.fn(() => []),
  buildExecutiveSummary: vi.fn(() => Promise.resolve([])),
  buildAssumptionsAndScope: vi.fn(() => []),
  buildEnvironmentAnalysis: vi.fn(() => Promise.resolve([])),
  buildMigrationReadiness: vi.fn(() => []),
  buildMigrationOptions: vi.fn(() => []),
  buildMigrationStrategy: vi.fn(() => []),
  buildROKSOverview: vi.fn(() => []),
  buildVSIOverview: vi.fn(() => []),
  buildCostEstimation: vi.fn(() => []),
  buildDay2OperationsSection: vi.fn(() => []),
  buildNextSteps: vi.fn(() => []),
  buildAppendices: vi.fn(() => []),
  buildPlatformSelectionSection: vi.fn(() => []),
  buildRiskAssessmentSection: vi.fn(() => []),
  buildTimelineSection: vi.fn(() => []),
  buildComplexityAssessment: vi.fn(() => []),
  buildOSCompatibilitySection: vi.fn(() => []),
}));

// Mock utility functions
vi.mock('./utils/calculations', () => ({
  calculateVMReadiness: vi.fn(() => ({
    total: 10,
    ready: 8,
    blockers: 1,
    warnings: 1,
    readyVMs: [],
    blockerVMs: [],
    warningVMs: [],
    issuesByCategory: {},
  })),
  calculateROKSSizing: vi.fn(() => ({
    workerNodes: 3,
    controlPlaneNodes: 3,
    workerCores: 48,
    workerMemoryGiB: 192,
    totalVMs: 10,
    supportedVMs: 8,
    cpuOvercommit: 5,
  })),
  calculateVSIMappings: vi.fn(() => ({
    mappings: [],
    profileCounts: {},
    totalVCPUs: 40,
    totalMemoryGiB: 160,
  })),
}));

// Mock helpers
vi.mock('./utils/helpers', () => ({
  resetCaptionCounters: vi.fn(),
  createTableCaption: vi.fn(() => []),
  createFigureCaption: vi.fn(() => []),
  createTableDescription: vi.fn(() => []),
  createTableLabel: vi.fn(() => ({})),
  createFigureDescription: vi.fn(() => []),
  createFigureLabel: vi.fn(() => ({})),
  createHeading: vi.fn(() => ({})),
  createParagraph: vi.fn(() => ({})),
  createBulletList: vi.fn(() => []),
  createStyledTable: vi.fn(() => ({})),
  createTableCell: vi.fn(() => ({})),
  getCurrentTableNumber: vi.fn(() => 0),
  getCurrentFigureNumber: vi.fn(() => 0),
  createDocLink: vi.fn(() => ({})),
}));

// Mock docx library
vi.mock('docx', () => {
  return {
    Document: class MockDocument {
      constructor() {}
    },
    Packer: {
      toBlob: vi.fn(() => Promise.resolve(new Blob(['DOCX content'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))),
    },
    Paragraph: class MockParagraph {
      constructor() {}
    },
    TextRun: class MockTextRun {
      constructor() {}
    },
    Header: class MockHeader {
      constructor() {}
    },
    Footer: class MockFooter {
      constructor() {}
    },
    TableOfContents: class MockTableOfContents {
      constructor() {}
    },
    PageBreak: class MockPageBreak {
      constructor() {}
    },
    ExternalHyperlink: class MockExternalHyperlink {
      constructor() {}
    },
    PageNumber: {},
    NumberFormat: { DECIMAL: 'decimal' },
    AlignmentType: { CENTER: 'center', LEFT: 'left', RIGHT: 'right', JUSTIFIED: 'justified' },
    HeadingLevel: { HEADING_1: 'heading1', HEADING_2: 'heading2', HEADING_3: 'heading3' },
    convertInchesToTwip: vi.fn((inches: number) => inches * 1440),
  };
});

// Mock report templates
vi.mock('@/data/reportTemplates.json', () => ({
  default: {
    placeholders: {
      clientName: 'Test Client',
      preparedBy: 'Test Author',
      companyName: 'Test Company',
    },
  },
}));

import { generateDocxReport } from './index';
import {
  buildROKSOverview,
  buildVSIOverview,
  buildPlatformSelectionSection,
  buildRiskAssessmentSection,
  buildTimelineSection,
  buildComplexityAssessment,
  buildOSCompatibilitySection,
  buildAppendices,
} from './sections';
import type { RVToolsData } from '@/types/rvtools';

const mockRVToolsData = {
  metadata: {
    fileName: 'test-export.xlsx',
    collectionDate: new Date('2024-01-15'),
    vCenterVersion: '7.0.3',
    environment: 'production',
  },
  vInfo: [
    {
      vmName: 'vm-1',
      powerState: 'poweredOn',
      template: false,
      cpus: 4,
      memory: 8192,
      provisionedMiB: 102400,
      inUseMiB: 51200,
      datacenter: 'dc-1',
      cluster: 'cluster-1',
      hardwareVersion: 'vmx-19',
      guestOS: 'Windows Server 2019',
    },
    {
      vmName: 'vm-2',
      powerState: 'poweredOn',
      template: false,
      cpus: 2,
      memory: 4096,
      provisionedMiB: 51200,
      inUseMiB: 25600,
      datacenter: 'dc-1',
      cluster: 'cluster-1',
      hardwareVersion: 'vmx-17',
      guestOS: 'Red Hat Enterprise Linux 8',
    },
  ],
  vHost: [],
  vCluster: [],
  vDatastore: [],
  vSnapshot: [],
  vTools: [],
  vCD: [],
  vDisk: [],
  vCPU: [],
  vMemory: [],
  vNetwork: [],
  vSource: [],
  vLicense: [],
} as unknown as RVToolsData;

describe('generateDocxReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a DOCX blob with default options', async () => {
    const blob = await generateDocxReport(mockRVToolsData);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('generates a DOCX blob with custom client name', async () => {
    const blob = await generateDocxReport(mockRVToolsData, {
      clientName: 'Custom Client',
    });

    expect(blob).toBeInstanceOf(Blob);
  });

  it('generates a DOCX blob with all options', async () => {
    const blob = await generateDocxReport(mockRVToolsData, {
      clientName: 'Test Client',
      preparedBy: 'Test Author',
      companyName: 'Test Company',
      includeROKS: true,
      includeVSI: true,
      includeCosts: true,
      maxIssueVMs: 10,
    });

    expect(blob).toBeInstanceOf(Blob);
  });

  it('generates a DOCX blob without ROKS section', async () => {
    const blob = await generateDocxReport(mockRVToolsData, {
      includeROKS: false,
    });

    expect(blob).toBeInstanceOf(Blob);
  });

  it('generates a DOCX blob without VSI section', async () => {
    const blob = await generateDocxReport(mockRVToolsData, {
      includeVSI: false,
    });

    expect(blob).toBeInstanceOf(Blob);
  });

  it('generates a DOCX blob without costs section', async () => {
    const blob = await generateDocxReport(mockRVToolsData, {
      includeCosts: false,
    });

    expect(blob).toBeInstanceOf(Blob);
  });

  it('handles empty VM list', async () => {
    const emptyData = {
      ...mockRVToolsData,
      vInfo: [],
    } as unknown as RVToolsData;

    const blob = await generateDocxReport(emptyData);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('respects maxIssueVMs option', async () => {
    const blob = await generateDocxReport(mockRVToolsData, {
      maxIssueVMs: 5,
    });

    expect(blob).toBeInstanceOf(Blob);
  });

  it('uses default values when options not provided', async () => {
    const blob = await generateDocxReport(mockRVToolsData);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('calls buildPlatformSelectionSection when platformSelection is provided', async () => {
    const platformSelection = {
      score: { vsiCount: 5, roksCount: 3, answeredCount: 12, leaning: 'vsi' as const },
      answers: { 'vsi-change-risk': 'yes' as const, 'roks-containerize': 'no' as const },
    };

    await generateDocxReport(mockRVToolsData, { platformSelection });

    expect(buildPlatformSelectionSection).toHaveBeenCalledWith(platformSelection, expect.any(Number));
  });

  it('does not call buildPlatformSelectionSection when platformSelection is null', async () => {
    await generateDocxReport(mockRVToolsData, { platformSelection: null });

    expect(buildPlatformSelectionSection).not.toHaveBeenCalled();
  });

  it('passes rawData and wavePlanningPreference to buildROKSOverview', async () => {
    const wavePref = { wavePlanningMode: 'complexity' as const, networkGroupBy: 'cluster' as const };
    const platformSelection = {
      score: { vsiCount: 2, roksCount: 5, answeredCount: 10, leaning: 'roks' as const, roksVariant: 'rov' as const },
      answers: {},
    };

    await generateDocxReport(mockRVToolsData, {
      wavePlanningPreference: wavePref,
      platformSelection,
    });

    expect(buildROKSOverview).toHaveBeenCalledWith(
      expect.any(Object), // sizing
      mockRVToolsData,
      wavePref,
      platformSelection,
      expect.any(Number), // sectionNum
    );
  });

  it('passes rawData, wavePlanningPreference, and vpcDesign to buildVSIOverview', async () => {
    const wavePref = { wavePlanningMode: 'network' as const, networkGroupBy: 'portGroup' as const };
    const vpcDesign = { vpcName: 'test-vpc', region: 'us-south', subnets: [], zones: [], securityGroups: [], transitGateways: [] };

    await generateDocxReport(mockRVToolsData, {
      wavePlanningPreference: wavePref,
      vpcDesign: vpcDesign as any,
    });

    expect(buildVSIOverview).toHaveBeenCalledWith(
      expect.any(Object), // mappings
      20,
      mockRVToolsData,
      wavePref,
      vpcDesign,
      expect.any(Number), // sectionNum
    );
  });

  it('orders sections: ROKS before VSI before comparison before timeline before risk', async () => {
    const platformSelection = {
      score: { vsiCount: 3, roksCount: 3, answeredCount: 6, leaning: 'neutral' as const },
      answers: {},
    };
    const timelinePhases = [{ id: '1', name: 'Prep', type: 'preparation' as const, durationWeeks: 2, startWeek: 0, endWeek: 2, color: '#ccc', defaultDurationWeeks: 2 }];
    const riskAssessment = { rows: [], autoRisks: [], curatedRisks: [] };

    await generateDocxReport(mockRVToolsData, {
      platformSelection,
      timelinePhases: timelinePhases as any,
      riskAssessment: riskAssessment as any,
    });

    // Verify call order: ROKS → VSI → Platform Selection → Timeline → Risk
    const roksCall = (buildROKSOverview as any).mock.invocationCallOrder[0];
    const vsiCall = (buildVSIOverview as any).mock.invocationCallOrder[0];
    const platCall = (buildPlatformSelectionSection as any).mock.invocationCallOrder[0];
    const timeCall = (buildTimelineSection as any).mock.invocationCallOrder[0];
    const riskCall = (buildRiskAssessmentSection as any).mock.invocationCallOrder[0];

    expect(roksCall).toBeLessThan(vsiCall);
    expect(vsiCall).toBeLessThan(platCall);
    expect(platCall).toBeLessThan(timeCall);
    expect(timeCall).toBeLessThan(riskCall);
  });

  it('calls buildComplexityAssessment with rawData and section number', async () => {
    await generateDocxReport(mockRVToolsData);

    expect(buildComplexityAssessment).toHaveBeenCalledWith(mockRVToolsData, expect.any(Number));
  });

  it('calls buildOSCompatibilitySection with rawData and platform flags', async () => {
    await generateDocxReport(mockRVToolsData, { includeROKS: true, includeVSI: false });

    expect(buildOSCompatibilitySection).toHaveBeenCalledWith(
      mockRVToolsData,
      { includeROKS: true, includeVSI: false },
      expect.any(Number)
    );
  });

  it('passes includeAppendices to buildAppendices (default true)', async () => {
    await generateDocxReport(mockRVToolsData);

    expect(buildAppendices).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Number),
      mockRVToolsData,
      true
    );
  });

  it('passes includeAppendices: false to buildAppendices when set', async () => {
    await generateDocxReport(mockRVToolsData, { includeAppendices: false });

    expect(buildAppendices).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Number),
      mockRVToolsData,
      false
    );
  });
});
