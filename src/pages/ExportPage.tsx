// Export & Reports page — consolidates all export options into a visible workflow step
import { useState, useCallback, useRef, useMemo } from 'react';
import {
  Grid,
  Column,
  Tile,
  Tag,
  Button,
  Checkbox,
  InlineLoading,
  InlineNotification,
  Modal,
  UnorderedList,
  ListItem,
  ContentSwitcher,
  Switch,
  TextInput,
  Toggle,
} from '@carbon/react';
import {
  DocumentPdf,
  DataTable,
  Document,
  PresentationFile,
  Report,
  DataShare,
  Upload,
  CheckmarkOutline,
  ChartVennDiagram,
  Debug,
  Kubernetes,
  Deploy,
} from '@carbon/icons-react';
import { Navigate } from 'react-router-dom';
import { useData, usePDFExport, useExcelExport, useDocxExport, usePptxExport, useAISettings, useVMs, useAllVMs, useAutoExclusion, usePlatformSelection, useVMOverrides, useMigrationAssessment, useWavePlanning } from '@/hooks';
import { useTimelineConfig } from '@/hooks/useTimelineConfig';
import { downloadHandoverFile } from '@/services/export/handoverExporter';
import { extractSettingsFromFile, type ExtractedSettings } from '@/services/settingsExtractor';
import { restoreBundledSettings } from '@/services/settingsRestore';
import { SETTINGS_LABELS } from '@/services/settingsLabels';
import { useWorkflowProgress } from '@/hooks/useWorkflowProgress';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { fetchAIInsights } from '@/services/ai/aiInsightsApi';
import { buildInsightsInput } from '@/services/ai/insightsInputBuilder';
import { ROUTES } from '@/utils/constants';
import { formatNumber } from '@/utils/formatters';
import { createLogger } from '@/utils/logger';
import { getVMIdentifier } from '@/utils/vmIdentifier';
import { filterRawDataByExclusions } from '@/utils/filterRawData';
import type { PDFExportOptions } from '@/hooks/usePDFExport';
import type { RVToolsData } from '@/types/rvtools';
import type { MigrationInsights } from '@/services/ai/types';
import { getWavePlanningPreference, getPlatformSelectionExport, getRiskAssessmentExport, getVPCDesignExport, getTargetAssignmentsExport, getWorkloadClassificationExport, getSourceEnvironmentExport } from '@/services/export/docx/types';
import { getDefaultFilename, sanitizeFilename } from '@/utils/exportFilenames';
import { runPreFlightChecks, type CheckMode } from '@/services/preflightChecks';
import { exportPreFlightExcel, downloadWavePlanningExcel } from '@/services/export/excelGenerator';
import { buildDiagnosticBundle, downloadDiagnosticBundle } from '@/services/diagnosticBundle';
import { getCachedBOM, hasCachedBOM } from '@/services/bomCache';
import { downloadVSIBOMExcel, downloadROKSBOMExcel, MTVYAMLGenerator, downloadBlob } from '@/services/export';
import type { MTVExportOptions } from '@/types/mtvYaml';
import { RackwareExportModal } from '@/components/export/RackwareExportModal';
import './ExportPage.scss';

const logger = createLogger('ExportPage');

const AI_INSIGHTS_TIMEOUT_MS = 45000;

