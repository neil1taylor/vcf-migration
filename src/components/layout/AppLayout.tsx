// Main application layout
import { useState, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  Content,
  Modal,
  Checkbox,
  Button,
  InlineLoading,
  InlineNotification,
} from '@carbon/react';
import { TopNav } from './TopNav';
import { SideNav } from './SideNav';
import { ChatWidget } from '@/components/ai/ChatWidget';
import { ROUTES } from '@/utils/constants';
import { useData, usePDFExport, useExcelExport, useDocxExport } from '@/hooks';
import type { PDFExportOptions } from '@/hooks/usePDFExport';
import './AppLayout.scss';

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
  const { rawData } = useData();
  const { isExporting, error, exportPDF } = usePDFExport();
  const { exportExcel } = useExcelExport();
  const { exportDocx } = useDocxExport();
  const [isSideNavExpanded] = useState(true);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<PDFExportOptions>(DEFAULT_OPTIONS);

  const handleUploadClick = useCallback(() => {
    navigate(ROUTES.home);
  }, [navigate]);

  const handleExportPDFClick = useCallback(() => {
    setIsExportModalOpen(true);
  }, []);

  const handleExportExcelClick = useCallback(() => {
    if (rawData) {
      exportExcel(rawData);
    }
  }, [rawData, exportExcel]);

  const handleExportDocxClick = useCallback(async () => {
    if (rawData) {
      try {
        await exportDocx(rawData);
      } catch {
        // Error is handled by the hook
      }
    }
  }, [rawData, exportDocx]);

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

    try {
      await exportPDF(rawData, exportOptions);
      setIsExportModalOpen(false);
    } catch {
      // Error is handled by the hook
    }
  }, [rawData, exportOptions, exportPDF]);

  return (
    <div className="app-layout">
      <TopNav
        onUploadClick={handleUploadClick}
        onExportPDFClick={handleExportPDFClick}
        onExportExcelClick={handleExportExcelClick}
        onExportDocxClick={handleExportDocxClick}
      />
      <SideNav isExpanded={isSideNavExpanded} />
      <Content className="app-layout__content">
        <Outlet />
      </Content>

      {/* AI Chat Widget */}
      <ChatWidget />

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
