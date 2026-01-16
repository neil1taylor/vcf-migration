// Unit tests for vLicense parser
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseVLicense } from './vLicenseParser';

function createMockSheet(headers: string[], rows: unknown[][]): XLSX.WorkSheet {
  const data = [headers, ...rows];
  return XLSX.utils.aoa_to_sheet(data);
}

describe('parseVLicense', () => {
  describe('basic parsing', () => {
    it('parses license data with standard column names', () => {
      const headers = [
        'Name', 'Key', 'Total', 'Used', 'Product Name', 'Product Version'
      ];
      const rows = [
        ['vSphere Enterprise Plus', 'XXXXX-XXXXX-XXXXX-XXXXX-ABCDE', 100, 80, 'VMware vSphere', '8.0'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVLicense(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'vSphere Enterprise Plus',
        total: 100,
        used: 80,
        productName: 'VMware vSphere',
        productVersion: '8.0',
      });
      // License key should be masked
      expect(result[0].licenseKey).toContain('*****');
      expect(result[0].licenseKey).toContain('ABCDE');
    });

    it('parses license data with alternative column names', () => {
      const headers = [
        'License Name', 'License Key', 'Total Licenses', 'Used Licenses', 'Product', 'Version'
      ];
      const rows = [
        ['vCenter Standard', 'YYYYY-YYYYY-YYYYY-YYYYY-12345', 5, 2, 'VMware vCenter Server', '7.0'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVLicense(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'vCenter Standard',
        total: 5,
        used: 2,
        productName: 'VMware vCenter Server',
        productVersion: '7.0',
      });
    });
  });

  describe('license key masking', () => {
    it('masks license keys showing only last 5 characters', () => {
      const headers = ['Name', 'Key'];
      const rows = [
        ['License1', 'AAAAA-BBBBB-CCCCC-DDDDD-EEEEE'],
        ['License2', 'XXXXX-YYYYY-ZZZZZ-11111-22222'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVLicense(sheet);

      expect(result[0].licenseKey).toBe('*****-*****-*****-EEEEE');
      expect(result[1].licenseKey).toBe('*****-*****-*****-22222');
    });

    it('does not mask short license keys', () => {
      const headers = ['Name', 'Key'];
      const rows = [
        ['License1', 'ABC'],
        ['License2', '12345'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVLicense(sheet);

      expect(result[0].licenseKey).toBe('ABC');
      expect(result[1].licenseKey).toBe('12345');
    });

    it('handles empty license key', () => {
      const headers = ['Name', 'Key'];
      const rows = [
        ['License1', ''],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVLicense(sheet);

      expect(result[0].licenseKey).toBe('');
    });
  });

  describe('license counts', () => {
    it('parses total and used counts', () => {
      const headers = ['Name', 'Total', 'Used'];
      const rows = [
        ['License1', 100, 75],
        ['License2', 50, 50],
        ['License3', 25, 0],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVLicense(sheet);

      expect(result[0].total).toBe(100);
      expect(result[0].used).toBe(75);
      expect(result[1].total).toBe(50);
      expect(result[1].used).toBe(50);
      expect(result[2].total).toBe(25);
      expect(result[2].used).toBe(0);
    });

    it('handles unlimited licenses (0 total)', () => {
      const headers = ['Name', 'Total', 'Used'];
      const rows = [
        ['Unlimited License', 0, 150],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVLicense(sheet);

      expect(result[0].total).toBe(0);
      expect(result[0].used).toBe(150);
    });
  });

  describe('expiration date', () => {
    it('parses expiration date', () => {
      const headers = ['Name', 'Expiration Date'];
      const rows = [
        ['License1', '2025-12-31T00:00:00'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVLicense(sheet);

      expect(result[0].expirationDate).toBeInstanceOf(Date);
    });

    it('returns null for missing expiration date', () => {
      const headers = ['Name'];
      const rows = [['License1']];

      const sheet = createMockSheet(headers, rows);
      const result = parseVLicense(sheet);

      expect(result[0].expirationDate).toBeNull();
    });

    it('returns null for perpetual licenses (no expiration)', () => {
      const headers = ['Name', 'Expiration Date'];
      const rows = [
        ['Perpetual License', ''],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVLicense(sheet);

      expect(result[0].expirationDate).toBeNull();
    });
  });

  describe('product information', () => {
    it('parses product name and version', () => {
      const headers = ['Name', 'Product Name', 'Product Version'];
      const rows = [
        ['vSphere License', 'VMware vSphere', '8.0'],
        ['vCenter License', 'VMware vCenter Server', '8.0.0'],
        ['vSAN License', 'VMware vSAN', '8'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVLicense(sheet);

      expect(result[0].productName).toBe('VMware vSphere');
      expect(result[0].productVersion).toBe('8.0');
      expect(result[1].productName).toBe('VMware vCenter Server');
      expect(result[2].productName).toBe('VMware vSAN');
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty sheet', () => {
      const sheet = XLSX.utils.aoa_to_sheet([]);
      const result = parseVLicense(sheet);
      expect(result).toEqual([]);
    });

    it('filters out rows without license name', () => {
      const headers = ['Name', 'Total'];
      const rows = [
        ['License1', 100],
        ['', 50],
        ['License2', 25],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVLicense(sheet);

      expect(result).toHaveLength(2);
    });

    it('handles multiple license types', () => {
      const headers = ['Name', 'Product Name', 'Total', 'Used'];
      const rows = [
        ['vSphere Enterprise Plus', 'VMware vSphere', 100, 80],
        ['vCenter Standard', 'VMware vCenter Server', 5, 2],
        ['vSAN Enterprise', 'VMware vSAN', 50, 40],
        ['NSX Enterprise Plus', 'VMware NSX', 25, 20],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVLicense(sheet);

      expect(result).toHaveLength(4);
      expect(result.map(l => l.productName)).toEqual([
        'VMware vSphere',
        'VMware vCenter Server',
        'VMware vSAN',
        'VMware NSX',
      ]);
    });
  });
});
