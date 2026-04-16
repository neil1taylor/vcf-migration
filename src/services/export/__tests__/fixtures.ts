// Shared test fixtures for export integration tests
// Parses the E2E fixture file into RVToolsData for use by all generators

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import {
  parseVInfo,
  parseVCPU,
  parseVMemory,
  parseVDisk,
  parseVDatastore,
  parseVSnapshot,
  parseVNetwork,
  parseVCD,
  parseVTools,
  parseVCluster,
  parseVHost,
  parseVLicense,
  parseVRP,
  parseVSource,
} from '@/services/parser/tabParsers';
import type { RVToolsData } from '@/types/rvtools';
import type { DocxExportOptions } from '../docx/types';
import type { PptxExportOptions } from '../pptx/types';
import type { PDFExportOptions } from '../pdfGenerator';

const FIXTURE_PATH = path.resolve(__dirname, '../../../../e2e/fixtures/test-rvtools.xlsx');

let cachedData: RVToolsData | null = null;
let cachedBuffer: ArrayBuffer | null = null;

/**
 * Read and parse the E2E fixture into RVToolsData.
 * Result is cached across test files within the same Vitest run.
 */
export async function getRVToolsData(): Promise<RVToolsData> {
  if (cachedData) return cachedData;

  const buffer = fs.readFileSync(FIXTURE_PATH);
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheets = workbook.SheetNames;

  const parseSheet = <T>(name: string, parser: (sheet: XLSX.WorkSheet) => T[]): T[] =>
    sheets.includes(name) ? parser(workbook.Sheets[name]) : [];

  cachedData = {
    metadata: {
      fileName: 'test-rvtools.xlsx',
      collectionDate: new Date(),
      vCenterVersion: '8.0.0',
      environment: 'Test',
    },
    vInfo: parseSheet('vInfo', parseVInfo),
    vCPU: parseSheet('vCPU', parseVCPU),
    vMemory: parseSheet('vMemory', parseVMemory),
    vDisk: parseSheet('vDisk', parseVDisk),
    vDatastore: parseSheet('vDatastore', parseVDatastore),
    vSnapshot: parseSheet('vSnapshot', parseVSnapshot),
    vNetwork: parseSheet('vNetwork', parseVNetwork),
    vCD: parseSheet('vCD', parseVCD),
    vTools: parseSheet('vTools', parseVTools),
    vCluster: parseSheet('vCluster', parseVCluster),
    vHost: parseSheet('vHost', parseVHost),
    vLicense: parseSheet('vLicense', parseVLicense),
    vResourcePool: parseSheet('vRP', parseVRP),
    vSource: parseSheet('vSource', parseVSource),
    vPartition: [],
    vHealth: [],
  };

  return cachedData!;
}

/**
 * Get the raw fixture file as an ArrayBuffer (for handover tests).
 */
export function getFixtureBuffer(): ArrayBuffer {
  if (cachedBuffer) return cachedBuffer;
  const buffer = fs.readFileSync(FIXTURE_PATH);
  cachedBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return cachedBuffer;
}

/** Default DOCX export options for integration tests */
export const defaultDocxOptions: DocxExportOptions = {
  clientName: 'Integration Test Client',
  preparedBy: 'Test Runner',
  companyName: 'Test Corp',
  includeROKS: true,
  includeVSI: true,

};

/** Default PPTX export options for integration tests */
export const defaultPptxOptions: PptxExportOptions = {
  clientName: 'Integration Test Client',
  preparedBy: 'Test Runner',
  companyName: 'Test Corp',
  includeROKS: true,
  includeVSI: true,

};

/** Default PDF export options for integration tests */
export const defaultPdfOptions: PDFExportOptions = {
  includeDashboard: true,
  includeCompute: true,
  includeStorage: true,
  includeNetwork: true,
  includeClusters: true,
  includeHosts: true,
  includeResourcePools: true,
};
