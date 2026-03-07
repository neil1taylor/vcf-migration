// Handover exporter — bundles localStorage settings into an RVTools Excel copy
import * as XLSX from 'xlsx';

export const SETTINGS_KEYS = [
  'vcf-vm-overrides',
  'vcf-subnet-overrides',
  'vcf-profile-overrides',
  'vcf-custom-profiles',
  'vcf-storage-tier-overrides',
  'vcf-target-location',
  'vcf-target-assignments',
  'vcf-platform-selection',
  'vcf-timeline-config',
  'vcf-risk-overrides',
  'vcf-vpc-design',
  'vcf-wave-planning-mode',
  'vcf-workflow-progress',
] as const;

export function generateHandoverFile(
  originalBuffer: ArrayBuffer,
  originalFileName: string
): Uint8Array {
  const workbook = XLSX.read(originalBuffer, { type: 'array' });

  // Remove existing _vcfSettings sheet if present
  const existingIdx = workbook.SheetNames.indexOf('_vcfSettings');
  if (existingIdx !== -1) {
    workbook.SheetNames.splice(existingIdx, 1);
    delete workbook.Sheets['_vcfSettings'];
    if (workbook.Workbook?.Sheets) {
      workbook.Workbook.Sheets.splice(existingIdx, 1);
    }
  }

  // Collect settings from localStorage
  const rows: string[][] = [['key', 'value']];

  // Add metadata
  rows.push(['_vcfSettingsVersion', '1']);
  rows.push(['_exportDate', new Date().toISOString()]);
  rows.push(['_sourceFileName', originalFileName]);

  for (const key of SETTINGS_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      rows.push([key, value]);
    }
  }

  // Create the settings sheet
  const settingsSheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, settingsSheet, '_vcfSettings');

  // Set sheet as veryHidden
  if (!workbook.Workbook) workbook.Workbook = {};
  if (!workbook.Workbook.Sheets) workbook.Workbook.Sheets = [];
  // Ensure the Sheets array has entries for all sheets
  while (workbook.Workbook.Sheets.length < workbook.SheetNames.length) {
    workbook.Workbook.Sheets.push({});
  }
  const settingsIdx = workbook.SheetNames.indexOf('_vcfSettings');
  workbook.Workbook.Sheets[settingsIdx] = { Hidden: 2 };

  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
}

export function downloadHandoverFile(
  originalBuffer: ArrayBuffer,
  originalFileName: string
): void {
  const data = generateHandoverFile(originalBuffer, originalFileName);
  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateSuffix = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  // Strip extension from original filename
  const baseName = originalFileName.replace(/\.(xlsx|xls)$/i, '');

  const link = document.createElement('a');
  link.href = url;
  link.download = `${baseName}_coe_${dateSuffix}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
