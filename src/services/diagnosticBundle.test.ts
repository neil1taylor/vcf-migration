import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildDiagnosticBundle, downloadDiagnosticBundle, sanitizeContext, type DiagnosticStateInput } from './diagnosticBundle';
import { pushLogEntry, clearLogBuffer } from '@/utils/logBuffer';

// Mock dependencies
vi.mock('@/services/pricing/pricingCache', () => ({
  getPricingSource: () => 'static',
}));

vi.mock('@/services/pricing/globalCatalogApi', () => ({
  isProxyConfigured: () => false,
}));

vi.mock('@/services/ibmCloudProfilesApi', () => ({
  isProfilesProxyConfigured: () => true,
}));

vi.mock('@/hooks/useAISettings', () => ({
  getAIEnabled: () => false,
}));

const defaultState: DiagnosticStateInput = {
  vmCount: 50,
  excludedVMCount: 5,
  loadedSheets: ['vInfo', 'vDisk', 'vHost'],
  selectedRegion: 'us-south',
  selectedDiscountType: 'onDemand',
};

describe('sanitizeContext', () => {
  it('returns undefined for undefined input', () => {
    expect(sanitizeContext(undefined)).toBeUndefined();
  });

  it('redacts sensitive keys', () => {
    const result = sanitizeContext({
      ip: '10.0.0.1',
      ipAddress: '192.168.1.1',
      apiKey: 'secret-key',
      url: 'https://example.com',
      name: 'my-vm',
      safe: 'visible',
    });

    expect(result).toEqual({
      ip: '[redacted]',
      ipAddress: '[redacted]',
      apiKey: '[redacted]',
      url: '[redacted]',
      name: '[redacted]',
      safe: 'visible',
    });
  });

  it('is case-insensitive for key matching', () => {
    const result = sanitizeContext({ UUID: '123', Password: 'abc' });
    expect(result).toEqual({ UUID: '[redacted]', Password: '[redacted]' });
  });

  it('recursively sanitizes nested objects', () => {
    const result = sanitizeContext({
      outer: { ip: '10.0.0.1', count: 5 },
    });
    expect(result).toEqual({
      outer: { ip: '[redacted]', count: 5 },
    });
  });

  it('preserves non-sensitive values', () => {
    const result = sanitizeContext({ module: 'pricing', operation: 'fetch', count: 42 });
    expect(result).toEqual({ module: 'pricing', operation: 'fetch', count: 42 });
  });
});

describe('buildDiagnosticBundle', () => {
  beforeEach(() => {
    clearLogBuffer();
  });

  it('returns correct structure', () => {
    const bundle = buildDiagnosticBundle(defaultState);

    expect(bundle.generatedAt).toBeTruthy();
    expect(bundle.appVersion).toBeTruthy();
    expect(bundle.logs).toBeInstanceOf(Array);
    expect(bundle.environment).toMatchObject({
      pricingSource: 'static',
      pricingProxyConfigured: false,
      profilesProxyConfigured: true,
      aiEnabled: false,
    });
    expect(bundle.stateSnapshot).toEqual({
      vmCount: 50,
      excludedVMCount: 5,
      loadedSheets: ['vInfo', 'vDisk', 'vHost'],
      selectedRegion: 'us-south',
      selectedDiscountType: 'onDemand',
    });
  });

  it('includes log entries', () => {
    pushLogEntry({ timestamp: '2026-01-01T00:00:00Z', level: 'info', module: 'test', message: 'hello' });
    pushLogEntry({ timestamp: '2026-01-01T00:00:01Z', level: 'warn', module: 'test', message: 'warning' });

    const bundle = buildDiagnosticBundle(defaultState);
    expect(bundle.logs).toHaveLength(2);
    expect(bundle.logs[0].message).toBe('hello');
    expect(bundle.logs[1].message).toBe('warning');
  });

  it('sanitizes sensitive data in log context', () => {
    pushLogEntry({
      timestamp: '2026-01-01T00:00:00Z',
      level: 'info',
      module: 'test',
      message: 'with context',
      context: { ip: '10.0.0.1', count: 5 },
    });

    const bundle = buildDiagnosticBundle(defaultState);
    expect(bundle.logs[0].context).toEqual({ ip: '[redacted]', count: 5 });
  });

  it('handles null optional state fields', () => {
    const bundle = buildDiagnosticBundle({
      vmCount: 0,
      excludedVMCount: 0,
      loadedSheets: [],
    });

    expect(bundle.stateSnapshot.selectedRegion).toBeNull();
    expect(bundle.stateSnapshot.selectedDiscountType).toBeNull();
  });
});

describe('downloadDiagnosticBundle', () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('creates and clicks a download link', () => {
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    const bundle = buildDiagnosticBundle(defaultState);
    downloadDiagnosticBundle(bundle);

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(mockLink.href).toBe('blob:test-url');
    expect(mockLink.download).toMatch(/^vcf-diagnostics-\d{4}-\d{2}-\d{2}-\d{6}\.json$/);
    expect(mockLink.click).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');

    vi.restoreAllMocks();
  });
});
