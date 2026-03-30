// Main file upload component combining DropZone and progress
import { useState, useCallback } from 'react';
import { Button, InlineNotification } from '@carbon/react';
import { TrashCan, Restart } from '@carbon/icons-react';
import * as XLSX from 'xlsx';
import { DropZone } from './DropZone';
import { UploadProgress } from './UploadProgress';
import { parseRVToolsFile, validateFile, type ParsingProgress } from '@/services/parser/excelParser';
import { detectFileType } from '@/services/parser/fileDetector';
import { parseClassicBilling } from '@/services/billing';
import { useData } from '@/hooks/useData';
import type { RVToolsData } from '@/types';
import './FileUpload.scss';

interface FileUploadProps {
  onDataParsed: (data: RVToolsData, file: File, bundledSettings?: Record<string, string>) => void;
  onError?: (errors: string[]) => void;
}

type UploadState = 'idle' | 'processing' | 'complete' | 'error';

export function FileUpload({ onDataParsed, onError }: FileUploadProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [fileName, setFileName] = useState<string>('');
  const [progress, setProgress] = useState<ParsingProgress | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [billingNotice, setBillingNotice] = useState<string | null>(null);
  const { rawData, setBillingData } = useData();

  const handleFileDrop = useCallback(
    async (file: File) => {
      setBillingNotice(null);

      // Validate file first
      const validation = validateFile(file);
      if (!validation.valid) {
        setErrors([validation.error || 'Invalid file']);
        setState('error');
        onError?.([validation.error || 'Invalid file']);
        return;
      }

      // Check if it's a billing file
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const fileType = detectFileType(workbook);

        if (fileType === 'classic-billing') {
          if (rawData) {
            // RVTools already loaded — parse and store billing data
            const billing = parseClassicBilling(workbook, file.name);
            setBillingData(billing);
            setBillingNotice(
              `Billing data loaded from "${file.name}" — ${billing.bareMetalServers.length} bare metal servers found. View the Source BOM tab to see actual costs.`
            );
          } else {
            // No RVTools data yet — prompt user
            setBillingNotice(
              'This looks like an IBM Cloud billing export. Please upload your RVTools or vInventory file first, then add billing data from the Source BOM tab in the Discovery page.'
            );
          }
          return;
        }
      } catch {
        // If detection fails, fall through to normal parsing
      }

      setFileName(file.name);
      setState('processing');
      setErrors([]);
      setWarnings([]);

      try {
        const result = await parseRVToolsFile(file, (prog) => {
          setProgress(prog);
        });

        if (result.success && result.data) {
          setState('complete');
          setWarnings(result.warnings);
          onDataParsed(result.data, file, result.bundledSettings);
        } else {
          setState('error');
          setErrors(result.errors);
          onError?.(result.errors);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState('error');
        setErrors([errorMessage]);
        onError?.([errorMessage]);
      }
    },
    [onDataParsed, onError, rawData, setBillingData]
  );

  const handleReset = useCallback(() => {
    setState('idle');
    setFileName('');
    setProgress(null);
    setErrors([]);
    setWarnings([]);
    setBillingNotice(null);
  }, []);

  return (
    <div className="file-upload">
      {billingNotice && (
        <InlineNotification
          kind={rawData ? 'success' : 'info'}
          title={rawData ? 'Billing data loaded' : 'Billing file detected'}
          subtitle={billingNotice}
          lowContrast
          onClose={() => setBillingNotice(null)}
          style={{ marginBottom: '1rem' }}
        />
      )}

      {state === 'idle' && (
        <DropZone onFileDrop={handleFileDrop} />
      )}

      {(state === 'processing' || state === 'complete') && progress && (
        <div className="file-upload__progress-container">
          <UploadProgress progress={progress} fileName={fileName} />

          {state === 'complete' && (
            <div className="file-upload__actions">
              <Button
                kind="ghost"
                size="sm"
                renderIcon={Restart}
                onClick={handleReset}
              >
                Upload different file
              </Button>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="file-upload__warnings">
              <h4>Warnings</h4>
              <ul>
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {state === 'error' && (
        <div className="file-upload__error-container">
          <div className="file-upload__error">
            <h4>Upload Failed</h4>
            <ul>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
          <Button
            kind="tertiary"
            size="sm"
            renderIcon={TrashCan}
            onClick={handleReset}
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
