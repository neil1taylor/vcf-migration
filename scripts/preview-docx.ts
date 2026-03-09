#!/usr/bin/env npx vite-node
/**
 * DOCX Preview/Inspection Script
 *
 * Generates a DOCX report from test fixtures, unzips it, and dumps a
 * structured inspection report to stdout. Useful for iterating on DOCX
 * formatting without opening the file manually.
 *
 * Usage: npm run preview:docx
 * Output: Inspection report on stdout + tmp/preview.docx
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

// ── Parse fixture ──────────────────────────────────────────────────
import {
  parseVInfo,
  parseVCPU,
  parseVMemory,
  parseVDisk,
  parseVDatastore,
  parseVSnapshot,
  parseVNetwork,
  parseVCD,
  parseVTools,
  parseVCluster,
  parseVHost,
  parseVLicense,
  parseVRP,
  parseVSource,
} from '@/services/parser/tabParsers';
import type { RVToolsData } from '@/types/rvtools';

const FIXTURE_PATH = path.resolve(__dirname, '../e2e/fixtures/test-rvtools.xlsx');
const OUT_DIR = path.resolve(__dirname, '../tmp');
const OUT_PATH = path.join(OUT_DIR, 'preview.docx');

function loadFixture(): RVToolsData {
  const buffer = fs.readFileSync(FIXTURE_PATH);
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheets = workbook.SheetNames;

  const parseSheet = <T>(name: string, parser: (sheet: XLSX.WorkSheet) => T[]): T[] =>
    sheets.includes(name) ? parser(workbook.Sheets[name]) : [];

  return {
    metadata: {
      fileName: 'test-rvtools.xlsx',
      collectionDate: new Date(),
      vCenterVersion: '8.0.0',
      environment: 'Test',
    },
    vInfo: parseSheet('vInfo', parseVInfo),
    vCPU: parseSheet('vCPU', parseVCPU),
    vMemory: parseSheet('vMemory', parseVMemory),
    vDisk: parseSheet('vDisk', parseVDisk),
    vDatastore: parseSheet('vDatastore', parseVDatastore),
    vSnapshot: parseSheet('vSnapshot', parseVSnapshot),
    vNetwork: parseSheet('vNetwork', parseVNetwork),
    vCD: parseSheet('vCD', parseVCD),
    vTools: parseSheet('vTools', parseVTools),
    vCluster: parseSheet('vCluster', parseVCluster),
    vHost: parseSheet('vHost', parseVHost),
    vLicense: parseSheet('vLicense', parseVLicense),
    vResourcePool: parseSheet('vRP', parseVRP),
    vSource: parseSheet('vSource', parseVSource),
    vHealth: [],
  };
}

// Chart module is mocked via vite-preview.config.ts alias (no canvas in Node)
import { generateDocxReport } from '@/services/export/docx/index';
import { getTimelineExport } from '@/services/export/docx/types';
import type { DocxExportOptions } from '@/services/export/docx/types';
import { buildDefaultTimeline } from '@/services/migration/timelineEstimation';

// ── XML inspection helpers ─────────────────────────────────────────

interface HeadingEntry {
  level: number;
  text: string;
}

function extractHeadings(xml: string): HeadingEntry[] {
  const headings: HeadingEntry[] = [];
  // Match paragraphs with heading styles
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let pMatch;
  while ((pMatch = pRegex.exec(xml)) !== null) {
    const pContent = pMatch[1];
    // Check for heading style
    const styleMatch = pContent.match(/<w:pStyle\s+w:val="Heading(\d)"/);
    if (!styleMatch) continue;
    const level = parseInt(styleMatch[1], 10);
    // Extract all text runs
    const texts: string[] = [];
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      if (tMatch[1]) texts.push(tMatch[1]);
    }
    if (texts.length > 0) {
      headings.push({ level, text: texts.join('') });
    }
  }
  return headings;
}

function countTables(xml: string): number {
  const matches = xml.match(/<w:tbl\b/g);
  return matches ? matches.length : 0;
}

function extractFonts(xml: string): string[] {
  const fonts = new Set<string>();
  const regex = /w:rFonts[^>]*?w:ascii="([^"]+)"/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    fonts.add(match[1]);
  }
  return Array.from(fonts).sort();
}

function extractColors(xml: string): string[] {
  const colors = new Set<string>();
  // w:color val
  let regex = /w:color\s+w:val="([0-9a-fA-F]{6})"/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    colors.add('#' + match[1].toLowerCase());
  }
  // shading fill
  regex = /w:shd[^>]*?w:fill="([0-9a-fA-F]{6})"/g;
  while ((match = regex.exec(xml)) !== null) {
    colors.add('#' + match[1].toLowerCase());
  }
  return Array.from(colors).sort();
}

function extractFontSizes(xml: string): number[] {
  const sizes = new Set<number>();
  const regex = /<w:sz\s+w:val="(\d+)"/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    sizes.add(parseInt(match[1], 10));
  }
  return Array.from(sizes).sort((a, b) => a - b);
}

function extractSectionPreviews(xml: string, headings: HeadingEntry[]): Map<string, string> {
  const previews = new Map<string, string>();
  // For each H1 heading, grab up to 200 chars of body text following it
  for (const heading of headings) {
    if (heading.level !== 1) continue;
    const escapedText = heading.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedText + '[\\s\\S]*?(?=<w:pStyle\\s+w:val="Heading1"|$)');
    const sectionMatch = regex.exec(xml);
    if (!sectionMatch) continue;
    // Extract body text (non-heading paragraphs)
    const bodyTexts: string[] = [];
    const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
    let pMatch;
    const sectionXml = sectionMatch[0];
    while ((pMatch = pRegex.exec(sectionXml)) !== null) {
      const pContent = pMatch[1];
      if (/<w:pStyle\s+w:val="Heading/.test(pContent)) continue;
      const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let tMatch;
      while ((tMatch = tRegex.exec(pContent)) !== null) {
        if (tMatch[1].trim()) bodyTexts.push(tMatch[1].trim());
      }
    }
    const preview = bodyTexts.join(' ').slice(0, 200);
    if (preview) previews.set(heading.text, preview);
  }
  return previews;
}

function countImages(xml: string): number {
  const matches = xml.match(/<w:drawing/g);
  return matches ? matches.length : 0;
}

function countPageBreaks(xml: string): number {
  const matches = xml.match(/<w:br\s+w:type="page"/g);
  return matches ? matches.length : 0;
}

// ── Formatting lint checks ─────────────────────────────────────────

interface LintIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  context?: string;
}

// Minimum spacing (in twips) expected before/after tables and headings
const MIN_TABLE_SPACING = 100; // ~5pt — anything less looks cramped
const MIN_HEADING_BEFORE_SPACING = 150; // ~7.5pt before headings
const EXPECTED_FONT = 'IBM Plex Sans';

/**
 * Parse the document into a flat sequence of block-level elements
 * (paragraphs and tables) with their properties for adjacency checks.
 */
