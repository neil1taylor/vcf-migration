// Platform Selection Assessment DOCX Section

import { HeadingLevel } from 'docx';
import type { PlatformSelectionExport, DocumentContent } from '../types';
import { createHeading, createParagraph, createStyledTable, createTableDescription, createTableLabel } from '../utils/helpers';
import factorsData from '@/data/platformSelectionFactors.json';

const LEANING_LABELS: Record<string, string> = {
  vsi: 'VPC VSI',
  roks: 'ROKS (OpenShift)',
  neutral: 'Neutral',
};

const VARIANT_LABELS: Record<string, string> = {
  full: 'ROKS (Full OpenShift)',
  rov: 'ROV (Red Hat OpenShift Virtualization)',
};

const TARGET_LABELS: Record<string, string> = {
  vsi: 'VSI',
  roks: 'ROKS',
  dynamic: 'Dynamic',
};

const ANSWER_LABELS: Record<string, string> = {
  yes: 'Yes',
  no: 'No',
  'not-sure': 'Not Sure',
  'no-preference': 'No Preference',
};

export function buildPlatformSelectionSection(data: PlatformSelectionExport, sectionNum?: number): DocumentContent[] {
  const { score, answers, roksMonthlyCost, vsiMonthlyCost } = data;
  const totalFactors = factorsData.factors.length;
  const vsiFactorCount = factorsData.factors.filter(f => f.target === 'vsi').length;
  const roksFactorCount = factorsData.factors.filter(f => f.target === 'roks').length;
  const s = sectionNum != null ? sectionNum : null;

  const sections: DocumentContent[] = [
    createHeading((s != null ? `${s}. ` : '') + 'Platform Selection Assessment', HeadingLevel.HEADING_1),
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
    ['ROKS Variant', VARIANT_LABELS[score.roksVariant] ?? 'Full'],
  ];
  sections.push(
    ...createTableDescription('Platform Selection Score Summary', 'Aggregated platform selection questionnaire results'),
    createStyledTable(summaryHeaders, summaryRows),
    createTableLabel('Platform Selection Score Summary'),
  );

  // Per-factor detail table
  sections.push(createHeading((s != null ? `${s}.1 ` : '') + 'Platform Selection Factors', HeadingLevel.HEADING_2));

  // Resolve dynamic cost factor label
  const costFavoursLabel = (() => {
    if (roksMonthlyCost != null && vsiMonthlyCost != null) {
      if (vsiMonthlyCost < roksMonthlyCost) return 'VSI (cheaper)';
      if (roksMonthlyCost < vsiMonthlyCost) return 'ROKS (cheaper)';
      return 'Equal cost';
    }
    return 'Dynamic (cost data unavailable)';
  })();

  const factorHeaders = ['Factor', 'Favours', 'Answer'];
  const factorRows = factorsData.factors.map(factor => {
    const favoursLabel = factor.target === 'dynamic'
      ? costFavoursLabel
      : TARGET_LABELS[factor.target] ?? factor.target;
    return [
      factor.label,
      favoursLabel,
      answers[factor.id] ? (ANSWER_LABELS[answers[factor.id]] ?? answers[factor.id]) : '\u2014',
    ];
  });
  sections.push(
    ...createTableDescription('Platform Selection Factor Responses', 'Individual factor responses from the platform selection questionnaire'),
    createStyledTable(factorHeaders, factorRows),
    createTableLabel('Platform Selection Factor Responses'),
  );

  // Callout for unanswered / "Not Sure" responses
  const notSureCount = factorsData.factors.filter(f => !answers[f.id] || answers[f.id] === 'not-sure').length;
  if (notSureCount > 0) {
    sections.push(
      createParagraph(
        `${notSureCount} question${notSureCount > 1 ? 's' : ''} answered with 'Not Sure' or left unanswered should be resolved with your IBM representative to ensure correct target platform selection.`
      ),
    );
  }

  if (score.roksVariant === 'rov') {
    sections.push(
      createParagraph(
        'Based on questionnaire responses, no containerisation requirements were identified. ROV (Red Hat OpenShift Virtualization) is recommended over full ROKS, providing the same bare metal infrastructure and MTV migration tooling at a reduced OCP licence cost.'
      ),
    );
  }

  sections.push(
    createParagraph(
      'Platform selection scores are indicative and should be considered alongside workload-specific requirements, organizational constraints, and the detailed migration assessment findings in this report. The migration partner will validate platform selection against detailed workload analysis and may recommend a split-platform approach where different workload groups target different IBM Cloud platforms.'
    ),
  );

  return sections;
}
