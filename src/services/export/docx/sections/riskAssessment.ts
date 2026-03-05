// Risk Assessment DOCX Section

import { HeadingLevel } from 'docx';
import type { RiskAssessment, RiskDomainId } from '@/types/riskAssessment';
import type { DocumentContent } from '../types';
import { createHeading, createParagraph, createStyledTable, createTableCaption, createBulletList } from '../utils/helpers';

const GO_NO_GO_LABELS = {
  go: 'GO — Migration Recommended',
  conditional: 'CONDITIONAL — Migration with Remediation',
  'no-go': 'NO-GO — Migration Not Recommended',
};

const DOMAIN_ORDER: RiskDomainId[] = ['cost', 'readiness', 'security', 'operational', 'compliance', 'timeline'];

export function buildRiskAssessmentSection(assessment: RiskAssessment): DocumentContent[] {
  const sections: DocumentContent[] = [
    createHeading('Risk Assessment', HeadingLevel.HEADING_1),
    createParagraph(`Overall Decision: ${GO_NO_GO_LABELS[assessment.goNoGo]}`),
    createParagraph(`Overall Risk Level: ${assessment.overallSeverity.toUpperCase()}`),
  ];

  // Risk domain table — ordered consistently
  const headers = ['Domain', 'Auto', 'Override', 'Effective'];
  const rows = DOMAIN_ORDER.map(domainId => {
    const d = assessment.domains[domainId];
    return [
      d.label,
      d.autoSeverity?.toUpperCase() ?? '—',
      d.overrideSeverity?.toUpperCase() ?? '—',
      d.effectiveSeverity.toUpperCase(),
    ];
  });

  sections.push(
    ...createTableCaption('Risk Assessment Summary', 'Risk severity across all assessment domains'),
    createStyledTable(headers, rows),
  );

  // Evidence details per domain — ordered
  DOMAIN_ORDER.forEach(domainId => {
    const domain = assessment.domains[domainId];
    if (domain.evidence.length > 0 || domain.notes) {
      sections.push(createHeading(domain.label, HeadingLevel.HEADING_2));

      if (domain.evidence.length > 0) {
        sections.push(
          ...createBulletList(domain.evidence.map(e => `${e.label}: ${e.detail}`))
        );
      }

      if (domain.notes) {
        sections.push(createParagraph(`Notes: ${domain.notes}`));
      }
    }
  });

  return sections;
}