interface BlockElement {
  type: 'paragraph' | 'table';
  index: number;         // position in document
  xml: string;           // raw XML
  // Paragraph-specific
  isHeading?: boolean;
  headingLevel?: number;
  headingText?: string;
  spacingBefore?: number; // twips
  spacingAfter?: number;  // twips
  hasPageBreak?: boolean;
  isEmpty?: boolean;      // no text content
  font?: string;
  fontSize?: number;      // half-points
}

function parseBlocks(xml: string): BlockElement[] {
  const blocks: BlockElement[] = [];
  // Match top-level <w:p> and <w:tbl> elements in document order
  const blockRegex = /(<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[^>]*>[\s\S]*?<\/w:p>)/g;
  let match;
  let index = 0;
  while ((match = blockRegex.exec(xml)) !== null) {
    const raw = match[1];
    if (raw.startsWith('<w:tbl')) {
      blocks.push({ type: 'table', index: index++, xml: raw });
    } else {
      const block: BlockElement = { type: 'paragraph', index: index++, xml: raw };
      // Heading?
      const styleMatch = raw.match(/<w:pStyle\s+w:val="Heading(\d)"/);
      if (styleMatch) {
        block.isHeading = true;
        block.headingLevel = parseInt(styleMatch[1], 10);
        const texts: string[] = [];
        const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
        let tMatch;
        while ((tMatch = tRegex.exec(raw)) !== null) {
          if (tMatch[1]) texts.push(tMatch[1]);
        }
        block.headingText = texts.join('');
      }
      // Spacing
      const spacingMatch = raw.match(/<w:spacing\s+[^>]*?w:before="(\d+)"/);
      if (spacingMatch) block.spacingBefore = parseInt(spacingMatch[1], 10);
      const spacingAfterMatch = raw.match(/<w:spacing\s+[^>]*?w:after="(\d+)"/);
      if (spacingAfterMatch) block.spacingAfter = parseInt(spacingAfterMatch[1], 10);
      // Page break
      block.hasPageBreak = /<w:br\s+w:type="page"/.test(raw);
      // Empty check
      const textContent = raw.replace(/<[^>]+>/g, '').trim();
      block.isEmpty = textContent.length === 0 && !block.hasPageBreak;
      // Font (first run)
      const fontMatch = raw.match(/w:rFonts[^>]*?w:ascii="([^"]+)"/);
      if (fontMatch) block.font = fontMatch[1];
      // Font size (first run)
      const szMatch = raw.match(/<w:sz\s+w:val="(\d+)"/);
      if (szMatch) block.fontSize = parseInt(szMatch[1], 10);

      blocks.push(block);
    }
  }
  return blocks;
}

