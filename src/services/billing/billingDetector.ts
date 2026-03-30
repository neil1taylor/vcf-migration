import type { WorkBook } from 'xlsx';

/**
 * Detect whether a workbook is an IBM Cloud Classic billing export.
 *
 * Billing files have "Summary" and "Detailed Billing" sheets
 * but NOT the RVTools/vInventory sheets (vInfo / vmInfo).
 */
export function isClassicBillingFormat(workbook: WorkBook): boolean {
  const sheets = workbook.SheetNames;
  const hasSummary = sheets.includes('Summary');
  const hasDetailedBilling = sheets.some(s => s.startsWith('Detailed Billing'));
  const hasRVToolsSheets = sheets.includes('vInfo') || sheets.includes('vmInfo');
  return hasSummary && hasDetailedBilling && !hasRVToolsSheets;
}
