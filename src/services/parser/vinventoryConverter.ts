/**
 * vInventory to RVTools in-memory workbook converter.
 *
 * Detects vInventory-format Excel files (have `vmInfo` but no `vInfo` sheet)
 * and transforms the SheetJS workbook in-place so existing RVTools tab parsers
 * can process it without modification.
 *
 * Ported from scripts/convert_vinventory.py.
 */
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/** Returns true if the workbook looks like a vInventory export. */
export function isVInventoryFormat(workbook: XLSX.WorkBook): boolean {
  const sheets = workbook.SheetNames;
  return sheets.includes('vmInfo') && !sheets.includes('vInfo');
}

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------

/** Convert GB to MiB (×1024, rounded). */
export function gbToMib(val: unknown): number | unknown {
  const n = typeof val === 'number' ? val : Number(val);
  if (isNaN(n)) return val;
  return Math.round(n * 1024);
}

/** Convert a "days old" number to an absolute Date. */
export function daysOldToDate(val: unknown): Date | null {
  const n = typeof val === 'number' ? val : Number(val);
  if (isNaN(n)) return null;
  return new Date(Date.now() - n * 86_400_000);
}

// ---------------------------------------------------------------------------
// Column maps  (source header → destination header, null = drop)
// ---------------------------------------------------------------------------

type ColumnMap = Record<string, string | null>;
type TransformMap = Record<string, (val: unknown) => unknown>;

const VMINFO_MAP: ColumnMap = {
  VM: 'VM',
  DnsName: 'DNS Name',
  PowerState: 'Powerstate',
  connectionState: 'Connection state',
  IsTemplate: 'Template',
  MemGB: 'Memory',
  Cpu: 'CPUs',
  NICs: 'NICs',
  Disks: 'Disks',
  IP: 'Guest IP',
  IpPrimary: 'Primary IP Address',
  GuestOS: 'OS according to the configuration file',
  vmOS: 'Guest OS',
  GuestFullName: 'OS according to the VMware Tools',
  ProvisionedGB: 'Provisioned MiB',
  ProvisionedMb: null,
  DiskGBUsed: 'In Use MiB',
  vHardware: 'HW version',
  vmhost: 'Host',
  Cluster: 'Cluster',
  Datacenter: 'Datacenter',
  InstanceUuid: 'VM UUID',
  UUID: 'UUID',
  Firmware: 'Firmware',
  ResourcePool: 'Resource pool',
  Folder: 'Folder',
  Annotation: 'Annotation',
  ConsolidationNeeded: 'Consolidation Needed',
  createDate: 'Creation date',
  LastBoot: 'PowerOn',
  // Columns to drop
  Snapshots: null, SnapshotBytes: null, SnapshotGB: null,
  DiskGB: null, 'DiskGBUsed%': null, DiskType: null,
  VirtualMedia: null, vHardwareEsxiSupport: null,
  CpuModel: null, EvcModeEnabled: null, EvcMode: null,
  MixedEvcModeRisk: null, EsxiVersion: null,
  ConsolidationDirty: null,
  MemPrivate: null, HostMemoryUsage: null, MemShared: null,
  MemReserved: null, MemMaxReserved: null,
  'MemActive%': null, 'MemConsumed%': null,
  InitialMemoryReservation: null, SwapReservation: null,
  SwappedMemory: null, BalloonedMemory: null,
  CoresPerSocket: null, CpuSockets: null,
  'CpuDemand%': null, 'CpuUsage%': null,
  vmHost_Mhz: null, NumaMaxSize: null, NumaNodes: null,
  ReserveCpu: null, HotAddCpu: null, HotAddMem: null,
  Tools: null, ToolsVersion: null, ToolsStatus: null,
  ToolsRunning: null, syncTime: null,
  Datastores: null, Partitions: null,
  DiskRdmPhysical: null, DiskRdmVirtual: null,
  DiskShared: null, SharedBus: null,
  vcFolderPath: null, moref: null,
  EthernetCards: null, onVSwitch: null, onVDswitch: null,
  DrsRule: null, DrsRuleEnabled: null, DrsRuleType: null,
  DrsClusterGroupName: null,
  HcxEligible: null, HcxDisqualifier: null,
  sVmotionEligible: null, sVmotionDisqualifier: null,
  PsPath: null, vCenter: null,
};

