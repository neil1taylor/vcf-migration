// Unit tests for vTools parser
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseVTools } from './vToolsParser';

function createMockSheet(headers: string[], rows: unknown[][]): XLSX.WorkSheet {
  const data = [headers, ...rows];
  return XLSX.utils.aoa_to_sheet(data);
}

describe('parseVTools', () => {
  describe('basic parsing', () => {
    it('parses tools data with standard column names', () => {
      const headers = [
        'VM', 'Powerstate', 'Template', 'Tools Status', 'Tools Version',
        'Upgradeable', 'Upgrade Policy'
      ];
      const rows = [
        ['web-server-01', 'poweredOn', false, 'toolsOk', '12352', true, 'manual'],
        ['db-server-01', 'poweredOff', false, 'toolsOld', '11265', true, 'upgradeAtPowerCycle'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVTools(sheet);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        vmName: 'web-server-01',
        powerState: 'poweredOn',
        template: false,
        toolsStatus: 'toolsOk',
        toolsVersion: '12352',
        upgradeable: true,
        upgradePolicy: 'manual',
      });
      expect(result[1]).toMatchObject({
        vmName: 'db-server-01',
        toolsStatus: 'toolsOld',
        upgradePolicy: 'upgradeAtPowerCycle',
      });
    });

    it('parses tools data with alternative column names', () => {
      const headers = [
        'VM Name', 'Power State', 'VMware Tools Status', 'Version', 'Policy'
      ];
      const rows = [
        ['app-server', 'poweredOn', 'toolsNotInstalled', '', 'manual'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVTools(sheet);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        vmName: 'app-server',
        toolsStatus: 'toolsNotInstalled',
        upgradePolicy: 'manual',
      });
    });
  });

  describe('tools status variations', () => {
    it('handles various tools status values', () => {
      const headers = ['VM', 'Tools Status'];
      const rows = [
        ['vm1', 'toolsOk'],
        ['vm2', 'toolsOld'],
        ['vm3', 'toolsNotInstalled'],
        ['vm4', 'toolsNotRunning'],
        ['vm5', 'guestToolsRunning'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVTools(sheet);

      expect(result[0].toolsStatus).toBe('toolsOk');
      expect(result[1].toolsStatus).toBe('toolsOld');
      expect(result[2].toolsStatus).toBe('toolsNotInstalled');
      expect(result[3].toolsStatus).toBe('toolsNotRunning');
      expect(result[4].toolsStatus).toBe('guestToolsRunning');
    });
  });

  describe('version fields', () => {
    it('parses VM version and tools version', () => {
      const headers = ['VM', 'VM Version', 'Tools Version', 'Required Version'];
      const rows = [
        ['vm1', 'vmx-19', '12352', '12288'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVTools(sheet);

      expect(result[0].vmVersion).toBe('vmx-19');
      expect(result[0].toolsVersion).toBe('12352');
      expect(result[0].requiredVersion).toBe('12288');
    });

    it('returns null for missing version fields', () => {
      const headers = ['VM'];
      const rows = [['vm1']];

      const sheet = createMockSheet(headers, rows);
      const result = parseVTools(sheet);

      expect(result[0].toolsVersion).toBeNull();
      expect(result[0].requiredVersion).toBeNull();
    });
  });

  describe('boolean fields', () => {
    it('parses upgradeable flag', () => {
      const headers = ['VM', 'Upgradeable'];
      const rows = [
        ['vm1', true],
        ['vm2', false],
        ['vm3', 'yes'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVTools(sheet);

      expect(result[0].upgradeable).toBe(true);
      expect(result[1].upgradeable).toBe(false);
      expect(result[2].upgradeable).toBe(true);
    });

    it('parses sync time flag', () => {
      const headers = ['VM', 'Sync Time'];
      const rows = [
        ['vm1', true],
        ['vm2', false],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVTools(sheet);

      expect(result[0].syncTime).toBe(true);
      expect(result[1].syncTime).toBe(false);
    });

    it('parses operation ready flag', () => {
      const headers = ['VM', 'Operation Ready'];
      const rows = [
        ['vm1', true],
        ['vm2', false],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVTools(sheet);

      expect(result[0].operationReady).toBe(true);
      expect(result[1].operationReady).toBe(false);
    });
  });

  describe('status fields', () => {
    it('parses app status and heartbeat status', () => {
      const headers = ['VM', 'App Status', 'Heartbeat Status'];
      const rows = [
        ['vm1', 'appStatusOk', 'green'],
        ['vm2', '', 'gray'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVTools(sheet);

      expect(result[0].appStatus).toBe('appStatusOk');
      expect(result[0].heartbeatStatus).toBe('green');
      expect(result[1].appStatus).toBeNull();
      expect(result[1].heartbeatStatus).toBe('gray');
    });

    it('parses kernel crash state', () => {
      const headers = ['VM', 'Kernel Crash State'];
      const rows = [
        ['vm1', 'none'],
        ['vm2', ''],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVTools(sheet);

      expect(result[0].kernelCrashState).toBe('none');
      expect(result[1].kernelCrashState).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty sheet', () => {
      const sheet = XLSX.utils.aoa_to_sheet([]);
      const result = parseVTools(sheet);
      expect(result).toEqual([]);
    });

    it('filters out rows without VM name', () => {
      const headers = ['VM', 'Tools Status'];
      const rows = [
        ['vm1', 'toolsOk'],
        ['', 'toolsOk'],
        ['vm2', 'toolsOld'],
      ];

      const sheet = createMockSheet(headers, rows);
      const result = parseVTools(sheet);

      expect(result).toHaveLength(2);
    });
  });
});
