// Parser for vLicense tab - VMware licensing information
import type { VLicenseInfo } from '@/types';
import type { WorkSheet } from 'xlsx';
import { parseSheet, getStringValue, getNumberValue, getDateValue } from './utils';

// Column mappings for vLicense tab
const COLUMN_MAP: Record<string, keyof VLicenseInfo | null> = {
  'Name': 'name',
  'License Name': 'name',
  'Key': 'licenseKey',
  'License Key': 'licenseKey',
  'Total': 'total',
  'Total Licenses': 'total',
  'Used': 'used',
  'Used Licenses': 'used',
  'Expiration Date': 'expirationDate',
  'Expiration': 'expirationDate',
  'Product Name': 'productName',
  'Product': 'productName',
  'Product Version': 'productVersion',
  'Version': 'productVersion',
  'Cost Unit': null,
  'Edition': null,
  'Labels': null,
};

export function parseVLicense(sheet: WorkSheet): VLicenseInfo[] {
  const rows = parseSheet(sheet, COLUMN_MAP);

  return rows.map((row): VLicenseInfo => ({
    name: getStringValue(row, 'name'),
    licenseKey: maskLicenseKey(getStringValue(row, 'licenseKey')),
    total: getNumberValue(row, 'total'),
    used: getNumberValue(row, 'used'),
    expirationDate: getDateValue(row, 'expirationDate'),
    productName: getStringValue(row, 'productName'),
    productVersion: getStringValue(row, 'productVersion'),
  })).filter(license => license.name); // Filter out empty rows
}

// Mask license key for security (show only last 5 chars)
function maskLicenseKey(key: string): string {
  if (!key || key.length <= 5) return key;
  return '*****-*****-*****-' + key.slice(-5);
}
