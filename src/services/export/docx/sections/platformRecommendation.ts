// Platform Recommendation DOCX Section
// Replaces and extends the old platformSelection.ts with:
// - Questionnaire results (from old section)
// - Explicit recommendation summary (NEW)
// - Target assignments table (NEW)

import { Paragraph, PageBreak, HeadingLevel, AlignmentType } from 'docx';
import type { PlatformSelectionExport, TargetAssignmentExport, DocumentContent } from '../types';
import { createHeading, createParagraph, createStyledTable, createTableDescription, createTableLabel } from '../utils/helpers';
import factorsData from '@/data/platformSelectionFactors.json';

const LEANING_LABELS: Record<string, string> = {
  vsi: 'VPC Virtual Servers (VSI)',
  roks: 'ROKS (OpenShift)',
  neutral: 'Split Approach',
};

const VARIANT_LABELS: Record<string, string> = {
  full: 'ROKS (Full OpenShift)',
  rov: 'ROV (Red Hat OpenShift Virtualization)',
};

const TARGET_LABELS: Record<string, string> = {
  vsi: 'VSI',
  roks: 'ROKS',
  dynamic: 'Dynamic',
  powervs: 'PowerVS',
};

const ANSWER_LABELS: Record<string, string> = {
  yes: 'Yes',
  no: 'No',
  'not-sure': 'Not Sure',
  'no-preference': 'No Preference',
};

