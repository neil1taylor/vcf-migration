// Platform Selection Assessment DOCX Section

import { HeadingLevel } from 'docx';
import type { PlatformSelectionExport, DocumentContent } from '../types';
import { createHeading, createParagraph, createStyledTable, createTableCaption } from '../utils/helpers';
import factorsData from '@/data/platformSelectionFactors.json';

const LEANING_LABELS: Record<string, string> = {
  vsi: 'VPC VSI',
  roks: 'ROKS (OpenShift)',
  neutral: 'Neutral',
};

const TARGET_LABELS: Record<string, string> = {
  vsi: 'VSI',
  roks: 'ROKS',
};

const ANSWER_LABELS: Record<string, string> = {
  yes: 'Yes',
  no: 'No',
  'not-sure': 'Not Sure',
};

export function buildPlatformSelectionSection(data: PlatformSelectionExport): DocumentContent[] {
  const { score, answers } = data;
  const totalFactors = factorsData.factors.length;
  const vsiFactorCount = factorsData.factors.filter(f => f.target === 'vsi').length;
  const roksFactorCount = factorsData.factors.filter(f => f.target === 'roks').length;

  const sections: DocumentContent[] = [
    createHeading('Platform Selection Assessment', HeadingLevel.HEADING_1),
    createParagraph(
      'This section documents the platform selection questionnaire responses used to determine the recommended target platform for migration.'
    ),
  ];

  // Score summary table
  const summaryHeaders = ['Metric', 'Value'];
  const summaryRows = [
    ['VSI factors (Yes)', `${score.vsiCount} of ${vsiFactorCount}`],
    ['ROKS factors (Yes)', `${score.roksCount} of ${roksFactorCount}`],
    ['Total answered', `${score.answeredCount} of ${totalFactors}`],
    ['Leaning', LEANING_LABELS[score.leaning] ?? score.leaning],
  ];
  sections.push(
    ...createTableCaption('Platform Selection Score Summary', 'Aggregated platform selection questionnaire results'),
    createStyledTable(summaryHeaders, summaryRows),
  );

  // Per-factor detail table
  sections.push(createHeading('Platform Selection Factors', HeadingLevel.HEADING_2));

  const factorHeaders = ['Factor', 'Favours', 'Answer'];
  const factorRows = factorsData.factors.map(factor => [
    factor.label,
    TARGET_LABELS[factor.target] ?? factor.target,
    answers[factor.id] ? (ANSWER_LABELS[answers[factor.id]] ?? answers[factor.id]) : '\u2014',
  ]);
  sections.push(
    ...createTableCaption('Platform Selection Factor Responses', 'Individual factor responses from the platform selection questionnaire'),
    createStyledTable(factorHeaders, factorRows),
  );

  sections.push(
    createParagraph(
      'Platform selection scores are indicative and should be considered alongside workload-specific requirements, organizational constraints, and the detailed migration assessment findings in this report.'
    ),
  );

  return sections;
}
