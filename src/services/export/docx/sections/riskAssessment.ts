// Risk Assessment DOCX Section — v3 (flat risk table)

import { HeadingLevel } from 'docx';
import type { RiskTableData, RiskStatus } from '@/types/riskAssessment';
import type { DocumentContent } from '../types';
import { createHeading, createParagraph, createStyledTable } from '../utils/helpers';

const STATUS_EMOJI: Record<RiskStatus, string> = {
  red: 'RED',
  amber: 'AMBER',
  green: 'GREEN',
};

export function buildRiskAssessmentSection(riskTable: RiskTableData): DocumentContent[] {
  const sections: DocumentContent[] = [
    createHeading('Risk Assessment', HeadingLevel.HEADING_1),
  ];

  // Summary counts
  const redCount = riskTable.rows.filter(r => r.status === 'red').length;
  const amberCount = riskTable.rows.filter(r => r.status === 'amber').length;
  const greenCount = riskTable.rows.filter(r => r.status === 'green').length;

  sections.push(
    createParagraph(
      `Risk Summary: ${redCount} Red, ${amberCount} Amber, ${greenCount} Green across ${riskTable.rows.length} identified risks.`
    ),
    createParagraph(
      'This is an initial risk identification based on environment data. The migration partner will develop a comprehensive risk register with severity scoring, likelihood assessment, and detailed mitigation plans informed by application dependency mapping and stakeholder interviews.'
    ),
  );

  // Risk table
  const headers = ['Category', 'Risk Description', 'Impact Area', 'Status', 'Mitigation Plan', 'Evidence / Detail'];
  const rows = riskTable.rows.map(row => [
    row.category,
    row.description,
    row.impactArea,
    STATUS_EMOJI[row.status],
    row.mitigationPlan,
    row.evidenceDetail || '—',
  ]);

  sections.push(createStyledTable(headers, rows));

  return sections;
}
