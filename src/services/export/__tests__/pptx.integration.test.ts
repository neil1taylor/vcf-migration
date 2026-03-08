// Integration tests for PPTX report generator
// Tests real output with no mocks — verifies structure and OOXML styling
//
// Note: pptxgenjs tries to fetch slide images via HTTP in Node.js.
// We mock the title slide image path to avoid network requests.

import { describe, it, expect, beforeAll, vi } from 'vitest';
import type JSZip from 'jszip';
import type { RVToolsData } from '@/types/rvtools';
import { getRVToolsData, defaultPptxOptions } from './fixtures';
import {
  unzipBlob,
  getXmlContent,
  extractTextRuns,
  findFontReferences,
  findColorReferences,
  countSlideFiles,
  assertFilesExist,
} from './ooxml-helpers';

// Mock the title slide to avoid HTTP image fetches in Node.js
vi.mock('../pptx/sections/titleSlide', () => ({
  addTitleSlide: (pres: import('pptxgenjs').default) => {
    const slide = pres.addSlide({ masterName: 'IMAGE' });
    slide.addText('Integration Test Client', { x: 1, y: 5, fontSize: 36 });
  },
}));

// Dynamically import after mock is set up
const { generatePptxReport } = await import('../pptx/index');

let data: RVToolsData;

beforeAll(async () => {
  data = await getRVToolsData();
});

describe('PPTX integration — structural checks', () => {
  it('generates a non-empty blob', async () => {
    const blob = await generatePptxReport(data, defaultPptxOptions);
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('produces a valid ZIP (OOXML)', async () => {
    const blob = await generatePptxReport(data, defaultPptxOptions);
    const zip = await unzipBlob(blob);
    assertFilesExist(zip, [
      '[Content_Types].xml',
      'ppt/presentation.xml',
    ]);
  });

  it('contains expected number of slides', async () => {
    const blob = await generatePptxReport(data, defaultPptxOptions);
    const zip = await unzipBlob(blob);
    const slideCount = countSlideFiles(zip);
    // Title + agenda + 2 reference + exec summary + stats + excluded + platform + cost + wave + execution + next steps = ~12
    expect(slideCount).toBeGreaterThanOrEqual(10);
    expect(slideCount).toBeLessThanOrEqual(15);
  });

  it('has title slide content', async () => {
    const blob = await generatePptxReport(data, defaultPptxOptions);
    const zip = await unzipBlob(blob);
    const slide1 = await getXmlContent(zip, 'ppt/slides/slide1.xml');
    const text = extractTextRuns(slide1, 'a:t');
    const joined = text.join(' ');
    expect(joined).toContain('Integration Test Client');
  });

  it('generates with ROKS-only options', async () => {
    const blob = await generatePptxReport(data, {
      ...defaultPptxOptions,
      includeROKS: true,
      includeVSI: false,
    });
    expect(blob.size).toBeGreaterThan(0);
  });

  it('generates with VSI-only options', async () => {
    const blob = await generatePptxReport(data, {
      ...defaultPptxOptions,
      includeROKS: false,
      includeVSI: true,
    });
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe('PPTX integration — style checks', () => {
  // Generate blob once and share across all style tests
  let zip: JSZip;
  let presXml: string;
  let slideCount: number;

  beforeAll(async () => {
    const blob = await generatePptxReport(data, defaultPptxOptions);
    zip = await unzipBlob(blob);
    presXml = await getXmlContent(zip, 'ppt/presentation.xml');
    slideCount = countSlideFiles(zip);
  });

  it('uses 16:9 wide slide dimensions', () => {
    // pptxgenjs encodes dimensions in EMUs (1 inch = 914400 EMU)
    // 26.67" x 15" = ~24384000 x 13716000 EMU
    expect(presXml).toMatch(/p:sldSz/);
    // Verify actual wide-format dimensions (cx > cy, matching 16:9-ish ratio)
    const sldSzMatch = presXml.match(/p:sldSz\s+cx="(\d+)"\s+cy="(\d+)"/);
    expect(sldSzMatch).not.toBeNull();
    const cx = Number(sldSzMatch![1]);
    const cy = Number(sldSzMatch![2]);
    // Width should be ~24384000 EMU (26.67"), height ~13716000 EMU (15")
    expect(cx).toBeGreaterThan(20_000_000);
    expect(cy).toBeGreaterThan(10_000_000);
    // Verify landscape (wider than tall)
    expect(cx).toBeGreaterThan(cy);
  });

  it('references IBM Plex Sans font in slides', async () => {
    let foundFont = false;
    for (let i = 1; i <= slideCount; i++) {
      const slideXml = await getXmlContent(zip, `ppt/slides/slide${i}.xml`);
      const fonts = findFontReferences(slideXml);
      if (fonts.some(f => f.includes('IBM Plex Sans'))) {
        foundFont = true;
        break;
      }
    }
    expect(foundFont).toBe(true);
  });

  it('uses IBM Blue color in slides', async () => {
    let foundBlue = false;
    for (let i = 1; i <= slideCount; i++) {
      const slideXml = await getXmlContent(zip, `ppt/slides/slide${i}.xml`);
      const colors = findColorReferences(slideXml);
      if (colors.includes('0f62fe')) {
        foundBlue = true;
        break;
      }
    }
    expect(foundBlue).toBe(true);
  });

  it('has slide layout definitions', () => {
    const hasLayouts = zip.file(/ppt\/slideLayouts\/slideLayout\d+\.xml/);
    expect(hasLayouts.length).toBeGreaterThan(0);
  });
});
