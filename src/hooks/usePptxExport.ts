// Hook for PPTX presentation export functionality
import { useState, useCallback } from 'react';
import { downloadPptx, type PptxExportOptions } from '@/services/export/pptxGenerator';
import type { RVToolsData } from '@/types/rvtools';

export interface UsePptxExportReturn {
  isExporting: boolean;
  error: string | null;
  exportPptx: (data: RVToolsData, options?: PptxExportOptions, filename?: string) => Promise<void>;
}

export function usePptxExport(): UsePptxExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportPptx = useCallback(
    async (data: RVToolsData, options?: PptxExportOptions, filename?: string) => {
      setIsExporting(true);
      setError(null);

      try {
        await downloadPptx(data, options, filename);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate PPTX presentation';
        setError(message);
        throw err;
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  return {
    isExporting,
    error,
    exportPptx,
  };
}
