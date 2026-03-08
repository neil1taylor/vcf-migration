// Integration tests for Excel report generator
// Tests real output with no mocks — verifies sheet structure and data

import { describe, it, expect, beforeAll } from 'vitest';
import * as XLSX from 'xlsx';
import type { RVToolsData } from '@/types/rvtools';
import { generateExcelReport } from '../excelGenerator';
import { getRVToolsData } from './fixtures';

let data: RVToolsData;

beforeAll(async () => {
  data = await getRVToolsData();
});

describe('Excel integration — structural checks', () => {
  it('generates a workbook with expected sheet names', () => {
    const workbook = generateExcelReport(data);
    expect(workbook.SheetNames).toContain('Executive Summary');
    expect(workbook.SheetNames).toContain('VM List');
    expect(workbook.SheetNames.length).toBeGreaterThanOrEqual(2);
  });

  it('has expected sheets for full data', () => {
    const workbook = generateExcelReport(data);
    const names = workbook.SheetNames;

    // Core sheets that should always be present
    expect(names).toContain('Executive Summary');
    expect(names).toContain('VM List');
  });

  it('VM List sheet has header row and data rows', () => {
    const workbook = generateExcelReport(data);
    const sheet = workbook.Sheets['VM List'];
    expect(sheet).toBeDefined();

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    // Should have at least some VMs (fixture has 3 but templates/infra VMs may be filtered)
    expect(rows.length).toBeGreaterThan(0);
  });

  it('Executive Summary sheet has content', () => {
    const workbook = generateExcelReport(data);
    const sheet = workbook.Sheets['Executive Summary'];
    expect(sheet).toBeDefined();

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    expect(rows.length).toBeGreaterThan(3);
  });

  it('can be written to a binary buffer', () => {
    const workbook = generateExcelReport(data);
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    expect(buffer.byteLength).toBeGreaterThan(0);

    // Verify it can be read back
    const readBack = XLSX.read(buffer, { type: 'buffer' });
    expect(readBack.SheetNames).toEqual(workbook.SheetNames);
  });

  it('includes host and datastore sheets', () => {
    // The fixture has 2 hosts and 1 datastore — these sheets must be present
    const workbook = generateExcelReport(data);
    const names = workbook.SheetNames;

    expect(names).toContain('Host List');
    expect(names).toContain('Datastore List');
  });
});
