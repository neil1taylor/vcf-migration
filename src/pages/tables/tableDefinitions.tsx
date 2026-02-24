// Table row type definitions and column definition factory functions
import { type ColumnDef } from '@tanstack/react-table';
import { Tag } from '@carbon/react';
import { formatNumber } from '@/utils/formatters';

// Type definitions for table rows - need index signature for TanStack Table
export interface VMRow {
  [key: string]: unknown;
  id: string;
  name: string;
  powerState: string;
  cpus: number;
  memoryGiB: number;
  storageGiB: number;
  guestOS: string;
  cluster: string;
  host: string;
  datacenter: string;
}

export interface DatastoreRow {
  [key: string]: unknown;
  id: string;
  name: string;
  type: string;
  capacityGiB: number;
  usedGiB: number;
  freePercent: number;
  vmCount: number;
  hostCount: number;
  datacenter: string;
}

export interface SnapshotRow {
  [key: string]: unknown;
  id: string;
  vmName: string;
  snapshotName: string;
  sizeMiB: number;
  ageInDays: number;
  dateTime: string;
  quiesced: boolean;
  cluster: string;
}

export interface HostRow {
  [key: string]: unknown;
  id: string;
  name: string;
  powerState: string;
  connectionState: string;
  cpuCores: number;
  memoryGiB: number;
  vmCount: number;
  esxiVersion: string;
  vendor: string;
  model: string;
  cluster: string;
  datacenter: string;
}

export interface NetworkRow {
  [key: string]: unknown;
  id: string;
  vmName: string;
  powerState: string;
  nicLabel: string;
  adapterType: string;
  networkName: string;
  switchName: string;
  connected: boolean;
  macAddress: string;
  ipv4Address: string;
  datacenter: string;
  cluster: string;
}

export interface ResourcePoolRow {
  [key: string]: unknown;
  id: string;
  name: string;
  configStatus: string;
  cpuReservation: number;
  cpuLimit: number;
  memoryReservationGiB: number;
  memoryLimitGiB: number;
  vmCount: number;
  datacenter: string;
  cluster: string;
}

export interface ClusterRow {
  [key: string]: unknown;
  id: string;
  name: string;
  configStatus: string;
  overallStatus: string;
  vmCount: number;
  hostCount: number;
  totalCpuCores: number;
  totalMemoryGiB: number;
  haEnabled: boolean;
  drsEnabled: boolean;
  datacenter: string;
}

export interface VCPURow {
  [key: string]: unknown;
  id: string;
  vmName: string;
  powerState: string;
  cpus: number;
  sockets: number;
  coresPerSocket: number;
  shares: number;
  reservation: number;
  limit: number;
  hotAddEnabled: boolean;
}

export interface VMemoryRow {
  [key: string]: unknown;
  id: string;
  vmName: string;
  powerState: string;
  memoryGiB: number;
  shares: number;
  reservationGiB: number;
  limitGiB: number;
  hotAddEnabled: boolean;
  activeGiB: number;
  consumedGiB: number;
}

export interface VDiskRow {
  [key: string]: unknown;
  id: string;
  vmName: string;
  powerState: string;
  diskLabel: string;
  capacityGiB: number;
  thin: boolean;
  diskMode: string;
  controllerType: string;
  datacenter: string;
  cluster: string;
}

export interface VCDRow {
  [key: string]: unknown;
  id: string;
  vmName: string;
  powerState: string;
  deviceNode: string;
  connected: boolean;
  deviceType: string;
  datacenter: string;
  cluster: string;
}

export interface VToolsRow {
  [key: string]: unknown;
  id: string;
  vmName: string;
  powerState: string;
  toolsStatus: string;
  toolsVersion: string;
  upgradeable: boolean;
  upgradePolicy: string;
  syncTime: boolean;
}

export interface VLicenseRow {
  [key: string]: unknown;
  id: string;
  name: string;
  licenseKey: string;
  total: number;
  used: number;
  expirationDate: string;
  productName: string;
  productVersion: string;
}

