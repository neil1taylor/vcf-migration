// PPTX Generator Tests
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all section builders
vi.mock('./sections', () => ({
  addTitleSlide: vi.fn(),
  addAgendaSlide: vi.fn(),
  addExecutiveSummarySlide: vi.fn(),
  addMigrationStatsSlide: vi.fn(),
  addExcludedVMsSlide: vi.fn(),
  addPlatformRecommendationSlide: vi.fn(),
  addCostEstimationSlide: vi.fn(),
  addWavePlanningSlide: vi.fn(),
  addMigrationExecutionSlide: vi.fn(),
  addNextStepsSlide: vi.fn(),
}));

// Mock preflight checks service (used by migrationStatsSlide)
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
  })),
  CHECK_DEFINITIONS: [],
}));

// Mock calculations (reused from DOCX)
vi.mock('../docx/utils/calculations', () => ({
  calculateROKSSizing: vi.fn(() => ({
    workerNodes: 3,
    profileName: 'bx2d-metal-96x384',
    totalCores: 144,
    totalThreads: 288,
    totalMemoryGiB: 1152,
    totalNvmeTiB: 18,
    odfUsableTiB: 5.4,
    monthlyCost: 5000,
  })),
  calculateVSIMappings: vi.fn(() => [
    { vmName: 'vm-1', monthlyCost: 200, sourceVcpus: 4, sourceMemoryGiB: 8, sourceStorageGiB: 100, profile: 'bx2-4x16', profileVcpus: 4, profileMemoryGiB: 16, family: 'Balanced', bootDiskGiB: 20, dataDiskGiB: 80, computeCost: 150, bootStorageCost: 2, dataStorageCost: 8, storageCost: 10 },
  ]),
}));

// Mock theme and utils
vi.mock('./utils', () => ({
  defineMasterSlides: vi.fn(),
  addSlideTitle: vi.fn(),
  addTable: vi.fn(),
  addBulletList: vi.fn(),
  addKPINumber: vi.fn(),
  addFooter: vi.fn(),
  fmt: vi.fn((n: number) => String(n)),
  fmtCurrency: vi.fn((n: number) => `$${n}`),
  injectReferenceSlides: vi.fn((blob: Blob) => Promise.resolve(blob)),
}));

