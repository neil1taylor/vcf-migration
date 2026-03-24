import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  isVInventoryFormat,
  gbToMib,
  daysOldToDate,
  convertSheet,
  convertVInventoryWorkbook,
} from './vinventoryConverter';

/** Create a workbook with given sheet names and optional data. */
function createWorkbook(
  sheets: Record<string, unknown[][]>,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const [name, data] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return wb;
}

// ---------------------------------------------------------------------------
// isVInventoryFormat
// ---------------------------------------------------------------------------

describe('isVInventoryFormat', () => {
  it('returns true when vmInfo exists but vInfo does not', () => {
    const wb = createWorkbook({ vmInfo: [['VM'], ['test-vm']] });
    expect(isVInventoryFormat(wb)).toBe(true);
  });

  it('returns false when vInfo exists', () => {
    const wb = createWorkbook({ vInfo: [['VM'], ['test-vm']] });
    expect(isVInventoryFormat(wb)).toBe(false);
  });

  it('returns false when both vmInfo and vInfo exist', () => {
    const wb = createWorkbook({
      vmInfo: [['VM'], ['test-vm']],
      vInfo: [['VM'], ['test-vm']],
    });
    expect(isVInventoryFormat(wb)).toBe(false);
  });

  it('returns false when neither sheet exists', () => {
    const wb = createWorkbook({ SomeSheet: [['A'], [1]] });
    expect(isVInventoryFormat(wb)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------

describe('gbToMib', () => {
  it('converts numeric value', () => {
    expect(gbToMib(4)).toBe(4096);
    expect(gbToMib(0.5)).toBe(512);
  });

  it('converts string numeric value', () => {
    expect(gbToMib('8')).toBe(8192);
  });

  it('returns original value for non-numeric input', () => {
    expect(gbToMib('abc')).toBe('abc');
  });

  it('rounds the result', () => {
    expect(gbToMib(1.5)).toBe(1536);
  });
});

describe('daysOldToDate', () => {
  it('converts days to a past date', () => {
    const result = daysOldToDate(1);
    expect(result).toBeInstanceOf(Date);
    const diffMs = Date.now() - result!.getTime();
    // Should be approximately 1 day (allow 1 second tolerance)
    expect(Math.abs(diffMs - 86_400_000)).toBeLessThan(1000);
  });

  it('returns null for non-numeric input', () => {
    expect(daysOldToDate('abc')).toBeNull();
  });

  it('handles zero', () => {
    const result = daysOldToDate(0);
    expect(result).toBeInstanceOf(Date);
    const diffMs = Date.now() - result!.getTime();
    expect(diffMs).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
// convertSheet
// ---------------------------------------------------------------------------

describe('convertSheet', () => {
  it('renames columns according to map', () => {
    const wb = createWorkbook({
      src: [['OldA', 'OldB'], ['val1', 'val2']],
    });
    const map = { OldA: 'NewA', OldB: 'NewB' };
    const rowCount = convertSheet(wb, 'src', 'dst', map);

    expect(rowCount).toBe(1);
    expect(wb.SheetNames).toContain('dst');

    const dstRows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['dst'], { header: 1 });
    expect(dstRows[0]).toEqual(['NewA', 'NewB']);
    expect(dstRows[1]).toEqual(['val1', 'val2']);
  });

  it('drops columns mapped to null', () => {
    const wb = createWorkbook({
      src: [['Keep', 'Drop', 'AlsoKeep'], ['a', 'b', 'c']],
    });
    const map = { Keep: 'Kept', Drop: null, AlsoKeep: 'Also' };
    convertSheet(wb, 'src', 'dst', map);

    const dstRows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['dst'], { header: 1 });
    expect(dstRows[0]).toEqual(['Kept', 'Also']);
    expect(dstRows[1]).toEqual(['a', 'c']);
  });

  it('applies transforms to destination columns', () => {
    const wb = createWorkbook({
      src: [['MemGB'], [4]],
    });
    const map = { MemGB: 'Memory' };
    const transforms = { Memory: gbToMib };
    convertSheet(wb, 'src', 'dst', map, transforms);

    const dstRows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['dst'], { header: 1 });
    expect(dstRows[1][0]).toBe(4096);
  });

  it('does not apply transform to null values', () => {
    const wb = createWorkbook({
      src: [['MemGB'], [null]],
    });
    const map = { MemGB: 'Memory' };
    const transforms = { Memory: gbToMib };
    convertSheet(wb, 'src', 'dst', map, transforms);

    const dstRows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['dst'], { header: 1 });
    // SheetJS omits trailing nulls in rows, so row may be short or have undefined
    expect(dstRows.length).toBe(2);
  });

  it('returns 0 for missing source sheet', () => {
    const wb = createWorkbook({ other: [['A'], [1]] });
    expect(convertSheet(wb, 'missing', 'dst', {})).toBe(0);
  });

  it('returns 0 for empty sheet', () => {
    const wb = createWorkbook({ src: [] });
    expect(convertSheet(wb, 'src', 'dst', {})).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Full conversion
// ---------------------------------------------------------------------------

describe('convertVInventoryWorkbook', () => {
  /** Create a minimal vInventory workbook with realistic data. */
  function createMinimalVInventory() {
    return createWorkbook({
      vmInfo: [
        ['VM', 'PowerState', 'IsTemplate', 'MemGB', 'Cpu', 'CoresPerSocket',
         'CpuSockets', 'GuestOS', 'vmOS', 'ProvisionedGB', 'DiskGBUsed',
         'vmhost', 'Cluster', 'Datacenter', 'InstanceUuid', 'ResourcePool',
         'vHardware', 'ToolsStatus', 'ToolsVersion', 'syncTime',
         'HotAddCpu', 'ReserveCpu', 'HotAddMem', 'MemReserved',
         'BalloonedMemory', 'SwappedMemory', 'Folder', 'Annotation',
         'NICs', 'Disks', 'Firmware', 'connectionState'],
        ['web-01', 'poweredOn', false, 8, 4, 2, 2, 'RHEL 8', 'Red Hat Enterprise Linux 8',
         10, 5, 'esxi-01', 'Prod', 'DC1', 'uuid-001', 'Resources',
         'vmx-19', 'toolsOk', '12345', null,
         true, 0, true, 0, 0, 0, '/VMs', 'Web server',
         2, 1, 'bios', 'connected'],
        ['db-01', 'poweredOff', false, 16, 8, 4, 2, 'Win2019', 'Windows Server 2019',
         50, 30, 'esxi-02', 'Prod', 'DC1', 'uuid-002', 'Resources',
         'vmx-17', 'toolsNotRunning', '11111', null,
         false, 100, false, 2048, 512, 256, '/VMs', 'DB server',
         1, 2, 'efi', 'connected'],
      ],
      vDisk: [
        ['VM', 'Disk', 'DiskGB', 'DiskGbUsed', 'Datastore', 'DatastoreType',
         'Thin', 'DiskFile', 'DiskMode', 'Type'],
        ['web-01', 'Hard disk 1', 10, 5, 'ds-prod-01', 'VMFS',
         true, '[ds-prod-01] web-01/web-01.vmdk', 'persistent', 'RawVirtual'],
        ['db-01', 'Hard disk 1', 50, 30, 'ds-prod-02', 'NFS',
         false, '[ds-prod-02] db-01/db-01.vmdk', 'persistent', 'Flat'],
      ],
      vNetworkadapter: [
        ['VM', 'vmNetworkAdapter', 'MacAddress', 'PortGroup', 'Connected', 'PowerState'],
        ['web-01', 'Network adapter 1', '00:50:56:01:01:01', 'VM Network', true, 'poweredOn'],
      ],
      Snapshots: [
        ['VM', 'Snapshot', 'DaysOld', 'SizeMB', 'Description'],
        ['db-01', 'before-upgrade', 45, 2048, 'Pre-upgrade snapshot'],
      ],
      DvdFloppy: [
        ['VM', 'Type', 'Connected'],
        ['web-01', 'CD/DVD drive 1', true],
      ],
      Cluster: [
        ['Cluster', 'Cores', 'Threads', 'MemGB', 'EffectiveMemGB', 'VMs',
         'vmhosts', 'DrsEnabled', 'HA_enabled', 'Datacenter'],
        ['Prod', 32, 64, 256, 240, 2, 2, true, true, 'DC1'],
      ],
      vmhost: [
        ['vmhost', 'Version', 'Build', 'MemGB', 'CPU', 'CpuCores',
         'CPUModel', 'CPUMhz', 'Vendor', 'Model', 'VMs',
         'Cluster', 'Datacenter', 'PowerState', 'ConnectionState'],
        ['esxi-01', '7.0.3', '20328353', 128, 2, 16,
         'Intel Xeon Gold 6248', 2500, 'Dell', 'PowerEdge R740', 1,
         'Prod', 'DC1', 'poweredOn', 'connected'],
      ],
      vCenter: [
        ['vCenter', 'Product', 'Version', 'Build', 'ApiVersion', 'OsType'],
        ['vcsa.local', 'VMware vCenter Server', '7.0.3', '20395099', '7.0.3.0', 'linux-x64'],
      ],
    });
  }

  it('converts vmInfo to vInfo with GB→MiB transforms', () => {
    const wb = createMinimalVInventory();
    convertVInventoryWorkbook(wb);

    expect(wb.SheetNames).toContain('vInfo');
    expect(wb.SheetNames).not.toContain('vmInfo');

    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['vInfo'], { header: 1 });
    const headers = rows[0] as string[];
    const memIdx = headers.indexOf('Memory');
    const provIdx = headers.indexOf('Provisioned MiB');
    const usedIdx = headers.indexOf('In Use MiB');

    // 8 GB = 8192 MiB
    expect(rows[1][memIdx]).toBe(8192);
    // 10 GB = 10240 MiB
    expect(rows[1][provIdx]).toBe(10240);
    // 5 GB = 5120 MiB
    expect(rows[1][usedIdx]).toBe(5120);
  });

  it('converts vDisk with GB→MiB transform', () => {
    const wb = createMinimalVInventory();
    convertVInventoryWorkbook(wb);

    expect(wb.SheetNames).toContain('vDisk');
    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['vDisk'], { header: 1 });
    const headers = rows[0] as string[];
    const capIdx = headers.indexOf('Capacity MiB');

    // 10 GB = 10240 MiB
    expect(rows[1][capIdx]).toBe(10240);
  });

  it('renames vNetworkadapter to vNetwork', () => {
    const wb = createMinimalVInventory();
    convertVInventoryWorkbook(wb);

    expect(wb.SheetNames).toContain('vNetwork');
    expect(wb.SheetNames).not.toContain('vNetworkadapter');
  });

  it('converts Snapshots to vSnapshot with DaysOld→Date', () => {
    const wb = createMinimalVInventory();
    convertVInventoryWorkbook(wb);

    expect(wb.SheetNames).toContain('vSnapshot');
    expect(wb.SheetNames).not.toContain('Snapshots');

    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['vSnapshot'], { header: 1 });
    const headers = rows[0] as string[];
    const dateIdx = headers.indexOf('Date / time');
    // SheetJS stores Date objects as Excel serial numbers in aoa_to_sheet,
    // so the value is a number. The existing tab parser's getDateValue()
    // handles Excel serial → Date conversion.
    const val = rows[1][dateIdx];
    expect(typeof val).toBe('number');
    // Verify it's a plausible Excel date serial (> 0)
    expect(val as number).toBeGreaterThan(0);
  });

  it('renames DvdFloppy to vCD', () => {
    const wb = createMinimalVInventory();
    convertVInventoryWorkbook(wb);

    expect(wb.SheetNames).toContain('vCD');
    expect(wb.SheetNames).not.toContain('DvdFloppy');
  });

  it('converts Cluster to vCluster with GB→MiB', () => {
    const wb = createMinimalVInventory();
    convertVInventoryWorkbook(wb);

    expect(wb.SheetNames).toContain('vCluster');
    expect(wb.SheetNames).not.toContain('Cluster');

    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['vCluster'], { header: 1 });
    const headers = rows[0] as string[];
    const memIdx = headers.indexOf('Total Memory');
    // 256 GB = 262144 MiB
    expect(rows[1][memIdx]).toBe(262144);
  });

  it('converts vmhost to vHost with GB→MiB', () => {
    const wb = createMinimalVInventory();
    convertVInventoryWorkbook(wb);

    expect(wb.SheetNames).toContain('vHost');
    expect(wb.SheetNames).not.toContain('vmhost');

    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['vHost'], { header: 1 });
    const headers = rows[0] as string[];
    const memIdx = headers.indexOf('Memory');
    // 128 GB = 131072 MiB
    expect(rows[1][memIdx]).toBe(131072);
  });

  it('converts vCenter to vSource', () => {
    const wb = createMinimalVInventory();
    convertVInventoryWorkbook(wb);

    expect(wb.SheetNames).toContain('vSource');
    expect(wb.SheetNames).not.toContain('vCenter');
  });

  it('synthesizes vTools from vmInfo columns', () => {
    const wb = createMinimalVInventory();
    convertVInventoryWorkbook(wb);

    expect(wb.SheetNames).toContain('vTools');
    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['vTools'], { header: 1 });
    const headers = rows[0] as string[];
    expect(headers).toContain('VM');
    expect(headers).toContain('Tools Status');
    expect(headers).toContain('Tools Version');

    const statusIdx = headers.indexOf('Tools Status');
    expect(rows[1][statusIdx]).toBe('toolsOk');
    expect(rows[2][statusIdx]).toBe('toolsNotRunning');
  });

  it('synthesizes vCPU from vmInfo columns', () => {
    const wb = createMinimalVInventory();
    convertVInventoryWorkbook(wb);

    expect(wb.SheetNames).toContain('vCPU');
    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['vCPU'], { header: 1 });
    const headers = rows[0] as string[];
    expect(headers).toContain('CPUs');
    expect(headers).toContain('Sockets');

    const cpuIdx = headers.indexOf('CPUs');
    expect(rows[1][cpuIdx]).toBe(4);
    expect(rows[2][cpuIdx]).toBe(8);
  });

  it('synthesizes vMemory from vmInfo with GB→MiB', () => {
    const wb = createMinimalVInventory();
    convertVInventoryWorkbook(wb);

    expect(wb.SheetNames).toContain('vMemory');
    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['vMemory'], { header: 1 });
    const headers = rows[0] as string[];
    const sizeIdx = headers.indexOf('Size MB');
    // 8 GB = 8192 MiB
    expect(rows[1][sizeIdx]).toBe(8192);
    // 16 GB = 16384 MiB
    expect(rows[2][sizeIdx]).toBe(16384);
  });

  it('synthesizes vRP from vmInfo ResourcePool', () => {
    const wb = createMinimalVInventory();
    convertVInventoryWorkbook(wb);

    expect(wb.SheetNames).toContain('vRP');
    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['vRP'], { header: 1 });
    expect(rows.length).toBe(2); // header + 1 pool ("Resources")
    expect(rows[1][0]).toBe('Resources');
    expect(rows[1][1]).toBe(2); // 2 VMs in that pool
  });

  it('synthesizes vDatastore from vDisk data', () => {
    const wb = createMinimalVInventory();
    convertVInventoryWorkbook(wb);

    expect(wb.SheetNames).toContain('vDatastore');
    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['vDatastore'], { header: 1 });
    const headers = rows[0] as string[];
    expect(headers).toContain('Name');
    expect(headers).toContain('Capacity MiB');
    // 2 datastores: ds-prod-01 and ds-prod-02
    expect(rows.length).toBe(3);
  });

  it('removes vInventory-only sheets after conversion', () => {
    const wb = createMinimalVInventory();
    convertVInventoryWorkbook(wb);

    expect(wb.SheetNames).not.toContain('vmInfo');
    expect(wb.SheetNames).not.toContain('vNetworkadapter');
    expect(wb.SheetNames).not.toContain('Snapshots');
    expect(wb.SheetNames).not.toContain('DvdFloppy');
    expect(wb.SheetNames).not.toContain('Cluster');
    expect(wb.SheetNames).not.toContain('vmhost');
    expect(wb.SheetNames).not.toContain('vCenter');
  });

  it('handles missing optional sheets gracefully', () => {
    // Only vmInfo — no vDisk, no snapshots, etc.
    const wb = createWorkbook({
      vmInfo: [
        ['VM', 'PowerState', 'MemGB', 'Cpu', 'GuestOS', 'Cluster', 'Datacenter', 'vmhost'],
        ['lone-vm', 'poweredOn', 4, 2, 'RHEL 8', 'Cluster1', 'DC1', 'host1'],
      ],
    });

    const { storageUsageIncomplete } = convertVInventoryWorkbook(wb);
    // No DiskGBUsed column → incomplete
    expect(storageUsageIncomplete).toBe(true);

    expect(wb.SheetNames).toContain('vInfo');
    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['vInfo'], { header: 1 });
    expect(rows.length).toBe(2);
  });

  it('flags storageUsageIncomplete when DiskGBUsed is mostly empty', () => {
    const wb = createWorkbook({
      vmInfo: [
        ['VM', 'PowerState', 'MemGB', 'Cpu', 'DiskGBUsed', 'ProvisionedGB', 'Cluster', 'Datacenter', 'vmhost'],
        ['vm-1', 'poweredOn', 8, 4, undefined, 100, 'Prod', 'DC1', 'host1'],
        ['vm-2', 'poweredOn', 16, 8, undefined, 200, 'Prod', 'DC1', 'host2'],
        ['vm-3', 'poweredOn', 4, 2, undefined, 50, 'Prod', 'DC1', 'host1'],
      ],
    });

    const { storageUsageIncomplete, warnings } = convertVInventoryWorkbook(wb);
    expect(storageUsageIncomplete).toBe(true);
    expect(warnings.some(w => w.includes('DiskGBUsed'))).toBe(true);
  });

  it('does not flag storageUsageIncomplete when DiskGBUsed is populated', () => {
    const wb = createWorkbook({
      vmInfo: [
        ['VM', 'PowerState', 'MemGB', 'Cpu', 'DiskGBUsed', 'ProvisionedGB', 'Cluster', 'Datacenter', 'vmhost'],
        ['vm-1', 'poweredOn', 8, 4, 50, 100, 'Prod', 'DC1', 'host1'],
        ['vm-2', 'poweredOn', 16, 8, 80, 200, 'Prod', 'DC1', 'host2'],
      ],
    });

    const { storageUsageIncomplete, warnings } = convertVInventoryWorkbook(wb);
    expect(storageUsageIncomplete).toBe(false);
    expect(warnings.some(w => w.includes('DiskGBUsed'))).toBe(false);
  });
});
