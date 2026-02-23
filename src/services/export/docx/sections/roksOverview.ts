// ROKS Overview Section

import { Paragraph, PageBreak, HeadingLevel, AlignmentType } from 'docx';
import reportTemplates from '@/data/reportTemplates.json';
import { type DocumentContent, type ROKSSizing } from '../types';
import { createHeading, createParagraph, createBulletList, createStyledTable, createTableDescription, createTableLabel } from '../utils/helpers';

// Type assertion for templates with table/figure descriptions
const templates = reportTemplates as typeof reportTemplates & {
  tableDescriptions: Record<string, { title: string; description: string }>;
  figureDescriptions: Record<string, { title: string; description: string }>;
};

export function buildROKSOverview(sizing: ROKSSizing): DocumentContent[] {
  const roksTemplates = reportTemplates.roksOverview;

  return [
    createHeading('6. ' + roksTemplates.title, HeadingLevel.HEADING_1),
    createParagraph(roksTemplates.introduction),

    createHeading('6.1 ' + roksTemplates.whatIsRoks.title, HeadingLevel.HEADING_2),
    createParagraph(roksTemplates.whatIsRoks.content),

    createHeading('6.2 ' + roksTemplates.architecture.title, HeadingLevel.HEADING_2),
    createParagraph(roksTemplates.architecture.content),
    ...createBulletList(roksTemplates.architecture.components),

    createHeading('6.3 ' + roksTemplates.benefits.title, HeadingLevel.HEADING_2),
    ...roksTemplates.benefits.items.flatMap((b) => [
      createParagraph(b.title, { bold: true }),
      createParagraph(b.description),
    ]),

    createHeading('6.4 ' + roksTemplates.considerations.title, HeadingLevel.HEADING_2),
    ...createBulletList(roksTemplates.considerations.items),

    createHeading('6.5 ' + roksTemplates.sizing.title, HeadingLevel.HEADING_2),
    createParagraph(roksTemplates.sizing.description),
    createParagraph(roksTemplates.sizing.methodology, { spacing: { after: 120 } }),

    createHeading('6.5.1 ODF Storage Sizing', HeadingLevel.HEADING_3),
    createParagraph(
      'OpenShift Data Foundation (ODF) uses Ceph for software-defined storage with 3-way replication for data protection. ' +
      'The sizing calculation reserves 25% of usable capacity for ODF operational overhead, resulting in 75% operational capacity.',
      { spacing: { after: 60 } }
    ),
    ...createBulletList([
      'Ceph rebalancing operations during node maintenance or failures',
      'Automatic data recovery and reconstruction after disk or node failures',
      'Storage system metadata and internal operations',
      'Headroom for workload growth without immediate capacity expansion',
    ]),

    createHeading('6.5.2 CPU Over-commitment', HeadingLevel.HEADING_3),
    createParagraph(
      'OpenShift Virtualization supports CPU over-commitment. The sizing calculations in this report use a conservative 1.8:1 CPU over-commit ratio.',
      { spacing: { after: 120 } }
    ),
    ...createBulletList([
      'Workload Characteristics: CPU-intensive applications may require lower over-commit ratios',
      'Performance Monitoring: Monitor CPU ready time and utilization metrics',
      'Node Capacity: OpenShift reserves ~15% CPU for system services',
    ]),

    createHeading('6.5.3 Memory Over-commitment', HeadingLevel.HEADING_3),
    createParagraph(
      'Memory over-commitment is supported but not enabled by default. This sizing uses 1:1 memory allocation for predictable VM performance.',
      { spacing: { after: 120 } }
    ),
    ...createBulletList([
      'Not Recommended by Default: This sizing uses 1:1 memory allocation',
      'Performance Impact: RAM is ~1000x faster than NVMe; heavy swap usage causes latency',
      'Workload Suitability: Only suitable for workloads tolerant of occasional degradation',
    ]),

    new Paragraph({ spacing: { before: 240 } }),
    createHeading('6.5.4 Recommended Configuration', HeadingLevel.HEADING_3),
    // ROKS sizing table - description above, label below
    ...createTableDescription(
      templates.tableDescriptions.roksSizing.title,
      templates.tableDescriptions.roksSizing.description
    ),
    createStyledTable(
      ['Configuration', 'Value'],
      [
        ['Bare Metal Profile', sizing.profileName],
        ['Worker Nodes', `${sizing.workerNodes}`],
        ['Total Physical Cores', `${sizing.totalCores}`],
        ['Total Threads', `${sizing.totalThreads}`],
        ['Total Memory', `${sizing.totalMemoryGiB} GiB`],
        ['Total Raw NVMe', `${sizing.totalNvmeTiB} TiB`],
        ['ODF Usable Storage', `${sizing.odfUsableTiB} TiB`],
      ],
      { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT] }
    ),
    createTableLabel(templates.tableDescriptions.roksSizing.title),

    new Paragraph({ children: [new PageBreak()] }),
  ];
}