export interface VSourceRow {
  [key: string]: unknown;
  id: string;
  server: string;
  ipAddress: string;
  version: string;
  build: string;
  osType: string;
  apiVersion: string;
}

// Column definition factory functions

export function createVMColumns(): ColumnDef<VMRow, unknown>[] {
  return [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'VM Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'powerState',
      accessorKey: 'powerState',
      header: 'Power State',
      cell: (info) => {
        const state = info.getValue() as string;
        const type = state === 'poweredOn' ? 'green' : state === 'poweredOff' ? 'gray' : 'magenta';
        return <Tag type={type} size="sm">{state}</Tag>;
      },
    },
    {
      id: 'cpus',
      accessorKey: 'cpus',
      header: 'vCPUs',
    },
    {
      id: 'memoryGiB',
      accessorKey: 'memoryGiB',
      header: 'Memory (GiB)',
      cell: (info) => `${info.getValue()} GiB`,
    },
    {
      id: 'storageGiB',
      accessorKey: 'storageGiB',
      header: 'Storage (GiB)',
      cell: (info) => `${formatNumber(info.getValue() as number)} GiB`,
    },
    {
      id: 'guestOS',
      accessorKey: 'guestOS',
      header: 'Guest OS',
    },
    {
      id: 'cluster',
      accessorKey: 'cluster',
      header: 'Cluster',
    },
    {
      id: 'host',
      accessorKey: 'host',
      header: 'Host',
    },
    {
      id: 'datacenter',
      accessorKey: 'datacenter',
      header: 'Datacenter',
    },
  ];
}

export function createDatastoreColumns(): ColumnDef<DatastoreRow, unknown>[] {
  return [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Datastore',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'type',
      accessorKey: 'type',
      header: 'Type',
      cell: (info) => <Tag type="blue" size="sm">{info.getValue() as string}</Tag>,
    },
    {
      id: 'capacityGiB',
      accessorKey: 'capacityGiB',
      header: 'Capacity (GiB)',
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      id: 'usedGiB',
      accessorKey: 'usedGiB',
      header: 'Used (GiB)',
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      id: 'freePercent',
      accessorKey: 'freePercent',
      header: 'Free %',
      cell: (info) => {
        const pct = info.getValue() as number;
        const type = pct < 10 ? 'red' : pct < 20 ? 'magenta' : 'green';
        return <Tag type={type} size="sm">{pct}%</Tag>;
      },
    },
    {
      id: 'vmCount',
      accessorKey: 'vmCount',
      header: 'VMs',
    },
    {
      id: 'hostCount',
      accessorKey: 'hostCount',
      header: 'Hosts',
    },
    {
      id: 'datacenter',
      accessorKey: 'datacenter',
      header: 'Datacenter',
    },
  ];
}

export function createSnapshotColumns(): ColumnDef<SnapshotRow, unknown>[] {
  return [
    {
      id: 'vmName',
      accessorKey: 'vmName',
      header: 'VM Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'snapshotName',
      accessorKey: 'snapshotName',
      header: 'Snapshot Name',
    },
    {
      id: 'sizeMiB',
      accessorKey: 'sizeMiB',
      header: 'Size (MiB)',
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      id: 'ageInDays',
      accessorKey: 'ageInDays',
      header: 'Age (Days)',
      cell: (info) => {
        const age = info.getValue() as number;
        const type = age > 30 ? 'red' : age > 7 ? 'magenta' : 'green';
        return <Tag type={type} size="sm">{age} days</Tag>;
      },
    },
    {
      id: 'dateTime',
      accessorKey: 'dateTime',
      header: 'Created',
    },
    {
      id: 'quiesced',
      accessorKey: 'quiesced',
      header: 'Quiesced',
      cell: (info) => (info.getValue() as boolean) ? 'Yes' : 'No',
    },
    {
      id: 'cluster',
      accessorKey: 'cluster',
      header: 'Cluster',
    },
  ];
}

