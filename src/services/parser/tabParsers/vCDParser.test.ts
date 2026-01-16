// Unit tests for vCD parser
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseVCD } from './vCDParser';

function createMockSheet(headers: string[], rows: unknown[][]): XLSX.WorkSheet {
  const data = [headers, ...rows];
  return XLSX.utils.aoa_to_sheet(data);
}

describe('parseVCD', () => {
  describe('basic parsing', () => {
    it('parses CD-ROM data with standard column names', () => {
      const headers = [
        'VM', 'Powerstate', 'Template', 'Device', 'Connected', 'Start Connected',
        'Device Type', 'Datacenter', 'Cluster', 'Host', 'Guest OS'
      ];
      const rows = [
        ['web-server-01', 'poweredOn', false, 'CD/DVD drive 1', true, true,
         'ISO', 'DC1', 'Prod-Cluster', 'esxi-01.local', 'RHEL 8'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCD(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        vmName: 'web-server-01',
        powerState: 'poweredOn',
        template: false,
        deviceNode: 'CD/DVD drive 1',
        connected: true,
        startsConnected: true,
        deviceType: 'ISO',
        datacenter: 'DC1',
        cluster: 'Prod-Cluster',
        host: 'esxi-01.local',
        guestOS: 'RHEL 8',
      });
    });

    it('parses CD-ROM data with alternative column names', () => {
      const headers = [
        'VM Name', 'Power State', 'CD/DVD', 'Type', 'Datacenter', 'Cluster', 'Host', 'OS'
      ];
      const rows = [
        ['db-server', 'poweredOff', 'CD/DVD drive 1', 'Client Device', 'DC2', 'Dev-Cluster', 'esxi-02.local', 'Windows 2019'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCD(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        vmName: 'db-server',
        deviceNode: 'CD/DVD drive 1',
        deviceType: 'Client Device',
        guestOS: 'Windows 2019',
      });
    });
  });

  describe('connection state', () => {
    it('parses connected and starts connected flags', () => {
      const headers = ['VM', 'Device', 'Connected', 'Start Connected', 'Datacenter', 'Cluster', 'Host', 'Guest OS'];
      const rows = [
        ['vm1', 'CD 1', true, true, 'DC1', 'C1', 'H1', 'Linux'],
        ['vm2', 'CD 1', false, true, 'DC1', 'C1', 'H1', 'Linux'],
        ['vm3', 'CD 1', true, false, 'DC1', 'C1', 'H1', 'Linux'],
        ['vm4', 'CD 1', false, false, 'DC1', 'C1', 'H1', 'Linux'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCD(sheet);

      expect(result[0].connected).toBe(true);
      expect(result[0].startsConnected).toBe(true);
      expect(result[1].connected).toBe(false);
      expect(result[1].startsConnected).toBe(true);
      expect(result[2].connected).toBe(true);
      expect(result[2].startsConnected).toBe(false);
      expect(result[3].connected).toBe(false);
      expect(result[3].startsConnected).toBe(false);
    });
  });

  describe('device types', () => {
    it('parses various device types', () => {
      const headers = ['VM', 'Device', 'Device Type', 'Datacenter', 'Cluster', 'Host', 'Guest OS'];
      const rows = [
        ['vm1', 'CD 1', 'ISO', 'DC1', 'C1', 'H1', 'Linux'],
        ['vm2', 'CD 1', 'Client Device', 'DC1', 'C1', 'H1', 'Linux'],
        ['vm3', 'CD 1', 'Host Device', 'DC1', 'C1', 'H1', 'Linux'],
        ['vm4', 'CD 1', 'Passthrough', 'DC1', 'C1', 'H1', 'Linux'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCD(sheet);

      expect(result[0].deviceType).toBe('ISO');
      expect(result[1].deviceType).toBe('Client Device');
      expect(result[2].deviceType).toBe('Host Device');
      expect(result[3].deviceType).toBe('Passthrough');
    });
  });

  describe('optional fields', () => {
    it('parses annotation field', () => {
      const headers = ['VM', 'Device', 'Annotation', 'Datacenter', 'Cluster', 'Host', 'Guest OS'];
      const rows = [
        ['vm1', 'CD 1', 'Install media', 'DC1', 'C1', 'H1', 'Linux'],
        ['vm2', 'CD 1', '', 'DC1', 'C1', 'H1', 'Linux'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCD(sheet);

      expect(result[0].annotation).toBe('Install media');
      expect(result[1].annotation).toBeNull();
    });

    it('parses OS from tools', () => {
      const headers = ['VM', 'Device', 'Guest OS', 'OS from Tools', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'CD 1', 'rhel8_64Guest', 'Red Hat Enterprise Linux 8.6', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCD(sheet);

      expect(result[0].guestOS).toBe('rhel8_64Guest');
      expect(result[0].osFromTools).toBe('Red Hat Enterprise Linux 8.6');
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty sheet', () => {
      const sheet = XLSX.utils.aoa_to_sheet([]);
      const result = parseVCD(sheet);
      expect(result).toEqual([]);
    });

    it('filters out rows without VM name', () => {
      const headers = ['VM', 'Device', 'Datacenter', 'Cluster', 'Host', 'Guest OS'];
      const rows = [
        ['vm1', 'CD 1', 'DC1', 'C1', 'H1', 'Linux'],
        ['', 'CD 1', 'DC1', 'C1', 'H1', 'Linux'],
        ['vm2', 'CD 1', 'DC1', 'C1', 'H1', 'Linux'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCD(sheet);

      expect(result).toHaveLength(2);
    });

    it('handles multiple CD drives per VM', () => {
      const headers = ['VM', 'Device', 'Device Type', 'Datacenter', 'Cluster', 'Host', 'Guest OS'];
      const rows = [
        ['vm1', 'CD/DVD drive 1', 'ISO', 'DC1', 'C1', 'H1', 'Linux'],
        ['vm1', 'CD/DVD drive 2', 'Client Device', 'DC1', 'C1', 'H1', 'Linux'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVCD(sheet);

      expect(result).toHaveLength(2);
      expect(result.every(cd => cd.vmName === 'vm1')).toBe(true);
    });
  });
});
