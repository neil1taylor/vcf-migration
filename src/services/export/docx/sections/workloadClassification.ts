// Workload Classification DOCX Section

import { Paragraph, PageBreak, HeadingLevel, AlignmentType } from 'docx';
import type { WorkloadClassificationExport, DocumentContent } from '../types';
import { createHeading, createParagraph, createStyledTable, createTableDescription, createTableLabel } from '../utils/helpers';

export function buildWorkloadClassification(
  classification: WorkloadClassificationExport,
  sectionNum?: number,
): DocumentContent[] {
  const s = sectionNum != null ? sectionNum : 5;
  const total = classification.categories.reduce((sum, c) => sum + c.count, 0);
  const classifiedPct = total > 0 ? Math.round((classification.totalClassified / total) * 100) : 0;

  const sections: DocumentContent[] = [
    createHeading(`${s}. Workload Classification`, HeadingLevel.HEADING_1),
    createParagraph(
      'Workload classification categorises each virtual machine by its function within the environment. ' +
      'Classification informs target platform selection, migration wave sequencing, and post-migration operational planning. ' +
      `Of the ${total} VMs analysed, ${classification.totalClassified} (${classifiedPct}%) were classified into a workload category ` +
      `based on VM name patterns, annotations, and workload detection rules.`
    ),
  ];

  // Classification methodology
  sections.push(
    createHeading(`${s}.1 Classification Methodology`, HeadingLevel.HEADING_2),
    createParagraph(
      'VMs are classified using a four-pass approach with the following precedence: ' +
      '(1) user-defined overrides, (2) maintainer authoritative classifications for known infrastructure products, ' +
      '(3) AI-assisted classification when enabled, and (4) rule-based pattern matching against VM names and annotations. ' +
      'Each VM receives exactly one workload category.'
    ),
  );

  // Category breakdown table
  const categoryRows = classification.categories.map(c => [
    c.category,
    `${c.count}`,
    `${c.percentage}%`,
  ]);

  sections.push(
    createHeading(`${s}.2 Category Breakdown`, HeadingLevel.HEADING_2),
    ...createTableDescription(
      'Workload Category Distribution',
      'Distribution of VMs across workload categories. Categories with higher VM counts represent the dominant workload patterns in the environment.'
    ),
    createStyledTable(
      ['Workload Category', 'VM Count', '% of Total'],
      categoryRows,
      { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT, AlignmentType.RIGHT] }
    ),
    createTableLabel('Workload Category Distribution'),
  );

  // Top categories summary
  const topCategories = classification.categories.filter(c => c.category !== 'Unclassified').slice(0, 4);
  if (topCategories.length > 0) {
    const topSummary = topCategories.map(c => `${c.category} (${c.count} VMs, ${c.percentage}%)`).join(', ');
    sections.push(
      createParagraph(
        `The dominant workload categories are: ${topSummary}. ` +
        'These categories should receive priority attention during migration wave planning and target platform validation.'
      ),
    );
  }

  const unclassified = classification.categories.find(c => c.category === 'Unclassified');
  if (unclassified && unclassified.count > 0) {
    sections.push(
      createParagraph(
        `${unclassified.count} VM${unclassified.count > 1 ? 's' : ''} (${unclassified.percentage}%) could not be automatically classified. ` +
        'These VMs should be reviewed manually to assign appropriate workload categories before migration planning is finalised.'
      ),
    );
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  return sections;
}
