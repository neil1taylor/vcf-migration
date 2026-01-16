// Unit tests for vCluster parser
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseVCluster } from './vClusterParser';

function createMockSheet(headers: string[], rows: unknown[][]): XLSX.WorkSheet {
  const data = [headers, ...rows];
  return XLSX.utils.aoa_to_sheet(data);
}

describe('parseVCluster', () => {
  describe('basic parsing', () => {
    it('parses cluster data with standard column names', () => {
      const headers = [
        'Name', 'Config Status', 'Overall Status', '# Hosts', '# VMs',
        'Total CPU', 'Total Memory', 'HA Enabled', 'DRS Enabled', 'Datacenter'
      ];
      const rows = [
        ['Prod-Cluster', 'green', 'green', 8, 100, 256000, 4194304, true, true, 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCluster(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'Prod-Cluster',
        configStatus: 'green',
        overallStatus: 'green',
        hostCount: 8,
        vmCount: 100,
        totalCpuMHz: 256000,
        totalMemoryMiB: 4194304,
        haEnabled: true,
        drsEnabled: true,
        datacenter: 'DC1',
      });
    });

    it('parses cluster data with alternative column names', () => {
      const headers = [
        'Cluster', 'Status', '# Hosts', 'NumVMs', 'Total CPU MHz',
        'Total Memory MB', 'HA', 'DRS', 'DataCenter'
      ];
      const rows = [
        ['Dev-Cluster', 'yellow', 4, 50, 128000, 2097152, false, true, 'DC2'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCluster(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'Dev-Cluster',
        configStatus: 'yellow',
        hostCount: 4,
        vmCount: 50,
        haEnabled: false,
        drsEnabled: true,
      });
    });
  });

  describe('CPU resources', () => {
    it('parses CPU cores and threads', () => {
      const headers = ['Name', '# CPU Cores', '# CPU Threads', 'Datacenter'];
      const rows = [
        ['Cluster1', 320, 640, 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCluster(sheet);

      expect(result[0].numCpuCores).toBe(320);
      expect(result[0].numCpuThreads).toBe(640);
    });

    it('parses effective CPU', () => {
      const headers = ['Name', 'Total CPU', 'Effective CPU', 'Datacenter'];
      const rows = [
        ['Cluster1', 256000, 230000, 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCluster(sheet);

      expect(result[0].totalCpuMHz).toBe(256000);
      expect(result[0].effectiveCpuMHz).toBe(230000);
    });
  });

  describe('memory resources', () => {
    it('parses total and effective memory', () => {
      const headers = ['Name', 'Total Memory', 'Effective Memory', 'Datacenter'];
      const rows = [
        ['Cluster1', 4194304, 3932160, 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCluster(sheet);

      expect(result[0].totalMemoryMiB).toBe(4194304);
      expect(result[0].effectiveMemoryMiB).toBe(3932160);
    });
  });

  describe('host counts', () => {
    it('parses host count and effective hosts', () => {
      const headers = ['Name', '# Hosts', '# Effective Hosts', 'Datacenter'];
      const rows = [
        ['Cluster1', 8, 7, 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCluster(sheet);

      expect(result[0].hostCount).toBe(8);
      expect(result[0].numEffectiveHosts).toBe(7);
    });
  });

  describe('HA settings', () => {
    it('parses HA enabled and failover level', () => {
      const headers = ['Name', 'HA Enabled', 'HA Failover Level', 'Datacenter'];
      const rows = [
        ['Cluster1', true, 1, 'DC1'],
        ['Cluster2', true, 2, 'DC1'],
        ['Cluster3', false, 0, 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCluster(sheet);

      expect(result[0].haEnabled).toBe(true);
      expect(result[0].haFailoverLevel).toBe(1);
      expect(result[1].haFailoverLevel).toBe(2);
      expect(result[2].haEnabled).toBe(false);
    });
  });

  describe('DRS settings', () => {
    it('parses DRS enabled and behavior', () => {
      const headers = ['Name', 'DRS Enabled', 'DRS Behavior', 'Datacenter'];
      const rows = [
        ['Cluster1', true, 'fullyAutomated', 'DC1'],
        ['Cluster2', true, 'partiallyAutomated', 'DC1'],
        ['Cluster3', true, 'manual', 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCluster(sheet);

      expect(result[0].drsEnabled).toBe(true);
      expect(result[0].drsBehavior).toBe('fullyAutomated');
      expect(result[1].drsBehavior).toBe('partiallyAutomated');
      expect(result[2].drsBehavior).toBe('manual');
    });
  });

  describe('EVC mode', () => {
    it('parses EVC mode', () => {
      const headers = ['Name', 'EVC Mode', 'Datacenter'];
      const rows = [
        ['Cluster1', 'intel-skylake', 'DC1'],
        ['Cluster2', '', 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCluster(sheet);

      expect(result[0].evcMode).toBe('intel-skylake');
      expect(result[1].evcMode).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty sheet', () => {
      const sheet = XLSX.utils.aoa_to_sheet([]);
      const result = parseVCluster(sheet);
      expect(result).toEqual([]);
    });

    it('filters out rows without cluster name', () => {
      const headers = ['Name', 'Datacenter'];
      const rows = [
        ['Cluster1', 'DC1'],
        ['', 'DC1'],
        ['Cluster2', 'DC1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCluster(sheet);

      expect(result).toHaveLength(2);
    });

    it('defaults missing numeric fields to 0', () => {
      const headers = ['Name', 'Datacenter'];
      const rows = [['Cluster1', 'DC1']];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCluster(sheet);

      expect(result[0].vmCount).toBe(0);
      expect(result[0].hostCount).toBe(0);
      expect(result[0].totalCpuMHz).toBe(0);
      expect(result[0].totalMemoryMiB).toBe(0);
    });

    it('defaults boolean fields to false', () => {
      const headers = ['Name', 'Datacenter'];
      const rows = [['Cluster1', 'DC1']];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCluster(sheet);

      expect(result[0].haEnabled).toBe(false);
      expect(result[0].drsEnabled).toBe(false);
    });
  });
});