const VMINFO_TRANSFORMS: TransformMap = {
  Memory: gbToMib,
  'Provisioned MiB': gbToMib,
  'In Use MiB': gbToMib,
};

const VDISK_MAP: ColumnMap = {
  VM: 'VM', Disk: 'Disk', DiskMode: 'Disk Mode',
  DiskDependent: null, DiskBacking: null,
  DiskShared: 'Sharing', BackingUuid: 'UUID',
  LunUuid: null, DeviceName: null,
  ControllerType: 'Controller', ControllerSharedBus: null,
  Controller: null, SCSI_ID: null,
  Thin: 'Thin', Type: 'Type', Split: 'Split',
  WriteThrough: 'Write Through',
  DiskGB: 'Capacity MiB',
  DiskGbUsed: null, IsClone: null,
  ParentDiskFile: null, ParentDiskUuid: null,
  DeltaDiskFormat: null, IoShares: null,
  IoPriority: null, IoLimit: null, IoReservation: null,
  DatastoreCluster: null, Datastore: 'Datastore',
  DatastoreType: null, DatastoreShared: null,
  vmmoref: null, DiskFile: 'Path',
  PsPath: null, vmUuID: null, vCenter: null,
};
const VDISK_TRANSFORMS: TransformMap = { 'Capacity MiB': gbToMib };

const VNETWORK_MAP: ColumnMap = {
  vmNetworkAdapter: 'NIC', VM: 'VM',
  MacAddress: 'MAC Address', IpAddress: 'IP Address',
  Mask: null, DomainName: null, SearchDomain: null,
  Type: 'Adapter Type', vmUuid: null,
  PortGroup: 'Port Group', Switch: 'Switch',
  VLAN: null, Connected: 'Connected',
  StartsConnected: 'Start Connected',
  Status: null, PowerState: 'Powerstate', vCenter: null,
};

const VSNAPSHOT_MAP: ColumnMap = {
  VM: 'VM', Snapshot: 'Name', ParentSnapshot: null,
  DaysOld: 'Date / time', SizeMB: 'Size MB', SizeGB: null,
  Quiesced: 'Quiesced', Description: 'Description', Id: null,
};
const VSNAPSHOT_TRANSFORMS: TransformMap = { 'Date / time': daysOldToDate };

const VCD_MAP: ColumnMap = {
  VM: 'VM', Type: 'Device Node',
  Connected: 'Connected', StartConnected: 'Start Connected',
  Summary: null, Backing: null, vmmoref: null, vCenter: null,
};

const VCLUSTER_MAP: ColumnMap = {
  Cluster: 'Name', EvcModeEnabled: null, EvcModeBaseline: null,
  MixedEvcModeRisk: null, ProactiveDrs: null,
  DrsEnabled: 'DRS Enabled', DrsVmotion: 'DRS Behavior',
  ConcurrentVmotion: null, DrsMigrationThreshold: null,
  DpmBehavior: null, DpmEnabled: null,
  Cores: '# CPU Cores', Threads: '# CPU Threads',
  vCpusAlloc: null, CpuRatio: null,
  SpeedMbMIN: null, SpeedMbMAX: null,
  'CPU%': null, 'N+1CPU%': null, 'MemUsed%': null, 'N+1MEM%': null,
  MemGB: 'Total Memory', EffectiveMemGB: 'Effective Memory',
  'VMs-On': null, VMs: '# VMs', Templates: null,
  HA_enabled: 'HA Enabled', HA_AdmissionControlEnabled: null,
  HA_HostMonitoring: null, HA_VmComponentProtecting: null,
  HA_FailoverLevel: 'HA Failover Level',
  HA_HeartbeatDatastores: null, HA_HeartbeatDatastore: null,
  vmhosts: '# Hosts', PNics: null, vmhostsConnected: null,
  InMaintenanceMode: null, VmToHostRatio: null,
  Datastores: null, StorageCapacityGB: null,
  StorageFreeGB: null, 'StorageUsed%': null,
  vcFolderPath: null, moref: null,
  Datacenter: 'Datacenter', EvcMode: 'EVC Mode', vCenter: null,
};
const VCLUSTER_TRANSFORMS: TransformMap = {
  'Total Memory': gbToMib,
  'Effective Memory': gbToMib,
};