export function createHostColumns(): ColumnDef<HostRow, unknown>[] {
  return [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Host Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'powerState',
      accessorKey: 'powerState',
      header: 'Power',
      cell: (info) => {
        const state = info.getValue() as string;
        const type = state === 'poweredOn' ? 'green' : 'gray';
        return <Tag type={type} size="sm">{state}</Tag>;
      },
    },
    {
      id: 'connectionState',
      accessorKey: 'connectionState',
      header: 'Connection',
      cell: (info) => {
        const state = info.getValue() as string;
        const type = state === 'connected' ? 'green' : 'red';
        return <Tag type={type} size="sm">{state}</Tag>;
      },
    },
    {
      id: 'cpuCores',
      accessorKey: 'cpuCores',
      header: 'CPU Cores',
    },
    {
      id: 'memoryGiB',
      accessorKey: 'memoryGiB',
      header: 'Memory (GiB)',
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      id: 'vmCount',
      accessorKey: 'vmCount',
      header: 'VMs',
    },
    {
      id: 'esxiVersion',
      accessorKey: 'esxiVersion',
      header: 'ESXi Version',
    },
    {
      id: 'vendor',
      accessorKey: 'vendor',
      header: 'Vendor',
    },
    {
      id: 'cluster',
      accessorKey: 'cluster',
      header: 'Cluster',
    },
    {
      id: 'datacenter',
      accessorKey: 'datacenter',
      header: 'Datacenter',
    },
  ];
}

export function createNetworkColumns(): ColumnDef<NetworkRow, unknown>[] {
  return [
    {
      id: 'vmName',
      accessorKey: 'vmName',
      header: 'VM Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'powerState',
      accessorKey: 'powerState',
      header: 'Power',
      cell: (info) => {
        const state = info.getValue() as string;
        const type = state === 'poweredOn' ? 'green' : state === 'poweredOff' ? 'gray' : 'magenta';
        return <Tag type={type} size="sm">{state}</Tag>;
      },
    },
    {
      id: 'nicLabel',
      accessorKey: 'nicLabel',
      header: 'NIC Label',
    },
    {
      id: 'adapterType',
      accessorKey: 'adapterType',
      header: 'Adapter Type',
      cell: (info) => <Tag type="blue" size="sm">{info.getValue() as string}</Tag>,
    },
    {
      id: 'networkName',
      accessorKey: 'networkName',
      header: 'Network',
    },
    {
      id: 'switchName',
      accessorKey: 'switchName',
      header: 'Switch',
    },
    {
      id: 'connected',
      accessorKey: 'connected',
      header: 'Connected',
      cell: (info) => {
        const connected = info.getValue() as boolean;
        return <Tag type={connected ? 'green' : 'gray'} size="sm">{connected ? 'Yes' : 'No'}</Tag>;
      },
    },
    {
      id: 'macAddress',
      accessorKey: 'macAddress',
      header: 'MAC Address',
    },
    {
      id: 'ipv4Address',
      accessorKey: 'ipv4Address',
      header: 'IPv4 Address',
    },
    {
      id: 'datacenter',
      accessorKey: 'datacenter',
      header: 'Datacenter',
    },
  ];
}