export function buildPlatformRecommendation(
  platformSelection: PlatformSelectionExport | null,
  targetAssignments: TargetAssignmentExport[] | null,
  sectionNum?: number,
): DocumentContent[] {
  const s = sectionNum != null ? sectionNum : 8;

  const sections: DocumentContent[] = [
    createHeading(`${s}. Platform Recommendation`, HeadingLevel.HEADING_1),
    createParagraph(
      'This section presents the recommended target platform for migration based on the platform selection questionnaire, ' +
      'workload analysis, and per-VM target assignments.'
    ),
  ];

  // §8.1 Questionnaire Results
  if (platformSelection) {
    sections.push(...buildQuestionnaireResults(platformSelection, s));
  }

  // §8.2 Recommendation Summary
  sections.push(...buildRecommendationSummary(platformSelection, targetAssignments, s));

  // §8.3 Target Assignments
  if (targetAssignments && targetAssignments.length > 0) {
    sections.push(...buildTargetAssignmentsSection(targetAssignments, platformSelection, s));
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  return sections;
}

function buildQuestionnaireResults(data: PlatformSelectionExport, s: number): DocumentContent[] {
  const { score, answers, roksMonthlyCost, vsiMonthlyCost } = data;
  const totalFactors = factorsData.factors.length;
  const vsiFactorCount = factorsData.factors.filter(f => f.target === 'vsi').length;
  const roksFactorCount = factorsData.factors.filter(f => f.target === 'roks').length;

  const elements: DocumentContent[] = [
    createHeading(`${s}.1 Questionnaire Results`, HeadingLevel.HEADING_2),
    createParagraph(
      'The platform selection questionnaire captures the client\'s requirements, constraints, and preferences ' +
      'across key decision factors. Each factor favours either ROKS or VSI.'
    ),
  ];

  // Score summary
  const summaryRows = [
    ['VSI factors (Yes)', `${score.vsiCount} of ${vsiFactorCount}`],
    ['ROKS factors (Yes)', `${score.roksCount} of ${roksFactorCount}`],
    ['Total answered', `${score.answeredCount} of ${totalFactors}`],
    ['Leaning', LEANING_LABELS[score.leaning] ?? score.leaning],
    ['ROKS Variant', VARIANT_LABELS[score.roksVariant] ?? 'Full'],
  ];
  elements.push(
    ...createTableDescription('Platform Selection Score Summary', 'Aggregated platform selection questionnaire results.'),
    createStyledTable(['Metric', 'Value'], summaryRows),
    createTableLabel('Platform Selection Score Summary'),
  );

  // Per-factor detail
  const costFavoursLabel = (() => {
    if (roksMonthlyCost != null && vsiMonthlyCost != null) {
      if (vsiMonthlyCost < roksMonthlyCost) return 'VSI (cheaper)';
      if (roksMonthlyCost < vsiMonthlyCost) return 'ROKS (cheaper)';
      return 'Equal cost';
    }
    return 'Dynamic (cost data unavailable)';
  })();

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
  elements.push(
    ...createTableDescription('Platform Selection Factor Responses', 'Individual factor responses from the platform selection questionnaire.'),
    createStyledTable(['Factor', 'Favours', 'Answer'], factorRows),
    createTableLabel('Platform Selection Factor Responses'),
  );

  // Callout for unanswered / "Not Sure"
  const notSureCount = factorsData.factors.filter(f => !answers[f.id] || answers[f.id] === 'not-sure').length;
  if (notSureCount > 0) {
    elements.push(
      createParagraph(
        `${notSureCount} question${notSureCount > 1 ? 's' : ''} answered with 'Not Sure' or left unanswered ` +
        'should be resolved with your IBM representative to ensure correct target platform selection.'
      ),
    );
  }

  if (score.roksVariant === 'rov') {
    elements.push(
      createParagraph(
        'Based on questionnaire responses, no containerisation requirements were identified. ROV (Red Hat OpenShift Virtualization) ' +
        'is recommended over full ROKS, providing the same bare metal infrastructure and MTV migration tooling at a reduced OCP licence cost.'
      ),
    );
  }

  return elements;
}

function buildRecommendationSummary(
  platformSelection: PlatformSelectionExport | null,
  targetAssignments: TargetAssignmentExport[] | null,
  s: number,
): DocumentContent[] {
  const elements: DocumentContent[] = [
    createHeading(`${s}.2 Recommendation Summary`, HeadingLevel.HEADING_2),
  ];

  const leaning = platformSelection?.score?.leaning;
  const assignments = targetAssignments || [];

  // Count by target
  const roksCount = assignments.filter(a => a.target === 'roks').length;
  const vsiCount = assignments.filter(a => a.target === 'vsi').length;
  const powervsCount = assignments.filter(a => a.target === 'powervs').length;
  const total = assignments.length;

  if (leaning === 'roks') {
    const variant = platformSelection?.score?.roksVariant === 'rov' ? 'ROV (Red Hat OpenShift Virtualization)' : 'ROKS (Red Hat OpenShift on IBM Cloud)';
    elements.push(
      createParagraph(
        `Based on the platform selection assessment and workload analysis, the recommended target platform is ${variant}. ` +
        'This recommendation reflects the organisation\'s modernisation goals, workload characteristics, and operational preferences as captured in the questionnaire responses.'
      ),
    );
  } else if (leaning === 'vsi') {
    elements.push(
      createParagraph(
        'Based on the platform selection assessment and workload analysis, the recommended target platform is VPC Virtual Servers (VSI). ' +
        'This recommendation reflects the organisation\'s preference for minimal operational change, traditional VM management, and a lift-and-shift migration approach.'
      ),
    );
  } else if (total > 0) {
    elements.push(
      createParagraph(
        'Based on the platform selection assessment, a split approach is recommended for this environment. ' +
        'The workload mix does not strongly favour a single platform, and different VM groups are best served by different IBM Cloud targets.'
      ),
    );
  } else {
    elements.push(
      createParagraph(
        'Platform selection scores are indicative and should be considered alongside workload-specific requirements, ' +
        'organizational constraints, and the detailed migration assessment findings in this report.'
      ),
    );
  }

  // Assignment breakdown
  if (total > 0) {
    const breakdownRows: string[][] = [];
    if (roksCount > 0) breakdownRows.push(['ROKS', `${roksCount}`, `${Math.round((roksCount / total) * 100)}%`]);
    if (vsiCount > 0) breakdownRows.push(['VSI', `${vsiCount}`, `${Math.round((vsiCount / total) * 100)}%`]);
    if (powervsCount > 0) breakdownRows.push(['PowerVS', `${powervsCount}`, `${Math.round((powervsCount / total) * 100)}%`]);

    elements.push(
      ...createTableDescription('Target Platform Distribution', 'Distribution of VMs across recommended target platforms.'),
      createStyledTable(
        ['Target Platform', 'VM Count', '% of Total'],
        breakdownRows,
        { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT, AlignmentType.RIGHT] }
      ),
      createTableLabel('Target Platform Distribution'),
    );
  }

  return elements;
}

