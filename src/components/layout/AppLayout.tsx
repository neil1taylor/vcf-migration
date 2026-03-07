// Main application layout
import { useState, useCallback, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  Content,
  Modal,
  Checkbox,
  Button,
  InlineLoading,
  InlineNotification,
  UnorderedList,
  ListItem,
} from '@carbon/react';
import { TopNav } from './TopNav';
import { SideNav } from './SideNav';
import { ChatWidget } from '@/components/ai/ChatWidget';
import { WorkflowStepper } from '@/components/common';
import { ROUTES } from '@/utils/constants';
import { useData, usePDFExport, useExcelExport, useDocxExport, useAISettings, usePlatformSelection } from '@/hooks';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { fetchAIInsights } from '@/services/ai/aiInsightsApi';
import { buildInsightsInput } from '@/services/ai/insightsInputBuilder';
import { downloadHandoverFile } from '@/services/export/handoverExporter';
import { extractSettingsFromFile, type ExtractedSettings } from '@/services/settingsExtractor';
import { restoreBundledSettings } from '@/services/settingsRestore';
import { SETTINGS_LABELS } from '@/services/settingsLabels';
import { createLogger } from '@/utils/logger';
import type { PDFExportOptions } from '@/hooks/usePDFExport';
import type { RVToolsData } from '@/types/rvtools';
import type { MigrationInsights } from '@/services/ai/types';
import { getWavePlanningPreference } from '@/services/export/docx/types';
import './AppLayout.scss';

const logger = createLogger('AppLayout');

const AI_INSIGHTS_TIMEOUT_MS = 45000;

/**
 * Fetch AI insights with timeout and logging.
 * Returns { insights, warning } — warning is set if insights could not be fetched.
 */