const VHOST_MAP: ColumnMap = {
  vmhost: 'Name', IP: null, DefaultGateway: null,
  NICs: null, HBAs: null, PNics: null,
  VmotionIp: null, VmotionEnabled: null, VmotionVnic: null,
  Product: null, Version: 'ESXi Version', LicenseVersion: null,
  Build: 'Build', LastBoot: null, Uptime: null,
  PowerState: 'Power State', PowerPolicy: null,
  ConnectionState: 'Connection State', inMaintenanceMode: null,
  Serial: null, Vendor: 'Vendor', Model: 'Model',
  MemGB: 'Memory', 'MemUsed%': null, MemUsedGB: null,
  EvcModeEnabled: null, CurrentEVCModeKey: null, MaxEvcMode: null,
  CPU: '# CPU', CpuCores: '# Cores', CpuThreads: null,
  vCpusAlloc: null, CpuRatio: null, CpuThreadRatio: null,
  CPUModel: 'CPU Model', CPUMhz: 'Speed', 'CpuUsage%': null,
  vSwitches: null, vPortGroups: null, VdSwitches: null,
  DrsRule: null, DrsRuleEnabled: null, DrsRuleType: null,
  DrsClusterGroupName: null, vcFolderPath: null,
  VMs: '# VMs', LUNs: null, ScsiLUNs: null,
  LUNpaths: null, Datastores: null,
  Cluster: 'Cluster', moref: null, UuID: null,
  Datacenter: 'Datacenter', vCenter: null,
};
const VHOST_TRANSFORMS: TransformMap = { Memory: gbToMib };

const VSOURCE_MAP: ColumnMap = {
  vCenter: 'Server', Product: 'Full Name',
  ApiVersion: 'API Version', Version: 'Version',
  Build: 'Build', LicenseProductVersion: null,
  LocaleVersion: null, OsType: 'OS Type',
  ServiceUri: null, VMs: null, 'VMs-On': null,
  Templates: null, Cores: null, Threads: null,
  MemGB: null, Clusters: null, Datacenters: null,
  Datastores: null, StorageCapacityGB: null,
  StorageFreeGB: null, vmhosts: null,
  vmhostsConnected: null, vdPortgroups: null,
  vPorgroups: null, vSwitches: null, vdSwitches: null,
  User: null, UserID: null,
};

const VLICENSE_MAP: ColumnMap = {
  EntityDisplayName: null, Product: 'Product Name',
  ProductVersion: 'Product Version', LicenseKey: 'Key',
  LicenseName: 'Name', expirationDate: 'Expiration Date',
  UsedLicense: 'Used', CostUnit: null, Total: 'Total',
  features: null, featuresInUse: null, vcenter: null,
};

const VPARTITION_MAP: ColumnMap = {
  VM: 'VM', '#': null, isTemplate: 'Template',
  Disk: 'Disk', CapacityMB: 'Capacity MiB',
  ConsumedMB: 'Consumed MB', FreeMB: 'Free MB',
  CapacityGB: null, ConsumedGB: null, FreeGB: null,
  'Free%': 'Free %', 'Consumed%': 'Consumed %',
  ToolsRunning: null, vmOS: null,
  GuestOS: 'Guest OS', Folder: 'Folder',
  Cluster: 'Cluster', vmhost: 'Host',
  Datacenter: 'Datacenter', vmmoref: null, vCenter: null,
};

// ---------------------------------------------------------------------------
// Generic sheet converter
// ---------------------------------------------------------------------------

/**
 * Read a sheet from the workbook, rename/transform columns, and write it back
 * under a new name. Returns the number of data rows.
 */