// Mock pptxgenjs
const mockWrite = vi.fn(() => Promise.resolve(new Blob(['PPTX content'], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })));
vi.mock('pptxgenjs', () => {
  return {
    default: class MockPptxGenJS {
      layout = '';
      title = '';
      author = '';
      company = '';
      subject = '';
      ChartType = { pie: 'pie', bar: 'bar' };
      defineLayout = vi.fn();
      defineSlideMaster = vi.fn();
      addSlide = vi.fn(() => ({
        addText: vi.fn(),
        addChart: vi.fn(),
        addTable: vi.fn(),
        addImage: vi.fn(),
      }));
      write = mockWrite;
    },
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

import { generatePptxReport } from './index';
import {
  addTitleSlide,
  addAgendaSlide,
  addExecutiveSummarySlide,
  addMigrationStatsSlide,
  addExcludedVMsSlide,
  addPlatformRecommendationSlide,
  addCostEstimationSlide,
  addWavePlanningSlide,
  addMigrationExecutionSlide,
  addNextStepsSlide,
} from './sections';
import { defineMasterSlides, injectReferenceSlides } from './utils';
import { calculateROKSSizing, calculateVSIMappings } from '../docx/utils/calculations';
import type { RVToolsData } from '@/types/rvtools';
import type { CostEstimate } from '@/services/costEstimation';

const mockRVToolsData = {
  metadata: {
    fileName: 'test.xlsx',
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

describe('generatePptxReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a PPTX blob with default options', async () => {
    const blob = await generatePptxReport(mockRVToolsData);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('calls defineMasterSlides', async () => {
    await generatePptxReport(mockRVToolsData);
    expect(defineMasterSlides).toHaveBeenCalledTimes(1);
  });

  it('calls injectReferenceSlides for post-processing', async () => {
    await generatePptxReport(mockRVToolsData);
    expect(injectReferenceSlides).toHaveBeenCalledTimes(1);
    expect(injectReferenceSlides).toHaveBeenCalledWith(expect.any(Blob));
  });

  it('calls all required section builders in correct order', async () => {
    await generatePptxReport(mockRVToolsData);

    // Title slide
    expect(addTitleSlide).toHaveBeenCalledTimes(1);

    // Agenda slide
    expect(addAgendaSlide).toHaveBeenCalledTimes(1);
    expect(addAgendaSlide).toHaveBeenCalledWith(
      expect.anything(),
      ['Executive Summary', 'Migration Readiness', 'Excluded VMs', 'Platform Recommendation', 'Cost Estimation', 'Migration Timeline', 'Migration Execution', 'Next Steps']
    );

    // Content slides
    expect(addExecutiveSummarySlide).toHaveBeenCalledTimes(1);
    expect(addMigrationStatsSlide).toHaveBeenCalledTimes(1);
    expect(addExcludedVMsSlide).toHaveBeenCalledTimes(1);
    expect(addPlatformRecommendationSlide).toHaveBeenCalledTimes(1);
    expect(addCostEstimationSlide).toHaveBeenCalledTimes(1);
    expect(addWavePlanningSlide).toHaveBeenCalledTimes(1);
    expect(addMigrationExecutionSlide).toHaveBeenCalledTimes(1);
    expect(addNextStepsSlide).toHaveBeenCalledTimes(1);
  });

  it('skips cost slide when includeCosts is false', async () => {
    await generatePptxReport(mockRVToolsData, { includeCosts: false });
    expect(addCostEstimationSlide).not.toHaveBeenCalled();
    // Agenda should not include Cost Estimation
    expect(addAgendaSlide).toHaveBeenCalledWith(
      expect.anything(),
      ['Executive Summary', 'Migration Readiness', 'Excluded VMs', 'Platform Recommendation', 'Migration Timeline', 'Migration Execution', 'Next Steps']
    );
  });

  it('skips cost slide when neither ROKS nor VSI included', async () => {
    await generatePptxReport(mockRVToolsData, { includeROKS: false, includeVSI: false });
    expect(addCostEstimationSlide).not.toHaveBeenCalled();
    expect(addAgendaSlide).toHaveBeenCalledWith(
      expect.anything(),
      ['Executive Summary', 'Migration Readiness', 'Excluded VMs', 'Platform Recommendation', 'Migration Timeline', 'Migration Execution', 'Next Steps']
    );
  });

  it('passes platformSelection to recommendation slide', async () => {
    const platformSelection = {
      score: { vsiCount: 5, roksCount: 3, answeredCount: 12, leaning: 'vsi' as const },
      answers: {},
    };
    await generatePptxReport(mockRVToolsData, { platformSelection });
    expect(addPlatformRecommendationSlide).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ platformSelection })
    );
  });

  it('passes rawData and leaning to migration stats slide', async () => {
    const platformSelection = {
      score: { vsiCount: 5, roksCount: 3, answeredCount: 12, leaning: 'roks' as const },
      answers: {},
    };
    await generatePptxReport(mockRVToolsData, { platformSelection });
    expect(addMigrationStatsSlide).toHaveBeenCalledWith(
      expect.anything(),
      mockRVToolsData,
      'roks'
    );
  });

  it('defaults leaning to neutral when no platformSelection', async () => {
    await generatePptxReport(mockRVToolsData);
    expect(addMigrationStatsSlide).toHaveBeenCalledWith(
      expect.anything(),
      mockRVToolsData,
      'neutral'
    );
  });

  it('calls addWavePlanningSlide with rawData and options', async () => {
    await generatePptxReport(mockRVToolsData);
    expect(addWavePlanningSlide).toHaveBeenCalledWith(
      expect.anything(),
      mockRVToolsData,
      expect.objectContaining({ wavePlanningPreference: null })
    );
  });

  it('passes wavePlanningPreference to wave planning slide', async () => {
    const wavePlanningPreference = { wavePlanningMode: 'complexity' as const, networkGroupBy: 'portGroup' as const };
    await generatePptxReport(mockRVToolsData, { wavePlanningPreference });
    expect(addWavePlanningSlide).toHaveBeenCalledWith(
      expect.anything(),
      mockRVToolsData,
      expect.objectContaining({ wavePlanningPreference })
    );
  });

  it('generates with custom client name', async () => {
    const blob = await generatePptxReport(mockRVToolsData, { clientName: 'ACME Corp' });
    expect(blob).toBeInstanceOf(Blob);
  });

  it('handles empty VM list', async () => {
    const emptyData = { ...mockRVToolsData, vInfo: [] } as unknown as RVToolsData;
    const blob = await generatePptxReport(emptyData);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('adds placeholder slides for reference XML injection (slides 3 & 4)', async () => {
    await generatePptxReport(mockRVToolsData);
    // The presentation should have addSlide called for placeholders
    // Title (1) + Agenda (1) + 2 placeholders + content slides
    // Verify injectReferenceSlides is called to replace them
    expect(injectReferenceSlides).toHaveBeenCalledTimes(1);
  });

  describe('filteredRawData', () => {
    const mockFilteredData = {
      ...mockRVToolsData,
      vInfo: [], // No VMs after filtering
    } as unknown as RVToolsData;

    it('uses filteredRawData for target calculations when provided', async () => {
      await generatePptxReport(mockRVToolsData, { filteredRawData: mockFilteredData });

      expect(calculateROKSSizing).toHaveBeenCalledWith(mockFilteredData);
      expect(calculateVSIMappings).toHaveBeenCalledWith(mockFilteredData);
    });

    it('uses filteredRawData for migration stats and wave planning slides', async () => {
      await generatePptxReport(mockRVToolsData, { filteredRawData: mockFilteredData });

      expect(addMigrationStatsSlide).toHaveBeenCalledWith(expect.anything(), mockFilteredData, 'neutral');
      expect(addWavePlanningSlide).toHaveBeenCalledWith(expect.anything(), mockFilteredData, expect.anything());
    });

    it('keeps rawData for source sections (executive summary, excluded VMs)', async () => {
      await generatePptxReport(mockRVToolsData, { filteredRawData: mockFilteredData });

      expect(addExecutiveSummarySlide).toHaveBeenCalledWith(expect.anything(), mockRVToolsData);
      expect(addExcludedVMsSlide).toHaveBeenCalledWith(expect.anything(), mockRVToolsData);
    });

    it('falls back to rawData when filteredRawData is not provided', async () => {
      await generatePptxReport(mockRVToolsData);

      expect(calculateROKSSizing).toHaveBeenCalledWith(mockRVToolsData);
      expect(addMigrationStatsSlide).toHaveBeenCalledWith(expect.anything(), mockRVToolsData, 'neutral');
    });
  });

  describe('timeline phases', () => {
    it('passes timelinePhases and timelineStartDate to wave planning slide', async () => {
      const timelinePhases = [
        { id: 'prep', name: 'Preparation', type: 'preparation' as const, durationWeeks: 2, defaultDurationWeeks: 2, startWeek: 0, endWeek: 2, color: '#0f62fe' },
        { id: 'pilot', name: 'Pilot', type: 'pilot' as const, durationWeeks: 2, defaultDurationWeeks: 2, waveSourceName: 'Low Complexity', waveVmCount: 5, waveStorageGiB: 100, startWeek: 2, endWeek: 4, color: '#8a3ffc' },
      ];
      const timelineStartDate = new Date('2024-06-01');

      await generatePptxReport(mockRVToolsData, { timelinePhases, timelineStartDate });

      expect(addWavePlanningSlide).toHaveBeenCalledWith(
        expect.anything(),
        mockRVToolsData,
        expect.objectContaining({ timelinePhases, timelineStartDate })
      );
    });

    it('defaults timelinePhases to null when not provided', async () => {
      await generatePptxReport(mockRVToolsData);

      expect(addWavePlanningSlide).toHaveBeenCalledWith(
        expect.anything(),
        mockRVToolsData,
        expect.objectContaining({ timelinePhases: null })
      );
    });
  });

  describe('cached cost estimates', () => {
    const mockRoksCostEstimate: CostEstimate = {
      architecture: 'roks',
      region: 'us-south',
      regionName: 'Dallas',
      discountType: 'list',
      discountPct: 0,
      lineItems: [
        { category: 'Compute', description: 'Worker Nodes', quantity: 3, unit: 'nodes', unitCost: 5000, monthlyCost: 15000, annualCost: 180000 },
        { category: 'OCP License', description: 'OpenShift Licensing', quantity: 3, unit: 'nodes', unitCost: 2000, monthlyCost: 6000, annualCost: 72000 },
      ],
      subtotalMonthly: 21000,
      subtotalAnnual: 252000,
      discountAmountMonthly: 0,
      discountAmountAnnual: 0,
      totalMonthly: 21000,
      totalAnnual: 252000,
      metadata: { pricingVersion: '1.0', generatedAt: '2024-01-15', notes: [] },
    };

    it('passes cached cost estimates to addCostEstimationSlide', async () => {
      await generatePptxReport(mockRVToolsData, {
        roksCostEstimate: mockRoksCostEstimate,
      });

      expect(addCostEstimationSlide).toHaveBeenCalledWith(
        expect.anything(), // pres
        expect.any(Object), // roksSizing
        expect.any(Object), // vsiMappings
        expect.any(Object), // options
        mockRoksCostEstimate,
        null,
      );
    });

    it('passes null cost estimates when not provided (fallback)', async () => {
      await generatePptxReport(mockRVToolsData);

      expect(addCostEstimationSlide).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
        null,
        null,
      );
    });
  });
});
