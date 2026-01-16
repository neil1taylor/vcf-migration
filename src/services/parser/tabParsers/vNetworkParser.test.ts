// Unit tests for vNetwork parser
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseVNetwork } from './vNetworkParser';

function createMockSheet(headers: string[], rows: unknown[][]): XLSX.WorkSheet {
  const data = [headers, ...rows];
  return XLSX.utils.aoa_to_sheet(data);
}

describe('parseVNetwork', () => {
  describe('basic parsing', () => {
    it('parses network data with standard column names', () => {
      const headers = [
        'VM', 'Powerstate', 'Template', 'NIC', 'Adapter', 'Network',
        'Connected', 'MAC Address', 'Datacenter', 'Cluster', 'Host'
      ];
      const rows = [
        ['web-server-01', 'poweredOn', false, 'Network adapter 1', 'VMXNET3', 'Production-VLAN',
         true, '00:50:56:ab:cd:ef', 'DC1', 'Prod-Cluster', 'esxi-01.local'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVNetwork(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        vmName: 'web-server-01',
        powerState: 'poweredOn',
        template: false,
        nicLabel: 'Network adapter 1',
        adapterType: 'VMXNET3',
        networkName: 'Production-VLAN',
        connected: true,
        macAddress: '00:50:56:ab:cd:ef',
        datacenter: 'DC1',
        cluster: 'Prod-Cluster',
        host: 'esxi-01.local',
      });
    });

    it('parses network data with alternative column names', () => {
      const headers = [
        'VM Name', 'Power State', 'NIC Label', 'Adapter Type', 'Network Name',
        'Is Connected', 'MAC', 'Datacenter', 'Cluster', 'Host'
      ];
      const rows = [
        ['db-server', 'poweredOff', 'Network adapter 1', 'E1000E', 'Database-VLAN',
         false, '00:50:56:12:34:56', 'DC2', 'Dev-Cluster', 'esxi-02.local'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVNetwork(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        vmName: 'db-server',
        nicLabel: 'Network adapter 1',
        adapterType: 'E1000E',
        networkName: 'Database-VLAN',
        connected: false,
      });
    });
  });

  describe('adapter types', () => {
    it('parses various adapter types', () => {
      const headers = ['VM', 'NIC', 'Adapter', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'NIC 1', 'VMXNET3', 'DC1', 'C1', 'H1'],
        ['vm2', 'NIC 1', 'E1000', 'DC1', 'C1', 'H1'],
        ['vm3', 'NIC 1', 'E1000E', 'DC1', 'C1', 'H1'],
        ['vm4', 'NIC 1', 'VMXNET2', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVNetwork(sheet);

      expect(result[0].adapterType).toBe('VMXNET3');
      expect(result[1].adapterType).toBe('E1000');
      expect(result[2].adapterType).toBe('E1000E');
      expect(result[3].adapterType).toBe('VMXNET2');
    });
  });

  describe('port group priority', () => {
    it('prioritizes Port Group column over Network column', () => {
      const headers = ['VM', 'NIC', 'Network', 'Port Group', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'NIC 1', 'dvs-123-abc', 'Production-VLAN-100', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVNetwork(sheet);

      expect(result[0].networkName).toBe('Production-VLAN-100');
    });

    it('falls back to Network column when Port Group is empty', () => {
      const headers = ['VM', 'NIC', 'Network', 'Port Group', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'NIC 1', 'VM Network', '', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVNetwork(sheet);

      expect(result[0].networkName).toBe('VM Network');
    });

    it('uses Network column when Port Group column is missing', () => {
      const headers = ['VM', 'NIC', 'Network', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'NIC 1', 'Management Network', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVNetwork(sheet);

      expect(result[0].networkName).toBe('Management Network');
    });
  });

  describe('connection state', () => {
    it('parses connected and starts connected flags', () => {
      const headers = ['VM', 'NIC', 'Connected', 'Start Connected', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'NIC 1', true, true, 'DC1', 'C1', 'H1'],
        ['vm2', 'NIC 1', false, true, 'DC1', 'C1', 'H1'],
        ['vm3', 'NIC 1', true, false, 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVNetwork(sheet);

      expect(result[0].connected).toBe(true);
      expect(result[0].startsConnected).toBe(true);
      expect(result[1].connected).toBe(false);
      expect(result[1].startsConnected).toBe(true);
      expect(result[2].connected).toBe(true);
      expect(result[2].startsConnected).toBe(false);
    });
  });

  describe('MAC address', () => {
    it('parses MAC address and type', () => {
      const headers = ['VM', 'NIC', 'MAC Address', 'Type', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'NIC 1', '00:50:56:ab:cd:ef', 'assigned', 'DC1', 'C1', 'H1'],
        ['vm2', 'NIC 1', '00:50:56:12:34:56', 'manual', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVNetwork(sheet);

      expect(result[0].macAddress).toBe('00:50:56:ab:cd:ef');
      expect(result[0].macType).toBe('assigned');
      expect(result[1].macAddress).toBe('00:50:56:12:34:56');
      expect(result[1].macType).toBe('manual');
    });
  });

  describe('IP addresses', () => {
    it('parses IPv4 and IPv6 addresses', () => {
      const headers = ['VM', 'NIC', 'IP Address', 'IPv6 Address', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'NIC 1', '192.168.1.100', 'fe80::1', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVNetwork(sheet);

      expect(result[0].ipv4Address).toBe('192.168.1.100');
      expect(result[0].ipv6Address).toBe('fe80::1');
    });

    it('returns null for missing IP addresses', () => {
      const headers = ['VM', 'NIC', 'Datacenter', 'Cluster', 'Host'];
      const rows = [['vm1', 'NIC 1', 'DC1', 'C1', 'H1']];

      const sheet = createMockSheet(headers, rows);
      const result = parseVNetwork(sheet);

      expect(result[0].ipv4Address).toBeNull();
      expect(result[0].ipv6Address).toBeNull();
    });
  });

  describe('switch name', () => {
    it('parses switch name', () => {
      const headers = ['VM', 'NIC', 'Switch', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'NIC 1', 'vSwitch0', 'DC1', 'C1', 'H1'],
        ['vm2', 'NIC 1', 'DSwitch-Production', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVNetwork(sheet);

      expect(result[0].switchName).toBe('vSwitch0');
      expect(result[1].switchName).toBe('DSwitch-Production');
    });
  });

  describe('DirectPath I/O', () => {
    it('parses DirectPath IO flag', () => {
      const headers = ['VM', 'NIC', 'DirectPath IO', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'NIC 1', true, 'DC1', 'C1', 'H1'],
        ['vm2', 'NIC 1', false, 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVNetwork(sheet);

      expect(result[0].directPathIO).toBe(true);
      expect(result[1].directPathIO).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty sheet', () => {
      const sheet = XLSX.utils.aoa_to_sheet([]);
      const result = parseVNetwork(sheet);
      expect(result).toEqual([]);
    });

    it('filters out rows without VM name', () => {
      const headers = ['VM', 'NIC', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'NIC 1', 'DC1', 'C1', 'H1'],
        ['', 'NIC 1', 'DC1', 'C1', 'H1'],
        ['vm2', 'NIC 1', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVNetwork(sheet);

      expect(result).toHaveLength(2);
    });

    it('handles multiple NICs per VM', () => {
      const headers = ['VM', 'NIC', 'Network', 'Datacenter', 'Cluster', 'Host'];
      const rows = [
        ['vm1', 'Network adapter 1', 'Production-VLAN', 'DC1', 'C1', 'H1'],
        ['vm1', 'Network adapter 2', 'Management-VLAN', 'DC1', 'C1', 'H1'],
        ['vm1', 'Network adapter 3', 'Backup-VLAN', 'DC1', 'C1', 'H1'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVNetwork(sheet);

      expect(result).toHaveLength(3);
      expect(result.every(n => n.vmName === 'vm1')).toBe(true);
      expect(result[0].networkName).toBe('Production-VLAN');
      expect(result[1].networkName).toBe('Management-VLAN');
      expect(result[2].networkName).toBe('Backup-VLAN');
    });
  });
});
