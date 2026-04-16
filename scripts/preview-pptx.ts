#!/usr/bin/env npx vite-node
/**
 * PPTX Visual Preview Script
 *
 * Generates a PPTX report from test fixtures, converts slides to PNG images
 * via LibreOffice, and prints the paths for visual inspection.
 *
 * Usage: npm run preview:pptx
 * Output: tmp/preview.pptx + tmp/pptx-slides/slide-*.png
 *
 * Note: All execSync calls use only hardcoded/internal paths — no user input.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, execFileSync } from 'child_process';
import * as XLSX from 'xlsx';

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
import type { PptxExportOptions } from '@/services/export/pptx/types';

// Title slide is mocked via vite-preview.config.ts alias (no window.location in Node)
// Patch JSZip.loadAsync to handle Node.js Blob (which lacks .arrayBuffer() in some builds)
import JSZip from 'jszip';
const origLoadAsync = JSZip.loadAsync.bind(JSZip);
JSZip.loadAsync = async function(data: unknown, options?: object) {
  if (data instanceof Blob) {
    const ab = await data.arrayBuffer();
    return origLoadAsync(ab, options);
  }
  return origLoadAsync(data, options);
} as typeof JSZip.loadAsync;

import { generatePptxReport } from '@/services/export/pptx/index';
import { getPlatformSelectionExport, getTimelineExport, getWavePlanningPreference } from '@/services/export/docx/types';
import { buildDefaultTimeline } from '@/services/migration/timelineEstimation';

// Accept optional input file as CLI argument: npm run preview:pptx -- /path/to/file.xlsx
const INPUT_FILE = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '../e2e/fixtures/test-rvtools.xlsx');
const OUTPUT_DIR = path.resolve(__dirname, '../tmp');
const SLIDES_DIR = path.resolve(OUTPUT_DIR, 'pptx-slides');
const PPTX_PATH = path.resolve(OUTPUT_DIR, 'preview.pptx');

/**
 * Extract localStorage settings from a handover file's _vcfSettings sheet.
 * Populates globalThis.localStorage so getPlatformSelectionExport/getWavePlanningPreference work.
 */
function loadHandoverSettings(workbook: XLSX.WorkBook): boolean {
  if (!workbook.SheetNames.includes('_vcfSettings')) return false;

  const rows = XLSX.utils.sheet_to_json<{ key: string; value: string }>(
    workbook.Sheets['_vcfSettings']
  );

  // Create a minimal localStorage shim
  const store: Record<string, string> = {};
  for (const row of rows) {
    if (!row.key || row.key.startsWith('_') || typeof row.value !== 'string') continue;
    store[row.key] = row.value;
  }

  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };

  const settingCount = Object.keys(store).length;
  console.log(`  Handover file detected: ${settingCount} settings loaded`);
  return settingCount > 0;
}

