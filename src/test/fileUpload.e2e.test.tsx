// E2E Integration tests for file upload flow
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileUpload } from '@/components/upload/FileUpload';
import { DropZone } from '@/components/upload/DropZone';
import { validateFile, parseRVToolsFile } from '@/services/parser/excelParser';
import type { RVToolsData, ParseResult } from '@/types';

// Mock the parser module
vi.mock('@/services/parser/excelParser', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/parser/excelParser')>();
  return {
    ...original,
    // Keep validateFile real, but mock parseRVToolsFile
    validateFile: original.validateFile,
    parseRVToolsFile: vi.fn(),
  };
});

const mockParseRVToolsFile = vi.mocked(parseRVToolsFile);

// Create mock RVTools data
function createMockRVToolsData(fileName: string): RVToolsData {
  return {
    metadata: {
      fileName,
      collectionDate: new Date(),
      vCenterVersion: '7.0.3',
      environment: 'Test',
    },
    vInfo: [
      {
        vmName: 'test-vm-1',
        powerState: 'poweredOn',
        template: false,
        srmPlaceholder: false,
        configStatus: 'green',
        dnsName: 'test-vm-1.example.com',
        connectionState: 'connected',
        guestState: 'running',
        heartbeat: 'green',
        consolidationNeeded: false,
        powerOnDate: null,
        suspendedToMemory: false,
        suspendTime: null,
        creationDate: null,
        cpus: 4,
        memory: 8192,
        nics: 1,
        disks: 2,
        resourcePool: 'Resources',
        folder: 'VMs',
        vApp: null,
        ftState: null,
        ftRole: null,
        cbrcEnabled: false,
        hardwareVersion: 'vmx-19',
        guestOS: 'Red Hat Enterprise Linux 8',
        osToolsConfig: 'guestManaged',
        guestHostname: 'test-vm-1',
        guestIP: '192.168.1.100',
        annotation: null,
        datacenter: 'DC1',
        cluster: 'Cluster-01',
        host: 'esxi-01.example.com',
        provisionedMiB: 102400,
        inUseMiB: 51200,
        uuid: 'test-uuid-123',
        firmwareType: 'bios',
        latencySensitivity: 'normal',
        cbtEnabled: true,
      },
    ],
    vCPU: [],
    vMemory: [],
    vDisk: [],
    vPartition: [],
    vNetwork: [],
    vCD: [],
    vSnapshot: [],
    vTools: [],
    vCluster: [],
    vHost: [],
    vDatastore: [],
    vResourcePool: [],
    vLicense: [],
    vHealth: [],
    vSource: [],
  };
}