function runFormattingLint(xml: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const blocks = parseBlocks(xml);

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const prev = i > 0 ? blocks[i - 1] : null;
    const next = i < blocks.length - 1 ? blocks[i + 1] : null;

    // ── Table spacing checks ──
    if (block.type === 'table') {
      // Check paragraph before table
      if (prev && prev.type === 'paragraph' && !prev.hasPageBreak) {
        if (prev.spacingAfter !== undefined && prev.spacingAfter < MIN_TABLE_SPACING) {
          const ctx = prev.isHeading ? `heading "${prev.headingText}"` : 'paragraph';
          issues.push({
            severity: 'warning',
            message: `Table at position ${block.index}: ${ctx} before table has only ${prev.spacingAfter}tw after-spacing (min ${MIN_TABLE_SPACING}tw)`,
            context: truncateText(prev.xml, 80),
          });
        }
        if (prev.isEmpty) {
          issues.push({
            severity: 'info',
            message: `Table at position ${block.index}: empty paragraph before table (may be intentional spacer)`,
          });
        }
      }
      // Check paragraph after table
      if (next && next.type === 'paragraph' && !next.hasPageBreak) {
        if (next.spacingBefore !== undefined && next.spacingBefore < MIN_TABLE_SPACING) {
          const ctx = next.isHeading ? `heading "${next.headingText}"` : 'paragraph';
          issues.push({
            severity: 'warning',
            message: `Table at position ${block.index}: ${ctx} after table has only ${next.spacingBefore}tw before-spacing (min ${MIN_TABLE_SPACING}tw)`,
            context: truncateText(next.xml, 80),
          });
        }
      }
      // Table immediately followed by another table
      if (next && next.type === 'table') {
        issues.push({
          severity: 'warning',
          message: `Back-to-back tables at positions ${block.index} and ${next.index} with no separating paragraph`,
        });
      }
    }

    // ── Heading spacing checks ──
    if (block.type === 'paragraph' && block.isHeading) {
      // Heading with no before-spacing (except after page breaks)
      if (block.spacingBefore !== undefined && block.spacingBefore < MIN_HEADING_BEFORE_SPACING) {
        if (!prev?.hasPageBreak) {
          issues.push({
            severity: 'info',
            message: `Heading "${block.headingText}" (H${block.headingLevel}) has only ${block.spacingBefore}tw before-spacing (expected >=${MIN_HEADING_BEFORE_SPACING}tw)`,
          });
        }
      }
      // Heading immediately after table with no spacing
      if (prev && prev.type === 'table') {
        if (block.spacingBefore !== undefined && block.spacingBefore < 200) {
          issues.push({
            severity: 'warning',
            message: `Heading "${block.headingText}" (H${block.headingLevel}) directly after table has only ${block.spacingBefore}tw before-spacing — may look cramped`,
          });
        }
      }
    }

    // ── Font consistency checks ──
    if (block.type === 'paragraph' && block.font && block.font !== EXPECTED_FONT) {
      issues.push({
        severity: 'warning',
        message: `Unexpected font "${block.font}" at position ${block.index} (expected "${EXPECTED_FONT}")`,
        context: truncateText(block.xml, 80),
      });
    }

    // ── Consecutive empty paragraphs (excessive whitespace) ──
    if (block.type === 'paragraph' && block.isEmpty && prev?.type === 'paragraph' && prev.isEmpty) {
      issues.push({
        severity: 'info',
        message: `Consecutive empty paragraphs at positions ${prev.index} and ${block.index} — may indicate excessive whitespace`,
      });
    }
  }

  // ── Section numbering consistency ──
  const h1Headings = blocks.filter(b => b.isHeading && b.headingLevel === 1 && b.headingText);
  const numberedH1s = h1Headings.filter(b => /^\d+\./.test(b.headingText!));
  let expectedNum = 1;
  for (const h of numberedH1s) {
    const numMatch = h.headingText!.match(/^(\d+)\./);
    if (numMatch) {
      const actual = parseInt(numMatch[1], 10);
      if (actual !== expectedNum) {
        issues.push({
          severity: 'error',
          message: `Section numbering gap: expected ${expectedNum}. but found "${h.headingText}" — numbering is not sequential`,
        });
      }
      expectedNum = actual + 1;
    }
  }

  // ── H2/H3 numbering consistency within sections ──
  const h2Headings = blocks.filter(b => b.isHeading && b.headingLevel === 2 && b.headingText);
  for (const h of h2Headings) {
    const numMatch = h.headingText!.match(/^(\d+)\.(\d+)/);
    if (numMatch) {
      const parentNum = parseInt(numMatch[1], 10);
      // Check parent H1 exists
      const parentH1 = numberedH1s.find(p => p.headingText!.startsWith(`${parentNum}.`));
      if (!parentH1) {
        issues.push({
          severity: 'error',
          message: `H2 "${h.headingText}" references parent section ${parentNum} which doesn't exist`,
        });
      }
    }
  }

  // Check for subsection numbering gaps (e.g., 3.1 → 3.4 skipping 3.2, 3.3)
  const numberedH2s = h2Headings
    .filter(b => /^\d+\.\d+/.test(b.headingText!))
    .map(b => {
      const m = b.headingText!.match(/^(\d+)\.(\d+)/);
      return { parent: parseInt(m![1], 10), sub: parseInt(m![2], 10), text: b.headingText! };
    });

  // Group by parent
  const byParent = new Map<number, typeof numberedH2s>();
  for (const h of numberedH2s) {
    if (!byParent.has(h.parent)) byParent.set(h.parent, []);
    byParent.get(h.parent)!.push(h);
  }
  for (const [parent, subs] of byParent) {
    for (let j = 1; j < subs.length; j++) {
      const expected = subs[j - 1].sub + 1;
      if (subs[j].sub !== expected) {
        issues.push({
          severity: 'error',
          message: `Subsection numbering gap in section ${parent}: "${subs[j - 1].text}" → "${subs[j].text}" (expected ${parent}.${expected})`,
        });
      }
    }
  }

  return issues;
}

