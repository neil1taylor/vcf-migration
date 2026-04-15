// Appendices Section

import { Paragraph, Table, TableRow, PageBreak, HeadingLevel, BorderStyle, AlignmentType } from 'docx';
import { STYLES, type DocumentContent } from '../types';
import type { RVToolsData } from '@/types/rvtools';
import type { VMCheckResults } from '@/services/preflightChecks';
import { mibToGiB } from '@/utils/formatters';
import { createHeading, createParagraph, createTableCell } from '../utils/helpers';
import { getIssueLabels } from '../utils/preflightHelpers';
import {
  buildComputeAppendix,
  buildStorageAppendix,
  buildClusterAppendix,
  buildHostAppendix,
  buildSnapshotAppendix,
  buildVMInventoryAppendix,
} from './appendixSections';

export function buildAppendices(
  checkResults: VMCheckResults[],
  rawData: RVToolsData,
  maxIssueVMs: number,
  includeAppendices: boolean
): DocumentContent[] {
  const allBlockerVMs = checkResults.filter((r) => r.blockerCount > 0);
  const allWarningVMs = checkResults.filter((r) => r.warningCount > 0 && r.blockerCount === 0);

  // Build a lookup for VM compute details (not available in VMCheckResults)
  const vmLookup = new Map(rawData.vInfo.map(vm => [vm.vmName, vm]));

  const hasOverflowBlockers = allBlockerVMs.length > maxIssueVMs;
  const hasOverflowWarnings = allWarningVMs.length > maxIssueVMs;
  const hasOverflow = hasOverflowBlockers || hasOverflowWarnings;

  // Check if there will be any appendix content at all
  if (!hasOverflow && !includeAppendices) {
    return [];
  }

  // Dynamic letter counter
  let letterIndex = 0;
  const nextLetter = () => String.fromCharCode(65 + letterIndex++); // A, B, C, ...

  const sections: DocumentContent[] = [
    createHeading('Appendices', HeadingLevel.HEADING_1),
    createParagraph(
      'The following appendices provide detailed reference data supporting the main report findings.',
      { spacing: { after: 200 } }
    ),
  ];

  // Appendix: Full Blockers List (unconditional — overflow from main body)
  if (hasOverflowBlockers) {
    const label = nextLetter();
    sections.push(
      new Paragraph({ spacing: { before: 240 } }),
      createHeading(`Appendix ${label}: Complete List of VMs with Blockers`, HeadingLevel.HEADING_2),
      createParagraph(
        `This appendix contains all ${allBlockerVMs.length} virtual machines with migration blockers that must be resolved before migration.`,
        { spacing: { after: 120 } }
      ),
      new Table({
        width: { size: 100, type: 'pct' as const },
        columnWidths: [2500, 1500, 1500, 1500, 3500],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          left: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          right: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
        },
        rows: [
          new TableRow({
          cantSplit: true,
            children: [
              createTableCell('VM Name', { header: true }),
              createTableCell('Cluster', { header: true }),
              createTableCell('vCPUs', { header: true, align: AlignmentType.RIGHT }),
              createTableCell('Memory', { header: true, align: AlignmentType.RIGHT }),
              createTableCell('Issues', { header: true }),
            ],
          }),
          ...allBlockerVMs.map(
            (result, index) => {
              const vm = vmLookup.get(result.vmName);
              return new TableRow({
          cantSplit: true,
                children: [
                  createTableCell(
                    result.vmName.length > 25 ? result.vmName.substring(0, 22) + '...' : result.vmName,
                    { altRow: index % 2 === 1 }
                  ),
                  createTableCell(result.cluster, { altRow: index % 2 === 1 }),
                  createTableCell(`${vm?.cpus ?? 0}`, { align: AlignmentType.RIGHT, altRow: index % 2 === 1 }),
                  createTableCell(`${vm ? Math.round(mibToGiB(vm.memory)) : 0} GiB`, { align: AlignmentType.RIGHT, altRow: index % 2 === 1 }),
                  createTableCell(getIssueLabels(result).join(', '), { altRow: index % 2 === 1 }),
                ],
              });
            }
          ),
        ],
      })
    );
  }

  // Appendix: Full Warnings List (unconditional — overflow from main body)
  if (hasOverflowWarnings) {
    const label = nextLetter();
    sections.push(
      new Paragraph({ children: [new PageBreak()] }),
      createHeading(`Appendix ${label}: Complete List of VMs with Warnings`, HeadingLevel.HEADING_2),
      createParagraph(
        `This appendix contains all ${allWarningVMs.length} virtual machines with warnings that should be reviewed before migration.`,
        { spacing: { after: 120 } }
      ),
      new Table({
        width: { size: 100, type: 'pct' as const },
        columnWidths: [2500, 1500, 1500, 1500, 3500],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          left: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          right: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
        },
        rows: [
          new TableRow({
          cantSplit: true,
            children: [
              createTableCell('VM Name', { header: true }),
              createTableCell('Cluster', { header: true }),
              createTableCell('vCPUs', { header: true, align: AlignmentType.RIGHT }),
              createTableCell('Memory', { header: true, align: AlignmentType.RIGHT }),
              createTableCell('Warnings', { header: true }),
            ],
          }),
          ...allWarningVMs.map(
            (result, index) => {
              const vm = vmLookup.get(result.vmName);
              return new TableRow({
          cantSplit: true,
                children: [
                  createTableCell(
                    result.vmName.length > 25 ? result.vmName.substring(0, 22) + '...' : result.vmName,
                    { altRow: index % 2 === 1 }
                  ),
                  createTableCell(result.cluster, { altRow: index % 2 === 1 }),
                  createTableCell(`${vm?.cpus ?? 0}`, { align: AlignmentType.RIGHT, altRow: index % 2 === 1 }),
                  createTableCell(`${vm ? Math.round(mibToGiB(vm.memory)) : 0} GiB`, { align: AlignmentType.RIGHT, altRow: index % 2 === 1 }),
                  createTableCell(getIssueLabels(result).join(', '), { altRow: index % 2 === 1 }),
                ],
              });
            }
          ),
        ],
      })
    );
  }

  // Tier-2 appendices (gated by includeAppendices)
  if (includeAppendices) {
    const tier2Builders = [
      buildComputeAppendix,
      buildStorageAppendix,
      buildClusterAppendix,
      buildHostAppendix,
      buildSnapshotAppendix,
      buildVMInventoryAppendix,
    ];

    for (const builder of tier2Builders) {
      const content = builder(rawData, nextLetter());
      if (content.length > 0) {
        sections.push(...content);
      } else {
        // Reclaim the letter since no content was emitted
        letterIndex--;
      }
    }
  }

  // If only the heading was added (no actual appendix content), return empty
  if (sections.length <= 2) {
    return [];
  }

  return sections;
}
