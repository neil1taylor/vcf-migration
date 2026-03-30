import { describe, it, expect } from 'vitest';
import { isClassicBillingFormat } from '../billingDetector';
import type { WorkBook } from 'xlsx';

function makeWorkbook(sheetNames: string[]): WorkBook {
  return { SheetNames: sheetNames, Sheets: {} } as unknown as WorkBook;
}

describe('isClassicBillingFormat', () => {
  it('returns true for a billing workbook with Summary + Detailed Billing', () => {
    const wb = makeWorkbook(['Summary', 'Bare Metal Servers and Attac...', 'Virtual Servers and Attached...', 'Detailed Billing']);
    expect(isClassicBillingFormat(wb)).toBe(true);
  });

  it('returns false if vInfo sheet is present (RVTools)', () => {
    const wb = makeWorkbook(['Summary', 'Detailed Billing', 'vInfo']);
    expect(isClassicBillingFormat(wb)).toBe(false);
  });

  it('returns false if vmInfo sheet is present (vInventory)', () => {
    const wb = makeWorkbook(['Summary', 'Detailed Billing', 'vmInfo']);
    expect(isClassicBillingFormat(wb)).toBe(false);
  });

  it('returns false if Summary is missing', () => {
    const wb = makeWorkbook(['Detailed Billing', 'Bare Metal Servers']);
    expect(isClassicBillingFormat(wb)).toBe(false);
  });

  it('returns false if Detailed Billing is missing', () => {
    const wb = makeWorkbook(['Summary', 'Bare Metal Servers']);
    expect(isClassicBillingFormat(wb)).toBe(false);
  });

  it('returns false for an empty workbook', () => {
    const wb = makeWorkbook([]);
    expect(isClassicBillingFormat(wb)).toBe(false);
  });
});
