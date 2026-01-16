// Unit tests for vInfo parser
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseVInfo } from './vInfoParser';

// Helper to create a mock worksheet from data
function createMockSheet(headers: string[], rows: unknown[][]): XLSX.WorkSheet {
  const data = [headers, ...rows];
  return XLSX.utils.aoa_to_sheet(data);
}

describe('parseVInfo', () => {
  describe('basic parsing', () => {
    it('parses VM data with standard column names', () => {
      const headers = [
        'VM', 'Powerstate', 'Template', 'CPUs', 'Memory', 'Guest OS',
        'Datacenter', 'Cluster', 'Host', 'HW version'
      ];
      const rows = [
        ['web-server-01', 'poweredOn', false, 4, 8192, 'Red Hat Enterprise Linux 8 (64-bit)',
         'DC1', 'Prod-Cluster', 'esxi-01.local', 'vmx-19'],
        ['db-server-01', 'poweredOff', false, 8, 16384, 'Windows Server 2019 (64-bit)',
         'DC1', 'Prod-Cluster', 'esxi-02.local', 'vmx-17'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        vmName: 'web-server-01',
        powerState: 'poweredOn',
        template: false,
        cpus: 4,
        memory: 8192,
        guestOS: 'Red Hat Enterprise Linux 8 (64-bit)',
        datacenter: 'DC1',
        cluster: 'Prod-Cluster',
        host: 'esxi-01.local',
        hardwareVersion: 'vmx-19',
      });
      expect(result[1]).toMatchObject({
        vmName: 'db-server-01',
        powerState: 'poweredOff',
        cpus: 8,
        memory: 16384,
      });
    });

    it('parses VM data with alternative column names', () => {
      const headers = [
        'VM Name', 'Power State', 'Num CPU', 'Memory MB', 'OS',
        'Datacenter', 'Cluster', 'Host', 'Hardware Version'
      ];
      const rows = [
        ['app-server', 'poweredOn', 2, 4096, 'Ubuntu Linux (64-bit)',
         'DC2', 'Dev-Cluster', 'esxi-03.local', 'vmx-14'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        vmName: 'app-server',
        powerState: 'poweredOn',
        cpus: 2,
        memory: 4096,
        guestOS: 'Ubuntu Linux (64-bit)',
        hardwareVersion: 'vmx-14',
      });
    });
  });

  describe('power state parsing', () => {
    it('normalizes power state values', () => {
      const headers = ['VM', 'Powerstate', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'poweredOn', 'DC1', 'C1', 'H1'],
        ['vm2', 'PoweredOn', 'DC1', 'C1', 'H1'],
        ['vm3', 'POWEREDON', 'DC1', 'C1', 'H1'],
        ['vm4', 'poweredOff', 'DC1', 'C1', 'H1'],
        ['vm5', 'PoweredOff', 'DC1', 'C1', 'H1'],
        ['vm6', 'suspended', 'DC1', 'C1', 'H1'],
        ['vm7', 'Suspended', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result[0].powerState).toBe('poweredOn');
      expect(result[1].powerState).toBe('poweredOn');
      expect(result[2].powerState).toBe('poweredOn');
      expect(result[3].powerState).toBe('poweredOff');
      expect(result[4].powerState).toBe('poweredOff');
      expect(result[5].powerState).toBe('suspended');
      expect(result[6].powerState).toBe('suspended');
    });

    it('defaults unknown power states to poweredOff', () => {
      const headers = ['VM', 'Powerstate', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'unknown', 'DC1', 'C1', 'H1'],
        ['vm2', '', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result[0].powerState).toBe('poweredOff');
      expect(result[1].powerState).toBe('poweredOff');
    });
  });

  describe('boolean field parsing', () => {
    it('parses template field correctly', () => {
      const headers = ['VM', 'Template', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', true, 'DC1', 'C1', 'H1'],
        ['vm2', false, 'DC1', 'C1', 'H1'],
        ['vm3', 'true', 'DC1', 'C1', 'H1'],
        ['vm4', 'yes', 'DC1', 'C1', 'H1'],
        ['vm5', 'no', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result[0].template).toBe(true);
      expect(result[1].template).toBe(false);
      expect(result[2].template).toBe(true);
      expect(result[3].template).toBe(true);
      expect(result[4].template).toBe(false);
    });

    it('parses CBT enabled field correctly', () => {
      const headers = ['VM', 'CBT', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', true, 'DC1', 'C1', 'H1'],
        ['vm2', 'yes', 'DC1', 'C1', 'H1'],
        ['vm3', false, 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result[0].cbtEnabled).toBe(true);
      expect(result[1].cbtEnabled).toBe(true);
      expect(result[2].cbtEnabled).toBe(false);
    });

    it('handles alternative CBT column names', () => {
      const headers = ['VM', 'Changed Block Tracking', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', true, 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result[0].cbtEnabled).toBe(true);
    });
  });

  describe('numeric field parsing', () => {
    it('parses numeric fields correctly', () => {
      const headers = ['VM', 'CPUs', 'Memory', 'NICs', 'Disks', 'Provisioned MB', 'In Use MB', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 4, 8192, 2, 3, 102400, 51200, 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result[0].cpus).toBe(4);
      expect(result[0].memory).toBe(8192);
      expect(result[0].nics).toBe(2);
      expect(result[0].disks).toBe(3);
      expect(result[0].provisionedMiB).toBe(102400);
      expect(result[0].inUseMiB).toBe(51200);
    });

    it('handles string numbers', () => {
      const headers = ['VM', 'CPUs', 'Memory', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', '8', '16384', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result[0].cpus).toBe(8);
      expect(result[0].memory).toBe(16384);
    });

    it('defaults missing numeric fields to 0', () => {
      const headers = ['VM', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result[0].cpus).toBe(0);
      expect(result[0].memory).toBe(0);
      expect(result[0].nics).toBe(0);
      expect(result[0].disks).toBe(0);
    });
  });

  describe('nullable string fields', () => {
    it('returns null for empty optional string fields', () => {
      const headers = ['VM', 'DNS Name', 'Resource pool', 'Folder', 'Guest IP', 'Annotation', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', '', '', '', '', '', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result[0].dnsName).toBeNull();
      expect(result[0].resourcePool).toBeNull();
      expect(result[0].folder).toBeNull();
      expect(result[0].guestIP).toBeNull();
      expect(result[0].annotation).toBeNull();
    });

    it('returns value for populated optional string fields', () => {
      const headers = ['VM', 'DNS Name', 'Resource pool', 'Guest IP', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'vm1.example.com', 'Production', '192.168.1.100', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result[0].dnsName).toBe('vm1.example.com');
      expect(result[0].resourcePool).toBe('Production');
      expect(result[0].guestIP).toBe('192.168.1.100');
    });
  });

  describe('date field parsing', () => {
    it('parses ISO date strings', () => {
      const headers = ['VM', 'Creation date', 'PowerOn', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', '2024-03-15T10:30:00', '2024-03-20T08:00:00', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result[0].creationDate).toBeInstanceOf(Date);
      expect(result[0].powerOnDate).toBeInstanceOf(Date);
    });

    it('returns null for missing date fields', () => {
      const headers = ['VM', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result[0].creationDate).toBeNull();
      expect(result[0].powerOnDate).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns empty array for sheet with only headers', () => {
      const headers = ['VM', 'Powerstate', 'Datacenter', 'Cluster', 'Host'];
      const sheet = createMockSheet(headers, []);
      const result = parseVInfo(sheet);

      expect(result).toEqual([]);
    });

    it('returns empty array for empty sheet', () => {
      const sheet = XLSX.utils.aoa_to_sheet([]);
      const result = parseVInfo(sheet);

      expect(result).toEqual([]);
    });

    it('filters out rows without VM name', () => {
      const headers = ['VM', 'CPUs', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 4, 'DC1', 'C1', 'H1'],
        ['', 2, 'DC1', 'C1', 'H1'],  // Should be filtered
        [null, 2, 'DC1', 'C1', 'H1'],  // Should be filtered
        ['vm2', 8, 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result).toHaveLength(2);
      expect(result[0].vmName).toBe('vm1');
      expect(result[1].vmName).toBe('vm2');
    });

    it('handles whitespace in string values', () => {
      const headers = ['VM', 'Guest OS', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['  vm1  ', '  Windows Server 2019  ', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result[0].vmName).toBe('vm1');
      expect(result[0].guestOS).toBe('Windows Server 2019');
    });

    it('handles special characters in VM names', () => {
      const headers = ['VM', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['web-server_01.prod', 'DC1', 'C1', 'H1'],
        ['app (backup)', 'DC1', 'C1', 'H1'],
        ['test/dev', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result).toHaveLength(3);
      expect(result[0].vmName).toBe('web-server_01.prod');
      expect(result[1].vmName).toBe('app (backup)');
      expect(result[2].vmName).toBe('test/dev');
    });
  });

  describe('firmware and hardware fields', () => {
    it('parses firmware type', () => {
      const headers = ['VM', 'Firmware', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'bios', 'DC1', 'C1', 'H1'],
        ['vm2', 'efi', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result[0].firmwareType).toBe('bios');
      expect(result[1].firmwareType).toBe('efi');
    });

    it('parses hardware version variations', () => {
      const headers = ['VM', 'HW version', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'vmx-19', 'DC1', 'C1', 'H1'],
        ['vm2', 'vmx-14', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result[0].hardwareVersion).toBe('vmx-19');
      expect(result[1].hardwareVersion).toBe('vmx-14');
    });
  });

  describe('location fields', () => {
    it('parses datacenter, cluster, and host', () => {
      const headers = ['VM', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'Primary-DC', 'Production-Cluster', 'esxi-host-01.example.com'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result[0].datacenter).toBe('Primary-DC');
      expect(result[0].cluster).toBe('Production-Cluster');
      expect(result[0].host).toBe('esxi-host-01.example.com');
    });
  });

  describe('OS fields', () => {
    it('parses guest OS and OS from tools', () => {
      const headers = ['VM', 'OS according to the configuration file', 'OS according to the VMware Tools', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'rhel8_64Guest', 'Red Hat Enterprise Linux 8.6', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVInfo(sheet);

      expect(result[0].guestOS).toBe('rhel8_64Guest');
      expect(result[0].osToolsConfig).toBe('Red Hat Enterprise Linux 8.6');
    });
  });
});
