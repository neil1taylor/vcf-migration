// Source Infrastructure BOM Section

import { HeadingLevel, AlignmentType as AT } from 'docx';
import type { SourceBOMResult } from '@/services/sourceBom';
import type { DocumentContent } from '../types';
import { createHeading, createParagraph, createStyledTable } from '../utils/helpers';

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TARGET_LABELS: Record<string, string> = {
  'file-storage': 'File Storage for VPC',
  'block-storage': 'Block Storage for VPC',
  'local-nvme': 'Local NVMe (included)',
};

export function buildSourceBOMSection(
  bomResult: SourceBOMResult,
  sectionNum?: number,
): DocumentContent[] {
  const s = sectionNum ?? 3;
  const sections: DocumentContent[] = [];

  sections.push(
    createHeading(`${s}. Source Infrastructure Costing`, HeadingLevel.HEADING_1),
    createParagraph(
      'This section presents the estimated IBM Cloud cost to replicate the source VMware infrastructure using bare metal servers, VCF licensing, and equivalent storage services. Hosts are matched to the smallest IBM Cloud bare metal profile that meets or exceeds their CPU and memory specifications.'
    ),
  );

  // Host-to-Bare-Metal Mapping table
  sections.push(
    createHeading(`${s}.1 Host-to-Bare-Metal Mapping`, HeadingLevel.HEADING_2),
    createParagraph(
      `${bomResult.hostMappings.length} ESXi host(s) mapped to ${bomResult.hostGroups.length} unique IBM Cloud bare metal profile(s).`
    ),
  );

  const hostHeaders = ['Host Name', 'Cluster', 'Source Cores', 'Source Memory (GiB)', 'IBM Cloud Profile', 'Monthly Cost'];
  const hostRows = bomResult.hostMappings.map(m => [
    m.hostName,
    m.cluster,
    String(m.sourceCores),
    String(m.sourceMemoryGiB),
    m.matchedProfile,
    formatCurrency(m.profileMonthlyCost),
  ]);

  sections.push(
    createStyledTable(hostHeaders, hostRows, {
      columnWidths: [2200, 1600, 1200, 1400, 2200, 1400],
      columnAligns: [AT.LEFT, AT.LEFT, AT.RIGHT, AT.RIGHT, AT.LEFT, AT.RIGHT],
    }),
  );

  // Storage Mapping table
  if (bomResult.storageItems.length > 0) {
    sections.push(
      createHeading(`${s}.2 Storage Mapping`, HeadingLevel.HEADING_2),
      createParagraph(
        'Source VMware datastores mapped to IBM Cloud storage equivalents. NFS datastores use File Storage for VPC, VMFS uses Block Storage, and vSAN/VVOL are served by bare metal local NVMe storage.'
      ),
    );

    const storageHeaders = ['Datastore', 'Type', 'Capacity (GiB)', 'IBM Cloud Target', 'Monthly Cost'];
    const storageRows = bomResult.storageItems.map(si => [
      si.datastoreName,
      si.datastoreType,
      String(si.capacityGiB),
      TARGET_LABELS[si.ibmCloudTarget] ?? si.ibmCloudTarget,
      si.monthlyCost > 0 ? formatCurrency(si.monthlyCost) : 'Included',
    ]);

    sections.push(
      createStyledTable(storageHeaders, storageRows, {
        columnWidths: [2400, 1200, 1400, 2400, 1400],
        columnAligns: [AT.LEFT, AT.LEFT, AT.RIGHT, AT.LEFT, AT.RIGHT],
      }),
    );
  }

  // Cost Summary
  const nextSub = bomResult.storageItems.length > 0 ? 3 : 2;
  sections.push(
    createHeading(`${s}.${nextSub} Cost Summary`, HeadingLevel.HEADING_2),
  );

  const costHeaders = ['Category', 'Description', 'Qty', 'Monthly', 'Annual'];
  const costRows = bomResult.estimate.lineItems.map(li => [
    li.category,
    li.description,
    `${li.quantity.toLocaleString()} ${li.unit}`,
    formatCurrency(li.monthlyCost),
    formatCurrency(li.annualCost),
  ]);

  // Total row
  costRows.push([
    'Total',
    '',
    '',
    formatCurrency(bomResult.estimate.totalMonthly),
    formatCurrency(bomResult.estimate.totalAnnual),
  ]);

  sections.push(
    createStyledTable(costHeaders, costRows, {
      columnWidths: [1600, 2800, 1400, 1600, 1600],
      columnAligns: [AT.LEFT, AT.LEFT, AT.RIGHT, AT.RIGHT, AT.RIGHT],
    }),
  );

  // Warnings
  if (bomResult.warnings.length > 0) {
    sections.push(
      createParagraph(''),
      createParagraph('Notes:'),
    );
    for (const warning of bomResult.warnings) {
      sections.push(createParagraph(`• ${warning}`));
    }
  }

  return sections;
}
