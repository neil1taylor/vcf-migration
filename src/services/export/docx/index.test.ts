// DOCX Generator Tests
/* eslint-disable @typescript-eslint/no-explicit-any */
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
  buildDay2OperationsSection: vi.fn(() => []),
  buildNextSteps: vi.fn(() => []),
  buildAppendices: vi.fn(() => []),
  buildPlatformSelectionSection: vi.fn(() => []),
  buildRiskAssessmentSection: vi.fn(() => []),
  buildTimelineSection: vi.fn(() => []),
  buildComplexityAssessment: vi.fn(() => []),
  buildOSCompatibilitySection: vi.fn(() => []),
  buildWorkloadClassification: vi.fn(() => []),
  buildPlatformRecommendation: vi.fn(() => []),
  buildRemediationPlanSection: vi.fn(() => []),
}));

// Mock utility functions
vi.mock('./utils/calculations', () => ({
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

// Mock shared pre-flight checks (same path as UI/XLSX/PPTX)
vi.mock('@/services/preflightChecks', () => ({
  runPreFlightChecks: vi.fn(() => []),
  derivePreflightCounts: vi.fn(() => ({
    totalVMs: 10,
    vmsWithBlockers: 1,
    vmsWithWarningsOnly: 1,
    vmsReady: 8,
    readinessPercentage: 80,
    vmsWithoutTools: 0,
    vmsWithoutToolsList: [],
    vmsWithToolsNotRunning: 0,
    vmsWithToolsNotRunningList: [],
    vmsWithOldSnapshots: 0,
    vmsWithOldSnapshotsList: [],
    vmsWithRDM: 0,
    vmsWithRDMList: [],
    vmsWithSharedDisks: 0,
    vmsWithSharedDisksList: [],
    vmsWithLargeDisks: 0,
    vmsWithLargeDisksList: [],
    hwVersionOutdated: 0,
    hwVersionOutdatedList: [],
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
  buildRiskAssessmentSection,
  buildTimelineSection,
  buildComplexityAssessment,
  buildOSCompatibilitySection,
  buildAppendices,
  buildWorkloadClassification,
  buildPlatformRecommendation,
  buildExecutiveSummary,
  buildEnvironmentAnalysis,
  buildMigrationStrategy,
} from './sections';
import { calculateROKSSizing, calculateVSIMappings } from './utils/calculations';
import { runPreFlightChecks, derivePreflightCounts } from '@/services/preflightChecks';
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

  it('calls buildPlatformRecommendation when platformSelection is provided', async () => {
    const platformSelection = {
      score: { vsiCount: 5, roksCount: 3, answeredCount: 12, leaning: 'vsi' as const },
      answers: { 'vsi-change-risk': 'yes' as const, 'roks-containerize': 'no' as const },
    };

    await generateDocxReport(mockRVToolsData, { platformSelection });

    expect(buildPlatformRecommendation).toHaveBeenCalledWith(platformSelection, null, expect.any(Number));
  });

  it('does not call buildPlatformRecommendation when platformSelection and targetAssignments are null', async () => {
    await generateDocxReport(mockRVToolsData, { platformSelection: null, targetAssignments: null });

    expect(buildPlatformRecommendation).not.toHaveBeenCalled();
  });

  it('calls buildPlatformRecommendation when only targetAssignments is provided', async () => {
    const targetAssignments = [
      { vmName: 'vm-1', workloadType: 'Web Server', target: 'roks' as const, reason: 'Linux workload', isUserOverride: false },
    ];

    await generateDocxReport(mockRVToolsData, { targetAssignments });

    expect(buildPlatformRecommendation).toHaveBeenCalledWith(null, targetAssignments, expect.any(Number));
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

  it('orders sections: platform recommendation before ROKS before VSI', async () => {
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

    // Verify call order: Platform Recommendation → ROKS → VSI → Strategy → Timeline → Risk
    const platCall = (buildPlatformRecommendation as any).mock.invocationCallOrder[0];
    const roksCall = (buildROKSOverview as any).mock.invocationCallOrder[0];
    const vsiCall = (buildVSIOverview as any).mock.invocationCallOrder[0];
    const stratCall = (buildMigrationStrategy as any).mock.invocationCallOrder[0];
    const timeCall = (buildTimelineSection as any).mock.invocationCallOrder[0];
    const riskCall = (buildRiskAssessmentSection as any).mock.invocationCallOrder[0];

    expect(platCall).toBeLessThan(roksCall);
    expect(roksCall).toBeLessThan(vsiCall);
    expect(vsiCall).toBeLessThan(stratCall);
    expect(stratCall).toBeLessThan(timeCall);
    expect(timeCall).toBeLessThan(riskCall);
  });

  it('orders VSI before ROKS when leaning is vsi', async () => {
    const platformSelection = {
      score: { vsiCount: 5, roksCount: 2, answeredCount: 7, leaning: 'vsi' as const },
      answers: {},
    };

    await generateDocxReport(mockRVToolsData, { platformSelection });

    const vsiCall = (buildVSIOverview as any).mock.invocationCallOrder[0];
    const roksCall = (buildROKSOverview as any).mock.invocationCallOrder[0];
    expect(vsiCall).toBeLessThan(roksCall);
  });

  it('orders ROKS before VSI when leaning is roks', async () => {
    const platformSelection = {
      score: { vsiCount: 2, roksCount: 5, answeredCount: 7, leaning: 'roks' as const },
      answers: {},
    };

    await generateDocxReport(mockRVToolsData, { platformSelection });

    const roksCall = (buildROKSOverview as any).mock.invocationCallOrder[0];
    const vsiCall = (buildVSIOverview as any).mock.invocationCallOrder[0];
    expect(roksCall).toBeLessThan(vsiCall);
  });

  it('calls buildComplexityAssessment with rawData, section number, and leaning', async () => {
    await generateDocxReport(mockRVToolsData);

    // No platformSelection → leaning is undefined
    expect(buildComplexityAssessment).toHaveBeenCalledWith(mockRVToolsData, expect.any(Number), undefined);
  });

  it('passes platform leaning to buildComplexityAssessment', async () => {
    const platformSelection = {
      score: { vsiCount: 5, roksCount: 2, answeredCount: 7, leaning: 'vsi' as const },
      answers: {},
    };

    await generateDocxReport(mockRVToolsData, { platformSelection });

    expect(buildComplexityAssessment).toHaveBeenCalledWith(mockRVToolsData, expect.any(Number), 'vsi');
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
      mockRVToolsData,
      expect.any(Number),
      true
    );
  });

  it('passes includeAppendices: false to buildAppendices when set', async () => {
    await generateDocxReport(mockRVToolsData, { includeAppendices: false });

    expect(buildAppendices).toHaveBeenCalledWith(
      expect.anything(),
      mockRVToolsData,
      expect.any(Number),
      false
    );
  });

  it('calls buildWorkloadClassification when workloadClassification is provided', async () => {
    const workloadClassification = {
      categories: [{ category: 'Web Server', count: 5, percentage: 50 }, { category: 'Database', count: 3, percentage: 30 }],
      totalClassified: 8,
    };

    await generateDocxReport(mockRVToolsData, { workloadClassification });

    expect(buildWorkloadClassification).toHaveBeenCalledWith(workloadClassification, expect.any(Number));
  });

  it('does not call buildWorkloadClassification when not provided', async () => {
    await generateDocxReport(mockRVToolsData);

    expect(buildWorkloadClassification).not.toHaveBeenCalled();
  });

  it('passes sourceEnvironment to buildEnvironmentAnalysis', async () => {
    const sourceEnvironment = {
      vcenterServer: 'vc01.example.com',
      vcenterVersion: 'VMware vCenter Server 7.0.3',
      esxiVersions: [{ version: '7.0.3', hostCount: 4 }],
      hostHardware: [{ vendor: 'Dell', model: 'PowerEdge R740', count: 4 }],
      cpuModels: [{ model: 'Intel Xeon Gold 6248R', count: 4 }],
      hostOvercommit: [],
      datastoreUtilization: [],
    };

    await generateDocxReport(mockRVToolsData, { sourceEnvironment });

    expect(buildEnvironmentAnalysis).toHaveBeenCalledWith(
      mockRVToolsData,
      expect.any(Number),
      sourceEnvironment,
    );
  });

  it('passes platformSelection and workloadClassification to buildExecutiveSummary', async () => {
    const platformSelection = {
      score: { vsiCount: 5, roksCount: 3, answeredCount: 12, leaning: 'vsi' as const },
      answers: {},
    };
    const workloadClassification = {
      categories: [{ category: 'Web Server', count: 5, percentage: 50 }],
      totalClassified: 5,
    };

    await generateDocxReport(mockRVToolsData, { platformSelection, workloadClassification });

    const call = (buildExecutiveSummary as any).mock.calls[0];
    expect(call[0]).toBe(mockRVToolsData);          // rawData
    expect(call[3]).toEqual(expect.any(Number));     // sectionNum
    expect(call[4]).toBe(platformSelection);          // platformSelection
    expect(call[5]).toBe(workloadClassification);     // workloadClassification
  });

  describe('filteredRawData', () => {
    const mockFilteredData = {
      ...mockRVToolsData,
      vInfo: [mockRVToolsData.vInfo[0]], // Only first VM
    } as unknown as RVToolsData;

    it('uses filteredRawData for target calculations when provided', async () => {
      await generateDocxReport(mockRVToolsData, { filteredRawData: mockFilteredData });

      expect(runPreFlightChecks).toHaveBeenCalledWith(mockFilteredData, expect.any(String));
      expect(calculateROKSSizing).toHaveBeenCalledWith(mockFilteredData);
      expect(calculateVSIMappings).toHaveBeenCalledWith(mockFilteredData);
    });

    it('uses filteredRawData for target sections', async () => {
      await generateDocxReport(mockRVToolsData, { filteredRawData: mockFilteredData });

      expect(buildComplexityAssessment).toHaveBeenCalledWith(mockFilteredData, expect.any(Number), undefined);
      expect(buildOSCompatibilitySection).toHaveBeenCalledWith(mockFilteredData, expect.any(Object), expect.any(Number));
      // buildMigrationStrategy(filteredRawData, aiInsights, wavePref, includeROKS, includeVSI, sectionNum)
      const stratCall = (buildMigrationStrategy as any).mock.calls[0];
      expect(stratCall[0]).toBe(mockFilteredData);
    });

    it('uses filteredRawData for ROKS and VSI overviews', async () => {
      await generateDocxReport(mockRVToolsData, { filteredRawData: mockFilteredData });

      // buildROKSOverview(sizing, rawData, wavePref, platformSel, sectionNum)
      const roksCall = (buildROKSOverview as any).mock.calls[0];
      expect(roksCall[1]).toBe(mockFilteredData);

      // buildVSIOverview(mappings, maxVMs, rawData, wavePref, vpcDesign, sectionNum)
      const vsiCall = (buildVSIOverview as any).mock.calls[0];
      expect(vsiCall[2]).toBe(mockFilteredData);
    });

    it('uses filteredRawData for appendices', async () => {
      await generateDocxReport(mockRVToolsData, { filteredRawData: mockFilteredData });

      expect(buildAppendices).toHaveBeenCalledWith(expect.anything(), mockFilteredData, expect.any(Number), true);
    });

    it('keeps rawData for source sections (executive summary, environment)', async () => {
      await generateDocxReport(mockRVToolsData, { filteredRawData: mockFilteredData });

      const execCall = (buildExecutiveSummary as any).mock.calls[0];
      expect(execCall[0]).toBe(mockRVToolsData);

      expect(buildEnvironmentAnalysis).toHaveBeenCalledWith(mockRVToolsData, expect.any(Number), null);
    });

    it('falls back to rawData when filteredRawData is not provided', async () => {
      await generateDocxReport(mockRVToolsData);

      expect(runPreFlightChecks).toHaveBeenCalledWith(mockRVToolsData, expect.any(String));
      expect(buildComplexityAssessment).toHaveBeenCalledWith(mockRVToolsData, expect.any(Number), undefined);
    });
  });

});
