import { describe, it, expect, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { generateHandoverFile, SETTINGS_KEYS } from './handoverExporter';

function createMinimalWorkbook(): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['VM Name', 'Power State'],
    ['vm-1', 'poweredOn'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'vInfo');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return out;
}

describe('generateHandoverFile', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a workbook with _vcfSettings sheet', () => {
    localStorage.setItem('vcf-vm-overrides', '{"test": true}');

    const buffer = createMinimalWorkbook();
    const result = generateHandoverFile(buffer, 'test.xlsx');

    const wb = XLSX.read(result, { type: 'array' });
    expect(wb.SheetNames).toContain('_vcfSettings');
    expect(wb.SheetNames).toContain('vInfo');
  });

  it('sets _vcfSettings as veryHidden (Hidden = 2)', () => {
    const buffer = createMinimalWorkbook();
    const result = generateHandoverFile(buffer, 'test.xlsx');

    const wb = XLSX.read(result, { type: 'array' });
    const idx = wb.SheetNames.indexOf('_vcfSettings');
    expect(wb.Workbook?.Sheets?.[idx]?.Hidden).toBe(2);
  });

  it('only exports allowlisted keys', () => {
    localStorage.setItem('vcf-vm-overrides', '{"test": true}');
    localStorage.setItem('some-other-key', 'should-not-appear');
    localStorage.setItem('vcf-ai-settings', 'also-not-exported');

    const buffer = createMinimalWorkbook();
    const result = generateHandoverFile(buffer, 'test.xlsx');

    const wb = XLSX.read(result, { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<{ key: string; value: string }>(
      wb.Sheets['_vcfSettings']
    );
    const keys = rows.map(r => r.key);
    expect(keys).toContain('vcf-vm-overrides');
    expect(keys).not.toContain('some-other-key');
    expect(keys).not.toContain('vcf-ai-settings');
  });

  it('includes metadata rows', () => {
    const buffer = createMinimalWorkbook();
    const result = generateHandoverFile(buffer, 'myfile.xlsx');

    const wb = XLSX.read(result, { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<{ key: string; value: string }>(
      wb.Sheets['_vcfSettings']
    );
    const keys = rows.map(r => r.key);
    expect(keys).toContain('_vcfSettingsVersion');
    expect(keys).toContain('_exportDate');
    expect(keys).toContain('_sourceFileName');

    const sourceRow = rows.find(r => r.key === '_sourceFileName');
    expect(sourceRow?.value).toBe('myfile.xlsx');
  });

  it('replaces existing _vcfSettings sheet on re-export', () => {
    localStorage.setItem('vcf-vm-overrides', '{"v1": true}');
    const buffer = createMinimalWorkbook();
    const firstResult = generateHandoverFile(buffer, 'test.xlsx');

    // Now re-export from the first result with different settings
    localStorage.setItem('vcf-vm-overrides', '{"v2": true}');
    // Convert result back to ArrayBuffer for re-export
    const arr = new Uint8Array(firstResult);
    const secondResult = generateHandoverFile(arr.buffer, 'test.xlsx');

    const wb = XLSX.read(secondResult, { type: 'array' });
    // Should have exactly one _vcfSettings sheet
    const settingsCount = wb.SheetNames.filter(n => n === '_vcfSettings').length;
    expect(settingsCount).toBe(1);

    const rows = XLSX.utils.sheet_to_json<{ key: string; value: string }>(
      wb.Sheets['_vcfSettings']
    );
    const overridesRow = rows.find(r => r.key === 'vcf-vm-overrides');
    expect(overridesRow?.value).toBe('{"v2": true}');
  });

  it('round-trips: generate then parse back to extract settings', () => {
    localStorage.setItem('vcf-vm-overrides', '{"excluded": ["vm-1"]}');
    localStorage.setItem('vcf-target-location', '{"mzr": "us-south"}');

    const buffer = createMinimalWorkbook();
    const result = generateHandoverFile(buffer, 'test.xlsx');

    // Parse back
    const wb = XLSX.read(result, { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<{ key: string; value: string }>(
      wb.Sheets['_vcfSettings']
    );
    const settings: Record<string, string> = {};
    for (const row of rows) {
      if (!row.key.startsWith('_')) {
        settings[row.key] = row.value;
      }
    }

    expect(settings['vcf-vm-overrides']).toBe('{"excluded": ["vm-1"]}');
    expect(settings['vcf-target-location']).toBe('{"mzr": "us-south"}');
  });

  it('exports all setting keys when all are present', () => {
    for (const key of SETTINGS_KEYS) {
      localStorage.setItem(key, `value-for-${key}`);
    }

    const buffer = createMinimalWorkbook();
    const result = generateHandoverFile(buffer, 'test.xlsx');

    const wb = XLSX.read(result, { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<{ key: string; value: string }>(
      wb.Sheets['_vcfSettings']
    );
    const dataKeys = rows.map(r => r.key).filter(k => !k.startsWith('_'));
    for (const key of SETTINGS_KEYS) {
      expect(dataKeys).toContain(key);
    }
  });
});