export function convertSheet(
  workbook: XLSX.WorkBook,
  srcSheetName: string,
  dstSheetName: string,
  columnMap: ColumnMap,
  transforms?: TransformMap,
): number {
  const sheet = workbook.Sheets[srcSheetName];
  if (!sheet) return 0;

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length === 0) return 0;

  const srcHeaders = rows[0] as (string | null | undefined)[];

  // Build column plan: [srcIndex, dstHeader, transformFn | undefined][]
  const colPlan: [number, string, ((val: unknown) => unknown) | undefined][] = [];

  for (let i = 0; i < srcHeaders.length; i++) {
    const hdr = srcHeaders[i];
    if (hdr == null) continue;
    const key = String(hdr).trim();
    if (key in columnMap) {
      const dst = columnMap[key];
      if (dst !== null) {
        colPlan.push([i, dst, transforms?.[dst]]);
      }
    }
  }

  // Build output rows
  const outHeaders = colPlan.map(([, dst]) => dst);
  const output: unknown[][] = [outHeaders];

  for (let r = 1; r < rows.length; r++) {
    const srcRow = rows[r];
    const outRow: unknown[] = [];
    for (const [srcIdx, , tfn] of colPlan) {
      let val = srcIdx < srcRow.length ? srcRow[srcIdx] : null;
      if (tfn != null && val != null) {
        val = tfn(val);
      }
      outRow.push(val);
    }
    output.push(outRow);
  }

  // Write new sheet
  const newSheet = XLSX.utils.aoa_to_sheet(output);
  workbook.Sheets[dstSheetName] = newSheet;

  // Update SheetNames if not already present
  if (!workbook.SheetNames.includes(dstSheetName)) {
    workbook.SheetNames.push(dstSheetName);
  }

  return rows.length - 1; // data rows
}

// ---------------------------------------------------------------------------
// Synthesized sheet helpers
// ---------------------------------------------------------------------------

/** Get column indices from a sheet's header row. */
function getColIndices(
  rows: unknown[][],
  colNames: string[],
): Record<string, number> {
  if (rows.length === 0) return {};
  const headers = (rows[0] as (string | null)[]).map((h) =>
    h != null ? String(h).trim() : '',
  );
  const result: Record<string, number> = {};
  for (const name of colNames) {
    const idx = headers.indexOf(name);
    if (idx !== -1) result[name] = idx;
  }
  return result;
}

function cellVal(row: unknown[], idx: number | undefined): unknown {
  if (idx === undefined || idx >= row.length) return null;
  return row[idx];
}

/** Synthesize vTools sheet from vmInfo columns. */
function synthesizeVTools(vmInfoRows: unknown[][], workbook: XLSX.WorkBook): number {
  const cols = getColIndices(vmInfoRows, [
    'VM', 'PowerState', 'IsTemplate', 'vHardware',
    'ToolsStatus', 'ToolsVersion', 'syncTime',
  ]);
  if (cols.VM === undefined) return 0;

  const outMap: [string, string][] = [
    ['VM', 'VM'], ['PowerState', 'Powerstate'], ['IsTemplate', 'Template'],
    ['vHardware', 'VM Version'], ['ToolsStatus', 'Tools Status'],
    ['ToolsVersion', 'Tools Version'], ['syncTime', 'Sync Time'],
  ];

  const output: unknown[][] = [outMap.map(([, dst]) => dst)];
  for (let r = 1; r < vmInfoRows.length; r++) {
    output.push(outMap.map(([src]) => cellVal(vmInfoRows[r], cols[src])));
  }

  workbook.Sheets['vTools'] = XLSX.utils.aoa_to_sheet(output);
  if (!workbook.SheetNames.includes('vTools')) workbook.SheetNames.push('vTools');
  return vmInfoRows.length - 1;
}

/** Synthesize vCPU sheet from vmInfo columns. */
function synthesizeVCPU(vmInfoRows: unknown[][], workbook: XLSX.WorkBook): number {
  const cols = getColIndices(vmInfoRows, [
    'VM', 'PowerState', 'IsTemplate', 'Cpu',
    'CoresPerSocket', 'CpuSockets', 'HotAddCpu', 'ReserveCpu',
  ]);
  if (cols.VM === undefined) return 0;

  const outMap: [string, string][] = [
    ['VM', 'VM'], ['PowerState', 'Powerstate'], ['IsTemplate', 'Template'],
    ['Cpu', 'CPUs'], ['CoresPerSocket', 'Cores per Socket'],
    ['CpuSockets', 'Sockets'], ['HotAddCpu', 'Hot Add'],
    ['ReserveCpu', 'Reservation'],
  ];

  const output: unknown[][] = [outMap.map(([, dst]) => dst)];
  for (let r = 1; r < vmInfoRows.length; r++) {
    output.push(outMap.map(([src]) => cellVal(vmInfoRows[r], cols[src])));
  }

  workbook.Sheets['vCPU'] = XLSX.utils.aoa_to_sheet(output);
  if (!workbook.SheetNames.includes('vCPU')) workbook.SheetNames.push('vCPU');
  return vmInfoRows.length - 1;
}

