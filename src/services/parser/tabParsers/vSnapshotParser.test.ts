// Unit tests for vSnapshot parser
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as XLSX from 'xlsx';
import { parseVSnapshot } from './vSnapshotParser';

function createMockSheet(headers: string[], rows: unknown[][]): XLSX.WorkSheet {
  const data = [headers, ...rows];
  return XLSX.utils.aoa_to_sheet(data);
}

describe('parseVSnapshot', () => {
  beforeEach(() => {
    // Mock current date for age calculations
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic parsing', () => {
    it('parses snapshot data with standard column names', () => {
      const headers = [
        'VM', 'Powerstate', 'Snapshot', 'Description', 'Date / time',
        'Size MB', 'Quiesced', 'Datacenter', 'Cluster', 'Host', 'Folder'
      ];
      const rows = [
        ['web-server-01', 'poweredOn', 'Before upgrade', 'Pre-patch snapshot',
         '2024-06-01T10:00:00', 1024, true, 'DC1', 'Prod-Cluster', 'esxi-01.local', '/Production'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVSnapshot(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        vmName: 'web-server-01',
        powerState: 'poweredOn',
        snapshotName: 'Before upgrade',
        description: 'Pre-patch snapshot',
        sizeTotalMiB: 1024,
        quiesced: true,
        datacenter: 'DC1',
        cluster: 'Prod-Cluster',
        host: 'esxi-01.local',
        folder: '/Production',
      });
      expect(result[0].dateTime).toBeInstanceOf(Date);
    });

    it('parses snapshot data with alternative column names', () => {
      const headers = [
        'VM Name', 'Power State', 'Name', 'Created', 'Size MiB',
        'Datacenter', 'Cluster', 'Host', 'Folder'
      ];
      const rows = [
        ['db-server', 'poweredOff', 'Daily backup', '2024-06-10T08:00:00', 2048,
         'DC2', 'Dev-Cluster', 'esxi-02.local', '/Dev'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVSnapshot(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        vmName: 'db-server',
        snapshotName: 'Daily backup',
        sizeTotalMiB: 2048,
      });
    });
  });

  describe('age calculation', () => {
    it('calculates snapshot age in days', () => {
      const headers = ['VM', 'Snapshot', 'Date / time', 'Datacenter', 'Cluster', 'Host', 'Folder'];
      const rows = [
        ['vm1', 'snap1', '2024-06-14T12:00:00', 'DC1', 'C1', 'H1', 'F1'], // 1 day old
        ['vm2', 'snap2', '2024-06-10T12:00:00', 'DC1', 'C1', 'H1', 'F1'], // 5 days old
        ['vm3', 'snap3', '2024-05-15T12:00:00', 'DC1', 'C1', 'H1', 'F1'], // 31 days old
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVSnapshot(sheet);

      expect(result[0].ageInDays).toBe(1);
      expect(result[1].ageInDays).toBe(5);
      expect(result[2].ageInDays).toBe(31);
    });

    it('handles missing date by using current date', () => {
      const headers = ['VM', 'Snapshot', 'Datacenter', 'Cluster', 'Host', 'Folder'];
      const rows = [
        ['vm1', 'snap1', 'DC1', 'C1', 'H1', 'F1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVSnapshot(sheet);

      expect(result[0].ageInDays).toBe(0);
    });
  });

  describe('size fields', () => {
    it('parses VMSN size and total size', () => {
      const headers = ['VM', 'Snapshot', 'Size vmsn MB', 'Size MB', 'Datacenter', 'Cluster', 'Host', 'Folder'];
      const rows = [
        ['vm1', 'snap1', 512, 2048, 'DC1', 'C1', 'H1', 'F1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVSnapshot(sheet);

      expect(result[0].sizeVmsnMiB).toBe(512);
      expect(result[0].sizeTotalMiB).toBe(2048);
    });
  });

  describe('optional fields', () => {
    it('parses state and filename', () => {
      const headers = ['VM', 'Snapshot', 'State', 'Filename', 'Datacenter', 'Cluster', 'Host', 'Folder'];
      const rows = [
        ['vm1', 'snap1', 'active', 'vm1-000001.vmdk', 'DC1', 'C1', 'H1', 'F1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVSnapshot(sheet);

      expect(result[0].state).toBe('active');
      expect(result[0].filename).toBe('vm1-000001.vmdk');
    });

    it('returns null for missing description and annotation', () => {
      const headers = ['VM', 'Snapshot', 'Datacenter', 'Cluster', 'Host', 'Folder'];
      const rows = [['vm1', 'snap1', 'DC1', 'C1', 'H1', 'F1']];

      const sheet = createMockSheet(headers, rows);
      const result = parseVSnapshot(sheet);

      expect(result[0].description).toBeNull();
      expect(result[0].annotation).toBeNull();
    });
  });

  describe('quiesced flag', () => {
    it('parses quiesced flag correctly', () => {
      const headers = ['VM', 'Snapshot', 'Quiesced', 'Datacenter', 'Cluster', 'Host', 'Folder'];
      const rows = [
        ['vm1', 'snap1', true, 'DC1', 'C1', 'H1', 'F1'],
        ['vm2', 'snap2', false, 'DC1', 'C1', 'H1', 'F1'],
        ['vm3', 'snap3', 'yes', 'DC1', 'C1', 'H1', 'F1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVSnapshot(sheet);

      expect(result[0].quiesced).toBe(true);
      expect(result[1].quiesced).toBe(false);
      expect(result[2].quiesced).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty sheet', () => {
      const sheet = XLSX.utils.aoa_to_sheet([]);
      const result = parseVSnapshot(sheet);
      expect(result).toEqual([]);
    });

    it('filters out rows without VM name', () => {
      const headers = ['VM', 'Snapshot', 'Datacenter', 'Cluster', 'Host', 'Folder'];
      const rows = [
        ['vm1', 'snap1', 'DC1', 'C1', 'H1', 'F1'],
        ['', 'snap2', 'DC1', 'C1', 'H1', 'F1'],
        ['vm2', 'snap3', 'DC1', 'C1', 'H1', 'F1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVSnapshot(sheet);

      expect(result).toHaveLength(2);
    });

    it('handles multiple snapshots per VM', () => {
      const headers = ['VM', 'Snapshot', 'Date / time', 'Datacenter', 'Cluster', 'Host', 'Folder'];
      const rows = [
        ['vm1', 'snap1', '2024-06-01T10:00:00', 'DC1', 'C1', 'H1', 'F1'],
        ['vm1', 'snap2', '2024-06-05T10:00:00', 'DC1', 'C1', 'H1', 'F1'],
        ['vm1', 'snap3', '2024-06-10T10:00:00', 'DC1', 'C1', 'H1', 'F1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVSnapshot(sheet);

      expect(result).toHaveLength(3);
      expect(result.every(s => s.vmName === 'vm1')).toBe(true);
      expect(result[0].snapshotName).toBe('snap1');
      expect(result[1].snapshotName).toBe('snap2');
      expect(result[2].snapshotName).toBe('snap3');
    });
  });
});