export function createResourcePoolColumns(): ColumnDef<ResourcePoolRow, unknown>[] {
  return [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'configStatus',
      accessorKey: 'configStatus',
      header: 'Status',
      cell: (info) => {
        const status = info.getValue() as string;
        const type = status === 'green' ? 'green' : status === 'yellow' ? 'magenta' : 'red';
        return <Tag type={type} size="sm">{status}</Tag>;
      },
    },
    {
      id: 'cpuReservation',
      accessorKey: 'cpuReservation',
      header: 'CPU Rsv (MHz)',
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      id: 'cpuLimit',
      accessorKey: 'cpuLimit',
      header: 'CPU Limit (MHz)',
      cell: (info) => {
        const limit = info.getValue() as number;
        return limit === -1 ? 'Unlimited' : formatNumber(limit);
      },
    },
    {
      id: 'memoryReservationGiB',
      accessorKey: 'memoryReservationGiB',
      header: 'Mem Rsv (GiB)',
      cell: (info) => `${info.getValue()} GiB`,
    },
    {
      id: 'memoryLimitGiB',
      accessorKey: 'memoryLimitGiB',
      header: 'Mem Limit (GiB)',
      cell: (info) => {
        const limit = info.getValue() as number;
        return limit === -1 ? 'Unlimited' : `${limit} GiB`;
      },
    },
    {
      id: 'vmCount',
      accessorKey: 'vmCount',
      header: 'VMs',
    },
    {
      id: 'datacenter',
      accessorKey: 'datacenter',
      header: 'Datacenter',
    },
    {
      id: 'cluster',
      accessorKey: 'cluster',
      header: 'Cluster',
    },
  ];
}

export function createClusterColumns(): ColumnDef<ClusterRow, unknown>[] {
  return [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Cluster Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'overallStatus',
      accessorKey: 'overallStatus',
      header: 'Status',
      cell: (info) => {
        const status = info.getValue() as string;
        const type = status === 'green' ? 'green' : status === 'yellow' ? 'magenta' : 'red';
        return <Tag type={type} size="sm">{status}</Tag>;
      },
    },
    {
      id: 'vmCount',
      accessorKey: 'vmCount',
      header: 'VMs',
    },
    {
      id: 'hostCount',
      accessorKey: 'hostCount',
      header: 'Hosts',
    },
    {
      id: 'totalCpuCores',
      accessorKey: 'totalCpuCores',
      header: 'CPU Cores',
    },
    {
      id: 'totalMemoryGiB',
      accessorKey: 'totalMemoryGiB',
      header: 'Memory (GiB)',
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      id: 'haEnabled',
      accessorKey: 'haEnabled',
      header: 'HA',
      cell: (info) => {
        const enabled = info.getValue() as boolean;
        return <Tag type={enabled ? 'green' : 'gray'} size="sm">{enabled ? 'On' : 'Off'}</Tag>;
      },
    },
    {
      id: 'drsEnabled',
      accessorKey: 'drsEnabled',
      header: 'DRS',
      cell: (info) => {
        const enabled = info.getValue() as boolean;
        return <Tag type={enabled ? 'green' : 'gray'} size="sm">{enabled ? 'On' : 'Off'}</Tag>;
      },
    },
    {
      id: 'datacenter',
      accessorKey: 'datacenter',
      header: 'Datacenter',
    },
  ];
}

export function createVCPUColumns(): ColumnDef<VCPURow, unknown>[] {
  return [
    {
      id: 'vmName',
      accessorKey: 'vmName',
      header: 'VM Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'powerState',
      accessorKey: 'powerState',
      header: 'Power',
      cell: (info) => {
        const state = info.getValue() as string;
        const type = state === 'poweredOn' ? 'green' : state === 'poweredOff' ? 'gray' : 'magenta';
        return <Tag type={type} size="sm">{state}</Tag>;
      },
    },
    {
      id: 'cpus',
      accessorKey: 'cpus',
      header: 'vCPUs',
    },
    {
      id: 'sockets',
      accessorKey: 'sockets',
      header: 'Sockets',
    },
    {
      id: 'coresPerSocket',
      accessorKey: 'coresPerSocket',
      header: 'Cores/Socket',
    },
    {
      id: 'shares',
      accessorKey: 'shares',
      header: 'Shares',
    },
    {
      id: 'reservation',
      accessorKey: 'reservation',
      header: 'Reservation (MHz)',
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      id: 'limit',
      accessorKey: 'limit',
      header: 'Limit (MHz)',
      cell: (info) => {
        const limit = info.getValue() as number;
        return limit === -1 ? 'Unlimited' : formatNumber(limit);
      },
    },
    {
      id: 'hotAddEnabled',
      accessorKey: 'hotAddEnabled',
      header: 'Hot Add',
      cell: (info) => (info.getValue() as boolean) ? 'Yes' : 'No',
    },
  ];
}

