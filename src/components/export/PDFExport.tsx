// PDF Export component with options modal
import { useState } from 'react';
import {
  Button,
  Modal,
  Checkbox,
  InlineLoading,
  InlineNotification,
} from '@carbon/react';
import { DocumentPdf } from '@carbon/icons-react';
import { useData, usePDFExport } from '@/hooks';
import type { PDFExportOptions } from '@/hooks/usePDFExport';
import './PDFExport.scss';

interface ExportOptions {
  includeDashboard: boolean;
  includeCompute: boolean;
  includeStorage: boolean;
  includeNetwork: boolean;
  includeClusters: boolean;
  includeHosts: boolean;
  includeResourcePools: boolean;
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeDashboard: true,
  includeCompute: true,
  includeStorage: true,
  includeNetwork: true,
  includeClusters: true,
  includeHosts: true,
  includeResourcePools: true,
};

interface PDFExportProps {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function PDFExport({ variant = 'primary', size = 'md' }: PDFExportProps) {
  const { rawData } = useData();
  const { isExporting, error, exportPDF } = usePDFExport();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_OPTIONS);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleOptionChange = (key: keyof ExportOptions) => {
    setOptions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSelectAll = () => {
    setOptions({
      includeDashboard: true,
      includeCompute: true,
      includeStorage: true,
      includeNetwork: true,
      includeClusters: true,
      includeHosts: true,
      includeResourcePools: true,
    });
  };

  const handleSelectNone = () => {
    setOptions({
      includeDashboard: false,
      includeCompute: false,
      includeStorage: false,
      includeNetwork: false,
      includeClusters: false,
      includeHosts: false,
      includeResourcePools: false,
    });
  };

  const handleExport = async () => {
    if (!rawData) return;

    try {
      const pdfOptions: PDFExportOptions = {
        includeDashboard: options.includeDashboard,
        includeCompute: options.includeCompute,
        includeStorage: options.includeStorage,
        includeNetwork: options.includeNetwork,
        includeClusters: options.includeClusters,
        includeHosts: options.includeHosts,
        includeResourcePools: options.includeResourcePools,
      };
      await exportPDF(rawData, pdfOptions);
      handleCloseModal();
    } catch {
      // Error is handled by the hook
    }
  };

  const hasAnySelected = Object.values(options).some(v => v);

  if (!rawData) {
    return null;
  }

  return (
    <>
      <Button
        kind={variant}
        size={size}
        renderIcon={DocumentPdf}
        onClick={handleOpenModal}
        disabled={isExporting}
      >
        Export PDF
      </Button>

      <Modal
        open={isModalOpen}
        onRequestClose={handleCloseModal}
        modalHeading="Export PDF Report"
        modalLabel="Report Options"
        primaryButtonText={isExporting ? 'Generating...' : 'Export'}
        secondaryButtonText="Cancel"
        onRequestSubmit={handleExport}
        primaryButtonDisabled={isExporting || !hasAnySelected}
        size="sm"
        selectorPrimaryFocus="#pdf-opt-dashboard"
        aria-describedby="pdf-export-description"
      >
        <div className="pdf-export-modal">
          <p id="pdf-export-description" className="pdf-export-modal__description">
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
              id="pdf-opt-dashboard"
              labelText="Dashboard Overview"
              checked={options.includeDashboard}
              onChange={() => handleOptionChange('includeDashboard')}
            />
            <Checkbox
              id="pdf-opt-compute"
              labelText="Compute Analysis"
              checked={options.includeCompute}
              onChange={() => handleOptionChange('includeCompute')}
            />
            <Checkbox
              id="pdf-opt-storage"
              labelText="Storage Analysis"
              checked={options.includeStorage}
              onChange={() => handleOptionChange('includeStorage')}
            />
            <Checkbox
              id="pdf-opt-network"
              labelText="Network Analysis"
              checked={options.includeNetwork}
              onChange={() => handleOptionChange('includeNetwork')}
            />
            <Checkbox
              id="pdf-opt-clusters"
              labelText="Clusters Analysis"
              checked={options.includeClusters}
              onChange={() => handleOptionChange('includeClusters')}
            />
            <Checkbox
              id="pdf-opt-hosts"
              labelText="Hosts Analysis"
              checked={options.includeHosts}
              onChange={() => handleOptionChange('includeHosts')}
            />
            <Checkbox
              id="pdf-opt-resourcepools"
              labelText="Resource Pools"
              checked={options.includeResourcePools}
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
    </>
  );
}
