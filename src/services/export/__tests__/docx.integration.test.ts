// Integration tests for DOCX report generator
// Tests real output — verifies structure and OOXML styling
// Only the canvas chart module is mocked (no canvas in jsdom)

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { Paragraph, ImageRun } from 'docx';
import type JSZip from 'jszip';
import type { RVToolsData } from '@/types/rvtools';
import { getRVToolsData, defaultDocxOptions } from './fixtures';

// Mock canvas-dependent chart generation (jsdom has no real canvas)
// Returns a 1x1 transparent PNG so the rest of the pipeline works
const TINY_PNG = new Uint8Array([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
  0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02,
  0x00, 0x01, 0xE5, 0x27, 0xDE, 0xFC, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
]);

vi.mock('../docx/utils/charts', () => ({
  generatePieChart: vi.fn(async () => TINY_PNG),
  createChartParagraph: vi.fn((imageData: Uint8Array, width: number, height: number) =>
    new Paragraph({
      children: [new ImageRun({ data: imageData, transformation: { width, height }, type: 'png' })],
    })
  ),
}));

const { generateDocxReport } = await import('../docx/index');
import {
  unzipBlob,
  getXmlContent,
  extractTextRuns,
  findFontReferences,
  findColorReferences,
  assertFilesExist,
} from './ooxml-helpers';

let data: RVToolsData;

beforeAll(async () => {
  data = await getRVToolsData();
});

describe('DOCX integration — structural checks', () => {
  it('generates a non-empty blob', async () => {
    const blob = await generateDocxReport(data, defaultDocxOptions);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('produces a valid ZIP (OOXML)', async () => {
    const blob = await generateDocxReport(data, defaultDocxOptions);
    const zip = await unzipBlob(blob);
    assertFilesExist(zip, [
      'word/document.xml',
      '[Content_Types].xml',
      'word/styles.xml',
    ]);
  });

  it('contains expected section headings in document.xml', async () => {
    const blob = await generateDocxReport(data, defaultDocxOptions);
    const zip = await unzipBlob(blob);
    const docXml = await getXmlContent(zip, 'word/document.xml');
    const textContent = extractTextRuns(docXml, 'w:t');
    const joined = textContent.join(' ');

    // Key section headings from the report
    expect(joined).toContain('Executive Summary');
    expect(joined).toContain('Environment Analysis');
    expect(joined).toContain('Migration Readiness');
    expect(joined).toContain('Complexity Assessment');
    expect(joined).toContain('OS Compatibility Matrix');
    expect(joined).toContain('Next Steps');
  });

  it('contains appendix sections when includeAppendices is true', async () => {
    const blob = await generateDocxReport(data, {
      ...defaultDocxOptions,
      includeAppendices: true,
    });
    const zip = await unzipBlob(blob);
    const docXml = await getXmlContent(zip, 'word/document.xml');
    const textContent = extractTextRuns(docXml, 'w:t');
    const joined = textContent.join(' ');

    expect(joined).toContain('Compute Deep-dive');
    expect(joined).toContain('VM Inventory');
  });

  it('omits detailed appendices when includeAppendices is false', async () => {
    const blob = await generateDocxReport(data, {
      ...defaultDocxOptions,
      includeAppendices: false,
    });
    const zip = await unzipBlob(blob);
    const docXml = await getXmlContent(zip, 'word/document.xml');
    const textContent = extractTextRuns(docXml, 'w:t');
    const joined = textContent.join(' ');

    expect(joined).not.toContain('Compute Deep-dive');
    expect(joined).not.toContain('VM Inventory');
  });

  it('generates with ROKS-only options', async () => {
    const blob = await generateDocxReport(data, {
      ...defaultDocxOptions,
      includeROKS: true,
      includeVSI: false,
    });
    expect(blob.size).toBeGreaterThan(0);
    const zip = await unzipBlob(blob);
    const docXml = await getXmlContent(zip, 'word/document.xml');
    const textContent = extractTextRuns(docXml, 'w:t').join(' ');
    expect(textContent).toContain('ROKS');
  });

  it('generates with VSI-only options', async () => {
    const blob = await generateDocxReport(data, {
      ...defaultDocxOptions,
      includeROKS: false,
      includeVSI: true,
    });
    expect(blob.size).toBeGreaterThan(0);
  });

  it('generates with no costs', async () => {
    const blob = await generateDocxReport(data, {
      ...defaultDocxOptions,
      includeCosts: false,
    });
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe('DOCX integration — style checks', () => {
  // Generate blob once and share across all style tests
  let docXml: string;
  let stylesXml: string;

  beforeAll(async () => {
    const blob = await generateDocxReport(data, defaultDocxOptions);
    const zip: JSZip = await unzipBlob(blob);
    docXml = await getXmlContent(zip, 'word/document.xml');
    stylesXml = await getXmlContent(zip, 'word/styles.xml');
  });

  it('declares IBM Plex Sans font in styles.xml', () => {
    const fonts = findFontReferences(stylesXml);
    expect(fonts).toContain('IBM Plex Sans');
  });

  it('uses heading styles in document.xml', () => {
    expect(docXml).toContain('w:val="Heading1"');
    expect(docXml).toContain('w:val="Heading2"');
  });

  it('uses IBM Blue color in document', () => {
    const colors = findColorReferences(docXml);
    expect(colors).toContain('0f62fe');
  });

  it('contains table borders', () => {
    expect(docXml).toContain('w:tblBorders');
  });

  it('uses correct font sizes', () => {
    // Font sizes stored as half-points in OOXML (w:sz w:val)
    // titleSize=56, heading2Size=26, bodySize=22
    expect(docXml).toMatch(/w:sz w:val="56"/);  // title
    expect(docXml).toMatch(/w:sz w:val="26"/);  // heading2
    expect(docXml).toMatch(/w:sz w:val="22"/);  // body
  });

  it('references IBM Plex Sans in document body', () => {
    const fonts = findFontReferences(docXml);
    expect(fonts).toContain('IBM Plex Sans');
  });
});
