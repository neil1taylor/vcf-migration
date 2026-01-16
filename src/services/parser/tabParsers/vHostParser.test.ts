// Unit tests for vHost parser
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseVHost } from './vHostParser';

function createMockSheet(headers: string[], rows: unknown[][]): XLSX.WorkSheet {
  const data = [headers, ...rows];
  return XLSX.utils.aoa_to_sheet(data);
}

describe('parseVHost', () => {
  describe('basic parsing', () => {
    it('parses host data with standard column names', () => {
      const headers = [
        'Name', 'Power State', 'Connection State', 'CPU Model', '# CPU',
        'Cores per Socket', '# Cores', 'Memory', 'ESXi Version', 'Datacenter', 'Cluster'
      ];
      const rows = [
        ['esxi-01.local', 'poweredOn', 'connected', 'Intel Xeon Gold 6248', 2,
         20, 40, 524288, '8.0.0', 'DC1', 'Prod-Cluster'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVHost(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'esxi-01.local',
        powerState: 'poweredOn',
        connectionState: 'connected',
        cpuModel: 'Intel Xeon Gold 6248',
        cpuSockets: 2,
        coresPerSocket: 20,
        totalCpuCores: 40,
        memoryMiB: 524288,
        esxiVersion: '8.0.0',
        datacenter: 'DC1',
        cluster: 'Prod-Cluster',
      });
    });

    it('parses host data with alternative column names', () => {
      const headers = [
        'Host Name', 'Powerstate', 'CPU Sockets', 'Cores per CPU', 'Total Cores',
        'Memory MB', 'ESX Version', 'Build', 'Datacenter', 'Cluster'
      ];
      const rows = [
        ['esxi-02.local', 'poweredOn', 4, 16, 64, 1048576, '7.0.3', '21424296', 'DC2', 'Dev-Cluster'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVHost(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'esxi-02.local',
        cpuSockets: 4,
        coresPerSocket: 16,
        totalCpuCores: 64,
        memoryMiB: 1048576,
        esxiVersion: '7.0.3',
        esxiBuild: '21424296',
      });
    });
  });

  describe('CPU fields', () => {
    it('parses CPU MHz and usage', () => {
      const headers = ['Name', 'Speed', 'CPU usage', 'Datacenter', 'Cluster'];
      const rows = [
        ['esxi-01', 3200, 45000, 'DC1', 'C1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVHost(sheet);

      expect(result[0].cpuMHz).toBe(3200);
      expect(result[0].cpuUsageMHz).toBe(45000);
    });

    it('parses hyperthreading flag', () => {
      const headers = ['Name', 'Hyperthreading', 'Datacenter', 'Cluster'];
      const rows = [
        ['esxi-01', true, 'DC1', 'C1'],
        ['esxi-02', false, 'DC1', 'C1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVHost(sheet);

      expect(result[0].hyperthreading).toBe(true);
      expect(result[1].hyperthreading).toBe(false);
    });
  });

  describe('memory fields', () => {
    it('parses memory and usage', () => {
      const headers = ['Name', 'Memory', 'Memory usage', 'Datacenter', 'Cluster'];
      const rows = [
        ['esxi-01', 524288, 262144, 'DC1', 'C1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVHost(sheet);

      expect(result[0].memoryMiB).toBe(524288);
      expect(result[0].memoryUsageMiB).toBe(262144);
    });
  });

  describe('VM statistics', () => {
    it('parses VM count and resource allocation', () => {
      const headers = ['Name', '# VMs', '# vCPUs', 'VM Memory', 'Datacenter', 'Cluster'];
      const rows = [
        ['esxi-01', 25, 100, 262144, 'DC1', 'C1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVHost(sheet);

      expect(result[0].vmCount).toBe(25);
      expect(result[0].vmCpuCount).toBe(100);
      expect(result[0].vmMemoryMiB).toBe(262144);
    });
  });

  describe('hardware information', () => {
    it('parses vendor and model', () => {
      const headers = ['Name', 'Vendor', 'Model', 'Datacenter', 'Cluster'];
      const rows = [
        ['esxi-01', 'Dell Inc.', 'PowerEdge R750', 'DC1', 'C1'],
        ['esxi-02', 'HPE', 'ProLiant DL380 Gen10', 'DC1', 'C1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVHost(sheet);

      expect(result[0].vendor).toBe('Dell Inc.');
      expect(result[0].model).toBe('PowerEdge R750');
      expect(result[1].vendor).toBe('HPE');
      expect(result[1].model).toBe('ProLiant DL380 Gen10');
    });
  });

  describe('status fields', () => {
    it('parses config and overall status', () => {
      const headers = ['Name', 'Config Status', 'Overall Status', 'Datacenter', 'Cluster'];
      const rows = [
        ['esxi-01', 'green', 'green', 'DC1', 'C1'],
        ['esxi-02', 'yellow', 'yellow', 'DC1', 'C1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVHost(sheet);

      expect(result[0].configStatus).toBe('green');
      expect(result[0].overallStatus).toBe('green');
      expect(result[1].configStatus).toBe('yellow');
      expect(result[1].overallStatus).toBe('yellow');
    });
  });

  describe('uptime', () => {
    it('parses uptime in seconds', () => {
      const headers = ['Name', 'Uptime', 'Datacenter', 'Cluster'];
      const rows = [
        ['esxi-01', 8640000, 'DC1', 'C1'], // 100 days
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVHost(sheet);

      expect(result[0].uptimeSeconds).toBe(8640000);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty sheet', () => {
      const sheet = XLSX.utils.aoa_to_sheet([]);
      const result = parseVHost(sheet);
      expect(result).toEqual([]);
    });

    it('filters out rows without host name', () => {
      const headers = ['Name', 'Datacenter', 'Cluster'];
      const rows = [
        ['esxi-01', 'DC1', 'C1'],
        ['', 'DC1', 'C1'],
        ['esxi-02', 'DC1', 'C1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVHost(sheet);

      expect(result).toHaveLength(2);
    });

    it('defaults missing numeric fields to 0', () => {
      const headers = ['Name', 'Datacenter', 'Cluster'];
      const rows = [['esxi-01', 'DC1', 'C1']];

      const sheet = createMockSheet(headers, rows);
      const result = parseVHost(sheet);

      expect(result[0].cpuMHz).toBe(0);
      expect(result[0].cpuSockets).toBe(0);
      expect(result[0].memoryMiB).toBe(0);
      expect(result[0].vmCount).toBe(0);
    });
  });
});
