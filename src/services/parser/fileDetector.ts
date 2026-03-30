import type { WorkBook } from 'xlsx';
import { isVInventoryFormat } from './vinventoryConverter';
import { isClassicBillingFormat } from '../billing/billingDetector';

export type DetectedFileType = 'rvtools' | 'vinventory' | 'classic-billing' | 'unknown';

/**
 * Detect the type of an uploaded Excel workbook.
 *
 * Check order matters: billing first (to avoid false positive on
 * Summary sheet), then vInventory, then RVTools.
 */
export function detectFileType(workbook: WorkBook): DetectedFileType {
  if (isClassicBillingFormat(workbook)) return 'classic-billing';
  if (isVInventoryFormat(workbook)) return 'vinventory';
  if (workbook.SheetNames.includes('vInfo')) return 'rvtools';
  return 'unknown';
}
