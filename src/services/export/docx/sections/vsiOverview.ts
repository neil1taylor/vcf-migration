// VSI Overview Section

import { Paragraph, Table, TableRow, PageBreak, HeadingLevel, BorderStyle, AlignmentType } from 'docx';
import type { RVToolsData } from '@/types/rvtools';
import type { VPCDesign } from '@/types/vpcDesign';
import reportTemplates from '@/data/reportTemplates.json';
import { STYLES, type DocumentContent, type VSIMapping, type WavePlanningPreference } from '../types';
import { createHeading, createParagraph, createBulletList, createTableCell, createTableDescription, createTableLabel, createDocLink } from '../utils/helpers';
import { DOC_LINKS } from '../utils/docLinks';
import { computeWavesForMode, buildWaveTable, getStrategyLabel } from './migrationStrategy';
import { buildNetworkDesignSection } from './networkDesign';

// Type assertion for templates with table/figure descriptions
const templates = reportTemplates as typeof reportTemplates & {
  tableDescriptions: Record<string, { title: string; description: string }>;
  figureDescriptions: Record<string, { title: string; description: string }>;
};

export function buildVSIOverview(
  mappings: VSIMapping[],
  maxVMs: number,
  rawData?: RVToolsData,
  wavePlanningPreference?: WavePlanningPreference | null,
  vpcDesign?: VPCDesign | null,
  sectionNum?: number,
): DocumentContent[] {
  const vsiTemplates = reportTemplates.vsiOverview;

  const profileDistribution = mappings.reduce((acc, m) => {
    acc[m.family] = (acc[m.family] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const s = sectionNum != null ? sectionNum : 7;

  const sections: DocumentContent[] = [
    createHeading(`${s}. ` + vsiTemplates.title, HeadingLevel.HEADING_1),
    createParagraph(vsiTemplates.introduction),

    createHeading(`${s}.1 ` + vsiTemplates.whatIsVsi.title, HeadingLevel.HEADING_2),
    createParagraph(vsiTemplates.whatIsVsi.content),
    createDocLink(
      'For the VPC Virtual Servers reference architecture, see',
      'VPC VSI Reference Architecture',
      DOC_LINKS.vsiArchitecture
    ),

    createHeading(`${s}.2 ` + vsiTemplates.architecture.title, HeadingLevel.HEADING_2),
    createParagraph(vsiTemplates.architecture.content),
    ...createBulletList(vsiTemplates.architecture.components),
    createDocLink(
      'For detailed compute design guidance, see',
      'VPC Compute Design',
      DOC_LINKS.vsiCompute
    ),
    createDocLink(
      'For detailed storage design guidance, see',
      'VPC Storage Design',
      DOC_LINKS.vsiStorage
    ),
    createDocLink(
      'For detailed networking design guidance, see',
      'VPC Network Design',
      DOC_LINKS.vsiNetworking
    ),

    createHeading(`${s}.3 ` + vsiTemplates.profileFamilies.title, HeadingLevel.HEADING_2),
    createParagraph(vsiTemplates.profileFamilies.description),

    // VSI profile families table - description above, label below
    ...createTableDescription(
      templates.tableDescriptions.vsiProfileFamilies.title,
      templates.tableDescriptions.vsiProfileFamilies.description
    ),
    new Table({
      width: { size: 100, type: 'pct' as const },
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
            createTableCell('Family', { header: true }),
            createTableCell('CPU:Memory', { header: true }),
            createTableCell('Use Case', { header: true }),
          ],
        }),
        ...vsiTemplates.profileFamilies.families.map(
          (f) =>
            new TableRow({
          cantSplit: true,
              children: [
                createTableCell(f.name),
                createTableCell(f.ratio),
                createTableCell(f.useCase),
              ],
            })
        ),
      ],
    }),
    createTableLabel(templates.tableDescriptions.vsiProfileFamilies.title),

    createHeading(`${s}.4 ` + vsiTemplates.benefits.title, HeadingLevel.HEADING_2),
    ...vsiTemplates.benefits.items.flatMap((b) => [
      createParagraph(b.title, { bold: true }),
      createParagraph(b.description),
    ]),

    createHeading(`${s}.5 ` + vsiTemplates.considerations.title, HeadingLevel.HEADING_2),
    ...createBulletList(vsiTemplates.considerations.items),

    createHeading(`${s}.6 ` + vsiTemplates.sizing.title, HeadingLevel.HEADING_2),
    createParagraph(vsiTemplates.sizing.description),

    createHeading(`${s}.6.1 Profile Distribution`, HeadingLevel.HEADING_3),
    new Table({
      width: { size: 100, type: 'pct' as const },
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
            createTableCell('Profile Family', { header: true }),
            createTableCell('VM Count', { header: true, align: AlignmentType.RIGHT }),
          ],
        }),
        ...Object.entries(profileDistribution).map(
          ([family, count]) =>
            new TableRow({
          cantSplit: true,
              children: [
                createTableCell(family),
                createTableCell(`${count}`, { align: AlignmentType.RIGHT }),
              ],
            })
        ),
      ],
    }),

    new Paragraph({ spacing: { before: 240 } }),
    createHeading(`${s}.6.2 Sample VM to VSI Mappings`, HeadingLevel.HEADING_3),
    // VSI mappings table - description above, label below
    ...createTableDescription(
      templates.tableDescriptions.vsiMappings.title,
      templates.tableDescriptions.vsiMappings.description
    ),
    new Table({
      width: { size: 100, type: 'pct' as const },
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
            createTableCell('vCPUs', { header: true, align: AlignmentType.RIGHT }),
            createTableCell('Memory', { header: true, align: AlignmentType.RIGHT }),
            createTableCell('Profile', { header: true }),
          ],
        }),
        ...mappings.slice(0, maxVMs).map(
          (m) =>
            new TableRow({
          cantSplit: true,
              children: [
                createTableCell(m.vmName.length > 25 ? m.vmName.substring(0, 22) + '...' : m.vmName),
                createTableCell(`${m.sourceVcpus}`, { align: AlignmentType.RIGHT }),
                createTableCell(`${m.sourceMemoryGiB} GiB`, { align: AlignmentType.RIGHT }),
                createTableCell(m.profile),
              ],
            })
        ),
      ],
    }),
    createTableLabel(templates.tableDescriptions.vsiMappings.title),
    mappings.length > maxVMs
      ? createParagraph(`Note: Showing ${maxVMs} of ${mappings.length} VM mappings.`, { spacing: { before: 120 } })
      : new Paragraph({}),

    new Paragraph({ spacing: { before: 360 } }),
    createHeading(`${s}.7 Block Storage Profiles`, HeadingLevel.HEADING_2),
    createParagraph(
      'IBM Cloud offers multiple storage profiles for VSI disk volumes, each optimized for different performance requirements.'
    ),

    createHeading(`${s}.7.1 First-Generation Storage Profiles`, HeadingLevel.HEADING_3),
    createParagraph('The first-generation storage profiles provide reliable block storage with predictable IOPS performance:'),
    new Table({
      width: { size: 100, type: 'pct' as const },
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
            createTableCell('Profile', { header: true }),
            createTableCell('IOPS/GB', { header: true, align: AlignmentType.CENTER }),
            createTableCell('Use Case', { header: true }),
            createTableCell('Boot Volume', { header: true, align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            createTableCell('general-purpose'),
            createTableCell('3', { align: AlignmentType.CENTER }),
            createTableCell('Standard workloads, file servers, development'),
            createTableCell('Yes (Required)', { align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            createTableCell('5iops-tier'),
            createTableCell('5', { align: AlignmentType.CENTER }),
            createTableCell('Moderate I/O applications, web servers'),
            createTableCell('No', { align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            createTableCell('10iops-tier'),
            createTableCell('10', { align: AlignmentType.CENTER }),
            createTableCell('High-performance databases, transactional workloads'),
            createTableCell('No', { align: AlignmentType.CENTER }),
          ],
        }),
      ],
    }),

    createParagraph('Boot Volume Requirements:', { bold: true, spacing: { before: 200 } }),
    ...createBulletList([
      'Boot volumes must use the general-purpose profile exclusively',
      'Boot disk size is limited to 10 GiB minimum and 250 GiB maximum',
      'VSI instances cannot have more than 12 attached disk volumes',
    ]),
  ];

  // VPC Network Design (moved here from standalone section)
  let subNum = 8;
  if (vpcDesign) {
    sections.push(
      createHeading(`${s}.${subNum} VPC Network Design`, HeadingLevel.HEADING_2),
      ...buildNetworkDesignSection(vpcDesign, true),
    );
    subNum++;
  }

  // VSI Wave Summary (moved from strategy)
  if (rawData && wavePlanningPreference) {
    const vsiWaves = computeWavesForMode(rawData, 'vsi', wavePlanningPreference);
    const isComplexity = wavePlanningPreference.wavePlanningMode === 'complexity';
    sections.push(
      createHeading(`${s}.${subNum} VSI Wave Summary`, HeadingLevel.HEADING_2),
      createParagraph(
        `${vsiWaves.length} wave${vsiWaves.length !== 1 ? 's' : ''} generated for VPC Virtual Server migration using the ${getStrategyLabel(wavePlanningPreference)} strategy:`,
        { spacing: { after: 120 } }
      ),
      buildWaveTable(vsiWaves, isComplexity),
    );
    subNum++;
  }

  // VSI Migration Considerations (moved from strategy)
  sections.push(
    createHeading(`${s}.${subNum} VSI Migration Considerations`, HeadingLevel.HEADING_2),
    createParagraph(
      'For VPC Virtual Server migration, subnet-based waves simplify VPC network design:',
      { spacing: { after: 120 } }
    ),
    ...createBulletList([
      'Each VMware port group maps to a VPC subnet with equivalent CIDR range',
      'Security groups can be pre-configured to match existing firewall rules before migration',
      'VPN or Direct Link connectivity can route traffic to migrated subnets during transition',
      'Phased cutover allows gradual DNS updates as each subnet completes migration',
      'During coexistence, traffic between migrated VSIs and non-migrated on-prem VMs traverses the VPN or Direct Link — plan waves to keep latency-sensitive VM pairs together',
    ]),
  );

  sections.push(new Paragraph({ children: [new PageBreak()] }));

  return sections;
}
