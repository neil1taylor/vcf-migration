// Integration tests for PDF report generator
// Tests real output with no mocks — verifies structure and content

import { describe, it, expect, beforeAll } from 'vitest';
import type { RVToolsData } from '@/types/rvtools';
import { EnhancedPDFGenerator } from '../pdfGenerator';
import { getRVToolsData, defaultPdfOptions } from './fixtures';
import { blobToArrayBuffer } from './ooxml-helpers';

let data: RVToolsData;

beforeAll(async () => {
  data = await getRVToolsData();
});

describe('PDF integration — structural checks', () => {
  it('generates a non-empty blob', async () => {
    const generator = new EnhancedPDFGenerator();
    const blob = await generator.generate(data, defaultPdfOptions);
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('starts with PDF magic bytes', async () => {
    const generator = new EnhancedPDFGenerator();
    const blob = await generator.generate(data, defaultPdfOptions);
    const bytes = new Uint8Array(await blobToArrayBuffer(blob));
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]);
    expect(magic).toBe('%PDF-');
  });

  it('has reasonable file size for 3 VMs', async () => {
    const generator = new EnhancedPDFGenerator();
    const blob = await generator.generate(data, defaultPdfOptions);
    // Expect at least 10KB for a report with charts and tables
    expect(blob.size).toBeGreaterThan(10_000);
  });

  it('contains expected text content', async () => {
    const generator = new EnhancedPDFGenerator();
    const blob = await generator.generate(data, defaultPdfOptions);
    const bytes = new Uint8Array(await blobToArrayBuffer(blob));
    const text = new TextDecoder('latin1').decode(bytes);
    // jsPDF embeds text as PDF operators — look for content that should be in the report
    // The report title or section headers should appear somewhere in the binary
    expect(text).toMatch(/Analysis|Dashboard|Migration|Summary/);
  });

  it('generates with subset of sections', async () => {
    const generator = new EnhancedPDFGenerator();
    const blob = await generator.generate(data, {
      includeDashboard: true,
      includeCompute: true,
      includeStorage: false,
      includeNetwork: false,
      includeClusters: false,
      includeHosts: false,
      includeResourcePools: false,
    });
    expect(blob.size).toBeGreaterThan(0);
    // Smaller than full report
    const fullBlob = await new EnhancedPDFGenerator().generate(data, defaultPdfOptions);
    expect(blob.size).toBeLessThan(fullBlob.size);
  });
});