function parseFixture(): RVToolsData {
  const buffer = fs.readFileSync(INPUT_FILE);
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheets = workbook.SheetNames;

  // If handover file, load bundled localStorage settings
  loadHandoverSettings(workbook);

  const parseSheet = <T>(name: string, parser: (sheet: XLSX.WorkSheet) => T[]): T[] =>
    sheets.includes(name) ? parser(workbook.Sheets[name]) : [];

  return {
    metadata: {
      fileName: path.basename(INPUT_FILE),
      collectionDate: new Date(),
      vCenterVersion: '8.0.0',
      environment: 'Preview',
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

function findSoffice(): string {
  const candidates = [
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/usr/local/bin/soffice',
    '/usr/bin/soffice',
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  try {
    return execSync('which soffice', { encoding: 'utf-8' }).trim();
  } catch {
    console.error(
      'LibreOffice not found. Install with: brew install --cask libreoffice',
    );
    process.exit(1);
  }
}

function convertPdfToPngs(pdfPath: string, slidesDir: string): void {
  // Write a temp Python script to avoid shell quoting issues
  const scriptPath = path.join(OUTPUT_DIR, '_convert.py');
  fs.writeFileSync(scriptPath, `
import sys, os

# Suppress MuPDF C-level stderr warnings
_stderr = os.dup(2)
os.dup2(os.open(os.devnull, os.O_WRONLY), 2)

pdf_path = sys.argv[1]
slides_dir = sys.argv[2]

try:
    import fitz
    doc = fitz.open(pdf_path)
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=200)
        pix.save(os.path.join(slides_dir, f"slide-{i+1:02d}.png"))
    os.dup2(_stderr, 2)
    print(f"Exported {len(doc)} slides")
except ImportError:
    import Quartz
    from CoreFoundation import CFURLCreateFromFileSystemRepresentation
    url = Quartz.CFURLCreateFromFileSystemRepresentation(None, pdf_path.encode(), len(pdf_path.encode()), False)
    pdf = Quartz.CGPDFDocumentCreateWithURL(url)
    n = Quartz.CGPDFDocumentGetNumberOfPages(pdf)
    for i in range(1, n + 1):
        page = Quartz.CGPDFDocumentGetPage(pdf, i)
        rect = Quartz.CGPDFPageGetBoxRect(page, Quartz.kCGPDFMediaBox)
        scale = 2.0
        w = int(rect.size.width * scale)
        h = int(rect.size.height * scale)
        cs = Quartz.CGColorSpaceCreateDeviceRGB()
        ctx = Quartz.CGBitmapContextCreate(None, w, h, 8, 4 * w, cs, Quartz.kCGImageAlphaPremultipliedLast)
        Quartz.CGContextScaleCTM(ctx, scale, scale)
        Quartz.CGContextDrawPDFPage(ctx, page)
        image = Quartz.CGBitmapContextCreateImage(ctx)
        out_path = os.path.join(slides_dir, f"slide-{i:02d}.png")
        url_out = Quartz.CFURLCreateFromFileSystemRepresentation(None, out_path.encode(), len(out_path.encode()), False)
        dest = Quartz.CGImageDestinationCreateWithURL(url_out, "public.png", 1, None)
        Quartz.CGImageDestinationAddImage(dest, image, None)
        Quartz.CGImageDestinationFinalize(dest)
    print(f"Exported {n} slides (Quartz)")
`);

  const result = execFileSync('python3', [scriptPath, pdfPath, slidesDir], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  console.log(`  ${result.trim()}`);
  fs.unlinkSync(scriptPath);
}

async function main() {
  console.log('=== PPTX Visual Preview ===\n');
  console.log(`Input: ${INPUT_FILE}\n`);

  // 1. Parse fixture
  console.log('Parsing fixture...');
  const data = parseFixture();
  console.log(`  ${data.vInfo.length} VMs loaded`);

  // 2. Generate PPTX — extract settings from handover file if available
  const platformSelection = getPlatformSelectionExport(data);
  const wavePlanningPreference = getWavePlanningPreference();

  if (platformSelection) {
    console.log(`  Platform selection: ${platformSelection.score.leaning} (${platformSelection.score.answeredCount} answers)`);
  }
  if (wavePlanningPreference) {
    console.log(`  Wave planning: ${wavePlanningPreference.wavePlanningMode} / ${wavePlanningPreference.networkGroupBy}`);
  }

  const timelineExport = getTimelineExport(data);
  if (timelineExport) {
    console.log(`  Timeline: ${timelineExport.phases.length} phases (from settings)`);
  } else {
    console.log('  Timeline: using synthetic default phases');
  }

  const options: PptxExportOptions = {
    clientName: 'Preview Client',
    preparedBy: 'PPTX Preview Script',
    companyName: 'Preview Corp',
    includeROKS: true,
    includeVSI: true,
    platformSelection,
    wavePlanningPreference,
    timelinePhases: timelineExport?.phases ?? buildDefaultTimeline(3, undefined, [2, 5, 8], ['Pilot', 'Wave 1', 'Wave 2', 'Wave 3'], [50, 200, 500, 800]),
    timelineStartDate: timelineExport?.startDate ?? new Date(),
  };

  console.log('Generating PPTX...');
  const blob = await generatePptxReport(data, options);

  // 3. Write PPTX to disk
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const arrayBuffer = await blob.arrayBuffer();
  fs.writeFileSync(PPTX_PATH, Buffer.from(arrayBuffer));
  console.log(`  Written to ${PPTX_PATH} (${(arrayBuffer.byteLength / 1024).toFixed(0)} KB)`);

  // 4. Convert to PNGs via LibreOffice
  const soffice = findSoffice();
  console.log('Converting slides to PNG...');

  // Clean old slides
  if (fs.existsSync(SLIDES_DIR)) {
    fs.rmSync(SLIDES_DIR, { recursive: true });
  }
  fs.mkdirSync(SLIDES_DIR, { recursive: true });

  // PPTX → PDF (preserves individual pages)
  execSync(
    `"${soffice}" --headless --convert-to pdf --outdir "${OUTPUT_DIR}" "${PPTX_PATH}"`,
    { stdio: 'pipe' },
  );

  const pdfPath = path.join(OUTPUT_DIR, 'preview.pdf');
  if (!fs.existsSync(pdfPath)) {
    console.error('PDF conversion failed');
    process.exit(1);
  }

  // PDF pages → individual PNGs
  try {
    convertPdfToPngs(pdfPath, SLIDES_DIR);
  } catch {
    // Fallback: convert PPTX to a single PNG
    console.error('PDF to PNG conversion failed. Falling back to single-file PNG.');
    execSync(
      `"${soffice}" --headless --convert-to png --outdir "${SLIDES_DIR}" "${PPTX_PATH}"`,
      { stdio: 'pipe' },
    );
    const fallbackPng = path.join(SLIDES_DIR, 'preview.png');
    if (fs.existsSync(fallbackPng)) {
      fs.renameSync(fallbackPng, path.join(SLIDES_DIR, 'slide-01.png'));
    }
  }

  // 5. List generated PNGs
  const pngs = fs.readdirSync(SLIDES_DIR)
    .filter(f => f.endsWith('.png'))
    .sort();

  if (pngs.length === 0) {
    console.error('No PNGs generated!');
    process.exit(1);
  }

  console.log(`\nGenerated ${pngs.length} slide images:`);
  for (const png of pngs) {
    console.log(`  ${path.join(SLIDES_DIR, png)}`);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