/** Synthesize vMemory sheet from vmInfo columns. */
function synthesizeVMemory(vmInfoRows: unknown[][], workbook: XLSX.WorkBook): number {
  const cols = getColIndices(vmInfoRows, [
    'VM', 'PowerState', 'IsTemplate', 'MemGB',
    'HotAddMem', 'MemReserved', 'BalloonedMemory', 'SwappedMemory',
  ]);
  if (cols.VM === undefined) return 0;

  type SrcTransform = [string, ((v: unknown) => unknown) | null];
  const outHeaders = ['VM', 'Powerstate', 'Template', 'Size MB', 'Hot Add',
    'Reservation', 'Ballooned', 'Swapped'];
  const srcMap: SrcTransform[] = [
    ['VM', null], ['PowerState', null], ['IsTemplate', null],
    ['MemGB', gbToMib], ['HotAddMem', null],
    ['MemReserved', null], ['BalloonedMemory', null], ['SwappedMemory', null],
  ];

  const output: unknown[][] = [outHeaders];
  for (let r = 1; r < vmInfoRows.length; r++) {
    const row = vmInfoRows[r];
    output.push(srcMap.map(([src, tfn]) => {
      let val = cellVal(row, cols[src]);
      if (tfn && val != null) val = tfn(val);
      return val;
    }));
  }

  workbook.Sheets['vMemory'] = XLSX.utils.aoa_to_sheet(output);
  if (!workbook.SheetNames.includes('vMemory')) workbook.SheetNames.push('vMemory');
  return vmInfoRows.length - 1;
}

/** Synthesize vRP sheet by aggregating ResourcePool from vmInfo. */
function synthesizeVRP(vmInfoRows: unknown[][], workbook: XLSX.WorkBook): number {
  const cols = getColIndices(vmInfoRows, ['ResourcePool', 'Cluster', 'Datacenter']);
  if (cols.ResourcePool === undefined) return 0;

  const pools = new Map<string, { cluster: string; datacenter: string; count: number }>();

  for (let r = 1; r < vmInfoRows.length; r++) {
    const row = vmInfoRows[r];
    const poolName = String(cellVal(row, cols.ResourcePool) ?? '');
    if (!poolName) continue;
    const cluster = String(cellVal(row, cols.Cluster) ?? '');
    const datacenter = String(cellVal(row, cols.Datacenter) ?? '');
    const key = `${poolName}|${cluster}|${datacenter}`;
    const existing = pools.get(key);
    if (existing) {
      existing.count++;
    } else {
      pools.set(key, { cluster, datacenter, count: 1 });
    }
  }

  const output: unknown[][] = [['Name', '# VMs', 'Cluster', 'Datacenter']];
  for (const [key, { cluster, datacenter, count }] of [...pools.entries()].sort()) {
    const poolName = key.split('|')[0];
    output.push([poolName, count, cluster, datacenter]);
  }

  workbook.Sheets['vRP'] = XLSX.utils.aoa_to_sheet(output);
  if (!workbook.SheetNames.includes('vRP')) workbook.SheetNames.push('vRP');
  return pools.size;
}

