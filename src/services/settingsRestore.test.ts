import { describe, it, expect, beforeEach } from 'vitest';
import { restoreBundledSettings } from './settingsRestore';

describe('restoreBundledSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('restores valid keys to localStorage', () => {
    const settings = {
      'vcf-vm-overrides': '{"test": true}',
      'vcf-target-location': '{"mzr": "us-south"}',
    };

    const result = restoreBundledSettings(settings);

    expect(result.restored).toEqual(['vcf-vm-overrides', 'vcf-target-location']);
    expect(result.skipped).toEqual([]);
    expect(localStorage.getItem('vcf-vm-overrides')).toBe('{"test": true}');
    expect(localStorage.getItem('vcf-target-location')).toBe('{"mzr": "us-south"}');
  });

  it('skips metadata keys (starting with _)', () => {
    const settings = {
      '_vcfSettingsVersion': '1',
      '_exportDate': '2026-03-07T00:00:00Z',
      '_sourceFileName': 'test.xlsx',
      'vcf-vm-overrides': '{}',
    };

    const result = restoreBundledSettings(settings);

    expect(result.restored).toEqual(['vcf-vm-overrides']);
    expect(result.skipped).toEqual([]);
    expect(localStorage.getItem('_vcfSettingsVersion')).toBeNull();
  });

  it('skips unknown keys', () => {
    const settings = {
      'vcf-vm-overrides': '{}',
      'unknown-key': 'value',
      'vcf-ai-settings': 'should-skip',
    };

    const result = restoreBundledSettings(settings);

    expect(result.restored).toEqual(['vcf-vm-overrides']);
    expect(result.skipped).toEqual(['unknown-key', 'vcf-ai-settings']);
    expect(localStorage.getItem('unknown-key')).toBeNull();
    expect(localStorage.getItem('vcf-ai-settings')).toBeNull();
  });

  it('handles empty settings', () => {
    const result = restoreBundledSettings({});
    expect(result.restored).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it('overwrites existing localStorage values', () => {
    localStorage.setItem('vcf-vm-overrides', '{"old": true}');

    restoreBundledSettings({ 'vcf-vm-overrides': '{"new": true}' });

    expect(localStorage.getItem('vcf-vm-overrides')).toBe('{"new": true}');
  });
});