export function createVMemoryColumns(): ColumnDef<VMemoryRow, unknown>[] {
  return [
    {
      id: 'vmName',
      accessorKey: 'vmName',
      header: 'VM Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'powerState',
      accessorKey: 'powerState',
      header: 'Power',
      cell: (info) => {
        const state = info.getValue() as string;
        const type = state === 'poweredOn' ? 'green' : state === 'poweredOff' ? 'gray' : 'magenta';
        return <Tag type={type} size="sm">{state}</Tag>;
      },
    },
    {
      id: 'memoryGiB',
      accessorKey: 'memoryGiB',
      header: 'Memory (GiB)',
      cell: (info) => `${info.getValue()} GiB`,
    },
    {
      id: 'shares',
      accessorKey: 'shares',
      header: 'Shares',
    },
    {
      id: 'reservationGiB',
      accessorKey: 'reservationGiB',
      header: 'Reservation (GiB)',
      cell: (info) => `${info.getValue()} GiB`,
    },
    {
      id: 'limitGiB',
      accessorKey: 'limitGiB',
      header: 'Limit (GiB)',
      cell: (info) => {
        const limit = info.getValue() as number;
        return limit === -1 ? 'Unlimited' : `${limit} GiB`;
      },
    },
    {
      id: 'hotAddEnabled',
      accessorKey: 'hotAddEnabled',
      header: 'Hot Add',
      cell: (info) => (info.getValue() as boolean) ? 'Yes' : 'No',
    },
    {
      id: 'activeGiB',
      accessorKey: 'activeGiB',
      header: 'Active (GiB)',
      cell: (info) => `${info.getValue()} GiB`,
    },
    {
      id: 'consumedGiB',
      accessorKey: 'consumedGiB',
      header: 'Consumed (GiB)',
      cell: (info) => `${info.getValue()} GiB`,
    },
  ];
}

export function createVDiskColumns(): ColumnDef<VDiskRow, unknown>[] {
  return [
    {
      id: 'vmName',
      accessorKey: 'vmName',
      header: 'VM Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'powerState',
      accessorKey: 'powerState',
      header: 'Power',
      cell: (info) => {
        const state = info.getValue() as string;
        const type = state === 'poweredOn' ? 'green' : state === 'poweredOff' ? 'gray' : 'magenta';
        return <Tag type={type} size="sm">{state}</Tag>;
      },
    },
    {
      id: 'diskLabel',
      accessorKey: 'diskLabel',
      header: 'Disk Label',
    },
    {
      id: 'capacityGiB',
      accessorKey: 'capacityGiB',
      header: 'Capacity (GiB)',
      cell: (info) => `${info.getValue()} GiB`,
    },
    {
      id: 'thin',
      accessorKey: 'thin',
      header: 'Thin',
      cell: (info) => {
        const thin = info.getValue() as boolean;
        return <Tag type={thin ? 'blue' : 'gray'} size="sm">{thin ? 'Yes' : 'No'}</Tag>;
      },
    },
    {
      id: 'diskMode',
      accessorKey: 'diskMode',
      header: 'Mode',
    },
    {
      id: 'controllerType',
      accessorKey: 'controllerType',
      header: 'Controller',
    },
    {
      id: 'datacenter',
      accessorKey: 'datacenter',
      header: 'Datacenter',
    },
    {
      id: 'cluster',
      accessorKey: 'cluster',
      header: 'Cluster',
    },
  ];
}

