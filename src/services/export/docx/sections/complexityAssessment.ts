// Complexity Assessment Section

import { Paragraph, PageBreak, HeadingLevel, AlignmentType } from 'docx';
import type { DocumentContent } from '../types';
import type { RVToolsData } from '@/types/rvtools';
import {
  calculateComplexityScores,
  getComplexityDistribution,
  getAssessmentSummary,
} from '@/services/migration/migrationAssessment';
import type { ComplexityScore } from '@/services/migration/migrationAssessment';
import {
  createHeading,
  createParagraph,
  createStyledTable,
  createBulletList,
  createTableDescription,
  createTableLabel,
} from '../utils/helpers';

export function buildComplexityAssessment(
  rawData: RVToolsData,
  sectionNum?: number
): DocumentContent[] {
  const title = sectionNum ? `${sectionNum}. Complexity Assessment` : 'Complexity Assessment';
  const sections: DocumentContent[] = [
    createHeading(title, HeadingLevel.HEADING_1),
    createParagraph(
      'Each virtual machine is scored for migration complexity on a 0–100 scale based on OS compatibility, disk layout, network interfaces, memory size, and CPU count. Scores map to four categories: Simple (0–25), Moderate (26–50), Complex (51–75), and Blocker (76–100).'
    ),
  ];

  const poweredOnVMs = rawData.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template);

  if (poweredOnVMs.length === 0) {
    sections.push(createParagraph('No powered-on, non-template VMs found for complexity analysis.'));
    sections.push(new Paragraph({ children: [new PageBreak()] }));
    return sections;
  }

  // Calculate scores using ROKS mode as conservative baseline
  const scores = calculateComplexityScores(poweredOnVMs, rawData.vDisk, rawData.vNetwork, 'roks');
  const distribution = getComplexityDistribution(scores);
  const summary = getAssessmentSummary(scores);

  // Distribution summary table
  const categories: Array<{ name: string; range: string }> = [
    { name: 'Simple', range: '0–25' },
    { name: 'Moderate', range: '26–50' },
    { name: 'Complex', range: '51–75' },
    { name: 'Blocker', range: '76–100' },
  ];

  const distRows = categories.map(cat => {
    const count = distribution[cat.name] || 0;
    const pct = summary.totalVMs > 0 ? ((count / summary.totalVMs) * 100).toFixed(1) : '0.0';
    return [cat.name, cat.range, `${count}`, `${pct}%`];
  });

  // Add average score row
  distRows.push(['Average Score', '', `${summary.averageScore}`, '']);

  sections.push(
    ...createTableDescription('Complexity Distribution', 'The following table summarises the distribution of VMs across complexity categories.'),
    createStyledTable(
      ['Category', 'Score Range', 'Count', '%'],
      distRows,
      { columnAligns: [undefined, undefined, AlignmentType.RIGHT, AlignmentType.RIGHT] }
    ),
    createTableLabel('Complexity Distribution'),
  );

  // Top complex VMs table (only if any Moderate+)
  const nonSimple = scores.filter(s => s.category !== 'Simple');
  if (nonSimple.length > 0) {
    const topVMs = [...scores]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const topRows = topVMs.map((vm: ComplexityScore) => [
      vm.vmName.length > 30 ? vm.vmName.substring(0, 27) + '...' : vm.vmName,
      vm.guestOS.length > 25 ? vm.guestOS.substring(0, 22) + '...' : vm.guestOS,
      `${vm.score}`,
      vm.category,
      vm.factors.length > 50 ? vm.factors.substring(0, 47) + '...' : vm.factors,
    ]);

    sections.push(
      ...createTableDescription('Top Complex VMs', 'The most complex VMs requiring additional planning or remediation before migration.'),
      createStyledTable(
        ['VM Name', 'OS', 'Score', 'Category', 'Factors'],
        topRows,
        { columnAligns: [undefined, undefined, AlignmentType.RIGHT, undefined, undefined] }
      ),
      createTableLabel('Top Complex VMs'),
    );
  }

  // Key observations
  const observations: string[] = [];
  const simplePercent = summary.totalVMs > 0 ? ((summary.simpleCount / summary.totalVMs) * 100).toFixed(0) : '0';
  observations.push(`${simplePercent}% of VMs (${summary.simpleCount} of ${summary.totalVMs}) are classified as Simple and can be migrated with minimal effort.`);

  if (summary.blockerCount > 0) {
    observations.push(`${summary.blockerCount} VM${summary.blockerCount > 1 ? 's have' : ' has'} blocker-level complexity and will require remediation before migration.`);
  }
  if (summary.complexCount > 0) {
    observations.push(`${summary.complexCount} VM${summary.complexCount > 1 ? 's are' : ' is'} classified as Complex and should be scheduled in later migration waves.`);
  }
  observations.push(`The average complexity score across all VMs is ${summary.averageScore} out of 100.`);

  sections.push(
    createHeading('Key Observations', HeadingLevel.HEADING_2),
    ...createBulletList(observations),
    new Paragraph({ children: [new PageBreak()] }),
  );

  return sections;
}
