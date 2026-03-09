// parse_rvtools — Load and parse an RVTools Excel file into memory

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import {
  parseVInfo,
  parseVCPU,
  parseVMemory,
  parseVDisk,
  parseVDatastore,
  parseVSnapshot,
  parseVNetwork,
  parseVCD,
  parseVTools,
  parseVCluster,
  parseVHost,
  parseVLicense,
  parseVRP,
  parseVSource,
} from '@/services/parser/tabParsers';
import type { RVToolsData } from '@/types/rvtools';
import { setParsedData } from '../lib/state';

const DEFAULT_FIXTURE = path.resolve(process.cwd(), 'e2e/fixtures/test-rvtools.xlsx');

export function parseRvtools(filePath?: string): { content: Array<{ type: 'text'; text: string }> } {
  const resolvedPath = filePath || DEFAULT_FIXTURE;

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const buffer = fs.readFileSync(resolvedPath);
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheets = workbook.SheetNames;

  const parseSheet = <T>(name: string, parser: (sheet: XLSX.WorkSheet) => T[]): T[] =>
    sheets.includes(name) ? parser(workbook.Sheets[name]) : [];

  const data: RVToolsData = {
    metadata: {
      fileName: path.basename(resolvedPath),
      collectionDate: new Date(),
      vCenterVersion: null,
      environment: null,
    },
    vInfo: parseSheet('vInfo', parseVInfo),
    vCPU: parseSheet('vCPU', parseVCPU),
    vMemory: parseSheet('vMemory', parseVMemory),
    vDisk: parseSheet('vDisk', parseVDisk),
    vDatastore: parseSheet('vDatastore', parseVDatastore),
    vSnapshot: parseSheet('vSnapshot', parseVSnapshot),
    vNetwork: parseSheet('vNetwork', parseVNetwork),
    vCD: parseSheet('vCD', parseVCD),
    vTools: parseSheet('vTools', parseVTools),
    vCluster: parseSheet('vCluster', parseVCluster),
    vHost: parseSheet('vHost', parseVHost),
    vLicense: parseSheet('vLicense', parseVLicense),
    vResourcePool: parseSheet('vRP', parseVRP),
    vSource: parseSheet('vSource', parseVSource),
    vHealth: [],
  };

  setParsedData(data, path.basename(resolvedPath));

  const sheetsFound = sheets.filter(s =>
    ['vInfo', 'vCPU', 'vMemory', 'vDisk', 'vDatastore', 'vSnapshot', 'vNetwork', 'vCD', 'vTools', 'vCluster', 'vHost', 'vLicense', 'vRP', 'vSource'].includes(s)
  );

  const activeVMs = data.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        fileName: path.basename(resolvedPath),
        totalVMs: data.vInfo.length,
        activeVMs: activeVMs.length,
        hosts: data.vHost.length,
        clusters: data.vCluster.length,
        datastores: data.vDatastore.length,
        sheetsFound,
        sheetCounts: {
          vInfo: data.vInfo.length,
          vCPU: data.vCPU.length,
          vMemory: data.vMemory.length,
          vDisk: data.vDisk.length,
          vDatastore: data.vDatastore.length,
          vSnapshot: data.vSnapshot.length,
          vNetwork: data.vNetwork.length,
          vCD: data.vCD.length,
          vTools: data.vTools.length,
          vCluster: data.vCluster.length,
          vHost: data.vHost.length,
        },
      }, null, 2),
    }],
  };
}