function buildTargetAssignmentsSection(
  assignments: TargetAssignmentExport[],
  platformSelection: PlatformSelectionExport | null,
  s: number,
): DocumentContent[] {
  const elements: DocumentContent[] = [
    createHeading(`${s}.3 Target Assignments`, HeadingLevel.HEADING_2),
  ];

  const leaning = platformSelection?.score?.leaning;
  const recommendedTarget = leaning === 'vsi' ? 'vsi' : leaning === 'roks' ? 'roks' : null;

  if (recommendedTarget) {
    // Show only VMs that differ from the recommended platform
    const exceptions = assignments.filter(a => a.target !== recommendedTarget);

    if (exceptions.length === 0) {
      elements.push(
        createParagraph(
          'All VMs are assigned to the recommended platform. No exceptions or overrides are required.'
        ),
      );
      return elements;
    }

    elements.push(
      createParagraph(
        `The following ${exceptions.length} VM${exceptions.length > 1 ? 's are' : ' is'} assigned to a platform other than the recommended ` +
        `${recommendedTarget === 'roks' ? 'ROKS' : 'VSI'} target. These assignments reflect workload-specific requirements ` +
        'such as OS compatibility, resource thresholds, or user overrides.'
      ),
    );

    const exceptionRows = exceptions.map(a => [
      a.vmName,
      a.workloadType,
      TARGET_LABELS[a.target] ?? a.target,
      a.reason,
      a.isUserOverride ? 'User' : 'Auto',
    ]);
    elements.push(
      ...createTableDescription('Target Assignment Exceptions', 'VMs assigned to a platform other than the primary recommendation, with the reason for each exception.'),
      createStyledTable(
        ['VM Name', 'Workload Type', 'Target', 'Reason', 'Source'],
        exceptionRows,
        { columnAligns: [AlignmentType.LEFT, AlignmentType.LEFT, AlignmentType.LEFT, AlignmentType.LEFT, AlignmentType.CENTER] }
      ),
      createTableLabel('Target Assignment Exceptions'),
    );
  } else {
    // Neutral/split — show full assignment table (limit to 50 for document size)
    elements.push(
      createParagraph(
        'With no single dominant platform recommendation, the following table shows the per-VM target assignment. ' +
        'Each VM is assigned based on OS compatibility, workload characteristics, and resource requirements.'
      ),
    );

    const displayAssignments = assignments.slice(0, 50);
    const assignmentRows = displayAssignments.map(a => [
      a.vmName,
      a.workloadType,
      TARGET_LABELS[a.target] ?? a.target,
      a.reason,
      a.isUserOverride ? 'User' : 'Auto',
    ]);

    elements.push(
      ...createTableDescription('VM Target Assignments', 'Per-VM target platform assignments with classification reason and source.'),
      createStyledTable(
        ['VM Name', 'Workload Type', 'Target', 'Reason', 'Source'],
        assignmentRows,
        { columnAligns: [AlignmentType.LEFT, AlignmentType.LEFT, AlignmentType.LEFT, AlignmentType.LEFT, AlignmentType.CENTER] }
      ),
      createTableLabel('VM Target Assignments'),
    );

    if (assignments.length > 50) {
      elements.push(
        createParagraph(
          `Showing ${displayAssignments.length} of ${assignments.length} VMs. The complete assignment list is available in the application.`
        ),
      );
    }
  }

  elements.push(
    createParagraph(
      'Platform selection scores are indicative and should be considered alongside workload-specific requirements, ' +
      'organizational constraints, and the detailed migration assessment findings in this report. ' +
      'The migration partner will validate platform selection against detailed workload analysis.'
    ),
  );

  return elements;
}