async function fetchInsightsForExport(
  rawData: RVToolsData,
  exportType: string,
): Promise<{ insights: MigrationInsights | null; warning: string | null }> {
  logger.info(`[${exportType}] Fetching AI insights for export`);
  try {
    const insightsInput = buildInsightsInput(rawData);
    const result = await Promise.race([
      fetchAIInsights(insightsInput),
      new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), AI_INSIGHTS_TIMEOUT_MS)
      ),
    ]);
    if (result === 'timeout') {
      logger.warn(`[${exportType}] AI insights timed out`);
      return { insights: null, warning: `AI insights timed out — report generated without AI sections.` };
    }
    if (!result) {
      return { insights: null, warning: 'AI insights returned empty data — report generated without AI sections.' };
    }
    logger.info(`[${exportType}] AI insights fetched successfully`);
    return { insights: result, warning: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[${exportType}] AI insights fetch failed`, error instanceof Error ? error : new Error(message));
    return { insights: null, warning: `AI insights failed: ${message} — report generated without AI sections.` };
  }
}

const DEFAULT_PDF_OPTIONS: PDFExportOptions = {
  includeDashboard: true,
  includeCompute: true,
  includeStorage: true,
  includeNetwork: true,
  includeClusters: true,
  includeHosts: true,
  includeResourcePools: true,
};

const DEFAULT_MTV_OPTIONS: MTVExportOptions = {
  namespace: 'openshift-mtv',
  sourceProviderName: 'vmware-source',
  destinationProviderName: 'host',
  networkMapName: 'vmware-network-map',
  storageMapName: 'vmware-storage-map',
  defaultStorageClass: 'ocs-storagecluster-ceph-rbd',
  targetNamespace: 'migrated-vms',
  warm: false,
  preserveStaticIPs: false,
};

export function ExportPage() {
  const { rawData, originalFileBuffer, originalFileName } = useData();
  const vms = useVMs();
  const allVmsRaw = useAllVMs();
  const vmOverrides = useVMOverrides();
  const { autoExcludedCount, getAutoExclusionById } = useAutoExclusion();
  const { isExporting: isPDFExporting, error: pdfError, exportPDF } = usePDFExport();
  const { isExporting: isExcelExporting, error: excelError, exportExcel } = useExcelExport();
  const { isExporting: isDocxExporting, error: docxError, exportDocx } = useDocxExport();
  const { isExporting: isPptxExporting, error: pptxError, exportPptx } = usePptxExport();
  const { settings: aiSettings } = useAISettings();
  const { answers, score } = usePlatformSelection();
  const { markExportComplete } = useWorkflowProgress();
  const [aiWarning, setAIWarning] = useState<string | null>(null);

  // Import settings state
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<ExtractedSettings | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Pre-flight mode
  const [preflightMode, setPreflightMode] = useState<CheckMode>('roks');

  // RackWare modal
  const [rackwareModalOpen, setRackwareModalOpen] = useState(false);

  // MTV export state
  const [mtvExporting, setMtvExporting] = useState(false);

  // ===== Filename state =====
  const filenameCtx = useMemo(() => ({
    sourceFileName: originalFileName || undefined,
  }), [originalFileName]);

  const [pdfFilename, setPdfFilename] = useState(() => getDefaultFilename('pdf', filenameCtx));
  const [excelFilename, setExcelFilename] = useState(() => getDefaultFilename('excel', filenameCtx));
  const [docxFilename, setDocxFilename] = useState(() => getDefaultFilename('docx', filenameCtx));
  const [includeAppendices, setIncludeAppendices] = useState(true);
  const [pptxFilename, setPptxFilename] = useState(() => getDefaultFilename('pptx', filenameCtx));
  const [preflightFilename, setPreflightFilename] = useState(() => getDefaultFilename('preflight', { ...filenameCtx, mode: preflightMode }));
  const [wavesFilename, setWavesFilename] = useState(() => getDefaultFilename('waves', filenameCtx));
  const [mtvYamlFilename, setMtvYamlFilename] = useState(() => getDefaultFilename('mtv-yaml', filenameCtx));
  const [vsiBomFilename, setVsiBomFilename] = useState(() => getDefaultFilename('vsi-bom', filenameCtx));
  const [roksBomFilename, setRoksBomFilename] = useState(() => getDefaultFilename('roks-bom', filenameCtx));
  const [handoverFilename, setHandoverFilename] = useState(() => getDefaultFilename('handover', filenameCtx));
  const [diagnosticsFilename, setDiagnosticsFilename] = useState(() => getDefaultFilename('diagnostics', filenameCtx));

  // ===== Filtered VMs (same exclusion logic as migration pages) =====
  const includedVMs = useMemo(() => {
    return allVmsRaw.filter(vm => {
      const vmId = getVMIdentifier(vm);
      const autoResult = getAutoExclusionById(vmId);
      return !vmOverrides.isEffectivelyExcluded(vmId, autoResult.isAutoExcluded);
    });
  }, [allVmsRaw, vmOverrides, getAutoExclusionById]);

  const poweredOnVMs = useMemo(() => includedVMs.filter(vm => vm.powerState === 'poweredOn'), [includedVMs]);

  // Derived data arrays
  const disks = useMemo(() => rawData?.vDisk ?? [], [rawData?.vDisk]);
  const snapshots = useMemo(() => rawData?.vSnapshot ?? [], [rawData?.vSnapshot]);
  const tools = useMemo(() => rawData?.vTools ?? [], [rawData?.vTools]);
  const networks = useMemo(() => rawData?.vNetwork ?? [], [rawData?.vNetwork]);

  // ===== Pre-filtered rawData for target/migration sections in exports =====
  const filteredRawData = useMemo(() => {
    if (!rawData) return null;
    return filterRawDataByExclusions(rawData, allVmsRaw, vmOverrides, { getAutoExclusionById });
  }, [rawData, allVmsRaw, vmOverrides, getAutoExclusionById]);

  // ===== Migration Assessment (for complexity scores) =====
  const waveMode = score.leaning === 'vsi' ? 'vsi' : 'roks';

  const { complexityScores } = useMigrationAssessment({
    mode: waveMode,
    vms: poweredOnVMs,
    disks,
    networks,
    blockerCount: 0,
    warningCount: 0,
  });

  // ===== Wave Planning =====
  const wavePlanning = useWavePlanning({
    mode: waveMode,
    vms: poweredOnVMs,
    complexityScores,
    disks,
    snapshots,
    tools,
    networks,
  });

  // ===== Timeline from wave data (matches UI) =====
  const waveCount = Math.max(0, wavePlanning.activeWaves.length - 1);
  const waveVmCounts = useMemo(() => wavePlanning.waveResources.map(w => w.vmCount), [wavePlanning.waveResources]);
  const waveNames = useMemo(() => wavePlanning.waveResources.map(w => w.name), [wavePlanning.waveResources]);
  const waveStorageGiB = useMemo(() => wavePlanning.waveResources.map(w => w.storageGiB), [wavePlanning.waveResources]);
  const { phases: timelinePhases, startDate: timelineStartDate } = useTimelineConfig(
    waveCount, waveVmCounts, waveNames, waveStorageGiB
  );

  // ===== Pre-flight check results =====
  const preflightResults = useMemo(
    () => filteredRawData ? runPreFlightChecks(filteredRawData, preflightMode) : [],
    [filteredRawData, preflightMode]
  );

  const handleImportFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImportError(null);
    try {
      const result = await extractSettingsFromFile(file);
      if (!result) {
        setImportError('No settings found in this file. Make sure you select a handover export file.');
        return;
      }
      setImportResult(result);
      setImportModalOpen(true);
    } catch {
      setImportError('Failed to read the file. Please check the file format.');
    }
  }, []);

  const handleImportConfirm = useCallback(() => {
    if (!importResult) return;
    restoreBundledSettings(importResult.settings);
    setImportModalOpen(false);
    setImportResult(null);
    window.location.reload();
  }, [importResult]);

  const handleImportCancel = useCallback(() => {
    setImportModalOpen(false);
    setImportResult(null);
  }, []);

  // PDF section selection
  const [pdfOptions, setPdfOptions] = useState<PDFExportOptions>(DEFAULT_PDF_OPTIONS);
  const [showPdfOptions, setShowPdfOptions] = useState(false);

  const aiAvailable = aiSettings.enabled && isAIProxyConfigured();

  const handlePdfOptionChange = useCallback((key: keyof PDFExportOptions) => {
    setPdfOptions(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleExportPDF = useCallback(async () => {
    if (!rawData) return;
    setAIWarning(null);
    let aiInsights = null;
    if (aiAvailable) {
      const { insights, warning } = await fetchInsightsForExport(rawData, 'PDF');
      aiInsights = insights;
      if (warning) setAIWarning(warning);
    }
    await exportPDF(rawData, { ...pdfOptions, aiInsights }, sanitizeFilename(pdfFilename, '.pdf'));
    markExportComplete();
  }, [rawData, pdfOptions, exportPDF, aiAvailable, markExportComplete, pdfFilename]);

  const handleExportExcel = useCallback(async () => {
    if (!rawData) return;
    setAIWarning(null);
    let aiInsights = null;
    if (aiAvailable) {
      const { insights, warning } = await fetchInsightsForExport(rawData, 'Excel');
      aiInsights = insights;
      if (warning) setAIWarning(warning);
    }
    exportExcel(rawData, sanitizeFilename(excelFilename, '.xlsx'), aiInsights);
    markExportComplete();
  }, [rawData, exportExcel, aiAvailable, markExportComplete, excelFilename]);

  const handleExportDocx = useCallback(async () => {
    if (!rawData) return;
    setAIWarning(null);
    let aiInsights = null;
    if (aiAvailable) {
      const { insights, warning } = await fetchInsightsForExport(rawData, 'DOCX');
      aiInsights = insights;
      if (warning) setAIWarning(warning);
    }

    // Gather all user inputs from localStorage
    const platformSelection = getPlatformSelectionExport(rawData);
    const riskAssessment = getRiskAssessmentExport(rawData);
    const vpcDesign = getVPCDesignExport(rawData);
    const targetAssignments = getTargetAssignmentsExport(rawData);
    const workloadClassification = getWorkloadClassificationExport(rawData);
    const sourceEnvironment = getSourceEnvironmentExport(rawData);

    const roksBOM = getCachedBOM('roks');
    const vsiBOM = getCachedBOM('vsi');

    await exportDocx(rawData, {
      aiInsights,
      wavePlanningPreference: getWavePlanningPreference(),
      platformSelection,
      riskAssessment,
      timelinePhases: timelinePhases.length > 0 ? timelinePhases : null,
      timelineStartDate,
      vpcDesign,
      includeAppendices,
      targetAssignments,
      workloadClassification,
      sourceEnvironment,
      filteredRawData,
      roksCostEstimate: roksBOM?.estimate ?? null,
      vsiCostEstimate: vsiBOM?.estimate ?? null,
    }, sanitizeFilename(docxFilename, '.docx'));
    markExportComplete();
  }, [rawData, filteredRawData, exportDocx, aiAvailable, markExportComplete, docxFilename, includeAppendices, timelinePhases, timelineStartDate]);

  const handleExportPptx = useCallback(async () => {
    if (!rawData) return;
    const platformSelection = Object.keys(answers).length > 0 ? { score, answers } : null;
    const roksBOMPptx = getCachedBOM('roks');
    const vsiBOMPptx = getCachedBOM('vsi');
    await exportPptx(rawData, {
      platformSelection,
      wavePlanningPreference: getWavePlanningPreference(),
      filteredRawData,
      roksCostEstimate: roksBOMPptx?.estimate ?? null,
      vsiCostEstimate: vsiBOMPptx?.estimate ?? null,
      timelinePhases: timelinePhases.length > 0 ? timelinePhases : null,
      timelineStartDate,
    }, sanitizeFilename(pptxFilename, '.pptx'));
    markExportComplete();
  }, [rawData, filteredRawData, exportPptx, markExportComplete, answers, score, pptxFilename, timelinePhases, timelineStartDate]);

  const handleExportHandover = useCallback(async () => {
    if (!originalFileBuffer || !originalFileName) return;
    await downloadHandoverFile(originalFileBuffer, originalFileName, sanitizeFilename(handoverFilename, '.xlsx'));
    markExportComplete();
  }, [originalFileBuffer, originalFileName, markExportComplete, handoverFilename]);

  // ===== Migration Export Handlers =====

  const handleExportPreFlight = useCallback(() => {
    if (preflightResults.length === 0) return;
    exportPreFlightExcel(preflightResults, preflightMode, sanitizeFilename(preflightFilename, '.xlsx'));
    markExportComplete();
  }, [preflightResults, preflightMode, markExportComplete, preflightFilename]);

  const handleExportWaves = useCallback(() => {
    const waves = wavePlanning.activeWaves;
    if (!waves || waves.length === 0) return;
    downloadWavePlanningExcel(
      waves,
      wavePlanning.wavePlanningMode,
      wavePlanning.wavePlanningMode === 'network' ? wavePlanning.networkGroupBy : undefined,
      sanitizeFilename(wavesFilename, '.xlsx'),
    );
    markExportComplete();
  }, [wavePlanning, markExportComplete, wavesFilename]);

  const handleExportVSIBOM = useCallback(async () => {
    const cached = getCachedBOM('vsi');
    if (!cached) return;
    await downloadVSIBOMExcel(
      cached.vmDetails ?? [],
      cached.estimate,
      'Default VPC',
      cached.region,
      cached.discountType,
      sanitizeFilename(vsiBomFilename, '.xlsx'),
    );
    markExportComplete();
  }, [markExportComplete, vsiBomFilename]);

  const handleExportROKSBOM = useCallback(async () => {
    const cached = getCachedBOM('roks');
    if (!cached) return;
    await downloadROKSBOMExcel(
      cached.estimate,
      cached.roksNodeDetails ?? [],
      'ROKS Cluster',
      cached.region,
      cached.discountType,
      sanitizeFilename(roksBomFilename, '.xlsx'),
    );
    markExportComplete();
  }, [markExportComplete, roksBomFilename]);

  const handleExportMTVYAML = useCallback(async () => {
    const waves = wavePlanning.activeWaves;
    if (!waves || waves.length === 0 || !rawData) return;
    setMtvExporting(true);
    try {
      const generator = new MTVYAMLGenerator(DEFAULT_MTV_OPTIONS);
      const waveData = waves.map(w => ({
        name: w.name,
        vms: poweredOnVMs.filter(vm => w.vms.some(wv => wv.vmName === vm.vmName)),
      }));
      const blob = await generator.generateBundle(
        waveData,
        rawData.vNetwork,
        rawData.vDatastore,
      );
      downloadBlob(blob, sanitizeFilename(mtvYamlFilename, '.zip'));
      markExportComplete();
    } catch (error) {
      logger.error('MTV YAML export failed', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setMtvExporting(false);
    }
  }, [wavePlanning.activeWaves, rawData, poweredOnVMs, markExportComplete, mtvYamlFilename]);

  const handleExportDiagnostics = useCallback(() => {
    const allVms = rawData?.vInfo ?? [];
    let excludedCount = 0;
    for (const vm of allVms) {
      const vmId = getVMIdentifier(vm);
      const autoResult = getAutoExclusionById(vmId);
      if (vmOverrides.isEffectivelyExcluded(vmId, autoResult.isAutoExcluded)) {
        excludedCount++;
      }
    }

    const loadedSheets: string[] = [];
    if (rawData) {
      const sheetKeys = ['vInfo', 'vCPU', 'vMemory', 'vDisk', 'vPartition', 'vNetwork', 'vCD', 'vSnapshot', 'vTools', 'vCluster', 'vHost', 'vDatastore', 'vResourcePool', 'vLicense', 'vHealth', 'vSource'] as const;
      for (const key of sheetKeys) {
        if ((rawData[key]?.length ?? 0) > 0) {
          loadedSheets.push(key);
        }
      }
    }

    const bundle = buildDiagnosticBundle({
      vmCount: allVms.length,
      excludedVMCount: excludedCount,
      loadedSheets,
    });
    downloadDiagnosticBundle(bundle, sanitizeFilename(diagnosticsFilename, '.json'));
  }, [rawData, vmOverrides, getAutoExclusionById, diagnosticsFilename]);

  if (!rawData) return <Navigate to={ROUTES.home} replace />;

  const totalVMs = vms.length;
  const hasAnyPdfSelected = Object.values(pdfOptions).some(v => v);
  const isAnyExporting = isPDFExporting || isExcelExporting || isDocxExporting || isPptxExporting || mtvExporting;
  const anyError = pdfError || excelError || docxError || pptxError;
  const hasVSIBOM = hasCachedBOM('vsi');
  const hasROKSBOM = hasCachedBOM('roks');
  const hasWaves = wavePlanning.activeWaves.length > 0;

  return (
    <div className="export-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="export-page__title">Export &amp; Reports</h1>
          <p className="export-page__subtitle">
            Generate reports and deliverables for stakeholder review and migration planning.
          </p>
        </Column>

        {/* Summary Tile */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="export-page__summary-tile">
            <h3 className="export-page__summary-title">Data Summary</h3>
            <div className="export-page__summary-stats">
              <div className="export-page__summary-stat">
                <span className="export-page__summary-label">VMs in Scope</span>
                <span className="export-page__summary-value">{formatNumber(totalVMs)}</span>
              </div>
              <div className="export-page__summary-stat">
                <span className="export-page__summary-label">Auto-Excluded</span>
                <span className="export-page__summary-value">{formatNumber(autoExcludedCount)}</span>
              </div>
            </div>
            {aiAvailable && (
              <Tag type="green" size="sm" className="export-page__ai-tag">
                AI Insights Enabled
              </Tag>
            )}
            {!aiAvailable && aiSettings.enabled && (
              <Tag type="gray" size="sm" className="export-page__ai-tag">
                AI Proxy Unavailable
              </Tag>
            )}
          </Tile>
        </Column>

        <Column lg={8} md={4} sm={4}>
          <Tile className="export-page__summary-tile">
            <h3 className="export-page__summary-title">About Reports</h3>
            <p className="export-page__summary-description">
              The <strong>PDF</strong> covers infrastructure discovery — a snapshot of your current VMware environment.
              The <strong>Word document</strong> is the full migration assessment report with sizing, costs, risks, and recommendations.
              {aiAvailable && ' AI-powered insights from watsonx.ai are included automatically in both.'}
            </p>
          </Tile>
        </Column>

        {/* ===== Section 1: Reports ===== */}
        <Column lg={16} md={8} sm={4}>
          <h2 className="export-page__section-title">Reports</h2>
        </Column>

        {/* PDF Report */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="export-page__card">
            <div className="export-page__card-header">
              <DocumentPdf size={24} className="export-page__card-icon" />
              <div>
                <h3 className="export-page__card-title">PDF Report</h3>
                <p className="export-page__card-description">
                  Infrastructure discovery report with charts covering compute, storage, network, clusters, hosts, and resource pools. Best for summarizing the current VMware environment.
                </p>
              </div>
            </div>

            <Button
              kind="ghost"
              size="sm"
              onClick={() => setShowPdfOptions(!showPdfOptions)}
              className="export-page__card-toggle"
            >
              {showPdfOptions ? 'Hide sections' : 'Select sections'}
            </Button>

            {showPdfOptions && (
              <div className="export-page__card-options">
                <Checkbox id="exp-dashboard" labelText="Dashboard Overview" checked={!!pdfOptions.includeDashboard} onChange={() => handlePdfOptionChange('includeDashboard')} />
                <Checkbox id="exp-compute" labelText="Compute Analysis" checked={!!pdfOptions.includeCompute} onChange={() => handlePdfOptionChange('includeCompute')} />
                <Checkbox id="exp-storage" labelText="Storage Analysis" checked={!!pdfOptions.includeStorage} onChange={() => handlePdfOptionChange('includeStorage')} />
                <Checkbox id="exp-network" labelText="Network Analysis" checked={!!pdfOptions.includeNetwork} onChange={() => handlePdfOptionChange('includeNetwork')} />
                <Checkbox id="exp-clusters" labelText="Clusters Analysis" checked={!!pdfOptions.includeClusters} onChange={() => handlePdfOptionChange('includeClusters')} />
                <Checkbox id="exp-hosts" labelText="Hosts Analysis" checked={!!pdfOptions.includeHosts} onChange={() => handlePdfOptionChange('includeHosts')} />
                <Checkbox id="exp-resourcepools" labelText="Resource Pools" checked={!!pdfOptions.includeResourcePools} onChange={() => handlePdfOptionChange('includeResourcePools')} />
              </div>
            )}

            <TextInput
              id="pdf-filename"
              labelText="Filename"
              size="sm"
              value={pdfFilename}
              onChange={(e) => setPdfFilename(e.target.value)}
              className="export-page__card-filename"
            />
            <Button
              kind="primary"
              size="md"
              renderIcon={DocumentPdf}
              onClick={handleExportPDF}
              disabled={isPDFExporting || !hasAnyPdfSelected}
              className="export-page__card-action"
            >
              {isPDFExporting ? 'Generating...' : 'Export PDF'}
            </Button>
          </Tile>
        </Column>

        {/* Excel Workbook */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="export-page__card">
            <div className="export-page__card-header">
              <DataTable size={24} className="export-page__card-icon" />
              <div>
                <h3 className="export-page__card-title">Excel Workbook</h3>
                <p className="export-page__card-description">
                  Raw VM data export with multiple sheets for detailed analysis and filtering. Includes all RVTools data plus AI insights when available.
                </p>
              </div>
            </div>
            <TextInput
              id="excel-filename"
              labelText="Filename"
              size="sm"
              value={excelFilename}
              onChange={(e) => setExcelFilename(e.target.value)}
              className="export-page__card-filename"
            />
            <Button
              kind="primary"
              size="md"
              renderIcon={DataTable}
              onClick={handleExportExcel}
              disabled={isExcelExporting}
              className="export-page__card-action"
            >
              {isExcelExporting ? 'Generating...' : 'Export Excel'}
            </Button>
          </Tile>
        </Column>

        {/* DOCX Report */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="export-page__card">
            <div className="export-page__card-header">
              <Document size={24} className="export-page__card-icon" />
              <div>
                <h3 className="export-page__card-title">Word Document</h3>
                <p className="export-page__card-description">
                  Full migration assessment report including executive summary, readiness analysis, platform selection, risk assessment, migration timeline, ROKS/VSI sizing, cost estimation, VPC network design, and next steps. Best for client deliverables and proposals.
                </p>
              </div>
            </div>
            <Toggle
              id="docx-appendices"
              size="sm"
              labelText="Include detailed appendices"
              labelA="Off"
              labelB="On"
              toggled={includeAppendices}
              onToggle={(checked: boolean) => setIncludeAppendices(checked)}
              className="export-page__card-toggle"
            />
            <TextInput
              id="docx-filename"
              labelText="Filename"
              size="sm"
              value={docxFilename}
              onChange={(e) => setDocxFilename(e.target.value)}
              className="export-page__card-filename"
            />
            <Button
              kind="primary"
              size="md"
              renderIcon={Document}
              onClick={handleExportDocx}
              disabled={isDocxExporting}
              className="export-page__card-action"
            >
              {isDocxExporting ? 'Generating...' : 'Export DOCX'}
            </Button>
          </Tile>
        </Column>

        {/* PPTX Presentation */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="export-page__card">
            <div className="export-page__card-header">
              <PresentationFile size={24} className="export-page__card-icon" />
              <div>
                <h3 className="export-page__card-title">PowerPoint Deck</h3>
                <p className="export-page__card-description">
                  Summary presentation with key findings — readiness charts, platform recommendation, cost estimates, and next steps. Ideal for client meetings and stakeholder briefings.
                </p>
              </div>
            </div>
            <TextInput
              id="pptx-filename"
              labelText="Filename"
              size="sm"
              value={pptxFilename}
              onChange={(e) => setPptxFilename(e.target.value)}
              className="export-page__card-filename"
            />
            <Button
              kind="primary"
              size="md"
              renderIcon={PresentationFile}
              onClick={handleExportPptx}
              disabled={isPptxExporting}
              className="export-page__card-action"
            >
              {isPptxExporting ? 'Generating...' : 'Export PPTX'}
            </Button>
          </Tile>
        </Column>

        {/* ===== Section 2: Migration Exports ===== */}
        <Column lg={16} md={8} sm={4}>
          <h2 className="export-page__section-title">Migration Exports</h2>
        </Column>

        {/* VSI BOM */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="export-page__card">
            <div className="export-page__card-header">
              <Report size={24} className="export-page__card-icon" />
              <div>
                <h3 className="export-page__card-title">VSI Bill of Materials</h3>
                <p className="export-page__card-description">
                  Detailed BOM with per-VM VSI profile assignments, storage volumes, and cost breakdown for VPC Virtual Server deployment.
                </p>
              </div>
            </div>
            {!hasVSIBOM && (
              <p className="export-page__card-helper">Complete cost estimation on the VSI Migration page to enable.</p>
            )}
            <TextInput
              id="vsi-bom-filename"
              labelText="Filename"
              size="sm"
              value={vsiBomFilename}
              onChange={(e) => setVsiBomFilename(e.target.value)}
              disabled={!hasVSIBOM}
              className="export-page__card-filename"
            />
            <Button
              kind="primary"
              size="md"
              renderIcon={Report}
              onClick={handleExportVSIBOM}
              disabled={!hasVSIBOM}
              className="export-page__card-action"
            >
              Export VSI BOM
            </Button>
          </Tile>
        </Column>

        {/* ROKS BOM */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="export-page__card">
            <div className="export-page__card-header">
              <Report size={24} className="export-page__card-icon" />
              <div>
                <h3 className="export-page__card-title">ROKS Bill of Materials</h3>
                <p className="export-page__card-description">
                  Detailed BOM with bare metal node specifications, ODF storage configuration, and cost breakdown for OpenShift deployment.
                </p>
              </div>
            </div>
            {!hasROKSBOM && (
              <p className="export-page__card-helper">Complete cost estimation on the ROKS Migration page to enable.</p>
            )}
            <TextInput
              id="roks-bom-filename"
              labelText="Filename"
              size="sm"
              value={roksBomFilename}
              onChange={(e) => setRoksBomFilename(e.target.value)}
              disabled={!hasROKSBOM}
              className="export-page__card-filename"
            />
            <Button
              kind="primary"
              size="md"
              renderIcon={Report}
              onClick={handleExportROKSBOM}
              disabled={!hasROKSBOM}
              className="export-page__card-action"
            >
              Export ROKS BOM
            </Button>
          </Tile>
        </Column>

        {/* Pre-Flight Report */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="export-page__card">
            <div className="export-page__card-header">
              <CheckmarkOutline size={24} className="export-page__card-icon" />
              <div>
                <h3 className="export-page__card-title">Pre-Flight Report</h3>
                <p className="export-page__card-description">
                  VM-by-VM readiness checks covering tools, storage, hardware, configuration, and OS compatibility for the selected migration target.
                </p>
              </div>
            </div>
            <div className="export-page__card-switcher">
              <ContentSwitcher
                size="sm"
                onChange={(e) => {
                  const newMode = e.name as CheckMode;
                  setPreflightMode(newMode);
                  setPreflightFilename(getDefaultFilename('preflight', { ...filenameCtx, mode: newMode }));
                }}
                selectedIndex={preflightMode === 'roks' ? 0 : 1}
              >
                <Switch name="roks" text="ROKS" />
                <Switch name="vsi" text="VSI" />
              </ContentSwitcher>
            </div>
            <TextInput
              id="preflight-filename"
              labelText="Filename"
              size="sm"
              value={preflightFilename}
              onChange={(e) => setPreflightFilename(e.target.value)}
              className="export-page__card-filename"
            />
            <Button
              kind="primary"
              size="md"
              renderIcon={CheckmarkOutline}
              onClick={handleExportPreFlight}
              disabled={preflightResults.length === 0}
              className="export-page__card-action"
            >
              Export Pre-Flight Report
            </Button>
          </Tile>
        </Column>

        {/* Wave Planning */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="export-page__card">
            <div className="export-page__card-header">
              <ChartVennDiagram size={24} className="export-page__card-icon" />
              <div>
                <h3 className="export-page__card-title">Wave Planning Excel</h3>
                <p className="export-page__card-description">
                  Migration wave assignments with VM details, complexity scores, resource totals, and blocker status per wave.
                </p>
              </div>
            </div>
            {!hasWaves && (
              <p className="export-page__card-helper">No VMs available for wave planning.</p>
            )}
            <TextInput
              id="waves-filename"
              labelText="Filename"
              size="sm"
              value={wavesFilename}
              onChange={(e) => setWavesFilename(e.target.value)}
              disabled={!hasWaves}
              className="export-page__card-filename"
            />
            <Button
              kind="primary"
              size="md"
              renderIcon={ChartVennDiagram}
              onClick={handleExportWaves}
              disabled={!hasWaves}
              className="export-page__card-action"
            >
              Export Waves
            </Button>
          </Tile>
        </Column>

        {/* MTV YAML */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="export-page__card">
            <div className="export-page__card-header">
              <Kubernetes size={24} className="export-page__card-icon" />
              <div>
                <h3 className="export-page__card-title">MTV YAML Bundle</h3>
                <p className="export-page__card-description">
                  Migration Toolkit for Virtualization YAML manifests — migration plans, network maps, and storage maps for OpenShift deployment.
                </p>
              </div>
            </div>
            {!hasWaves && (
              <p className="export-page__card-helper">No VMs available for MTV export.</p>
            )}
            <TextInput
              id="mtv-yaml-filename"
              labelText="Filename"
              size="sm"
              value={mtvYamlFilename}
              onChange={(e) => setMtvYamlFilename(e.target.value)}
              disabled={!hasWaves}
              className="export-page__card-filename"
            />
            <Button
              kind="primary"
              size="md"
              renderIcon={Kubernetes}
              onClick={handleExportMTVYAML}
              disabled={!hasWaves || mtvExporting}
              className="export-page__card-action"
            >
              {mtvExporting ? 'Generating...' : 'Export MTV YAML'}
            </Button>
          </Tile>
        </Column>

        {/* RackWare CSV */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="export-page__card">
            <div className="export-page__card-header">
              <Deploy size={24} className="export-page__card-icon" />
              <div>
                <h3 className="export-page__card-title">RackWare CSV</h3>
                <p className="export-page__card-description">
                  RackWare RMM import file for automated VM migration to IBM Cloud VPC. Includes wave-based grouping and VM metadata.
                </p>
              </div>
            </div>
            {!hasWaves && (
              <p className="export-page__card-helper">No VMs available for RackWare export.</p>
            )}
            <Button
              kind="primary"
              size="md"
              renderIcon={Deploy}
              onClick={() => setRackwareModalOpen(true)}
              disabled={!hasWaves}
              className="export-page__card-action"
            >
              Export RackWare CSV
            </Button>
          </Tile>
        </Column>

        {/* ===== Section 3: Data & Settings ===== */}
        <Column lg={16} md={8} sm={4}>
          <h2 className="export-page__section-title">Data &amp; Settings</h2>
        </Column>

        {/* Handover File */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="export-page__card">
            <div className="export-page__card-header">
              <DataShare size={24} className="export-page__card-icon" />
              <div>
                <h3 className="export-page__card-title">Handover File</h3>
                <p className="export-page__card-description">
                  Download a copy of your uploaded RVTools file bundled with all your current analysis settings — VM overrides, platform selection, target assignments, risk assessments, timeline config, and more. The recipient uploads this single file and is prompted to restore all bundled settings automatically.
                </p>
              </div>
            </div>
            {!originalFileBuffer && (
              <p className="export-page__card-helper">Upload an RVTools file first to enable handover export.</p>
            )}
            <TextInput
              id="handover-filename"
              labelText="Filename"
              size="sm"
              value={handoverFilename}
              onChange={(e) => setHandoverFilename(e.target.value)}
              disabled={!originalFileBuffer}
              className="export-page__card-filename"
            />
            <Button
              kind="primary"
              size="md"
              renderIcon={DataShare}
              onClick={handleExportHandover}
              disabled={!originalFileBuffer}
              className="export-page__card-action"
            >
              Export Handover File
            </Button>
          </Tile>
        </Column>

        {/* Import Settings from Handover */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="export-page__card">
            <div className="export-page__card-header">
              <Upload size={24} className="export-page__card-icon" />
              <div>
                <h3 className="export-page__card-title">Import Settings</h3>
                <p className="export-page__card-description">
                  Restore settings from a previous handover export file. Upload a fresh RVTools file as your data source, then import settings from an older handover file to carry forward your VM overrides, platform selection, target assignments, and other configuration.
                </p>
              </div>
            </div>
            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleImportFileSelect}
            />
            {importError && (
              <InlineNotification
                kind="error"
                title="Import failed"
                subtitle={importError}
                lowContrast
                onCloseButtonClick={() => setImportError(null)}
                style={{ marginBottom: '0.5rem' }}
              />
            )}
            <Button
              kind="primary"
              size="md"
              renderIcon={Upload}
              onClick={() => importFileRef.current?.click()}
              className="export-page__card-action"
            >
              Import from Handover File
            </Button>
          </Tile>
        </Column>

        {/* Diagnostics */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="export-page__card">
            <div className="export-page__card-header">
              <Debug size={24} className="export-page__card-icon" />
              <div>
                <h3 className="export-page__card-title">Diagnostics</h3>
                <p className="export-page__card-description">
                  Download a diagnostic bundle containing application logs, environment info, and an anonymized state snapshot for troubleshooting.
                </p>
              </div>
            </div>
            <TextInput
              id="diagnostics-filename"
              labelText="Filename"
              size="sm"
              value={diagnosticsFilename}
              onChange={(e) => setDiagnosticsFilename(e.target.value)}
              className="export-page__card-filename"
            />
            <Button
              kind="primary"
              size="md"
              renderIcon={Debug}
              onClick={handleExportDiagnostics}
              className="export-page__card-action"
            >
              Export Diagnostics
            </Button>
          </Tile>
        </Column>

        {/* Status */}
        {isAnyExporting && (
          <Column lg={16} md={8} sm={4}>
            <InlineLoading status="active" description="Generating report..." />
          </Column>
        )}

        {anyError && (
          <Column lg={16} md={8} sm={4}>
            <InlineNotification
              kind="error"
              title="Export failed"
              subtitle={anyError}
              lowContrast
              hideCloseButton
            />
          </Column>
        )}

        {aiWarning && (
          <Column lg={16} md={8} sm={4}>
            <InlineNotification
              kind="warning"
              title="AI Insights"
              subtitle={aiWarning}
              lowContrast
              onCloseButtonClick={() => setAIWarning(null)}
            />
          </Column>
        )}
      </Grid>

      {/* Import Settings Modal */}
      <Modal
        open={importModalOpen}
        modalHeading="Import Settings from Handover File"
        primaryButtonText="Import Settings"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleImportConfirm}
        onRequestClose={handleImportCancel}
        size="sm"
      >
        {importResult && (
          <div>
            {importResult.metadata.sourceFileName && (
              <p style={{ marginBottom: '0.5rem' }}>
                <strong>Source file:</strong> {importResult.metadata.sourceFileName}
              </p>
            )}
            {importResult.metadata.exportDate && (
              <p style={{ marginBottom: '1rem' }}>
                <strong>Exported:</strong>{' '}
                {new Date(importResult.metadata.exportDate).toLocaleString()}
              </p>
            )}
            <p style={{ marginBottom: '0.5rem' }}>
              The following {importResult.settingKeys.length} setting{importResult.settingKeys.length !== 1 ? 's' : ''} will be restored:
            </p>
            <UnorderedList>
              {importResult.settingKeys.map((key) => (
                <ListItem key={key}>
                  {SETTINGS_LABELS[key] ?? key}
                </ListItem>
              ))}
            </UnorderedList>
            <InlineNotification
              kind="warning"
              title="This will overwrite your current settings"
              subtitle="The page will reload after importing."
              lowContrast
              hideCloseButton
              style={{ marginTop: '1rem' }}
            />
          </div>
        )}
      </Modal>

      {/* RackWare Export Modal */}
      <RackwareExportModal
        open={rackwareModalOpen}
        onClose={() => setRackwareModalOpen(false)}
        waves={wavePlanning.activeWaves}
        mode="vsi"
        wavePlanningMode={wavePlanning.wavePlanningMode}
        networkGroupBy={wavePlanning.networkGroupBy}
      />
    </div>
  );
}
