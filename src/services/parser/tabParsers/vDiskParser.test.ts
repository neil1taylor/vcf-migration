// Unit tests for vDisk parser
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseVDisk } from './vDiskParser';

function createMockSheet(headers: string[], rows: unknown[][]): XLSX.WorkSheet {
  const data = [headers, ...rows];
  return XLSX.utils.aoa_to_sheet(data);
}

describe('parseVDisk', () => {
  describe('basic parsing', () => {
    it('parses disk data with standard column names', () => {
      const headers = [
        'VM', 'Powerstate', 'Template', 'Disk', 'Capacity MB', 'Thin',
        'Controller', 'Datacenter', 'Cluster', 'Host'
      ];
      const rows = [
        ['web-server-01', 'poweredOn', false, 'Hard disk 1', 102400, true,
         'SCSI controller 0', 'DC1', 'Prod-Cluster', 'esxi-01.local'],
        ['web-server-01', 'poweredOn', false, 'Hard disk 2', 512000, false,
         'SCSI controller 0', 'DC1', 'Prod-Cluster', 'esxi-01.local'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDisk(sheet);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        vmName: 'web-server-01',
        powerState: 'poweredOn',
        template: false,
        diskLabel: 'Hard disk 1',
        capacityMiB: 102400,
        thin: true,
        controllerType: 'SCSI controller 0',
        datacenter: 'DC1',
        cluster: 'Prod-Cluster',
        host: 'esxi-01.local',
      });
      expect(result[1]).toMatchObject({
        diskLabel: 'Hard disk 2',
        capacityMiB: 512000,
        thin: false,
      });
    });

    it('parses disk data with alternative column names', () => {
      const headers = [
        'VM Name', 'Power State', 'Label', 'Capacity MiB', 'Thin provisioned',
        'Controller Type', 'Datacenter', 'Cluster', 'Host'
      ];
      const rows = [
        ['db-server', 'poweredOff', 'Hard disk 1', 204800, true,
         'PVSCSI', 'DC2', 'Dev-Cluster', 'esxi-02.local'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDisk(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        vmName: 'db-server',
        diskLabel: 'Hard disk 1',
        capacityMiB: 204800,
        thin: true,
        controllerType: 'PVSCSI',
      });
    });
  });

  describe('disk properties', () => {
    it('parses RDM/raw disk indicator', () => {
      const headers = ['VM', 'Disk', 'Raw', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'Hard disk 1', false, 'DC1', 'C1', 'H1'],
        ['vm2', 'Hard disk 1', true, 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDisk(sheet);

      expect(result[0].raw).toBe(false);
      expect(result[1].raw).toBe(true);
    });

    it('parses disk mode and sharing mode', () => {
      const headers = ['VM', 'Disk', 'Disk Mode', 'Sharing', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'Hard disk 1', 'persistent', 'sharingNone', 'DC1', 'C1', 'H1'],
        ['vm2', 'Hard disk 1', 'independent_persistent', 'sharingMultiWriter', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDisk(sheet);

      expect(result[0].diskMode).toBe('persistent');
      expect(result[0].sharingMode).toBe('sharingNone');
      expect(result[1].diskMode).toBe('independent_persistent');
      expect(result[1].sharingMode).toBe('sharingMultiWriter');
    });

    it('parses eagerly scrub and split flags', () => {
      const headers = ['VM', 'Disk', 'Eagerly Scrub', 'Split', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'Hard disk 1', true, false, 'DC1', 'C1', 'H1'],
        ['vm2', 'Hard disk 1', false, true, 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDisk(sheet);

      expect(result[0].eagerlyScrub).toBe(true);
      expect(result[0].split).toBe(false);
      expect(result[1].eagerlyScrub).toBe(false);
      expect(result[1].split).toBe(true);
    });

    it('parses write through flag', () => {
      const headers = ['VM', 'Disk', 'Write Through', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'Hard disk 1', true, 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDisk(sheet);

      expect(result[0].writeThrough).toBe(true);
    });
  });

  describe('disk identifiers', () => {
    it('parses disk key, UUID, and path', () => {
      const headers = ['VM', 'Disk', 'Key', 'UUID', 'Path', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'Hard disk 1', 2000, 'abc-123-def', '[datastore1] vm1/vm1.vmdk', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDisk(sheet);

      expect(result[0].diskKey).toBe(2000);
      expect(result[0].diskUuid).toBe('abc-123-def');
      expect(result[0].diskPath).toBe('[datastore1] vm1/vm1.vmdk');
    });

    it('returns null for missing UUID', () => {
      const headers = ['VM', 'Disk', 'Datacenter', 'Cluster', 'Host'];
      const rows = [['vm1', 'Hard disk 1', 'DC1', 'C1', 'H1']];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDisk(sheet);

      expect(result[0].diskUuid).toBeNull();
    });
  });

  describe('controller information', () => {
    it('parses controller key and unit number', () => {
      const headers = ['VM', 'Disk', 'Controller Key', 'Unit Number', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'Hard disk 1', 1000, 0, 'DC1', 'C1', 'H1'],
        ['vm1', 'Hard disk 2', 1000, 1, 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDisk(sheet);

      expect(result[0].controllerKey).toBe(1000);
      expect(result[0].unitNumber).toBe(0);
      expect(result[1].unitNumber).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty sheet', () => {
      const sheet = XLSX.utils.aoa_to_sheet([]);
      const result = parseVDisk(sheet);
      expect(result).toEqual([]);
    });

    it('filters out rows without VM name', () => {
      const headers = ['VM', 'Disk', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'Hard disk 1', 'DC1', 'C1', 'H1'],
        ['', 'Hard disk 1', 'DC1', 'C1', 'H1'],
        ['vm2', 'Hard disk 1', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDisk(sheet);

      expect(result).toHaveLength(2);
    });

    it('handles multiple disks per VM', () => {
      const headers = ['VM', 'Disk', 'Capacity MB', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'Hard disk 1', 51200, 'DC1', 'C1', 'H1'],
        ['vm1', 'Hard disk 2', 102400, 'DC1', 'C1', 'H1'],
        ['vm1', 'Hard disk 3', 204800, 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVDisk(sheet);

      expect(result).toHaveLength(3);
      expect(result.every(d => d.vmName === 'vm1')).toBe(true);
      expect(result[0].capacityMiB).toBe(51200);
      expect(result[1].capacityMiB).toBe(102400);
      expect(result[2].capacityMiB).toBe(204800);
    });
  });
});
