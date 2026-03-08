// Appendices Section

import { Paragraph, Table, TableRow, PageBreak, HeadingLevel, BorderStyle, AlignmentType } from 'docx';
import { STYLES, type DocumentContent, type VMReadiness } from '../types';
import type { RVToolsData } from '@/types/rvtools';
import { createHeading, createParagraph, createTableCell } from '../utils/helpers';
import {
  buildComputeAppendix,
  buildStorageAppendix,
  buildClusterAppendix,
  buildHostAppendix,
  buildSnapshotAppendix,
  buildVMInventoryAppendix,
} from './appendixSections';

export function buildAppendices(
  readiness: VMReadiness[],
  maxIssueVMs: number,
  rawData: RVToolsData,
  includeAppendices: boolean
): DocumentContent[] {
  const allBlockerVMs = readiness.filter((r) => r.hasBlocker);
  const allWarningVMs = readiness.filter((r) => r.hasWarning && !r.hasBlocker);

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
            (vm, index) =>
              new TableRow({
          cantSplit: true,
                children: [
                  createTableCell(
                    vm.vmName.length > 25 ? vm.vmName.substring(0, 22) + '...' : vm.vmName,
                    { altRow: index % 2 === 1 }
                  ),
                  createTableCell(vm.cluster, { altRow: index % 2 === 1 }),
                  createTableCell(`${vm.cpus}`, { align: AlignmentType.RIGHT, altRow: index % 2 === 1 }),
                  createTableCell(`${vm.memoryGiB} GiB`, { align: AlignmentType.RIGHT, altRow: index % 2 === 1 }),
                  createTableCell(vm.issues.join(', '), { altRow: index % 2 === 1 }),
                ],
              })
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
            (vm, index) =>
              new TableRow({
          cantSplit: true,
                children: [
                  createTableCell(
                    vm.vmName.length > 25 ? vm.vmName.substring(0, 22) + '...' : vm.vmName,
                    { altRow: index % 2 === 1 }
                  ),
                  createTableCell(vm.cluster, { altRow: index % 2 === 1 }),
                  createTableCell(`${vm.cpus}`, { align: AlignmentType.RIGHT, altRow: index % 2 === 1 }),
                  createTableCell(`${vm.memoryGiB} GiB`, { align: AlignmentType.RIGHT, altRow: index % 2 === 1 }),
                  createTableCell(vm.issues.join(', '), { altRow: index % 2 === 1 }),
                ],
              })
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
