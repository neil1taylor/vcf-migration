// Source Infrastructure BOM Section

import { HeadingLevel, AlignmentType as AT } from 'docx';
import type { SourceBOMResult } from '@/services/sourceBom';
import type { DocumentContent } from '../types';
import { createHeading, createParagraph, createStyledTable } from '../utils/helpers';

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TARGET_LABELS: Record<string, string> = {
  'file-storage': 'Endurance File Storage',
  'block-storage': 'Endurance Block Storage',
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
      'This section presents the estimated IBM Cloud Classic bare metal cost to replicate the source VMware infrastructure. Hosts are independently matched to the best-fit CPU and RAM components, with VCF licensing and equivalent storage services.'
    ),
  );

  // Host-to-Bare-Metal Mapping table
  sections.push(
    createHeading(`${s}.1 Host-to-Classic-Bare-Metal Mapping`, HeadingLevel.HEADING_2),
    createParagraph(
      `${bomResult.hostMappings.length} ESXi host(s) mapped to ${bomResult.hostGroups.length} unique Classic bare metal configuration(s).`
    ),
  );

  const hostHeaders = ['Host Name', 'Cluster', 'Source Cores', 'Source Mem (GiB)', 'Classic BM CPU', 'Classic BM RAM', 'Monthly Cost'];
  const hostRows = bomResult.hostMappings.map(m => [
    m.hostName,
    m.cluster,
    String(m.sourceCores),
    String(m.sourceMemoryGiB),
    m.matchedCpu,
    m.matchedRam,
    formatCurrency(m.profileMonthlyCost),
  ]);

  sections.push(
    createStyledTable(hostHeaders, hostRows, {
      columnWidths: [1800, 1400, 1000, 1200, 2000, 1400, 1200],
      columnAligns: [AT.LEFT, AT.LEFT, AT.RIGHT, AT.RIGHT, AT.LEFT, AT.LEFT, AT.RIGHT],
    }),
  );

  // Storage Mapping table
  if (bomResult.storageItems.length > 0) {
    sections.push(
      createHeading(`${s}.2 Storage Mapping`, HeadingLevel.HEADING_2),
      createParagraph(
        'Source VMware datastores mapped to IBM Cloud Classic storage equivalents. NFS datastores use Endurance File Storage, VMFS uses Endurance Block Storage (both at 4 IOPS/GB tier), and vSAN/VVOL are served by bare metal local NVMe storage.'
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

  const costHeaders = ['Category', 'Description', 'Qty', 'Unit Cost', 'Monthly', 'Annual'];
  const costRows = bomResult.estimate.lineItems.map(li => [
    li.category,
    li.description,
    `${li.quantity.toLocaleString()} ${li.unit}`,
    formatCurrency(li.unitCost),
    formatCurrency(li.monthlyCost),
    formatCurrency(li.annualCost),
  ]);

  // Total row
  costRows.push([
    'Total',
    '',
    '',
    '',
    formatCurrency(bomResult.estimate.totalMonthly),
    formatCurrency(bomResult.estimate.totalAnnual),
  ]);

  sections.push(
    createStyledTable(costHeaders, costRows, {
      columnWidths: [1400, 2400, 1400, 1200, 1400, 1400],
      columnAligns: [AT.LEFT, AT.LEFT, AT.RIGHT, AT.RIGHT, AT.RIGHT, AT.RIGHT],
    }),
  );

  // Pricing assumptions
  const storageNote = bomResult.storageItems.length > 0
    ? 'Network-attached storage priced using Classic Infrastructure Endurance tier at 4 IOPS/GB.'
    : '';
  const assumptions = [
    'Classic bare metal CPU and RAM priced at IBM Cloud list rates (SoftLayer standard pricing group).',
    storageNote,
    'VMware Cloud Foundation (VCF) licensing priced per physical core per month.',
    'vSAN and VVOL datastores mapped to local NVMe storage included with bare metal servers at no additional cost.',
  ].filter(Boolean);

  sections.push(
    createParagraph(''),
    createParagraph('Pricing Assumptions:'),
  );
  for (const assumption of assumptions) {
    sections.push(createParagraph(`• ${assumption}`));
  }

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
