// Unit tests for vMemory parser
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseVMemory } from './vMemoryParser';

function createMockSheet(headers: string[], rows: unknown[][]): XLSX.WorkSheet {
  const data = [headers, ...rows];
  return XLSX.utils.aoa_to_sheet(data);
}

describe('parseVMemory', () => {
  describe('basic parsing', () => {
    it('parses memory data with standard column names', () => {
      const headers = [
        'VM', 'Powerstate', 'Template', 'Size MB', 'Shares',
        'Reservation', 'Limit', 'Hot Add'
      ];
      const rows = [
        ['web-server-01', 'poweredOn', false, 8192, 81920, 0, -1, true],
        ['db-server-01', 'poweredOff', false, 16384, 163840, 4096, 16384, false],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVMemory(sheet);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        vmName: 'web-server-01',
        powerState: 'poweredOn',
        template: false,
        memoryMiB: 8192,
        shares: 81920,
        reservation: 0,
        limit: -1,
        hotAddEnabled: true,
      });
      expect(result[1]).toMatchObject({
        vmName: 'db-server-01',
        memoryMiB: 16384,
        reservation: 4096,
        hotAddEnabled: false,
      });
    });

    it('parses memory data with alternative column names', () => {
      const headers = [
        'VM Name', 'Power State', 'Memory MB', 'Memory Shares',
        'Memory Reservation', 'Memory Limit', 'Memory Hot Add'
      ];
      const rows = [
        ['app-server', 'poweredOn', 4096, 40960, 1024, 8192, true],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVMemory(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        vmName: 'app-server',
        memoryMiB: 4096,
        shares: 40960,
        reservation: 1024,
        limit: 8192,
        hotAddEnabled: true,
      });
    });
  });

  describe('memory usage fields', () => {
    it('parses active, consumed, ballooned, swapped, and compressed', () => {
      const headers = [
        'VM', 'Size MB', 'Active', 'Consumed', 'Ballooned', 'Swapped', 'Compressed'
      ];
      const rows = [
        ['vm1', 8192, 4096, 6144, 512, 256, 128],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVMemory(sheet);

      expect(result[0].active).toBe(4096);
      expect(result[0].consumed).toBe(6144);
      expect(result[0].ballooned).toBe(512);
      expect(result[0].swapped).toBe(256);
      expect(result[0].compressed).toBe(128);
    });

    it('returns null for missing usage fields', () => {
      const headers = ['VM', 'Size MB'];
      const rows = [['vm1', 8192]];

      const sheet = createMockSheet(headers, rows);
      const result = parseVMemory(sheet);

      expect(result[0].active).toBeNull();
      expect(result[0].consumed).toBeNull();
      expect(result[0].ballooned).toBeNull();
      expect(result[0].swapped).toBeNull();
      expect(result[0].compressed).toBeNull();
    });

    it('handles alternative usage column names', () => {
      const headers = ['VM', 'Active MB', 'Consumed MB', 'Ballooned MB', 'Swapped MB', 'Compressed MB'];
      const rows = [
        ['vm1', 2048, 3072, 512, 256, 128],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVMemory(sheet);

      expect(result[0].active).toBe(2048);
      expect(result[0].consumed).toBe(3072);
      expect(result[0].ballooned).toBe(512);
      expect(result[0].swapped).toBe(256);
      expect(result[0].compressed).toBe(128);
    });
  });

  describe('entitlement fields', () => {
    it('parses entitlement and DRS entitlement', () => {
      const headers = ['VM', 'Entitlement', 'DRS Entitlement'];
      const rows = [
        ['vm1', 4096, 3500],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVMemory(sheet);

      expect(result[0].entitlement).toBe(4096);
      expect(result[0].drsEntitlement).toBe(3500);
    });

    it('returns null for missing entitlement fields', () => {
      const headers = ['VM'];
      const rows = [['vm1']];

      const sheet = createMockSheet(headers, rows);
      const result = parseVMemory(sheet);

      expect(result[0].entitlement).toBeNull();
      expect(result[0].drsEntitlement).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty sheet', () => {
      const sheet = XLSX.utils.aoa_to_sheet([]);
      const result = parseVMemory(sheet);
      expect(result).toEqual([]);
    });

    it('filters out rows without VM name', () => {
      const headers = ['VM', 'Size MB'];
      const rows = [
        ['vm1', 4096],
        ['', 2048],
        ['vm2', 8192],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVMemory(sheet);

      expect(result).toHaveLength(2);
    });

    it('defaults missing numeric fields to 0', () => {
      const headers = ['VM'];
      const rows = [['vm1']];

      const sheet = createMockSheet(headers, rows);
      const result = parseVMemory(sheet);

      expect(result[0].memoryMiB).toBe(0);
      expect(result[0].shares).toBe(0);
      expect(result[0].reservation).toBe(0);
      expect(result[0].limit).toBe(0);
    });
  });
});
