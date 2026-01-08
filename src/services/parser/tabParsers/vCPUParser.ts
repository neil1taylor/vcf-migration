// Parser for vCPU tab - CPU configuration information
import type { VCPUInfo } from '@/types';
import type { WorkSheet } from 'xlsx';
import { parseSheet, getStringValue, getNumberValue, getBooleanValue } from './utils';

// Column mappings for vCPU tab
const COLUMN_MAP: Record<string, keyof VCPUInfo | null> = {
  'VM': 'vmName',
  'VM Name': 'vmName',
  'Name': 'vmName',
  'Powerstate': 'powerState',
  'Power State': 'powerState',
  'Template': 'template',
  'CPUs': 'cpus',
  'Num CPU': 'cpus',
  'Sockets': 'sockets',
  'Cores per Socket': 'coresPerSocket',
  'Max CPU': 'maxCpu',
  'Overall Level': 'overallLevel',
  'CPU Overall Level': 'overallLevel',
  'Shares': 'shares',
  'CPU Shares': 'shares',
  'Reservation': 'reservation',
  'CPU Reservation': 'reservation',
  'Entitlement': 'entitlement',
  'CPU Entitlement': 'entitlement',
  'DRS Entitlement': 'drsEntitlement',
  'Limit': 'limit',
  'CPU Limit': 'limit',
  'Hot Add': 'hotAddEnabled',
  'CPU Hot Add': 'hotAddEnabled',
  'Hot Add Enabled': 'hotAddEnabled',
  'Affinity Rule': 'affinityRule',
  'CPU Affinity': 'affinityRule',
};

export function parseVCPU(sheet: WorkSheet): VCPUInfo[] {
  const rows = parseSheet(sheet, COLUMN_MAP);

  return rows.map((row): VCPUInfo => ({
    vmName: getStringValue(row, 'vmName'),
    powerState: getStringValue(row, 'powerState'),
    template: getBooleanValue(row, 'template'),
    cpus: getNumberValue(row, 'cpus'),
    sockets: getNumberValue(row, 'sockets'),
    coresPerSocket: getNumberValue(row, 'coresPerSocket'),
    maxCpu: getNumberValue(row, 'maxCpu'),
    overallLevel: getStringValue(row, 'overallLevel') || null,
    shares: getNumberValue(row, 'shares'),
    reservation: getNumberValue(row, 'reservation'),
    entitlement: getNumberValue(row, 'entitlement') || null,
    drsEntitlement: getNumberValue(row, 'drsEntitlement') || null,
    limit: getNumberValue(row, 'limit'),
    hotAddEnabled: getBooleanValue(row, 'hotAddEnabled'),
    affinityRule: getStringValue(row, 'affinityRule') || null,
  })).filter(cpu => cpu.vmName); // Filter out empty rows
}
