// Unit tests for vCPU parser
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseVCPU } from './vCPUParser';

function createMockSheet(headers: string[], rows: unknown[][]): XLSX.WorkSheet {
  const data = [headers, ...rows];
  return XLSX.utils.aoa_to_sheet(data);
}

describe('parseVCPU', () => {
  describe('basic parsing', () => {
    it('parses CPU data with standard column names', () => {
      const headers = [
        'VM', 'Powerstate', 'Template', 'CPUs', 'Sockets', 'Cores per Socket',
        'Shares', 'Reservation', 'Limit', 'Hot Add'
      ];
      const rows = [
        ['web-server-01', 'poweredOn', false, 4, 2, 2, 4000, 0, -1, true],
        ['db-server-01', 'poweredOff', false, 8, 4, 2, 8000, 2000, 8000, false],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCPU(sheet);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        vmName: 'web-server-01',
        powerState: 'poweredOn',
        template: false,
        cpus: 4,
        sockets: 2,
        coresPerSocket: 2,
        shares: 4000,
        reservation: 0,
        limit: -1,
        hotAddEnabled: true,
      });
      expect(result[1]).toMatchObject({
        vmName: 'db-server-01',
        cpus: 8,
        sockets: 4,
        reservation: 2000,
        limit: 8000,
        hotAddEnabled: false,
      });
    });

    it('parses CPU data with alternative column names', () => {
      const headers = [
        'VM Name', 'Power State', 'Num CPU', 'CPU Shares', 'CPU Reservation',
        'CPU Limit', 'CPU Hot Add'
      ];
      const rows = [
        ['app-server', 'poweredOn', 2, 2000, 500, 4000, true],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCPU(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        vmName: 'app-server',
        cpus: 2,
        shares: 2000,
        reservation: 500,
        limit: 4000,
        hotAddEnabled: true,
      });
    });
  });

  describe('numeric fields', () => {
    it('parses all numeric fields correctly', () => {
      const headers = [
        'VM', 'CPUs', 'Sockets', 'Cores per Socket', 'Max CPU',
        'Shares', 'Reservation', 'Entitlement', 'DRS Entitlement', 'Limit'
      ];
      const rows = [
        ['vm1', 16, 4, 4, 32, 16000, 4000, 8000, 6000, 16000],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCPU(sheet);

      expect(result[0].cpus).toBe(16);
      expect(result[0].sockets).toBe(4);
      expect(result[0].coresPerSocket).toBe(4);
      expect(result[0].maxCpu).toBe(32);
      expect(result[0].shares).toBe(16000);
      expect(result[0].reservation).toBe(4000);
      expect(result[0].entitlement).toBe(8000);
      expect(result[0].drsEntitlement).toBe(6000);
      expect(result[0].limit).toBe(16000);
    });

    it('defaults missing numeric fields to 0', () => {
      const headers = ['VM'];
      const rows = [['vm1']];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCPU(sheet);

      expect(result[0].cpus).toBe(0);
      expect(result[0].sockets).toBe(0);
      expect(result[0].shares).toBe(0);
      expect(result[0].reservation).toBe(0);
      expect(result[0].limit).toBe(0);
    });

    it('returns null for missing entitlement fields', () => {
      const headers = ['VM'];
      const rows = [['vm1']];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCPU(sheet);

      expect(result[0].entitlement).toBeNull();
      expect(result[0].drsEntitlement).toBeNull();
    });
  });

  describe('optional fields', () => {
    it('parses overall level', () => {
      const headers = ['VM', 'Overall Level'];
      const rows = [
        ['vm1', 'normal'],
        ['vm2', 'high'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCPU(sheet);

      expect(result[0].overallLevel).toBe('normal');
      expect(result[1].overallLevel).toBe('high');
    });

    it('parses affinity rule', () => {
      const headers = ['VM', 'Affinity Rule'];
      const rows = [
        ['vm1', 'cpu-0,cpu-1'],
        ['vm2', ''],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCPU(sheet);

      expect(result[0].affinityRule).toBe('cpu-0,cpu-1');
      expect(result[1].affinityRule).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty sheet', () => {
      const sheet = XLSX.utils.aoa_to_sheet([]);
      const result = parseVCPU(sheet);
      expect(result).toEqual([]);
    });

    it('filters out rows without VM name', () => {
      const headers = ['VM', 'CPUs'];
      const rows = [
        ['vm1', 4],
        ['', 2],
        ['vm2', 8],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCPU(sheet);

      expect(result).toHaveLength(2);
      expect(result[0].vmName).toBe('vm1');
      expect(result[1].vmName).toBe('vm2');
    });
  });
});
