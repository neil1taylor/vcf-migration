import * as XLSX from 'xlsx';
import type {
  ClassicBillingData,
  BillingSummary,
  BillingServerSummary,
  BillingDetailLineItem,
} from './types';

type Row = (string | number | null | undefined)[];

/** Read a sheet as an array of arrays (raw rows). */
function readSheet(workbook: XLSX.WorkBook, sheetName: string): Row[] {
  // Sheet names may be truncated in the workbook — find by prefix
  const match = workbook.SheetNames.find(s => s.startsWith(sheetName));
  if (!match) return [];
  const ws = workbook.Sheets[match];
  return XLSX.utils.sheet_to_json<Row>(ws, { header: 1 });
}

// ---------------------------------------------------------------------------
// Summary sheet
// ---------------------------------------------------------------------------

const SUMMARY_CATEGORY_MAP: Record<string, keyof BillingSummary> = {
  'bare metal servers': 'bareMetalTotal',
  'virtual servers': 'virtualServerTotal',
  'unattached services': 'unattachedServicesTotal',
  'platform services': 'platformServicesTotal',
};

function parseSummary(rows: Row[]): BillingSummary {
  const summary: BillingSummary = {
    bareMetalTotal: 0,
    virtualServerTotal: 0,
    unattachedServicesTotal: 0,
    platformServicesTotal: 0,
    grandTotal: 0,
  };

  for (const row of rows) {
    const label = String(row[0] ?? '').toLowerCase().trim();

    // Match top-level category rows (col 0 has category text, cost near end)
    for (const [pattern, key] of Object.entries(SUMMARY_CATEGORY_MAP)) {
      if (label.includes(pattern)) {
        // Cost is the last numeric value in the row
        const cost = findLastNumber(row);
        if (cost !== null) summary[key] = cost;
        break;
      }
    }

    // Grand total row
    if (label === 'total:' || label === 'total') {
      const cost = findLastNumber(row);
      if (cost !== null) summary.grandTotal = cost;
    }
  }

  // Derive grand total from categories if not found
  if (summary.grandTotal === 0) {
    summary.grandTotal =
      summary.bareMetalTotal +
      summary.virtualServerTotal +
      summary.unattachedServicesTotal +
      summary.platformServicesTotal;
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Bare Metal / Virtual Servers sheets
// ---------------------------------------------------------------------------

function parseServerSheet(
  rows: Row[],
  serverType: 'bare-metal' | 'virtual-server',
): BillingServerSummary[] {
  const servers: BillingServerSummary[] = [];

  for (const row of rows) {
    const hostname = String(row[0] ?? '').trim();
    if (!hostname) continue;

    // Skip header/title/total rows
    const lower = hostname.toLowerCase();
    if (
      lower.includes('description') ||
      lower.includes('servers and attached') ||
      lower.includes('sub-total') ||
      lower.includes('total') ||
      lower.includes('taxes')
    ) continue;

    const cost = findLastNumber(row);
    if (cost === null) continue;

    servers.push({ hostname, totalRecurringFee: cost, serverType });
  }

  return servers;
}

// ---------------------------------------------------------------------------
// Detailed Billing sheet
// ---------------------------------------------------------------------------

function parseDetailedBilling(rows: Row[]): BillingDetailLineItem[] {
  const items: BillingDetailLineItem[] = [];
  let currentServer = '';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const col0 = String(row[0] ?? '').trim();
    if (!col0) continue;

    const lower = col0.toLowerCase();

    // Skip title/total/sub-total rows
    if (
      lower === 'detailed billing' ||
      lower.startsWith('total:') ||
      lower.startsWith('amount due') ||
      lower.startsWith('sub-total')
    ) continue;

    const col5 = String(row[5] ?? '').trim().toLowerCase();

    // Header row: server/service name in col 0 + "Category Group" in col 5
    // This sets the current server context for subsequent line items
    if (col5 === 'category group') {
      currentServer = col0;
      continue;
    }

    // Line item: has a category string in col 5 and belongs to current server
    if (col5 && currentServer) {
      items.push({
        serverOrServiceName: currentServer,
        description: col0,
        category: String(row[5] ?? '').trim(),
        location: String(row[6] ?? '').trim(),
        recurringFee: typeof row[7] === 'number' ? row[7] : 0,
      });
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function parseClassicBilling(
  workbook: XLSX.WorkBook,
  fileName: string,
): ClassicBillingData {
  const warnings: string[] = [];

  const summaryRows = readSheet(workbook, 'Summary');
  const bmRows = readSheet(workbook, 'Bare Metal Servers');
  const vsRows = readSheet(workbook, 'Virtual Servers');
  const detailRows = readSheet(workbook, 'Detailed Billing');

  const summary = parseSummary(summaryRows);
  const bareMetalServers = parseServerSheet(bmRows, 'bare-metal');
  const virtualServers = parseServerSheet(vsRows, 'virtual-server');
  const detailedLineItems = parseDetailedBilling(detailRows);

  if (bareMetalServers.length === 0 && virtualServers.length === 0) {
    warnings.push('No servers found in billing export.');
  }

  if (detailedLineItems.length === 0) {
    warnings.push('No detailed billing line items found.');
  }

  return {
    summary,
    bareMetalServers,
    virtualServers,
    detailedLineItems,
    fileName,
    parseWarnings: warnings,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findLastNumber(row: Row): number | null {
  for (let i = row.length - 1; i >= 0; i--) {
    if (typeof row[i] === 'number') return row[i] as number;
  }
  return null;
}
