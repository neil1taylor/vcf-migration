// Timeline Estimation DOCX Section

import { HeadingLevel } from 'docx';
import type { TimelinePhase } from '@/types/timeline';
import { calculateTimelineTotals } from '@/services/migration/timelineEstimation';
import type { DocumentContent } from '../types';
import { createHeading, createParagraph, createStyledTable, createTableDescription, createTableLabel } from '../utils/helpers';

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
  const headers = ['Phase', 'Source', 'VMs', 'Data', 'Duration (weeks)', 'Start Week', 'End Week'];
  const rows = phases.map(p => [
    p.name,
    p.waveSourceName || p.type,
    p.waveVmCount?.toString() ?? '—',
    p.waveStorageGiB != null
      ? (p.waveStorageGiB >= 1024
          ? `${Math.round(p.waveStorageGiB / 1024).toLocaleString()} TiB`
          : `${Math.round(p.waveStorageGiB).toLocaleString()} GiB`)
      : '—',
    p.durationWeeks.toString(),
    p.startWeek.toString(),
    p.endWeek.toString(),
  ]);

  sections.push(
    ...createTableDescription('Migration Timeline Phases', 'Detailed breakdown of migration phases and durations'),
    createStyledTable(headers, rows),
    createTableLabel('Migration Timeline Phases'),
    createParagraph(
      'The pilot wave is intended to migrate a small number of test VMs to prove the migration process before production waves begin. Wave durations are estimated based on data volume at 500 GB/day migration throughput, with a minimum of 0.25 days per VM for setup and validation overhead, rounded up to the nearest week.'
    ),
    createParagraph(
      'This timeline is indicative and based on typical migration patterns. Once a migration partner is engaged, they will produce a detailed, dependency-aware schedule with specific dates, maintenance windows, and resource assignments tailored to your environment.'
    ),
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
