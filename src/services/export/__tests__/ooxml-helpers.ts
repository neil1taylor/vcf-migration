// OOXML parsing helpers for integration tests
// Utilities for inspecting DOCX/PPTX internals (both are ZIP-based OOXML)

import JSZip from 'jszip';

/**
 * Unzip an OOXML blob (DOCX or PPTX) and return the JSZip instance.
 */
/**
 * Convert a Blob to an ArrayBuffer, handling jsdom's incomplete Blob implementation.
 * jsdom Blob lacks arrayBuffer(), text(), and stream() — only FileReader works.
 */
export function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  // jsdom environment: use FileReader
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

export async function unzipBlob(blob: Blob): Promise<JSZip> {
  const buffer = await blobToArrayBuffer(blob);
  return JSZip.loadAsync(buffer);
}

/**
 * Extract and return the raw XML content at a given path within the ZIP.
 */
export async function getXmlContent(zip: JSZip, filePath: string): Promise<string> {
  const file = zip.file(filePath);
  if (!file) throw new Error(`File not found in ZIP: ${filePath}`);
  return file.async('string');
}

/**
 * Extract text content from XML elements with the given tag name.
 * E.g., extractTextRuns(xml, 'w:t') for DOCX text runs.
 */
export function extractTextRuns(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'g');
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    if (match[1].trim()) results.push(match[1].trim());
  }
  return results;
}

/**
 * Find all font name references in XML (e.g., w:rFonts, a:latin).
 */
export function findFontReferences(xml: string): string[] {
  const fonts = new Set<string>();
  // DOCX: <w:rFonts w:ascii="..." w:hAnsi="..." .../>
  const rFontsRegex = /w:rFonts[^>]*?w:ascii="([^"]+)"/g;
  let match;
  while ((match = rFontsRegex.exec(xml)) !== null) {
    fonts.add(match[1]);
  }
  // PPTX: <a:latin typeface="..."/>
  const latinRegex = /a:latin[^>]*?typeface="([^"]+)"/g;
  while ((match = latinRegex.exec(xml)) !== null) {
    fonts.add(match[1]);
  }
  return Array.from(fonts);
}

/**
 * Find all color hex values in XML (6-digit hex strings from w:color, a:srgbClr, etc.).
 */
export function findColorReferences(xml: string): string[] {
  const colors = new Set<string>();
  // DOCX: <w:color w:val="0f62fe"/>
  const wColorRegex = /w:color\s+w:val="([0-9a-fA-F]{6})"/g;
  let match;
  while ((match = wColorRegex.exec(xml)) !== null) {
    colors.add(match[1].toLowerCase());
  }
  // PPTX: <a:srgbClr val="0F62FE"/>
  const srgbRegex = /a:srgbClr\s+val="([0-9a-fA-F]{6})"/g;
  while ((match = srgbRegex.exec(xml)) !== null) {
    colors.add(match[1].toLowerCase());
  }
  return Array.from(colors);
}

/**
 * Count slide XML files in a PPTX ZIP (ppt/slides/slideN.xml).
 */
export function countSlideFiles(zip: JSZip): number {
  let count = 0;
  zip.forEach((relativePath) => {
    if (/^ppt\/slides\/slide\d+\.xml$/.test(relativePath)) {
      count++;
    }
  });
  return count;
}

/**
 * Check that a ZIP file contains all expected paths.
 */
export function assertFilesExist(zip: JSZip, paths: string[]): void {
  for (const p of paths) {
    if (!zip.file(p)) {
      throw new Error(`Expected file not found in ZIP: ${p}`);
    }
  }
}
