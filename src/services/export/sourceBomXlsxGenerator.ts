// Source Infrastructure BOM Excel Generator
import ExcelJS from 'exceljs';
import type { SourceBOMResult } from '../sourceBom';

const STYLES = {
  headerBlack: {
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF262626' } },
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
  },
  currency: {
    numFmt: '"$"#,##0.00',
  },
  totalRow: {
    font: { bold: true },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD4EDDA' } },
  },
};

function applyHeaderStyle(row: ExcelJS.Row, headers: string[]) {
  headers.forEach((val, i) => {
    const cell = row.getCell(i + 1);
    cell.value = val;
    cell.fill = STYLES.headerBlack.fill;
    cell.font = STYLES.headerBlack.font;
  });
}

/**
 * Generate Source Infrastructure BOM as an Excel workbook.
 */
export async function generateSourceBOMExcel(
  bomResult: SourceBOMResult,
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VCF Migration Tool';
  workbook.created = new Date();
  const { estimate } = bomResult;

  // === BOM Summary Sheet ===
  const summarySheet = workbook.addWorksheet('BOM Summary');
  summarySheet.columns = [
    { width: 18 }, // Category
    { width: 40 }, // Description
    { width: 40 }, // Details
    { width: 15 }, // Qty
    { width: 14 }, // Unit Cost
    { width: 14 }, // Monthly
    { width: 14 }, // Annual
  ];

  applyHeaderStyle(summarySheet.getRow(1), ['Category', 'Description', 'Details', 'Qty', 'Unit Cost', 'Monthly', 'Annual']);

  let row = 2;
  for (const item of estimate.lineItems) {
    const r = summarySheet.getRow(row);
    r.getCell(1).value = item.category;
    r.getCell(2).value = item.description;
    r.getCell(3).value = item.notes || '';
    r.getCell(4).value = `${item.quantity.toLocaleString()} ${item.unit}`;
    r.getCell(5).value = item.unitCost;
    r.getCell(5).numFmt = STYLES.currency.numFmt;
    r.getCell(6).value = item.monthlyCost;
    r.getCell(6).numFmt = STYLES.currency.numFmt;
    r.getCell(7).value = item.annualCost;
    r.getCell(7).numFmt = STYLES.currency.numFmt;
    row++;
  }

  // Total row
  const totalRow = summarySheet.getRow(row);
  totalRow.getCell(1).value = 'Total';
  summarySheet.mergeCells(row, 1, row, 5);
  totalRow.getCell(6).value = estimate.totalMonthly;
  totalRow.getCell(6).numFmt = STYLES.currency.numFmt;
  totalRow.getCell(7).value = estimate.totalAnnual;
  totalRow.getCell(7).numFmt = STYLES.currency.numFmt;
  for (let col = 1; col <= 7; col++) {
    totalRow.getCell(col).fill = STYLES.totalRow.fill;
    totalRow.getCell(col).font = STYLES.totalRow.font;
  }

  // === Host Mapping Sheet ===
  const hostSheet = workbook.addWorksheet('Host Mapping');
  hostSheet.columns = [
    { width: 25 }, // Host Name
    { width: 18 }, // Cluster
    { width: 12 }, // Source Cores
    { width: 16 }, // Source Memory
    { width: 30 }, // CPU Model
    { width: 25 }, // Matched Profile
    { width: 14 }, // Profile Cores
    { width: 16 }, // Profile Memory
    { width: 14 }, // Monthly Cost
  ];

  applyHeaderStyle(hostSheet.getRow(1), [
    'Host Name', 'Cluster', 'Source Cores', 'Source Memory (GiB)',
    'CPU Model', 'IBM Cloud Profile', 'Profile Cores', 'Profile Memory (GiB)', 'Monthly Cost',
  ]);

  bomResult.hostMappings.forEach((m, i) => {
    const r = hostSheet.getRow(i + 2);
    r.getCell(1).value = m.hostName;
    r.getCell(2).value = m.cluster;
    r.getCell(3).value = m.sourceCores;
    r.getCell(4).value = m.sourceMemoryGiB;
    r.getCell(5).value = m.sourceCpuModel;
    r.getCell(6).value = m.matchedProfile;
    r.getCell(7).value = m.matchedProfileCores;
    r.getCell(8).value = m.matchedProfileMemoryGiB;
    r.getCell(9).value = m.profileMonthlyCost;
    r.getCell(9).numFmt = STYLES.currency.numFmt;
  });

  // === Storage Mapping Sheet ===
  const storageSheet = workbook.addWorksheet('Storage Mapping');
  storageSheet.columns = [
    { width: 30 }, // Datastore
    { width: 12 }, // Type
    { width: 16 }, // Capacity
    { width: 25 }, // IBM Cloud Target
    { width: 14 }, // Cost/GB
    { width: 14 }, // Monthly Cost
  ];

  const TARGET_LABELS: Record<string, string> = {
    'file-storage': 'File Storage for VPC',
    'block-storage': 'Block Storage for VPC',
    'local-nvme': 'Local NVMe (included)',
  };

  applyHeaderStyle(storageSheet.getRow(1), [
    'Datastore', 'Type', 'Capacity (GiB)', 'IBM Cloud Target', 'Cost/GB/mo', 'Monthly Cost',
  ]);

  bomResult.storageItems.forEach((s, i) => {
    const r = storageSheet.getRow(i + 2);
    r.getCell(1).value = s.datastoreName;
    r.getCell(2).value = s.datastoreType;
    r.getCell(3).value = s.capacityGiB;
    r.getCell(4).value = TARGET_LABELS[s.ibmCloudTarget] ?? s.ibmCloudTarget;
    r.getCell(5).value = s.costPerGBMonth;
    r.getCell(5).numFmt = STYLES.currency.numFmt;
    r.getCell(6).value = s.monthlyCost;
    r.getCell(6).numFmt = STYLES.currency.numFmt;
  });

  return workbook;
}

/**
 * Download Source Infrastructure BOM as xlsx.
 */
export async function downloadSourceBOMExcel(
  bomResult: SourceBOMResult,
  filename?: string,
): Promise<void> {
  const workbook = await generateSourceBOMExcel(bomResult);
  const defaultFilename = `source-infrastructure-bom-${bomResult.estimate.region}-${new Date().toISOString().split('T')[0]}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || defaultFilename;
  a.click();
  URL.revokeObjectURL(url);
}