/** Synthesize vDatastore from vDisk + DatastoreAssociation + LUN sheets. */
function synthesizeVDatastore(workbook: XLSX.WorkBook, vmInfoRows: unknown[][]): number {
  const outHeaders = ['Name', 'Type', 'Capacity MiB', 'Provisioned MiB', 'In Use MiB',
    'Free MB', 'Free %', '# Hosts', 'Hosts', 'Datacenter'];

  // 1. Aggregate vDisk data by datastore
  const dsInfo = new Map<string, { type: string; provGb: number; usedGb: number }>();

  if (workbook.SheetNames.includes('vDisk')) {
    const diskRows: unknown[][] = XLSX.utils.sheet_to_json(workbook.Sheets['vDisk'], { header: 1 });
    if (diskRows.length > 0) {
      const h = getColIndices(diskRows, ['Datastore', 'DatastoreType', 'DiskGB', 'DiskGbUsed']);
      for (let r = 1; r < diskRows.length; r++) {
        const row = diskRows[r];
        const dsName = String(cellVal(row, h.Datastore) ?? '');
        if (!dsName) continue;
        if (!dsInfo.has(dsName)) {
          const dsType = String(cellVal(row, h.DatastoreType) ?? '');
          dsInfo.set(dsName, { type: dsType, provGb: 0, usedGb: 0 });
        }
        const info = dsInfo.get(dsName)!;
        const prov = Number(cellVal(row, h.DiskGB) ?? 0);
        if (!isNaN(prov)) info.provGb += prov;
        const used = Number(cellVal(row, h.DiskGbUsed) ?? 0);
        if (!isNaN(used)) info.usedGb += used;
      }
    }
  }

  // 2. Host counts from DatastoreAssociation
  const dsHosts = new Map<string, Set<string>>();
  if (workbook.SheetNames.includes('DatastoreAssociation')) {
    const assocRows: unknown[][] = XLSX.utils.sheet_to_json(
      workbook.Sheets['DatastoreAssociation'], { header: 1 },
    );
    if (assocRows.length > 0) {
      const h = getColIndices(assocRows, ['Datastore', 'vmhost']);
      for (let r = 1; r < assocRows.length; r++) {
        const row = assocRows[r];
        const dsName = String(cellVal(row, h.Datastore) ?? '');
        const host = String(cellVal(row, h.vmhost) ?? '');
        if (dsName && host) {
          if (!dsHosts.has(dsName)) dsHosts.set(dsName, new Set());
          dsHosts.get(dsName)!.add(host);
        }
      }
    }
  }

  // 3. Capacity from LUN
  const lunCapacity = new Map<string, number>();
  if (workbook.SheetNames.includes('LUN')) {
    const lunRows: unknown[][] = XLSX.utils.sheet_to_json(
      workbook.Sheets['LUN'], { header: 1 },
    );
    if (lunRows.length > 0) {
      const h = getColIndices(lunRows, ['Datastore', 'SizeGB']);
      for (let r = 1; r < lunRows.length; r++) {
        const row = lunRows[r];
        const dsName = String(cellVal(row, h.Datastore) ?? '');
        const sizeGb = Number(cellVal(row, h.SizeGB) ?? NaN);
        if (dsName && !isNaN(sizeGb)) lunCapacity.set(dsName, sizeGb);
      }
    }
  }

  // 4. Datacenter from vmInfo
  let datacenter = '';
  if (vmInfoRows.length > 1) {
    const cols = getColIndices(vmInfoRows, ['Datacenter']);
    if (cols.Datacenter !== undefined) {
      datacenter = String(cellVal(vmInfoRows[1], cols.Datacenter) ?? '');
    }
  }

  // 5. Merge all datastores
  const allDs = new Set([...dsInfo.keys(), ...dsHosts.keys(), ...lunCapacity.keys()]);

  const output: unknown[][] = [outHeaders];
  for (const dsName of [...allDs].sort()) {
    const info = dsInfo.get(dsName) ?? { type: '', provGb: 0, usedGb: 0 };
    const hosts = dsHosts.get(dsName) ?? new Set<string>();
    const capGb = lunCapacity.get(dsName) ?? info.provGb;

    const capMib = Math.round(capGb * 1024);
    const provMib = Math.round(info.provGb * 1024);
    const usedMib = Math.round(info.usedGb * 1024);
    const freeMib = Math.max(0, capMib - usedMib);
    const freePct = capMib > 0 ? Math.round((freeMib / capMib) * 1000) / 10 : 0;

    output.push([
      dsName, info.type, capMib, provMib, usedMib,
      freeMib, freePct, hosts.size,
      [...hosts].sort().join(', '), datacenter,
    ]);
  }

  workbook.Sheets['vDatastore'] = XLSX.utils.aoa_to_sheet(output);
  if (!workbook.SheetNames.includes('vDatastore')) workbook.SheetNames.push('vDatastore');
  return allDs.size;
}

// ---------------------------------------------------------------------------
// Sheet conversion config
// ---------------------------------------------------------------------------

interface SheetConversion {
  src: string;
  dst: string;
  map: ColumnMap;
  transforms?: TransformMap;
}

