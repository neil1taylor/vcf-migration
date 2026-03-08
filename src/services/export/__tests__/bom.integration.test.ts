// Integration tests for BOM (Bill of Materials) generators
// Tests real output for both text/JSON/CSV and Excel BOM
// Pricing cache is mocked to avoid dependency on live pricing data
// VMDetail/ROKSNodeDetail are hand-crafted because they require sizing pipeline output

import { describe, it, expect, beforeAll, vi } from 'vitest';

// Mock pricing cache so BOM XLSX doesn't need live pricing
// Use the real getStaticPricing transformer with camelCase blockStorage keys
// (the BOM generator uses camelCase like `generalPurpose` while static data uses kebab-case)
vi.mock('@/services/pricing/pricingCache', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/pricing/pricingCache')>();
  return {
    ...original,
    getCurrentPricing: () => {
      const data = original.getStaticPricing();
      // Normalize blockStorage keys to camelCase (BOM generator expects this)
      const bs = data.blockStorage as Record<string, unknown>;
      if (bs['general-purpose'] && !bs['generalPurpose']) {
        bs['generalPurpose'] = bs['general-purpose'];
      }
      return { data, source: 'static' as const, lastUpdated: null };
    },
  };
});

import {
  generateBOMText,
  generateBOMJSON,
  generateBOMCSV,
} from '../bomGenerator';
import { generateVSIBOMExcel, generateROKSBOMExcel } from '../bomXlsxGenerator';
import type { CostEstimate } from '@/services/costEstimation';
import type { VMDetail, ROKSNodeDetail } from '../bomXlsxGenerator';
import type { RVToolsData } from '@/types/rvtools';
import { getRVToolsData } from './fixtures';
import { mibToGiB } from '@/utils/formatters';

let data: RVToolsData;

beforeAll(async () => {
  data = await getRVToolsData();
});

// Minimal valid CostEstimate for testing
const mockEstimate: CostEstimate = {
  architecture: 'VPC VSI',
  region: 'us-south',
  regionName: 'Dallas',
  discountType: 'onDemand',
  discountPct: 0,
  lineItems: [
    {
      category: 'Compute',
      description: 'bx2-4x16 instance',
      quantity: 3,
      unit: 'instance',
      unitCost: 0.192,
      monthlyCost: 420.48,
      annualCost: 5045.76,
    },
  ],
  subtotalMonthly: 420.48,
  subtotalAnnual: 5045.76,
  discountAmountMonthly: 0,
  discountAmountAnnual: 0,
  totalMonthly: 420.48,
  totalAnnual: 5045.76,
  metadata: {
    pricingVersion: '2024-01',
    generatedAt: new Date().toISOString(),
    notes: ['Test estimate'],
  },
};

/** Derive VMDetail entries from fixture data so the data path is partially exercised */
function deriveVMDetails(rvData: RVToolsData): VMDetail[] {
  const vms = rvData.vInfo.filter(vm => !vm.template && vm.powerState === 'poweredOn');
  return vms.map(vm => {
    const memoryGiB = Math.round(mibToGiB(vm.memory));
    const storageGiB = Math.round(mibToGiB(vm.provisionedMiB));
    // Use balanced family profile naming convention
    const profile = `bx2-${vm.cpus}x${memoryGiB}`;
    return {
      vmName: vm.vmName,
      guestOS: vm.guestOS,
      profile,
      vcpus: vm.cpus,
      memoryGiB,
      bootVolumeGiB: 100,
      dataVolumes: storageGiB > 100 ? [{ sizeGiB: storageGiB - 100 }] : [],
    };
  });
}

const mockNodeDetails: ROKSNodeDetail[] = [
  { nodeName: 'worker-1', profile: 'bx2.16x64', nodeType: 'worker' },
  { nodeName: 'worker-2', profile: 'bx2.16x64', nodeType: 'worker' },
  { nodeName: 'storage-1', profile: 'bx2.16x64', nodeType: 'storage' },
];

describe('BOM text/JSON/CSV integration', () => {
  it('generates valid BOM text', () => {
    const text = generateBOMText(mockEstimate, 'Test Migration');
    expect(text).toContain('Test Migration');
    expect(text).toContain('Compute');
    expect(text).toContain('420');
  });

  it('generates valid BOM JSON', () => {
    const json = generateBOMJSON(mockEstimate, 'Test Migration');
    const parsed = JSON.parse(json);
    expect(parsed.title).toBe('Test Migration');
    expect(parsed.lineItems).toHaveLength(1);
    expect(parsed.totalMonthly).toBe(420.48);
  });

  it('generates valid BOM CSV', () => {
    const csv = generateBOMCSV(mockEstimate);
    const lines = csv.trim().split('\n');
    // Header row + at least 1 data row + totals
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0]).toContain('Category');
  });
});

describe('VSI BOM Excel integration', () => {
  it('generates a workbook with expected sheet names', async () => {
    const vmDetails = deriveVMDetails(data);
    const workbook = await generateVSIBOMExcel(vmDetails, mockEstimate);
    const sheetNames = workbook.worksheets.map(ws => ws.name);
    expect(sheetNames).toContain('VPC VSI BOM');
    expect(sheetNames).toContain('VM Details');
    expect(sheetNames).toContain('Summary');
  });

  it('has data rows matching fixture VM count', async () => {
    const vmDetails = deriveVMDetails(data);
    const workbook = await generateVSIBOMExcel(vmDetails, mockEstimate);
    const detailSheet = workbook.getWorksheet('VM Details');
    expect(detailSheet).toBeDefined();
    // VM Details has a header row + one row per VM
    expect(detailSheet!.rowCount).toBeGreaterThanOrEqual(vmDetails.length + 1);
  });

  it('can be written to a buffer', async () => {
    const vmDetails = deriveVMDetails(data);
    const workbook = await generateVSIBOMExcel(vmDetails, mockEstimate);
    const buffer = await workbook.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});

describe('ROKS BOM Excel integration', () => {
  it('generates a workbook with expected sheet names', async () => {
    const workbook = await generateROKSBOMExcel(mockEstimate, mockNodeDetails);
    const sheetNames = workbook.worksheets.map(ws => ws.name);
    expect(sheetNames).toContain('ROKS BOM');
    expect(sheetNames).toContain('Summary');
  });

  it('has data rows matching node count', async () => {
    const workbook = await generateROKSBOMExcel(mockEstimate, mockNodeDetails);
    const firstSheet = workbook.worksheets[0];
    // Header + 3 nodes = at least 4 rows
    expect(firstSheet.rowCount).toBeGreaterThanOrEqual(4);
  });

  it('can be written to a buffer', async () => {
    const workbook = await generateROKSBOMExcel(mockEstimate, mockNodeDetails);
    const buffer = await workbook.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
