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

  return sections;
}
