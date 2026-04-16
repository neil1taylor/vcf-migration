// Integration tests for IT Requirements Template Excel generator
// Tests the IBM Cloud Cost Estimator import format with Project Settings,
// Data Domains, and Revision History sheets

import { describe, it, expect } from 'vitest';
import type { VMDetail } from '../bomXlsxGenerator';

// Import will fail until we create the generator (RED phase)
import { generateITRequirementsExcel } from '../itRequirementsXlsxGenerator';

// ── Test Fixtures ──────────────────────────────────────────────────

const sampleVMs: VMDetail[] = [
  {
    vmName: 'web-server-01',
    guestOS: 'Red Hat Enterprise Linux 9 (64-bit)',
    profile: 'bx2-4x16',
    vcpus: 4,
    memoryGiB: 16,
    bootVolumeGiB: 100,
    dataVolumes: [{ sizeGiB: 200 }, { sizeGiB: 500 }],
    storageTier: 'general-purpose',
  },
  {
    vmName: 'db-server-01',
    guestOS: 'Microsoft Windows Server 2019 (64-bit)',
    profile: 'mx2-8x64',
    vcpus: 8,
    memoryGiB: 64,
    bootVolumeGiB: 120,
    dataVolumes: [{ sizeGiB: 1000 }],
    storageTier: '10iops',
  },
  {
    vmName: 'app-server-01',
    guestOS: 'Ubuntu Linux (64-bit)',
    profile: 'cx2d-4x8',
    vcpus: 4,
    memoryGiB: 8,
    bootVolumeGiB: 100,
    dataVolumes: [],
  },
  {
    vmName: 'flex-server-01',
    guestOS: 'SUSE Linux Enterprise Server 15',
    profile: 'bxf-2x8',
    vcpus: 2,
    memoryGiB: 8,
    bootVolumeGiB: 100,
    dataVolumes: [{ sizeGiB: 50 }],
    storageTier: '5iops',
  },
];

// ── Sheet Structure Tests ──────────────────────────────────────────

