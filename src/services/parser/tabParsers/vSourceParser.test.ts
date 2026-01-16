// Unit tests for vSource parser
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseVSource } from './vSourceParser';

function createMockSheet(headers: string[], rows: unknown[][]): XLSX.WorkSheet {
  const data = [headers, ...rows];
  return XLSX.utils.aoa_to_sheet(data);
}

describe('parseVSource', () => {
  describe('basic parsing', () => {
    it('parses vCenter source data with standard column names', () => {
      const headers = [
        'Server', 'IP Address', 'Version', 'Build', 'OS Type',
        'API Version', 'Instance UUID', 'Full Name'
      ];
      const rows = [
        ['vcenter.example.com', '192.168.1.10', '8.0.0', '21216066', 'linux-x64',
         '8.0.0.1', 'abc-123-def-456', 'VMware vCenter Server 8.0.0 build-21216066'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVSource(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        server: 'vcenter.example.com',
        ipAddress: '192.168.1.10',
        version: '8.0.0',
        build: '21216066',
        osType: 'linux-x64',
        apiVersion: '8.0.0.1',
        instanceUuid: 'abc-123-def-456',
        fullName: 'VMware vCenter Server 8.0.0 build-21216066',
      });
    });

    it('parses vCenter source data with alternative column names', () => {
      const headers = [
        'vCenter Server', 'Address', 'vCenter Version', 'Build Number',
        'Operating System', 'ApiVersion', 'Instance Uuid', 'Product Name'
      ];
      const rows = [
        ['vc01.corp.local', '10.0.0.5', '7.0.3', '20990077', 'linux-x64',
         '7.0.3.0', 'xyz-789', 'VMware vCenter Server 7.0.3 build-20990077'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVSource(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        server: 'vc01.corp.local',
        ipAddress: '10.0.0.5',
        version: '7.0.3',
        build: '20990077',
        fullName: 'VMware vCenter Server 7.0.3 build-20990077',
      });
    });
  });

  describe('server identification', () => {
    it('parses various server name formats', () => {
      const headers = ['Server'];
      const rows = [
        ['vcenter.example.com'],
        ['192.168.1.10'],
        ['vc01'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVSource(sheet);

      expect(result[0].server).toBe('vcenter.example.com');
      expect(result[1].server).toBe('192.168.1.10');
      expect(result[2].server).toBe('vc01');
    });
  });

  describe('version information', () => {
    it('parses version and build separately', () => {
      const headers = ['Server', 'Version', 'Build'];
      const rows = [
        ['vc1', '8.0.0', '21216066'],
        ['vc2', '7.0.3', '20990077'],
        ['vc3', '6.7.0', '15129973'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVSource(sheet);

      expect(result[0].version).toBe('8.0.0');
      expect(result[0].build).toBe('21216066');
      expect(result[1].version).toBe('7.0.3');
      expect(result[2].version).toBe('6.7.0');
    });
  });

  describe('date parsing', () => {
    it('parses server time', () => {
      const headers = ['Server', 'Server Time'];
      const rows = [
        ['vc1', '2024-06-15T12:00:00'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVSource(sheet);

      expect(result[0].serverTime).toBeInstanceOf(Date);
    });

    it('returns null for missing server time', () => {
      const headers = ['Server'];
      const rows = [['vc1']];

      const sheet = createMockSheet(headers, rows);
      const result = parseVSource(sheet);

      expect(result[0].serverTime).toBeNull();
    });
  });

  describe('optional fields', () => {
    it('returns null for missing optional fields', () => {
      const headers = ['Server'];
      const rows = [['vc1']];

      const sheet = createMockSheet(headers, rows);
      const result = parseVSource(sheet);

      expect(result[0].ipAddress).toBeNull();
      expect(result[0].version).toBeNull();
      expect(result[0].build).toBeNull();
      expect(result[0].osType).toBeNull();
      expect(result[0].apiVersion).toBeNull();
      expect(result[0].instanceUuid).toBeNull();
      expect(result[0].fullName).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty sheet', () => {
      const sheet = XLSX.utils.aoa_to_sheet([]);
      const result = parseVSource(sheet);
      expect(result).toEqual([]);
    });

    it('filters out rows without server name', () => {
      const headers = ['Server', 'Version'];
      const rows = [
        ['vc1', '8.0.0'],
        ['', '7.0.3'],
        ['vc2', '8.0.0'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVSource(sheet);

      expect(result).toHaveLength(2);
    });

    it('handles multiple vCenter servers', () => {
      const headers = ['Server', 'Version', 'IP Address'];
      const rows = [
        ['vc-prod.example.com', '8.0.0', '192.168.1.10'],
        ['vc-dev.example.com', '7.0.3', '192.168.2.10'],
        ['vc-test.example.com', '8.0.0', '192.168.3.10'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVSource(sheet);

      expect(result).toHaveLength(3);
      expect(result[0].server).toBe('vc-prod.example.com');
      expect(result[1].server).toBe('vc-dev.example.com');
      expect(result[2].server).toBe('vc-test.example.com');
    });
  });
});
