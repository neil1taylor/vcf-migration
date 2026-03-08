// Export & Reports page — consolidates all export options into a visible workflow step
import { useState, useCallback, useRef } from 'react';
import {
  Grid,
  Column,
  Tile,
  ClickableTile,
  Tag,
  Button,
  Checkbox,
  InlineLoading,
  InlineNotification,
  Modal,
  UnorderedList,
  ListItem,
} from '@carbon/react';
import {
  DocumentPdf,
  DataTable,
  Document,
  PresentationFile,
  Report,
  DataShare,
  Upload,
} from '@carbon/icons-react';
import { Navigate } from 'react-router-dom';
import { useData, usePDFExport, useExcelExport, useDocxExport, usePptxExport, useAISettings, useVMs, useAutoExclusion, usePlatformSelection } from '@/hooks';
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
import type { PDFExportOptions } from '@/hooks/usePDFExport';
import type { RVToolsData } from '@/types/rvtools';
import type { MigrationInsights } from '@/services/ai/types';
import { getWavePlanningPreference } from '@/services/export/docx/types';
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

export function ExportPage() {
  const { rawData, originalFileBuffer, originalFileName } = useData();
  const vms = useVMs();
  const { autoExcludedCount } = useAutoExclusion();
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
    await exportPDF(rawData, { ...pdfOptions, aiInsights });
    markExportComplete();
  }, [rawData, pdfOptions, exportPDF, aiAvailable, markExportComplete]);

  const handleExportExcel = useCallback(async () => {
    if (!rawData) return;
    setAIWarning(null);
    let aiInsights = null;
    if (aiAvailable) {
      const { insights, warning } = await fetchInsightsForExport(rawData, 'Excel');
      aiInsights = insights;
      if (warning) setAIWarning(warning);
    }
    exportExcel(rawData, undefined, aiInsights);
    markExportComplete();
  }, [rawData, exportExcel, aiAvailable, markExportComplete]);

  const handleExportDocx = useCallback(async () => {
    if (!rawData) return;
    setAIWarning(null);
    let aiInsights = null;
    if (aiAvailable) {
      const { insights, warning } = await fetchInsightsForExport(rawData, 'DOCX');
      aiInsights = insights;
      if (warning) setAIWarning(warning);
    }
    await exportDocx(rawData, { aiInsights, wavePlanningPreference: getWavePlanningPreference() });
    markExportComplete();
  }, [rawData, exportDocx, aiAvailable, markExportComplete]);

  const handleExportPptx = useCallback(async () => {
    if (!rawData) return;
    const platformSelection = Object.keys(answers).length > 0 ? { score, answers } : null;
    await exportPptx(rawData, { platformSelection, wavePlanningPreference: getWavePlanningPreference() });
    markExportComplete();
  }, [rawData, exportPptx, markExportComplete, answers, score]);

  const handleExportHandover = useCallback(async () => {
    if (!originalFileBuffer || !originalFileName) return;
    await downloadHandoverFile(originalFileBuffer, originalFileName);
    markExportComplete();
  }, [originalFileBuffer, originalFileName, markExportComplete]);

  if (!rawData) return <Navigate to={ROUTES.home} replace />;

  const totalVMs = vms.length;
  const hasAnyPdfSelected = Object.values(pdfOptions).some(v => v);
  const isAnyExporting = isPDFExporting || isExcelExporting || isDocxExporting || isPptxExporting;
  const anyError = pdfError || excelError || docxError || pptxError;

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
            <p className="export-page__summary-description">
              For BOM (Bill of Materials) exports and MTV YAML, visit the ROKS or VSI Migration pages
              where sizing context is available.
            </p>
          </Tile>
        </Column>

        {/* Export Format Cards */}
        <Column lg={16} md={8} sm={4}>
          <h2 className="export-page__section-title">Export Formats</h2>
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

        {/* BOM / YAML Info */}
        <Column lg={8} md={4} sm={4}>
          <ClickableTile
            className="export-page__card export-page__card--link"
            onClick={() => window.location.assign(ROUTES.roksMigration)}
          >
            <div className="export-page__card-header">
              <Report size={24} className="export-page__card-icon" />
              <div>
                <h3 className="export-page__card-title">BOM &amp; MTV YAML</h3>
                <p className="export-page__card-description">
                  Bill of Materials and MTV migration YAML exports are available on the ROKS and VSI Migration pages
                  where sizing context is provided.
                </p>
              </div>
            </div>
          </ClickableTile>
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
    </div>
  );
}
