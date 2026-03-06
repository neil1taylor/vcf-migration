// Timeline Estimation DOCX Section

import { HeadingLevel } from 'docx';
import type { TimelinePhase } from '@/types/timeline';
import { calculateTimelineTotals } from '@/services/migration/timelineEstimation';
import type { DocumentContent } from '../types';
import { createHeading, createParagraph, createStyledTable, createTableCaption } from '../utils/helpers';

export function buildTimelineSection(phases: TimelinePhase[], startDate?: Date): DocumentContent[] {
  const totals = calculateTimelineTotals(phases, startDate);
  const sections: DocumentContent[] = [
    createHeading('Migration Timeline', HeadingLevel.HEADING_1),
    createParagraph(`Total estimated duration: ${totals.totalWeeks} weeks across ${totals.phaseCount} phases with ${totals.waveCount} migration waves.`),
  ];

  if (startDate && totals.estimatedEndDate) {
    sections.push(
      createParagraph(`Estimated date range: ${startDate.toLocaleDateString()} to ${totals.estimatedEndDate.toLocaleDateString()}`)
    );
  }

  // Phase table
  const headers = ['Phase', 'Type', 'Duration (weeks)', 'Start Week', 'End Week'];
  const rows = phases.map(p => [
    p.name,
    p.type,
    p.durationWeeks.toString(),
    p.startWeek.toString(),
    p.endWeek.toString(),
  ]);

  sections.push(
    ...createTableCaption('Migration Timeline Phases', 'Detailed breakdown of migration phases and durations'),
    createStyledTable(headers, rows),
  );

  // Typical timeline ranges
  sections.push(
    createHeading('Typical Timeline Ranges', HeadingLevel.HEADING_2),
    createParagraph(
      'The following table provides indicative timeline ranges based on environment size and complexity. These are drawn from typical IBM Cloud migration engagements and should be used as a planning guide rather than a commitment.'
    ),
    createStyledTable(
      ['Environment', 'Typical Assessment', 'Typical Migration'],
      [
        ['Small (<20 VMs, straightforward)', '1 week', '8\u201312 weeks'],
        ['Medium (20\u2013100 VMs, some complexity)', '3\u20135 weeks', '12\u201320 weeks'],
        ['Large (100\u2013500 VMs, significant complexity)', '4\u20138 weeks', '20\u201330+ weeks'],
        ['Extra-large (500+ VMs)', 'TBD', 'TBD'],
      ]
    ),
    createParagraph(
      'Actual timelines depend on environment complexity, remediation effort, change freeze windows, and application owner availability.',
      { spacing: { after: 200 } }
    ),
  );

  return sections;
}
