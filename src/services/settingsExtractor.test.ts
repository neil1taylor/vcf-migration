import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractSettingsFromArrayBuffer } from './settingsExtractor';

// Mock xlsx
vi.mock('xlsx', () => ({
  read: vi.fn(),
  utils: {
    sheet_to_json: vi.fn(),
  },
}));

import * as XLSX from 'xlsx';

const dummyBuffer = new ArrayBuffer(8);

describe('extractSettingsFromArrayBuffer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no _vcfSettings sheet exists', () => {
    (XLSX.read as ReturnType<typeof vi.fn>).mockReturnValue({
      SheetNames: ['vInfo', 'vCPU'],
      Sheets: {},
    });

    const result = extractSettingsFromArrayBuffer(dummyBuffer);
    expect(result).toBeNull();
  });

  it('extracts settings and metadata from valid file', () => {
    const mockSheet = {};
    (XLSX.read as ReturnType<typeof vi.fn>).mockReturnValue({
      SheetNames: ['vInfo', '_vcfSettings'],
      Sheets: { _vcfSettings: mockSheet },
    });
    (XLSX.utils.sheet_to_json as ReturnType<typeof vi.fn>).mockReturnValue([
      { key: '_vcfSettingsVersion', value: '1' },
      { key: '_exportDate', value: '2026-03-07T12:00:00Z' },
      { key: '_sourceFileName', value: 'original.xlsx' },
      { key: 'vcf-vm-overrides', value: '{"v":2}' },
      { key: 'vcf-target-location', value: '{"mzr":"us-south"}' },
    ]);

    const result = extractSettingsFromArrayBuffer(dummyBuffer);
    expect(result).not.toBeNull();
    expect(result!.metadata.exportDate).toBe('2026-03-07T12:00:00Z');
    expect(result!.metadata.sourceFileName).toBe('original.xlsx');
    expect(result!.metadata.settingsVersion).toBe('1');
    expect(result!.settingKeys).toEqual(['vcf-vm-overrides', 'vcf-target-location']);
    expect(result!.settings['vcf-vm-overrides']).toBe('{"v":2}');
  });

  it('separates metadata rows from settings', () => {
    const mockSheet = {};
    (XLSX.read as ReturnType<typeof vi.fn>).mockReturnValue({
      SheetNames: ['_vcfSettings'],
      Sheets: { _vcfSettings: mockSheet },
    });
    (XLSX.utils.sheet_to_json as ReturnType<typeof vi.fn>).mockReturnValue([
      { key: '_exportDate', value: '2026-01-01T00:00:00Z' },
      { key: '_vcfSettingsVersion', value: '1' },
      { key: '_sourceFileName', value: 'test.xlsx' },
      { key: 'vcf-platform-selection', value: '{}' },
    ]);

    const result = extractSettingsFromArrayBuffer(dummyBuffer);
    expect(result).not.toBeNull();
    expect(result!.settingKeys).toEqual(['vcf-platform-selection']);
    expect(result!.settings).not.toHaveProperty('_exportDate');
    expect(result!.settings).not.toHaveProperty('_vcfSettingsVersion');
    expect(result!.settings).not.toHaveProperty('_sourceFileName');
  });

  it('returns null when settings sheet has only metadata (no actual settings)', () => {
    const mockSheet = {};
    (XLSX.read as ReturnType<typeof vi.fn>).mockReturnValue({
      SheetNames: ['_vcfSettings'],
      Sheets: { _vcfSettings: mockSheet },
    });
    (XLSX.utils.sheet_to_json as ReturnType<typeof vi.fn>).mockReturnValue([
      { key: '_exportDate', value: '2026-01-01T00:00:00Z' },
      { key: '_vcfSettingsVersion', value: '1' },
    ]);

    const result = extractSettingsFromArrayBuffer(dummyBuffer);
    expect(result).toBeNull();
  });

  it('skips rows with missing key or non-string value', () => {
    const mockSheet = {};
    (XLSX.read as ReturnType<typeof vi.fn>).mockReturnValue({
      SheetNames: ['_vcfSettings'],
      Sheets: { _vcfSettings: mockSheet },
    });
    (XLSX.utils.sheet_to_json as ReturnType<typeof vi.fn>).mockReturnValue([
      { key: '', value: 'ignored' },
      { key: 'vcf-vm-overrides', value: 123 },
      { key: 'vcf-target-location', value: '{"mzr":"us-south"}' },
    ]);

    const result = extractSettingsFromArrayBuffer(dummyBuffer);
    expect(result).not.toBeNull();
    expect(result!.settingKeys).toEqual(['vcf-target-location']);
  });
});
