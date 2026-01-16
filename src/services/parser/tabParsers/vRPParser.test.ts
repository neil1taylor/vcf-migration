// Unit tests for vRP (Resource Pool) parser
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseVRP } from './vRPParser';

function createMockSheet(headers: string[], rows: unknown[][]): XLSX.WorkSheet {
  const data = [headers, ...rows];
  return XLSX.utils.aoa_to_sheet(data);
}

describe('parseVRP', () => {
  describe('basic parsing', () => {
    it('parses resource pool data with standard column names', () => {
      const headers = [
        'Name', 'Config Status', 'CPU Reservation', 'CPU Limit', 'CPU Expandable',
        'CPU Shares', 'Memory Reservation', 'Memory Limit', 'Memory Expandable',
        'Memory Shares', '# VMs', 'Datacenter', 'Cluster'
      ];
      const rows = [
        ['Production', 'green', 10000, -1, true, 4000, 8192, -1, true, 163840, 25, 'DC1', 'Prod-Cluster'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVRP(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'Production',
        configStatus: 'green',
        cpuReservation: 10000,
        cpuLimit: -1,
        cpuExpandable: true,
        cpuShares: 4000,
        memoryReservation: 8192,
        memoryLimit: -1,
        memoryExpandable: true,
        memoryShares: 163840,
        vmCount: 25,
        datacenter: 'DC1',
        cluster: 'Prod-Cluster',
      });
    });

    it('parses resource pool data with alternative column names', () => {
      const headers = [
        'Resource Pool Name', 'CPU reservation', 'CPU limit', 'CPU shares',
        'Mem reservation', 'Mem limit', 'Mem shares', '# VMs total', 'Datacenter', 'Cluster'
      ];
      const rows = [
        ['Development', 5000, 20000, 2000, 4096, 16384, 81920, 10, 'DC2', 'Dev-Cluster'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVRP(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'Development',
        cpuReservation: 5000,
        cpuLimit: 20000,
        cpuShares: 2000,
        memoryReservation: 4096,
        memoryLimit: 16384,
        memoryShares: 81920,
        vmCount: 10,
      });
    });
  });

  describe('CPU resources', () => {
    it('parses CPU reservation, limit, and shares', () => {
      const headers = ['Name', 'CPU Reservation', 'CPU Limit', 'CPU Shares', 'Datacenter', 'Cluster'];
      const rows = [
        ['RP1', 10000, 50000, 4000, 'DC1', 'C1'],
        ['RP2', 0, -1, 2000, 'DC1', 'C1'], // -1 = unlimited
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVRP(sheet);

      expect(result[0].cpuReservation).toBe(10000);
      expect(result[0].cpuLimit).toBe(50000);
      expect(result[0].cpuShares).toBe(4000);
      expect(result[1].cpuLimit).toBe(-1);
    });

    it('parses CPU expandable reservation', () => {
      const headers = ['Name', 'CPU Expandable', 'Datacenter', 'Cluster'];
      const rows = [
        ['RP1', true, 'DC1', 'C1'],
        ['RP2', false, 'DC1', 'C1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVRP(sheet);

      expect(result[0].cpuExpandable).toBe(true);
      expect(result[1].cpuExpandable).toBe(false);
    });
  });

  describe('memory resources', () => {
    it('parses memory reservation, limit, and shares', () => {
      const headers = ['Name', 'Memory Reservation', 'Memory Limit', 'Memory Shares', 'Datacenter', 'Cluster'];
      const rows = [
        ['RP1', 16384, 65536, 163840, 'DC1', 'C1'],
        ['RP2', 0, -1, 81920, 'DC1', 'C1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVRP(sheet);

      expect(result[0].memoryReservation).toBe(16384);
      expect(result[0].memoryLimit).toBe(65536);
      expect(result[0].memoryShares).toBe(163840);
      expect(result[1].memoryLimit).toBe(-1);
    });

    it('parses memory expandable reservation', () => {
      const headers = ['Name', 'Memory Expandable', 'Datacenter', 'Cluster'];
      const rows = [
        ['RP1', true, 'DC1', 'C1'],
        ['RP2', false, 'DC1', 'C1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVRP(sheet);

      expect(result[0].memoryExpandable).toBe(true);
      expect(result[1].memoryExpandable).toBe(false);
    });
  });

  describe('path extraction', () => {
    it('extracts datacenter and cluster from path when not in columns', () => {
      const headers = ['Name', 'Resource Pool path'];
      const rows = [
        ['Production', '/MyDatacenter/MyCluster/Resources/Production'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVRP(sheet);

      expect(result[0].datacenter).toBe('MyDatacenter');
      expect(result[0].cluster).toBe('MyCluster');
    });

    it('extracts from traditional vSphere path format', () => {
      const headers = ['Name', 'Path'];
      const rows = [
        ['Production', '/Datacenter/host/Cluster/Resources/Production'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVRP(sheet);

      expect(result[0].datacenter).toBe('Datacenter');
      expect(result[0].cluster).toBe('Cluster');
    });

    it('prefers direct columns over path extraction', () => {
      const headers = ['Name', 'Datacenter', 'Cluster', 'Path'];
      const rows = [
        ['RP1', 'DC-Direct', 'Cluster-Direct', '/DC-Path/Cluster-Path/Resources/RP1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVRP(sheet);

      expect(result[0].datacenter).toBe('DC-Direct');
      expect(result[0].cluster).toBe('Cluster-Direct');
    });
  });

  describe('parent field', () => {
    it('parses parent resource pool', () => {
      const headers = ['Name', 'Parent', 'Datacenter', 'Cluster'];
      const rows = [
        ['Child-RP', 'Parent-RP', 'DC1', 'C1'],
        ['Root-RP', '', 'DC1', 'C1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVRP(sheet);

      expect(result[0].parent).toBe('Parent-RP');
      expect(result[1].parent).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty sheet', () => {
      const sheet = XLSX.utils.aoa_to_sheet([]);
      const result = parseVRP(sheet);
      expect(result).toEqual([]);
    });

    it('filters out rows without name', () => {
      const headers = ['Name', 'Datacenter', 'Cluster'];
      const rows = [
        ['RP1', 'DC1', 'C1'],
        ['', 'DC1', 'C1'],
        ['RP2', 'DC1', 'C1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVRP(sheet);

      expect(result).toHaveLength(2);
    });

    it('defaults missing numeric fields to 0', () => {
      const headers = ['Name', 'Datacenter', 'Cluster'];
      const rows = [['RP1', 'DC1', 'C1']];

      const sheet = createMockSheet(headers, rows);
      const result = parseVRP(sheet);

      expect(result[0].cpuReservation).toBe(0);
      expect(result[0].cpuLimit).toBe(0);
      expect(result[0].cpuShares).toBe(0);
      expect(result[0].memoryReservation).toBe(0);
      expect(result[0].memoryLimit).toBe(0);
      expect(result[0].memoryShares).toBe(0);
      expect(result[0].vmCount).toBe(0);
    });
  });
});