describe('IT Requirements Template Excel Generator', () => {
  describe('sheet structure', () => {
    it('generates a workbook with 3 sheets', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'Test VPC', 'us-south', 'onDemand');
      expect(wb.worksheets).toHaveLength(3);
    });

    it('has correct sheet names', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'Test VPC', 'us-south', 'onDemand');
      const names = wb.worksheets.map(ws => ws.name);
      expect(names).toEqual(['Project Settings', 'Data Domains', 'Revision History']);
    });
  });

  describe('Project Settings sheet', () => {
    it('has all 46 column headers in row 1', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'Test VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      const headerRow = sheet.getRow(1);
      // Column 1 should be "Requirement Type"
      expect(headerRow.getCell(1).value).toBe('Requirement Type');
      // Column 2 should be "VPC name"
      expect(headerRow.getCell(2).value).toBe('VPC name');
      // There should be 46 headers total
      let lastNonEmpty = 0;
      for (let i = 1; i <= 50; i++) {
        if (headerRow.getCell(i).value != null) lastNonEmpty = i;
      }
      expect(lastNonEmpty).toBe(46);
    });

    it('has a Zone row as the first data row', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'Test VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      const row2 = sheet.getRow(2);
      expect(row2.getCell(1).value).toBe('Zone');          // Requirement Type
      expect(row2.getCell(2).value).toBe('Test VPC');       // VPC name
      expect(row2.getCell(4).value).toBe('us-south');       // Region
      expect(row2.getCell(5).value).toBe('us-south-1');     // Data Center
    });

    it('has a Subnet row after the Zone row', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'Test VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      const row3 = sheet.getRow(3);
      expect(row3.getCell(1).value).toBe('Subnet');
      expect(row3.getCell(2).value).toBe('Test VPC');
      expect(row3.getCell(11).value).toBe('Test VPC-subnet-1');
      expect(row3.getCell(13).value).toBe('Private');
    });

    it('has one Compute row per VM', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'Test VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      let computeRows = 0;
      sheet.eachRow((row) => {
        if (row.getCell(1).value === 'Compute') computeRows++;
      });
      expect(computeRows).toBe(4); // 4 VMs
    });

    it('has correct Data Volume rows', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'Test VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      let dataVolumeRows = 0;
      sheet.eachRow((row) => {
        if (row.getCell(1).value === 'Data Volume') dataVolumeRows++;
      });
      // web-server: 2 volumes, db-server: 1 volume, app-server: 0 volumes, flex-server: 1 volume = 4
      expect(dataVolumeRows).toBe(4);
    });

    it('maps VM profile to correct Compute Category VS', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'Test VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      const computeRows: { name: string; category: string }[] = [];
      sheet.eachRow((row) => {
        if (row.getCell(1).value === 'Compute') {
          computeRows.push({
            name: String(row.getCell(16).value),   // Compute name
            category: String(row.getCell(26).value), // Compute Category VS
          });
        }
      });
      // bx2-4x16 -> Balanced
      expect(computeRows.find(r => r.name === 'web-server-01')?.category).toBe('Balanced');
      // mx2-8x64 -> Memory
      expect(computeRows.find(r => r.name === 'db-server-01')?.category).toBe('Memory');
      // cx2d-4x8 -> Compute
      expect(computeRows.find(r => r.name === 'app-server-01')?.category).toBe('Compute');
      // bxf-2x8 -> Flex-Balanced
      expect(computeRows.find(r => r.name === 'flex-server-01')?.category).toBe('Flex-Balanced');
    });

    it('puts the profile name in Compute Family VS', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'Test VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      const families: string[] = [];
      sheet.eachRow((row) => {
        if (row.getCell(1).value === 'Compute') {
          families.push(String(row.getCell(27).value));
        }
      });
      expect(families).toEqual(['bx2-4x16', 'mx2-8x64', 'cx2d-4x8', 'bxf-2x8']);
    });

    it('maps instance storage profiles to Feature VS', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'Test VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      const features: { name: string; feature: string }[] = [];
      sheet.eachRow((row) => {
        if (row.getCell(1).value === 'Compute') {
          features.push({
            name: String(row.getCell(16).value),
            feature: String(row.getCell(25).value),
          });
        }
      });
      // cx2d has instance storage (d-suffix)
      expect(features.find(r => r.name === 'app-server-01')?.feature).toBe('{Instance Storage}');
      // bx2 does not
      expect(features.find(r => r.name === 'web-server-01')?.feature).toBe('{}');
    });

    it('formats OS names to match IT Requirements valid values', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'Test VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      const osNames: { name: string; os: string }[] = [];
      sheet.eachRow((row) => {
        if (row.getCell(1).value === 'Compute') {
          osNames.push({
            name: String(row.getCell(16).value),
            os: String(row.getCell(28).value),
          });
        }
      });
      expect(osNames.find(r => r.name === 'web-server-01')?.os).toBe('Red Hat Enterprise Linux');
      expect(osNames.find(r => r.name === 'db-server-01')?.os).toBe('Windows Server');
      expect(osNames.find(r => r.name === 'app-server-01')?.os).toBe('Ubuntu Linux');
      expect(osNames.find(r => r.name === 'flex-server-01')?.os).toBe('SUSE Linux Enterprise Server');
    });

    it('uses "byol" for OS Version VS', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'Test VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      sheet.eachRow((row) => {
        if (row.getCell(1).value === 'Compute') {
          expect(row.getCell(29).value).toBe('byol'); // OS Version VS
        }
      });
    });

    it('clamps boot volume size to 100-250 GB range', async () => {
      const vms: VMDetail[] = [
        { vmName: 'small-boot', guestOS: 'Ubuntu', profile: 'bx2-2x8', vcpus: 2, memoryGiB: 8, bootVolumeGiB: 40, dataVolumes: [] },
        { vmName: 'normal-boot', guestOS: 'Ubuntu', profile: 'bx2-2x8', vcpus: 2, memoryGiB: 8, bootVolumeGiB: 120, dataVolumes: [] },
        { vmName: 'large-boot', guestOS: 'Ubuntu', profile: 'bx2-2x8', vcpus: 2, memoryGiB: 8, bootVolumeGiB: 500, dataVolumes: [] },
      ];
      const wb = await generateITRequirementsExcel(vms, 'VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      const boots: { name: string; boot: unknown }[] = [];
      sheet.eachRow((row) => {
        if (row.getCell(1).value === 'Compute') {
          boots.push({ name: String(row.getCell(16).value), boot: row.getCell(32).value });
        }
      });
      expect(boots.find(r => r.name === 'small-boot')?.boot).toBe(100);  // clamped up
      expect(boots.find(r => r.name === 'normal-boot')?.boot).toBe(120); // unchanged
      expect(boots.find(r => r.name === 'large-boot')?.boot).toBe(250);  // clamped down
    });

    it('maps storage tier to correct IOPS in Data Volume rows', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'Test VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      const dataVolumes: { iops: unknown; size: unknown }[] = [];
      sheet.eachRow((row) => {
        if (row.getCell(1).value === 'Data Volume') {
          dataVolumes.push({
            iops: row.getCell(33).value,
            size: row.getCell(34).value,
          });
        }
      });
      // web-server (general-purpose -> 3 IOPS): 200GB, 500GB
      expect(dataVolumes[0]).toEqual({ iops: 3, size: 200 });
      expect(dataVolumes[1]).toEqual({ iops: 3, size: 500 });
      // db-server (10iops -> 10 IOPS): 1000GB
      expect(dataVolumes[2]).toEqual({ iops: 10, size: 1000 });
      // flex-server (5iops -> 5 IOPS): 50GB
      expect(dataVolumes[3]).toEqual({ iops: 5, size: 50 });
    });

    it('sets Number of instances to 1 for each Compute row', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'Test VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      sheet.eachRow((row) => {
        if (row.getCell(1).value === 'Compute') {
          expect(row.getCell(30).value).toBe(1);
        }
      });
    });

    it('sets Compute Server Type to "Virtual Server"', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'Test VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      sheet.eachRow((row) => {
        if (row.getCell(1).value === 'Compute') {
          expect(row.getCell(19).value).toBe('Virtual Server');
        }
      });
    });

    it('sets Compute Architecture to "x86"', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'Test VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      sheet.eachRow((row) => {
        if (row.getCell(1).value === 'Compute') {
          expect(row.getCell(17).value).toBe('x86');
        }
      });
    });
  });

  describe('discount type mapping', () => {
    it('maps onDemand to PAYG', async () => {
      const wb = await generateITRequirementsExcel([sampleVMs[0]], 'VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      const row4 = sheet.getRow(4); // first compute row (after header, zone, subnet)
      expect(row4.getCell(31).value).toBe('PAYG');
    });

    it('maps reserved1Year to 1 Yr Reserved', async () => {
      const wb = await generateITRequirementsExcel([sampleVMs[0]], 'VPC', 'us-south', 'reserved1Year');
      const sheet = wb.getWorksheet('Project Settings')!;
      const row4 = sheet.getRow(4); // first compute row (after header, zone, subnet)
      expect(row4.getCell(31).value).toBe('1 Yr Reserved');
    });

    it('maps reserved3Year to 3 Yr Reserved', async () => {
      const wb = await generateITRequirementsExcel([sampleVMs[0]], 'VPC', 'us-south', 'reserved3Year');
      const sheet = wb.getWorksheet('Project Settings')!;
      const row4 = sheet.getRow(4);
      expect(row4.getCell(31).value).toBe('3 Yr Reserved');
    });

    it('maps enterprise to PAYG', async () => {
      const wb = await generateITRequirementsExcel([sampleVMs[0]], 'VPC', 'us-south', 'enterprise');
      const sheet = wb.getWorksheet('Project Settings')!;
      const row4 = sheet.getRow(4);
      expect(row4.getCell(31).value).toBe('PAYG');
    });
  });

  describe('region and geography mapping', () => {
    it('maps us-south to US geography', async () => {
      const wb = await generateITRequirementsExcel([sampleVMs[0]], 'VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      expect(sheet.getRow(2).getCell(3).value).toBe('US');
    });

    it('maps eu-de to Europe geography', async () => {
      const wb = await generateITRequirementsExcel([sampleVMs[0]], 'VPC', 'eu-de' as any, 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      expect(sheet.getRow(2).getCell(3).value).toBe('Europe');
    });

    it('maps jp-tok to Asia Pacific geography', async () => {
      const wb = await generateITRequirementsExcel([sampleVMs[0]], 'VPC', 'jp-tok' as any, 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      expect(sheet.getRow(2).getCell(3).value).toBe('Asia Pacific');
    });

    it('maps br-sao to South America geography', async () => {
      const wb = await generateITRequirementsExcel([sampleVMs[0]], 'VPC', 'br-sao' as any, 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      expect(sheet.getRow(2).getCell(3).value).toBe('South America');
    });

    it('generates correct data center from region', async () => {
      const wb = await generateITRequirementsExcel([sampleVMs[0]], 'VPC', 'eu-de' as any, 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      expect(sheet.getRow(2).getCell(5).value).toBe('eu-de-1');
    });
  });

  describe('edge cases', () => {
    it('handles VM with no data volumes', async () => {
      const vmNoData: VMDetail[] = [{
        vmName: 'no-data-vm',
        guestOS: 'Ubuntu Linux (64-bit)',
        profile: 'bx2-2x8',
        vcpus: 2,
        memoryGiB: 8,
        bootVolumeGiB: 100,
        dataVolumes: [],
      }];
      const wb = await generateITRequirementsExcel(vmNoData, 'VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      let dataVolumeRows = 0;
      sheet.eachRow((row) => {
        if (row.getCell(1).value === 'Data Volume') dataVolumeRows++;
      });
      expect(dataVolumeRows).toBe(0);
    });

    it('handles empty VM list', async () => {
      const wb = await generateITRequirementsExcel([], 'VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      let computeRows = 0;
      sheet.eachRow((row) => {
        if (row.getCell(1).value === 'Compute') computeRows++;
      });
      expect(computeRows).toBe(0);
      // Should still have Zone row
      expect(sheet.getRow(2).getCell(1).value).toBe('Zone');
    });

    it('defaults to 3 IOPS when storageTier is absent', async () => {
      const vmNoTier: VMDetail[] = [{
        vmName: 'no-tier-vm',
        guestOS: 'Red Hat Enterprise Linux 9',
        profile: 'bx2-4x16',
        vcpus: 4,
        memoryGiB: 16,
        bootVolumeGiB: 100,
        dataVolumes: [{ sizeGiB: 100 }],
        // no storageTier
      }];
      const wb = await generateITRequirementsExcel(vmNoTier, 'VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      const dvRows: { iops: unknown }[] = [];
      sheet.eachRow((row) => {
        if (row.getCell(1).value === 'Data Volume') {
          dvRows.push({ iops: row.getCell(33).value });
        }
      });
      expect(dvRows[0].iops).toBe(3);
    });

    it('normalizes confidential computing profiles to standard equivalents', async () => {
      const vms: VMDetail[] = [
        { vmName: 'cc-balanced', guestOS: 'Ubuntu', profile: 'bx3dc-4x20', vcpus: 4, memoryGiB: 20, bootVolumeGiB: 100, dataVolumes: [] },
        { vmName: 'cc-compute', guestOS: 'Ubuntu', profile: 'cx3dc-8x20', vcpus: 8, memoryGiB: 20, bootVolumeGiB: 100, dataVolumes: [] },
        { vmName: 'normal', guestOS: 'Ubuntu', profile: 'bx2-4x16', vcpus: 4, memoryGiB: 16, bootVolumeGiB: 100, dataVolumes: [] },
      ];
      const wb = await generateITRequirementsExcel(vms, 'VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      const profiles: { name: string; profile: string }[] = [];
      sheet.eachRow((row) => {
        if (row.getCell(1).value === 'Compute') {
          profiles.push({
            name: String(row.getCell(16).value),
            profile: String(row.getCell(27).value),
          });
        }
      });
      expect(profiles.find(r => r.name === 'cc-balanced')?.profile).toBe('bx3d-4x20');
      expect(profiles.find(r => r.name === 'cc-compute')?.profile).toBe('cx3d-8x20');
      expect(profiles.find(r => r.name === 'normal')?.profile).toBe('bx2-4x16');
    });

    it('handles unknown OS gracefully', async () => {
      const vmUnknownOS: VMDetail[] = [{
        vmName: 'unknown-os-vm',
        guestOS: 'Some Custom OS 12',
        profile: 'bx2-2x8',
        vcpus: 2,
        memoryGiB: 8,
        bootVolumeGiB: 100,
        dataVolumes: [],
      }];
      const wb = await generateITRequirementsExcel(vmUnknownOS, 'VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Project Settings')!;
      const row4 = sheet.getRow(4); // first compute row (after header, zone, subnet)
      // Should title-case the unknown OS
      expect(row4.getCell(28).value).toBe('Some Custom Os 12');
    });
  });

  describe('Data Domains sheet', () => {
    it('has required lookup columns', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Data Domains')!;
      const headerRow = sheet.getRow(1);
      // Check key headers exist
      expect(headerRow.getCell(1).value).toBe('Requirement Types');
      expect(headerRow.getCell(2).value).toBe('Region');
      expect(headerRow.getCell(3).value).toBe('Data Center');
    });

    it('includes valid requirement types', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Data Domains')!;
      const reqTypes: string[] = [];
      for (let r = 2; r <= 20; r++) {
        const val = sheet.getRow(r).getCell(1).value;
        if (val) reqTypes.push(String(val));
      }
      expect(reqTypes).toContain('Zone');
      expect(reqTypes).toContain('Compute');
      expect(reqTypes).toContain('Data Volume');
      expect(reqTypes).toContain('Subnet');
    });

    it('includes valid compute profiles', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Data Domains')!;
      const profiles: string[] = [];
      for (let r = 2; r <= 200; r++) {
        const val = sheet.getRow(r).getCell(10).value;
        if (val) profiles.push(String(val));
      }
      expect(profiles).toContain('bx2-4x16');
      expect(profiles).toContain('cx2d-4x8');
      expect(profiles).toContain('mx2-8x64');
      expect(profiles).toContain('bxf-2x8');
      expect(profiles.length).toBeGreaterThan(100);
    });

    it('includes valid regions', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Data Domains')!;
      const regions: string[] = [];
      for (let r = 2; r <= 20; r++) {
        const val = sheet.getRow(r).getCell(2).value;
        if (val) regions.push(String(val));
      }
      expect(regions).toContain('us-south');
      expect(regions).toContain('eu-de');
      expect(regions).toContain('jp-tok');
    });
  });

  describe('Revision History sheet', () => {
    it('exists and has version info', async () => {
      const wb = await generateITRequirementsExcel(sampleVMs, 'VPC', 'us-south', 'onDemand');
      const sheet = wb.getWorksheet('Revision History')!;
      expect(sheet).toBeDefined();
      // Should have at least a version row
      let hasVersion = false;
      sheet.eachRow((row) => {
        if (row.getCell(1).value === 'Version') hasVersion = true;
      });
      expect(hasVersion).toBe(true);
    });
  });
});