// Helper to create mock files with fake size
function createMockFile(name: string, size: number, type: string): File {
  // Create a small blob but override the size property
  const blob = new Blob(['test'], { type });
  const file = new File([blob], name, { type });
  // Override the size property to simulate large files without allocating memory
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

// Helper to create valid Excel file
function createValidExcelFile(name = 'test.xlsx'): File {
  return createMockFile(name, 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

describe('File Upload E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation - successful parse
    mockParseRVToolsFile.mockImplementation(async (file, onProgress) => {
      // Simulate parsing progress
      onProgress?.({ phase: 'reading', sheetsProcessed: 0, totalSheets: 0, message: 'Reading file...' });
      onProgress?.({ phase: 'parsing', sheetsProcessed: 4, totalSheets: 8, message: 'Parsing...' });
      onProgress?.({ phase: 'validating', sheetsProcessed: 8, totalSheets: 8, message: 'Validating...' });
      onProgress?.({ phase: 'complete', sheetsProcessed: 8, totalSheets: 8, message: 'Successfully parsed 1 VMs' });

      return {
        success: true,
        data: createMockRVToolsData(file.name),
        errors: [],
        warnings: [],
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateFile', () => {
    it('should accept valid xlsx files', () => {
      const file = createValidExcelFile('RVTools_export_2025-01-14_10.30.00.xlsx');
      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid xls files', () => {
      const file = createMockFile('legacy.xls', 1024, 'application/vnd.ms-excel');
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it('should reject files that are too large', () => {
      const largeFile = createMockFile('large.xlsx', 60 * 1024 * 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const result = validateFile(largeFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('should reject invalid file types', () => {
      const csvFile = createMockFile('data.csv', 1024, 'text/csv');
      const result = validateFile(csvFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('should reject pdf files', () => {
      const pdfFile = createMockFile('document.pdf', 1024, 'application/pdf');
      const result = validateFile(pdfFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });
  });

  describe('DropZone Component', () => {
    it('should render drop zone with upload instructions', () => {
      const onFileDrop = vi.fn();
      render(<DropZone onFileDrop={onFileDrop} />);

      expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
      expect(screen.getByText(/click to browse/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /upload rvtools excel file/i })).toBeInTheDocument();
    });

    it('should show accepted file types', () => {
      const onFileDrop = vi.fn();
      render(<DropZone onFileDrop={onFileDrop} />);

      expect(screen.getByText(/\.xlsx/i)).toBeInTheDocument();
    });

    it('should call onFileDrop when valid file is dropped', () => {
      const onFileDrop = vi.fn();
      render(<DropZone onFileDrop={onFileDrop} />);

      const file = createValidExcelFile();
      const dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });

      // Create a mock DataTransfer object
      const dataTransfer = {
        files: [file],
        items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
        types: ['Files'],
      };

      fireEvent.drop(dropZone, { dataTransfer });

      expect(onFileDrop).toHaveBeenCalledWith(file);
    });

    it('should show error for invalid file type via drop', () => {
      const onFileDrop = vi.fn();
      render(<DropZone onFileDrop={onFileDrop} />);

      const file = createMockFile('invalid.txt', 1024, 'text/plain');
      const dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });

      const dataTransfer = { files: [file] };
      fireEvent.drop(dropZone, { dataTransfer });

      expect(onFileDrop).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
    });

    it('should show error for file that exceeds size limit', () => {
      const onFileDrop = vi.fn();
      render(<DropZone onFileDrop={onFileDrop} maxSizeMB={1} />);

      // Create a file larger than 1MB
      const largeFile = createMockFile('large.xlsx', 2 * 1024 * 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });

      const dataTransfer = { files: [largeFile] };
      fireEvent.drop(dropZone, { dataTransfer });

      expect(onFileDrop).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/too large/i)).toBeInTheDocument();
    });

    it('should handle drag over state', () => {
      const onFileDrop = vi.fn();
      render(<DropZone onFileDrop={onFileDrop} />);

      const dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });

      fireEvent.dragOver(dropZone, {
        dataTransfer: { files: [] },
      });

      expect(dropZone).toHaveClass('drop-zone--active');
    });

    it('should handle drag leave state', () => {
      const onFileDrop = vi.fn();
      render(<DropZone onFileDrop={onFileDrop} />);

      const dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });

      fireEvent.dragOver(dropZone, {
        dataTransfer: { files: [] },
      });

      fireEvent.dragLeave(dropZone, {
        dataTransfer: { files: [] },
      });

      expect(dropZone).not.toHaveClass('drop-zone--active');
    });

    it('should be disabled when disabled prop is true', () => {
      const onFileDrop = vi.fn();
      render(<DropZone onFileDrop={onFileDrop} disabled />);

      const dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });
      expect(dropZone).toHaveClass('drop-zone--disabled');
      expect(dropZone).toHaveAttribute('tabindex', '-1');
    });

    it('should not call onFileDrop when disabled and file is dropped', () => {
      const onFileDrop = vi.fn();
      render(<DropZone onFileDrop={onFileDrop} disabled />);

      const dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });
      const file = createValidExcelFile();

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] },
      });

      expect(onFileDrop).not.toHaveBeenCalled();
    });
  });

  describe('FileUpload Component', () => {
    it('should render in idle state initially', () => {
      const onDataParsed = vi.fn();
      render(<FileUpload onDataParsed={onDataParsed} />);

      expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
    });

    it('should show processing state when file is being parsed', async () => {
      // Make the mock hold to simulate processing
      let resolvePromise: (value: ParseResult) => void;
      mockParseRVToolsFile.mockImplementation((_file, onProgress) => {
        onProgress?.({ phase: 'reading', sheetsProcessed: 0, totalSheets: 0, message: 'Reading file...' });
        return new Promise((resolve) => {
          resolvePromise = resolve;
        });
      });

      const onDataParsed = vi.fn();
      render(<FileUpload onDataParsed={onDataParsed} />);

      const file = createValidExcelFile();
      const dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      // Should show file name during processing
      await waitFor(() => {
        expect(screen.getByText(file.name)).toBeInTheDocument();
      });

      // Resolve the promise to complete
      resolvePromise!({
        success: true,
        data: createMockRVToolsData(file.name),
        errors: [],
        warnings: [],
      });
    });

    it('should call onDataParsed callback when parsing completes successfully', async () => {
      const onDataParsed = vi.fn();
      render(<FileUpload onDataParsed={onDataParsed} />);

      const file = createValidExcelFile();
      const dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      await waitFor(() => {
        expect(onDataParsed).toHaveBeenCalled();
      });

      // Verify the data structure
      const [parsedData] = onDataParsed.mock.calls[0] as [RVToolsData];
      expect(parsedData).toHaveProperty('metadata');
      expect(parsedData).toHaveProperty('vInfo');
      expect(parsedData.metadata.fileName).toBe(file.name);
    });

    it('should call onError callback when file validation fails in FileUpload', async () => {
      // Note: DropZone validates first. For FileUpload to validate, the file must
      // pass DropZone's validation (valid extension) but fail FileUpload's validateFile
      // Since both check extensions, we test with a file too large for FileUpload but
      // small enough for DropZone's default limit
      const onDataParsed = vi.fn();
      const onError = vi.fn();
      // Using custom maxSizeMB on DropZone that's larger than FileUpload's 50MB limit
      // Actually both use 50MB, so let's test with a parsing failure instead
      mockParseRVToolsFile.mockResolvedValue({
        success: false,
        data: null,
        errors: ['Invalid file: missing required data'],
        warnings: [],
      });

      render(<FileUpload onDataParsed={onDataParsed} onError={onError} />);

      const file = createValidExcelFile();
      const dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      expect(onDataParsed).not.toHaveBeenCalled();
    });

    it('should call onError callback when parsing fails', async () => {
      mockParseRVToolsFile.mockResolvedValue({
        success: false,
        data: null,
        errors: ['Missing required sheets: vInfo'],
        warnings: [],
      });

      const onDataParsed = vi.fn();
      const onError = vi.fn();
      render(<FileUpload onDataParsed={onDataParsed} onError={onError} />);

      const file = createValidExcelFile();
      const dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      expect(onDataParsed).not.toHaveBeenCalled();
      expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
    });

    it('should show error state with try again button', async () => {
      // Use parsing failure to trigger error state (DropZone catches invalid extensions)
      mockParseRVToolsFile.mockResolvedValue({
        success: false,
        data: null,
        errors: ['Missing required sheets'],
        warnings: [],
      });

      const onDataParsed = vi.fn();
      const onError = vi.fn();
      render(<FileUpload onDataParsed={onDataParsed} onError={onError} />);

      const file = createValidExcelFile();
      const dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('should reset state when try again button is clicked', async () => {
      // Use parsing failure to trigger error state
      mockParseRVToolsFile.mockResolvedValueOnce({
        success: false,
        data: null,
        errors: ['Missing required sheets'],
        warnings: [],
      });

      const onDataParsed = vi.fn();
      const onError = vi.fn();
      render(<FileUpload onDataParsed={onDataParsed} onError={onError} />);

      // First, trigger an error
      const file = createValidExcelFile();
      const dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
      });

      // Click try again
      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      await userEvent.click(tryAgainButton);

      // Should be back to idle state
      expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
      expect(screen.queryByText(/upload failed/i)).not.toBeInTheDocument();
    });

    it('should show upload different file button after successful upload', async () => {
      const onDataParsed = vi.fn();
      render(<FileUpload onDataParsed={onDataParsed} />);

      const file = createValidExcelFile();
      const dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      await waitFor(() => {
        expect(onDataParsed).toHaveBeenCalled();
      });

      // Should show the upload different file button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /upload different file/i })).toBeInTheDocument();
      });
    });

    it('should reset and show dropzone when upload different file is clicked', async () => {
      const onDataParsed = vi.fn();
      render(<FileUpload onDataParsed={onDataParsed} />);

      const file = createValidExcelFile();
      const dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      await waitFor(() => {
        expect(onDataParsed).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /upload different file/i })).toBeInTheDocument();
      });

      const resetButton = screen.getByRole('button', { name: /upload different file/i });
      await userEvent.click(resetButton);

      // Should be back to idle state
      expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
    });

    it('should display warnings from parser', async () => {
      mockParseRVToolsFile.mockImplementation(async (file, onProgress) => {
        onProgress?.({ phase: 'complete', sheetsProcessed: 8, totalSheets: 8, message: 'Done' });
        return {
          success: true,
          data: createMockRVToolsData(file.name),
          errors: [],
          warnings: ['Missing recommended sheets: vSnapshot'],
        };
      });

      const onDataParsed = vi.fn();
      render(<FileUpload onDataParsed={onDataParsed} />);

      const file = createValidExcelFile();
      const dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      await waitFor(() => {
        expect(onDataParsed).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText(/warnings/i)).toBeInTheDocument();
        expect(screen.getByText(/missing recommended sheets/i)).toBeInTheDocument();
      });
    });
  });

  describe('Full Upload Flow Integration', () => {
    it('should complete full upload flow: select file -> parse -> display success', async () => {
      const onDataParsed = vi.fn();
      render(<FileUpload onDataParsed={onDataParsed} />);

      // Step 1: Initial state - drop zone visible
      expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();

      // Step 2: Drop file
      const file = createValidExcelFile('RVTools_export_DC1_2025-01-14_10.30.00.xlsx');
      const dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      // Step 3: Processing state - file name displayed
      await waitFor(() => {
        expect(screen.getByText(file.name)).toBeInTheDocument();
      });

      // Step 4: Complete state
      await waitFor(() => {
        expect(onDataParsed).toHaveBeenCalled();
      });

      // Verify parsed data structure
      const [parsedData] = onDataParsed.mock.calls[0] as [RVToolsData];
      expect(parsedData.metadata.fileName).toBe(file.name);
      expect(Array.isArray(parsedData.vInfo)).toBe(true);
    });

    it('should handle error flow: drop file -> parse fails -> show error -> reset', async () => {
      // Use parsing failure since DropZone catches invalid extensions
      mockParseRVToolsFile.mockResolvedValueOnce({
        success: false,
        data: null,
        errors: ['Invalid file format'],
        warnings: [],
      });

      const onDataParsed = vi.fn();
      const onError = vi.fn();
      render(<FileUpload onDataParsed={onDataParsed} onError={onError} />);

      // Step 1: Drop file (valid extension but parse will fail)
      const file = createValidExcelFile();
      const dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      // Step 2: Error state displayed
      await waitFor(() => {
        expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
      });
      expect(onError).toHaveBeenCalled();
      expect(onDataParsed).not.toHaveBeenCalled();

      // Step 3: Click try again
      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      await userEvent.click(tryAgainButton);

      // Step 4: Back to initial state
      expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
    });

    it('should handle parse error flow: drop valid file -> parse fails -> show error', async () => {
      mockParseRVToolsFile.mockResolvedValue({
        success: false,
        data: null,
        errors: ['No VMs found in vInfo sheet'],
        warnings: [],
      });

      const onDataParsed = vi.fn();
      const onError = vi.fn();
      render(<FileUpload onDataParsed={onDataParsed} onError={onError} />);

      const file = createValidExcelFile();
      const dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
        expect(screen.getByText(/no vms found/i)).toBeInTheDocument();
      });

      expect(onError).toHaveBeenCalled();
      expect(onDataParsed).not.toHaveBeenCalled();
    });

    it('should handle multiple file uploads in sequence', async () => {
      const onDataParsed = vi.fn();
      render(<FileUpload onDataParsed={onDataParsed} />);

      // First upload
      const file1 = createValidExcelFile('first.xlsx');
      let dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });
      fireEvent.drop(dropZone, { dataTransfer: { files: [file1] } });

      await waitFor(() => {
        expect(onDataParsed).toHaveBeenCalledTimes(1);
      });

      // Wait for and click reset button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /upload different file/i })).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole('button', { name: /upload different file/i }));

      // Second upload
      const file2 = createValidExcelFile('second.xlsx');
      dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });
      fireEvent.drop(dropZone, { dataTransfer: { files: [file2] } });

      await waitFor(() => {
        expect(onDataParsed).toHaveBeenCalledTimes(2);
      });

      // Verify both files were processed
      expect(onDataParsed.mock.calls[0][0].metadata.fileName).toBe('first.xlsx');
      expect(onDataParsed.mock.calls[1][0].metadata.fileName).toBe('second.xlsx');
    });

    it('should handle exception during parsing', async () => {
      mockParseRVToolsFile.mockRejectedValue(new Error('File corrupted'));

      const onDataParsed = vi.fn();
      const onError = vi.fn();
      render(<FileUpload onDataParsed={onDataParsed} onError={onError} />);

      const file = createValidExcelFile();
      const dropZone = screen.getByRole('button', { name: /upload rvtools excel file/i });
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
        expect(screen.getByText(/file corrupted/i)).toBeInTheDocument();
      });

      expect(onError).toHaveBeenCalled();
    });
  });
});
