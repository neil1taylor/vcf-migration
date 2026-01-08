// Parser for vMemory tab - Memory configuration information
import type { VMemoryInfo } from '@/types';
import type { WorkSheet } from 'xlsx';
import { parseSheet, getStringValue, getNumberValue, getBooleanValue } from './utils';

// Column mappings for vMemory tab
const COLUMN_MAP: Record<string, keyof VMemoryInfo | null> = {
  'VM': 'vmName',
  'VM Name': 'vmName',
  'Name': 'vmName',
  'Powerstate': 'powerState',
  'Power State': 'powerState',
  'Template': 'template',
  'Size MB': 'memoryMiB',
  'Size MiB': 'memoryMiB',
  'Memory': 'memoryMiB',
  'Memory MB': 'memoryMiB',
  'Overall Level': 'overallLevel',
  'Memory Overall Level': 'overallLevel',
  'Shares': 'shares',
  'Memory Shares': 'shares',
  'Reservation': 'reservation',
  'Memory Reservation': 'reservation',
  'Entitlement': 'entitlement',
  'Memory Entitlement': 'entitlement',
  'DRS Entitlement': 'drsEntitlement',
  'Limit': 'limit',
  'Memory Limit': 'limit',
  'Hot Add': 'hotAddEnabled',
  'Memory Hot Add': 'hotAddEnabled',
  'Hot Add Enabled': 'hotAddEnabled',
  'Active': 'active',
  'Active MB': 'active',
  'Consumed': 'consumed',
  'Consumed MB': 'consumed',
  'Ballooned': 'ballooned',
  'Ballooned MB': 'ballooned',
  'Swapped': 'swapped',
  'Swapped MB': 'swapped',
  'Compressed': 'compressed',
  'Compressed MB': 'compressed',
};

export function parseVMemory(sheet: WorkSheet): VMemoryInfo[] {
  const rows = parseSheet(sheet, COLUMN_MAP);

  return rows.map((row): VMemoryInfo => ({
    vmName: getStringValue(row, 'vmName'),
    powerState: getStringValue(row, 'powerState'),
    template: getBooleanValue(row, 'template'),
    memoryMiB: getNumberValue(row, 'memoryMiB'),
    overallLevel: getStringValue(row, 'overallLevel') || null,
    shares: getNumberValue(row, 'shares'),
    reservation: getNumberValue(row, 'reservation'),
    entitlement: getNumberValue(row, 'entitlement') || null,
    drsEntitlement: getNumberValue(row, 'drsEntitlement') || null,
    limit: getNumberValue(row, 'limit'),
    hotAddEnabled: getBooleanValue(row, 'hotAddEnabled'),
    active: getNumberValue(row, 'active') || null,
    consumed: getNumberValue(row, 'consumed') || null,
    ballooned: getNumberValue(row, 'ballooned') || null,
    swapped: getNumberValue(row, 'swapped') || null,
    compressed: getNumberValue(row, 'compressed') || null,
  })).filter(mem => mem.vmName); // Filter out empty rows
}