function truncateText(xml: string, maxLen: number): string {
  const text = xml.replace(/<[^>]+>/g, '').trim();
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('=== DOCX Preview Generator ===\n');

  // 1. Load fixture data
  console.log('Loading fixture data...');
  const rawData = loadFixture();
  console.log(`  VMs: ${rawData.vInfo.length}, Hosts: ${rawData.vHost.length}, Clusters: ${rawData.vCluster.length}\n`);

  // 2. Generate DOCX
  console.log('Generating DOCX report...');
  const timelineExport = getTimelineExport(rawData);
  if (timelineExport) {
    console.log(`  Timeline: ${timelineExport.phases.length} phases (from settings)\n`);
  } else {
    console.log('  Timeline: using synthetic default phases\n');
  }

  const options: DocxExportOptions = {
    clientName: 'Preview Test Client',
    preparedBy: 'DOCX Preview Script',
    companyName: 'Preview Corp',
    includeROKS: true,
    includeVSI: true,
    includeCosts: true,
    timelinePhases: timelineExport?.phases ?? buildDefaultTimeline(3, undefined, [2, 5, 8], ['Pilot', 'Wave 1', 'Wave 2', 'Wave 3'], [50, 200, 500, 800]),
    timelineStartDate: timelineExport?.startDate ?? new Date(),
  };

  const blob = await generateDocxReport(rawData, options);
  const buffer = Buffer.from(await blob.arrayBuffer());

  // 3. Write DOCX file
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_PATH, buffer);
  const sizeKB = (buffer.length / 1024).toFixed(1);
  console.log(`  Written to: ${OUT_PATH} (${sizeKB} KB)\n`);

  // 4. Unzip and parse
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')!.async('string');

  // 5. Print inspection report
  console.log('═'.repeat(60));
  console.log('  DOCX INSPECTION REPORT');
  console.log('═'.repeat(60));

  // -- Document structure --
  const headings = extractHeadings(documentXml);
  console.log('\n── DOCUMENT STRUCTURE ──────────────────────────────────');
  for (const h of headings) {
    const indent = '  '.repeat(h.level - 1);
    const marker = h.level === 1 ? 'H1' : h.level === 2 ? 'H2' : 'H3';
    console.log(`  ${indent}[${marker}] ${h.text}`);
  }
  console.log(`\n  Total: ${headings.filter(h => h.level === 1).length} H1, ${headings.filter(h => h.level === 2).length} H2, ${headings.filter(h => h.level === 3).length} H3`);

  // -- Style summary --
  console.log('\n── STYLE SUMMARY ──────────────────────────────────────');
  const fonts = extractFonts(documentXml);
  console.log(`  Fonts: ${fonts.length > 0 ? fonts.join(', ') : '(using style defaults)'}`);

  const fontSizes = extractFontSizes(documentXml);
  console.log(`  Font sizes (half-pts): ${fontSizes.join(', ')}`);
  console.log(`  Font sizes (pts):      ${fontSizes.map(s => s / 2).join(', ')}`);

  const colors = extractColors(documentXml);
  console.log(`  Colors: ${colors.join(', ')}`);

  // -- Counts --
  console.log('\n── ELEMENT COUNTS ─────────────────────────────────────');
  console.log(`  Tables:      ${countTables(documentXml)}`);
  console.log(`  Images:      ${countImages(documentXml)}`);
  console.log(`  Page breaks: ${countPageBreaks(documentXml)}`);

  // -- ZIP contents --
  const zipFiles: string[] = [];
  zip.forEach((relativePath) => zipFiles.push(relativePath));
  console.log(`  ZIP entries: ${zipFiles.length}`);

  // -- Formatting lint --
  console.log('\n── FORMATTING LINT ────────────────────────────────────');
  const lintIssues = runFormattingLint(documentXml);
  const errors = lintIssues.filter(i => i.severity === 'error');
  const warnings = lintIssues.filter(i => i.severity === 'warning');
  const infos = lintIssues.filter(i => i.severity === 'info');

  if (lintIssues.length === 0) {
    console.log('  No formatting issues found.');
  } else {
    console.log(`  ${errors.length} errors, ${warnings.length} warnings, ${infos.length} info\n`);
    for (const issue of lintIssues) {
      const icon = issue.severity === 'error' ? 'ERR' : issue.severity === 'warning' ? 'WRN' : 'INF';
      console.log(`  [${icon}] ${issue.message}`);
      if (issue.context) {
        console.log(`        ${issue.context}`);
      }
    }
  }

  // -- Section text previews --
  console.log('\n── SECTION PREVIEWS (first 200 chars) ─────────────────');
  const previews = extractSectionPreviews(documentXml, headings);
  for (const [heading, preview] of previews) {
    console.log(`\n  [${heading}]`);
    console.log(`  ${preview}${preview.length >= 200 ? '...' : ''}`);
  }

  console.log('\n' + '═'.repeat(60));
  if (errors.length > 0) {
    console.log(`  Done with ${errors.length} ERRORS. Fix formatting issues above.`);
  } else if (warnings.length > 0) {
    console.log(`  Done with ${warnings.length} warnings. Review issues above.`);
  } else {
    console.log('  Done. No formatting issues found.');
  }
  console.log(`  DOCX: ${OUT_PATH}`);
  console.log('═'.repeat(60) + '\n');
}

main().catch((err) => {
  console.error('Failed to generate DOCX preview:', err);
  process.exit(1);
});