async function fetchInsightsForExport(
  rawData: RVToolsData,
  exportType: string,
): Promise<{ insights: MigrationInsights | null; warning: string | null }> {
  logger.info(`[${exportType}] Fetching AI insights for export`);
  try {
    const insightsInput = buildInsightsInput(rawData);
    logger.debug(`[${exportType}] InsightsInput built`, {
      totalVMs: insightsInput.totalVMs,
      totalVCPUs: insightsInput.totalVCPUs,
      totalMemoryGiB: insightsInput.totalMemoryGiB,
    });

    const result = await Promise.race([
      fetchAIInsights(insightsInput),
      new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), AI_INSIGHTS_TIMEOUT_MS)
      ),
    ]);

    if (result === 'timeout') {
      logger.warn(`[${exportType}] AI insights timed out after ${AI_INSIGHTS_TIMEOUT_MS / 1000}s`);
      return { insights: null, warning: `AI insights timed out after ${AI_INSIGHTS_TIMEOUT_MS / 1000}s — report generated without AI sections.` };
    }

    if (!result) {
      logger.warn(`[${exportType}] AI insights returned null (proxy may have returned empty/invalid data)`);
      return { insights: null, warning: 'AI insights returned empty data — report generated without AI sections.' };
    }

    logger.info(`[${exportType}] AI insights fetched successfully`, {
      hasExecutiveSummary: !!result.executiveSummary,
      hasRiskAssessment: !!result.riskAssessment,
      recommendationsCount: result.recommendations.length,
      costOptimizationsCount: result.costOptimizations.length,
      hasMigrationStrategy: !!result.migrationStrategy,
    });
    return { insights: result, warning: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[${exportType}] AI insights fetch failed`, error instanceof Error ? error : new Error(message));
    return { insights: null, warning: `AI insights failed: ${message} — report generated without AI sections.` };
  }
}

const DEFAULT_OPTIONS: PDFExportOptions = {
  includeDashboard: true,
  includeCompute: true,
  includeStorage: true,
  includeNetwork: true,
  includeClusters: true,
  includeHosts: true,
  includeResourcePools: true,
};

export function AppLayout() {
  const navigate = useNavigate();
  const { rawData, calculatedCosts, originalFileBuffer, originalFileName } = useData();
  const { isExporting, error, exportPDF } = usePDFExport();
  const { exportExcel } = useExcelExport();
  const { exportDocx } = useDocxExport();
  const { settings: aiSettings } = useAISettings();
  const { score: platformScore, answers: platformAnswers } = usePlatformSelection();
  const [isSideNavExpanded] = useState(true);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<PDFExportOptions>(DEFAULT_OPTIONS);
  const [, setIsDocxExporting] = useState(false);
  const [aiWarning, setAIWarning] = useState<string | null>(null);

  const handleUploadClick = useCallback(() => {
    navigate(ROUTES.home);
  }, [navigate]);

  const handleExportPDFClick = useCallback(() => {
    setIsExportModalOpen(true);
  }, []);

  const handleExportExcelClick = useCallback(async () => {
    if (!rawData) return;
    setAIWarning(null);

    let aiInsights = null;
    if (aiSettings.enabled && isAIProxyConfigured()) {
      const { insights, warning } = await fetchInsightsForExport(rawData, 'Excel');
      aiInsights = insights;
      if (warning) setAIWarning(warning);
    }

    exportExcel(rawData, undefined, aiInsights);
  }, [rawData, exportExcel, aiSettings.enabled]);

  const handleExportDocxClick = useCallback(async () => {
    if (!rawData) return;
    setAIWarning(null);

    setIsDocxExporting(true);
    try {
      let aiInsights = null;
      if (aiSettings.enabled && isAIProxyConfigured()) {
        const { insights, warning } = await fetchInsightsForExport(rawData, 'DOCX');
        aiInsights = insights;
        if (warning) setAIWarning(warning);
      }

      await exportDocx(rawData, {
        aiInsights,
        wavePlanningPreference: getWavePlanningPreference(),
        platformSelection: platformScore.answeredCount > 0 ? { score: platformScore, answers: platformAnswers, roksMonthlyCost: calculatedCosts?.roksMonthlyCost, rovMonthlyCost: calculatedCosts?.rovMonthlyCost, vsiMonthlyCost: calculatedCosts?.vsiMonthlyCost } : null,
      });
    } catch {
      // Error is handled by the hook
    } finally {
      setIsDocxExporting(false);
    }
  }, [rawData, exportDocx, aiSettings.enabled, platformScore, platformAnswers]);

  const handleExportHandoverClick = useCallback(async () => {
    if (!originalFileBuffer || !originalFileName) return;
    await downloadHandoverFile(originalFileBuffer, originalFileName);
  }, [originalFileBuffer, originalFileName]);

  // Import settings from handover file
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<ExtractedSettings | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const handleImportSettingsClick = useCallback(() => {
    importFileRef.current?.click();
  }, []);

  const handleImportFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const result = await extractSettingsFromFile(file);
      if (!result) {
        logger.warn('No settings found in imported file');
        return;
      }
      setImportResult(result);
      setImportModalOpen(true);
    } catch {
      logger.error('Failed to read import file');
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

  const handleCloseExportModal = useCallback(() => {
    setIsExportModalOpen(false);
  }, []);

  const handleOptionChange = useCallback((key: keyof PDFExportOptions) => {
    setExportOptions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const handleSelectAll = useCallback(() => {
    setExportOptions({
      includeDashboard: true,
      includeCompute: true,
      includeStorage: true,
      includeNetwork: true,
      includeClusters: true,
      includeHosts: true,
      includeResourcePools: true,
    });
  }, []);

  const handleSelectNone = useCallback(() => {
    setExportOptions({
      includeDashboard: false,
      includeCompute: false,
      includeStorage: false,
      includeNetwork: false,
      includeClusters: false,
      includeHosts: false,
      includeResourcePools: false,
    });
  }, []);

  const hasAnySelected = Object.values(exportOptions).some(v => v);

  const handleExport = useCallback(async () => {
    if (!rawData) return;
    setAIWarning(null);

    try {
      let aiInsights = null;
      if (aiSettings.enabled && isAIProxyConfigured()) {
        const { insights, warning } = await fetchInsightsForExport(rawData, 'PDF');
        aiInsights = insights;
        if (warning) setAIWarning(warning);
      }

      await exportPDF(rawData, { ...exportOptions, aiInsights });
      setIsExportModalOpen(false);
    } catch {
      // Error is handled by the hook
    }
  }, [rawData, exportOptions, exportPDF, aiSettings.enabled]);

  return (
    <div className="app-layout">
      <TopNav
        onUploadClick={handleUploadClick}
        onExportPDFClick={handleExportPDFClick}
        onExportExcelClick={handleExportExcelClick}
        onExportDocxClick={handleExportDocxClick}
        onExportHandoverClick={originalFileBuffer ? handleExportHandoverClick : undefined}
        onImportSettingsClick={handleImportSettingsClick}
      />
      <SideNav isExpanded={isSideNavExpanded} />
      <Content id="main-content" className="app-layout__content">
        <WorkflowStepper />
        <Outlet />
      </Content>

      {/* AI insights warning notification */}
      {aiWarning && (
        <InlineNotification
          kind="warning"
          title="AI Insights"
          subtitle={aiWarning}
          lowContrast
          onCloseButtonClick={() => setAIWarning(null)}
          className="app-layout__ai-warning"
        />
      )}

      {/* AI Chat Widget */}
      <ChatWidget />

      {/* Hidden file input for import settings */}
      <input
        ref={importFileRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleImportFileSelect}
      />

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

      {/* PDF Export Modal */}
      <Modal
        open={isExportModalOpen}
        onRequestClose={handleCloseExportModal}
        modalHeading="Export PDF Report"
        modalLabel="Report Options"
        primaryButtonText={isExporting ? 'Generating...' : 'Export'}
        secondaryButtonText="Cancel"
        onRequestSubmit={handleExport}
        primaryButtonDisabled={isExporting || !hasAnySelected}
        size="sm"
        selectorPrimaryFocus="#opt-dashboard"
        aria-describedby="export-modal-description"
      >
        <div className="pdf-export-modal">
          <p id="export-modal-description" className="pdf-export-modal__description">
            Select the sections to include in your PDF report.
          </p>

          <div className="pdf-export-modal__actions">
            <Button kind="ghost" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button kind="ghost" size="sm" onClick={handleSelectNone}>
              Select None
            </Button>
          </div>

          <div className="pdf-export-modal__options">
            <Checkbox
              id="opt-dashboard"
              labelText="Dashboard Overview"
              checked={exportOptions.includeDashboard}
              onChange={() => handleOptionChange('includeDashboard')}
            />
            <Checkbox
              id="opt-compute"
              labelText="Compute Analysis"
              checked={exportOptions.includeCompute}
              onChange={() => handleOptionChange('includeCompute')}
            />
            <Checkbox
              id="opt-storage"
              labelText="Storage Analysis"
              checked={exportOptions.includeStorage}
              onChange={() => handleOptionChange('includeStorage')}
            />
            <Checkbox
              id="opt-network"
              labelText="Network Analysis"
              checked={exportOptions.includeNetwork}
              onChange={() => handleOptionChange('includeNetwork')}
            />
            <Checkbox
              id="opt-clusters"
              labelText="Clusters Analysis"
              checked={exportOptions.includeClusters}
              onChange={() => handleOptionChange('includeClusters')}
            />
            <Checkbox
              id="opt-hosts"
              labelText="Hosts Analysis"
              checked={exportOptions.includeHosts}
              onChange={() => handleOptionChange('includeHosts')}
            />
            <Checkbox
              id="opt-resourcepools"
              labelText="Resource Pools"
              checked={exportOptions.includeResourcePools}
              onChange={() => handleOptionChange('includeResourcePools')}
            />
          </div>

          {isExporting && (
            <InlineLoading
              status="active"
              description="Generating PDF report..."
            />
          )}

          {error && (
            <InlineNotification
              kind="error"
              title="Export failed"
              subtitle={error}
              lowContrast
              hideCloseButton
            />
          )}
        </div>
      </Modal>
    </div>
  );
}
