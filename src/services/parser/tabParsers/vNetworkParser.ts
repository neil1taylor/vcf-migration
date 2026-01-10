// Parser for vNetwork tab - network adapter information
import type { VNetworkInfo } from '@/types';
import type { WorkSheet } from 'xlsx';
import { parseSheet, getStringValue, getBooleanValue } from './utils';

const COLUMN_MAP: Record<string, keyof VNetworkInfo | null> = {
  // VM Name
  'VM': 'vmName',
  'VM Name': 'vmName',
  'VM name': 'vmName',
  'Name': 'vmName',
  // Power State
  'Powerstate': 'powerState',
  'Power State': 'powerState',
  'Power state': 'powerState',
  'PowerState': 'powerState',
  // Template
  'Template': 'template',
  // NIC Label
  'NIC': 'nicLabel',
  'NIC Label': 'nicLabel',
  'Nic': 'nicLabel',
  'Adapter': 'nicLabel',
  'Adapter Label': 'nicLabel',
  'Network Adapter': 'nicLabel',
  'Network adapter': 'nicLabel',
  // Adapter Type - this is critical for E1000/VMXNET3 detection
  'Adapter Type': 'adapterType',
  'Adapter type': 'adapterType',
  'AdapterType': 'adapterType',
  'Type': 'adapterType',
  'NIC Type': 'adapterType',
  'Nic Type': 'adapterType',
  'Nic type': 'adapterType',
  'Network Adapter Type': 'adapterType',
  // Network Name
  'Network': 'networkName',
  'Network Name': 'networkName',
  'Network name': 'networkName',
  'Port Group': 'networkName',
  'Portgroup': 'networkName',
  'Port group': 'networkName',
  // Switch Name
  'Switch': 'switchName',
  'Switch Name': 'switchName',
  'Switch name': 'switchName',
  'vSwitch': 'switchName',
  // Connected
  'Connected': 'connected',
  'Is Connected': 'connected',
  // Start Connected
  'Start Connected': 'startsConnected',
  'Starts Connected': 'startsConnected',
  'Start connected': 'startsConnected',
  'StartConnected': 'startsConnected',
  // MAC Address
  'MAC Address': 'macAddress',
  'MAC address': 'macAddress',
  'MAC': 'macAddress',
  'Mac Address': 'macAddress',
  // MAC Type
  'MAC Type': 'macType',
  'MAC type': 'macType',
  // IP Addresses
  'IP Address': 'ipv4Address',
  'IP address': 'ipv4Address',
  'IPv4 Address': 'ipv4Address',
  'IPv4 address': 'ipv4Address',
  'IP': 'ipv4Address',
  'Primary IP Address': 'ipv4Address',
  'IPv6 Address': 'ipv6Address',
  'IPv6 address': 'ipv6Address',
  // DirectPath
  'DirectPath IO': 'directPathIO',
  'DirectPath I/O': 'directPathIO',
  'Directpath IO': 'directPathIO',
  // Location
  'Datacenter': 'datacenter',
  'DataCenter': 'datacenter',
  'Data Center': 'datacenter',
  'Cluster': 'cluster',
  'Host': 'host',
};

export function parseVNetwork(sheet: WorkSheet): VNetworkInfo[] {
  const rows = parseSheet(sheet, COLUMN_MAP);

  return rows.map((row): VNetworkInfo => ({
    vmName: getStringValue(row, 'vmName'),
    powerState: getStringValue(row, 'powerState'),
    template: getBooleanValue(row, 'template'),
    nicLabel: getStringValue(row, 'nicLabel'),
    adapterType: getStringValue(row, 'adapterType'),
    networkName: getStringValue(row, 'networkName'),
    switchName: getStringValue(row, 'switchName'),
    connected: getBooleanValue(row, 'connected'),
    startsConnected: getBooleanValue(row, 'startsConnected'),
    macAddress: getStringValue(row, 'macAddress'),
    macType: getStringValue(row, 'macType'),
    ipv4Address: getStringValue(row, 'ipv4Address') || null,
    ipv6Address: getStringValue(row, 'ipv6Address') || null,
    directPathIO: getBooleanValue(row, 'directPathIO'),
    datacenter: getStringValue(row, 'datacenter'),
    cluster: getStringValue(row, 'cluster'),
    host: getStringValue(row, 'host'),
  })).filter(net => net.vmName);
}