const SHEET_CONVERSIONS: SheetConversion[] = [
  { src: 'vmInfo', dst: 'vInfo', map: VMINFO_MAP, transforms: VMINFO_TRANSFORMS },
  { src: 'vDisk', dst: 'vDisk', map: VDISK_MAP, transforms: VDISK_TRANSFORMS },
  { src: 'vNetworkadapter', dst: 'vNetwork', map: VNETWORK_MAP },
  { src: 'Snapshots', dst: 'vSnapshot', map: VSNAPSHOT_MAP, transforms: VSNAPSHOT_TRANSFORMS },
  { src: 'DvdFloppy', dst: 'vCD', map: VCD_MAP },
  { src: 'Cluster', dst: 'vCluster', map: VCLUSTER_MAP, transforms: VCLUSTER_TRANSFORMS },
  { src: 'vmhost', dst: 'vHost', map: VHOST_MAP, transforms: VHOST_TRANSFORMS },
  { src: 'vCenter', dst: 'vSource', map: VSOURCE_MAP },
  { src: 'vLicense', dst: 'vLicense', map: VLICENSE_MAP },
  { src: 'vPartition', dst: 'vPartition', map: VPARTITION_MAP },
];

// vInventory-specific sheet names that should be removed after conversion
const VINVENTORY_ONLY_SHEETS = [
  'vmInfo', 'vNetworkadapter', 'Snapshots', 'DvdFloppy',
  'Cluster', 'vmhost', 'vCenter',
  // Auxiliary sheets used by vDatastore synthesis
  'DatastoreAssociation', 'LUN', 'Datastore', 'ResourcePool_vApp',
];

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Convert a vInventory workbook in-place to RVTools format.
 * Mutates the workbook's SheetNames and Sheets.
 */
export function convertVInventoryWorkbook(workbook: XLSX.WorkBook): {
  warnings: string[];
  storageUsageIncomplete: boolean;
} {
  const warnings: string[] = [];

  // Read vmInfo rows before conversion (needed for synthesized sheets)
  const vmInfoSheet = workbook.Sheets['vmInfo'];
  const vmInfoRows: unknown[][] = vmInfoSheet
    ? XLSX.utils.sheet_to_json(vmInfoSheet, { header: 1 })
    : [];

  // Detect incomplete DiskGBUsed data
  let storageUsageIncomplete = false;
  if (vmInfoRows.length > 1) {
    const cols = getColIndices(vmInfoRows, ['DiskGBUsed']);
    const diskGBUsedIdx = cols.DiskGBUsed;
    if (diskGBUsedIdx === undefined) {
      // Column doesn't exist at all
      storageUsageIncomplete = true;
    } else {
      const dataRows = vmInfoRows.length - 1;
      let missingCount = 0;
      for (let r = 1; r < vmInfoRows.length; r++) {
        const val = cellVal(vmInfoRows[r], diskGBUsedIdx);
        if (val == null || val === '' || val === 0) missingCount++;
      }
      storageUsageIncomplete = missingCount / dataRows > 0.5;
    }
    if (storageUsageIncomplete) {
      warnings.push('Disk usage data (DiskGBUsed) is missing for most VMs. In Use storage will be estimated from disk capacity.');
    }
  }

  // 1. Convert mapped sheets
  for (const { src, dst, map, transforms } of SHEET_CONVERSIONS) {
    if (workbook.SheetNames.includes(src)) {
      convertSheet(workbook, src, dst, map, transforms);
    } else if (src === 'vmInfo') {
      // vmInfo is required — should not happen since we checked in isVInventoryFormat
      warnings.push('vmInfo sheet missing from vInventory file');
    }
  }

  // 2. Synthesize sheets from vmInfo data
  if (vmInfoRows.length > 0) {
    synthesizeVTools(vmInfoRows, workbook);
    synthesizeVCPU(vmInfoRows, workbook);
    synthesizeVMemory(vmInfoRows, workbook);
    synthesizeVRP(vmInfoRows, workbook);
  }

  // 3. Synthesize vDatastore from vDisk + DatastoreAssociation + LUN
  synthesizeVDatastore(workbook, vmInfoRows);

  // 4. Remove vInventory-only sheets
  for (const name of VINVENTORY_ONLY_SHEETS) {
    if (workbook.SheetNames.includes(name)) {
      workbook.SheetNames = workbook.SheetNames.filter((s) => s !== name);
      delete workbook.Sheets[name];
    }
  }

  return { warnings, storageUsageIncomplete };
}
