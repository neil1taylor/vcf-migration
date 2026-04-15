// Migration Scope & Remediation Plan Section

import { Paragraph, PageBreak, HeadingLevel, ExternalHyperlink, TextRun, AlignmentType } from 'docx';
import type { DocumentContent } from '../types';
import { STYLES, FONT_FAMILY } from '../types';
import { MIGRATION_PHASES } from '@/data/migrationPhases';
import { generateRemediationItems } from '@/services/migration';
import type { PreflightCheckCounts } from '@/services/migration/remediation';
import type { MigrationMode } from '@/services/migration/osCompatibility';
import {
  createHeading,
  createParagraph,
  createBulletList,
  createStyledTable,
  createTableDescription,
  createTableLabel,
} from '../utils/helpers';

const MAX_AFFECTED_VMS = 10;

export function buildRemediationPlanSection(
  counts: PreflightCheckCounts,
  mode: MigrationMode,
  sectionNum: number,
): DocumentContent[] {
  const s = sectionNum;
  let sub = 0;
  const nextSub = () => ++sub;

  const sections: DocumentContent[] = [
    createHeading(`${s}. Migration Scope & Remediation Plan`, HeadingLevel.HEADING_1),
    createParagraph(
      'This section outlines the Migration Partner\'s scope of work across three phases, followed by pre-migration remediation items that must be resolved by the client before migration can proceed.'
    ),
  ];

  // §X.1 Migration Partner Scope
  const scopeNum = nextSub();
  sections.push(
    createHeading(`${s}.${scopeNum} Migration Partner Scope`, HeadingLevel.HEADING_2),
    createParagraph(
      'The migration follows a structured three-phase approach. Each phase builds on the outputs of the previous stage to ensure a controlled, repeatable migration.'
    ),
  );

  for (const phase of MIGRATION_PHASES) {
    sections.push(
      createHeading(`Phase: ${phase.heading}`, HeadingLevel.HEADING_3),
      ...createBulletList(phase.bullets),
    );
  }

  // §X.2 Client Pre-Migration Remediation
  const remNum = nextSub();
  sections.push(
    createHeading(`${s}.${remNum} Client Pre-Migration Remediation`, HeadingLevel.HEADING_2),
    createParagraph(
      'The following items must be resolved by the client prior to Phase 3 (Migration). The Migration Partner will identify these items during Phase 1 (Discover) and provide guidance during Phase 2 (Design & Configure), but the client team is responsible for executing the remediation work (OS upgrades, snapshot cleanup, storage reconfiguration, etc.) on their source environment.'
    ),
  );

  // Use pre-computed pre-flight check results (shared path with UI and other exports)
  const includeAllChecks = mode === 'vsi';
  const items = generateRemediationItems(counts, mode, includeAllChecks);

  // Filter to blockers and warnings only
  const actionableItems = items.filter(
    item => !item.isUnverifiable && (item.severity === 'blocker' || item.severity === 'warning') && item.affectedCount > 0
  );

  if (actionableItems.length === 0) {
    sections.push(
      createParagraph(
        'No pre-migration remediation items were identified. All pre-flight checks passed for the selected migration target.'
      ),
    );
    sections.push(new Paragraph({ children: [new PageBreak()] }));
    return sections;
  }

  // §X.2.1 Remediation Summary Table
  sections.push(
    createHeading(`${s}.${remNum}.1 Remediation Summary`, HeadingLevel.HEADING_3),
    ...createTableDescription('Remediation Summary', 'Pre-migration remediation items requiring client action.'),
    createStyledTable(
      ['Check', 'Severity', 'Affected VMs', 'Remediation'],
      actionableItems.map(item => [
        item.name,
        item.severity === 'blocker' ? 'Blocker' : 'Warning',
        `${item.affectedCount}`,
        item.remediation.length > 100 ? item.remediation.substring(0, 97) + '...' : item.remediation,
      ]),
      { columnAligns: [AlignmentType.LEFT, AlignmentType.LEFT, AlignmentType.RIGHT, AlignmentType.LEFT] },
    ),
    createTableLabel('Remediation Summary'),
  );

  // §X.2.2 Detailed Remediation Actions
  sections.push(
    createHeading(`${s}.${remNum}.2 Detailed Remediation Actions`, HeadingLevel.HEADING_3),
  );

  for (const item of actionableItems) {
    const severityTag = item.severity === 'blocker' ? 'BLOCKER' : 'WARNING';
    sections.push(
      createHeading(
        `${item.name} — ${item.affectedCount} VM${item.affectedCount !== 1 ? 's' : ''} [${severityTag}]`,
        HeadingLevel.HEADING_4,
      ),
      createParagraph(item.description),
      createParagraph(`Remediation: ${item.remediation}`),
    );

    if (item.documentationLink) {
      sections.push(
        new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({
              text: 'Documentation: ',
              size: STYLES.smallSize,
              bold: true,
              color: STYLES.secondaryColor,
              font: FONT_FAMILY,
            }),
            new ExternalHyperlink({
              link: item.documentationLink,
              children: [
                new TextRun({
                  text: item.documentationLink,
                  style: 'Hyperlink',
                  size: STYLES.smallSize,
                  color: STYLES.primaryColor,
                  underline: {},
                  font: FONT_FAMILY,
                }),
              ],
            }),
          ],
        }),
      );
    }

    if (item.affectedVMs && item.affectedVMs.length > 0) {
      const displayVMs = item.affectedVMs.slice(0, MAX_AFFECTED_VMS);
      const vmBullets = [...displayVMs];
      if (item.affectedVMs.length > MAX_AFFECTED_VMS) {
        vmBullets.push(`...and ${item.affectedVMs.length - MAX_AFFECTED_VMS} more`);
      }
      sections.push(
        createParagraph('Affected VMs:'),
        ...createBulletList(vmBullets),
      );
    }
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  return sections;
}
