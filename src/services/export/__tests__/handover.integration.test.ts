// Integration tests for Handover exporter
// Tests real output with no mocks — verifies the bundled settings sheet

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { generateHandoverFile } from '../handoverExporter';
import { getFixtureBuffer } from './fixtures';

describe('Handover integration', () => {
  it('generates output from the fixture', () => {
    const buffer = getFixtureBuffer();
    const result = generateHandoverFile(buffer, 'test-rvtools.xlsx');

    expect(result).toBeDefined();
    // XLSX.write may return Uint8Array or ArrayBuffer-like depending on env
    const resultArray = result instanceof Uint8Array ? result : new Uint8Array(result as ArrayBuffer);
    expect(resultArray.byteLength).toBeGreaterThan(0);
  });

  it('can be parsed back as a workbook', () => {
    const buffer = getFixtureBuffer();
    const result = generateHandoverFile(buffer, 'test-rvtools.xlsx');

    const workbook = XLSX.read(result, { type: 'array' });
    expect(workbook.SheetNames.length).toBeGreaterThan(0);
  });

  it('contains the _vcfSettings sheet', () => {
    const buffer = getFixtureBuffer();
    const result = generateHandoverFile(buffer, 'test-rvtools.xlsx');

    const workbook = XLSX.read(result, { type: 'array' });
    expect(workbook.SheetNames).toContain('_vcfSettings');
  });

  it('preserves original sheets', () => {
    const buffer = getFixtureBuffer();
    const originalWorkbook = XLSX.read(buffer, { type: 'array' });
    const originalSheets = originalWorkbook.SheetNames;

    const result = generateHandoverFile(buffer, 'test-rvtools.xlsx');
    const newWorkbook = XLSX.read(result, { type: 'array' });

    for (const sheet of originalSheets) {
      expect(newWorkbook.SheetNames).toContain(sheet);
    }
  });

  it('settings sheet has metadata rows', () => {
    const buffer = getFixtureBuffer();
    const result = generateHandoverFile(buffer, 'test-rvtools.xlsx');

    const workbook = XLSX.read(result, { type: 'array' });
    const sheet = workbook.Sheets['_vcfSettings'];
    const rows = XLSX.utils.sheet_to_json<{ key: string; value: string }>(sheet);

    const keys = rows.map(r => r.key);
    expect(keys).toContain('_vcfSettingsVersion');
    expect(keys).toContain('_exportDate');
    expect(keys).toContain('_sourceFileName');
  });

  it('settings sheet records the source filename', () => {
    const buffer = getFixtureBuffer();
    const result = generateHandoverFile(buffer, 'test-rvtools.xlsx');

    const workbook = XLSX.read(result, { type: 'array' });
    const sheet = workbook.Sheets['_vcfSettings'];
    const rows = XLSX.utils.sheet_to_json<{ key: string; value: string }>(sheet);

    const fileNameRow = rows.find(r => r.key === '_sourceFileName');
    expect(fileNameRow?.value).toBe('test-rvtools.xlsx');
  });

  it('_vcfSettings sheet is marked as veryHidden', () => {
    const buffer = getFixtureBuffer();
    const result = generateHandoverFile(buffer, 'test-rvtools.xlsx');

    const workbook = XLSX.read(result, { type: 'array' });
    const settingsIdx = workbook.SheetNames.indexOf('_vcfSettings');
    const sheetProps = workbook.Workbook?.Sheets?.[settingsIdx];
    expect(sheetProps?.Hidden).toBe(2);
  });
});