export function createVCDColumns(): ColumnDef<VCDRow, unknown>[] {
  return [
    {
      id: 'vmName',
      accessorKey: 'vmName',
      header: 'VM Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'powerState',
      accessorKey: 'powerState',
      header: 'Power',
      cell: (info) => {
        const state = info.getValue() as string;
        const type = state === 'poweredOn' ? 'green' : state === 'poweredOff' ? 'gray' : 'magenta';
        return <Tag type={type} size="sm">{state}</Tag>;
      },
    },
    {
      id: 'deviceNode',
      accessorKey: 'deviceNode',
      header: 'Device Node',
    },
    {
      id: 'connected',
      accessorKey: 'connected',
      header: 'Connected',
      cell: (info) => {
        const connected = info.getValue() as boolean;
        return <Tag type={connected ? 'green' : 'gray'} size="sm">{connected ? 'Yes' : 'No'}</Tag>;
      },
    },
    {
      id: 'deviceType',
      accessorKey: 'deviceType',
      header: 'Device Type',
    },
    {
      id: 'datacenter',
      accessorKey: 'datacenter',
      header: 'Datacenter',
    },
    {
      id: 'cluster',
      accessorKey: 'cluster',
      header: 'Cluster',
    },
  ];
}

export function createVToolsColumns(): ColumnDef<VToolsRow, unknown>[] {
  return [
    {
      id: 'vmName',
      accessorKey: 'vmName',
      header: 'VM Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'powerState',
      accessorKey: 'powerState',
      header: 'Power',
      cell: (info) => {
        const state = info.getValue() as string;
        const type = state === 'poweredOn' ? 'green' : state === 'poweredOff' ? 'gray' : 'magenta';
        return <Tag type={type} size="sm">{state}</Tag>;
      },
    },
    {
      id: 'toolsStatus',
      accessorKey: 'toolsStatus',
      header: 'Tools Status',
      cell: (info) => {
        const status = info.getValue() as string;
        const type = status === 'toolsOk' ? 'green'
          : status === 'toolsOld' ? 'magenta'
          : status === 'toolsNotInstalled' ? 'red'
          : 'gray';
        return <Tag type={type} size="sm">{status}</Tag>;
      },
    },
    {
      id: 'toolsVersion',
      accessorKey: 'toolsVersion',
      header: 'Tools Version',
    },
    {
      id: 'upgradeable',
      accessorKey: 'upgradeable',
      header: 'Upgradeable',
      cell: (info) => (info.getValue() as boolean) ? 'Yes' : 'No',
    },
    {
      id: 'upgradePolicy',
      accessorKey: 'upgradePolicy',
      header: 'Upgrade Policy',
    },
    {
      id: 'syncTime',
      accessorKey: 'syncTime',
      header: 'Sync Time',
      cell: (info) => (info.getValue() as boolean) ? 'Yes' : 'No',
    },
  ];
}

export function createVLicenseColumns(): ColumnDef<VLicenseRow, unknown>[] {
  return [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'License Name',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'licenseKey',
      accessorKey: 'licenseKey',
      header: 'License Key',
    },
    {
      id: 'total',
      accessorKey: 'total',
      header: 'Total',
    },
    {
      id: 'used',
      accessorKey: 'used',
      header: 'Used',
    },
    {
      id: 'expirationDate',
      accessorKey: 'expirationDate',
      header: 'Expiration',
    },
    {
      id: 'productName',
      accessorKey: 'productName',
      header: 'Product',
    },
    {
      id: 'productVersion',
      accessorKey: 'productVersion',
      header: 'Version',
    },
  ];
}

export function createVSourceColumns(): ColumnDef<VSourceRow, unknown>[] {
  return [
    {
      id: 'server',
      accessorKey: 'server',
      header: 'Server',
      cell: (info) => <span className="tables-page__name-cell">{info.getValue() as string}</span>,
    },
    {
      id: 'ipAddress',
      accessorKey: 'ipAddress',
      header: 'IP Address',
    },
    {
      id: 'version',
      accessorKey: 'version',
      header: 'Version',
    },
    {
      id: 'build',
      accessorKey: 'build',
      header: 'Build',
    },
    {
      id: 'osType',
      accessorKey: 'osType',
      header: 'OS Type',
    },
    {
      id: 'apiVersion',
      accessorKey: 'apiVersion',
      header: 'API Version',
    },
  ];
}
