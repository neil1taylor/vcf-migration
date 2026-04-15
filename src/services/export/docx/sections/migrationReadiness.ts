// Migration Readiness Section

import { Paragraph, Table, TableRow, PageBreak, HeadingLevel, BorderStyle } from 'docx';
import type { MigrationInsights } from '@/services/ai/types';
import reportTemplates from '@/data/reportTemplates.json';
import { CHECK_DEFINITIONS, type CheckDefinition, type VMCheckResults } from '@/services/preflightChecks';
import { STYLES, type DocumentContent } from '../types';
import { createHeading, createParagraph, createBulletList, createTableCell, createTableDescription, createTableLabel, createAISection } from '../utils/helpers';
import { getIssueLabels } from '../utils/preflightHelpers';

// Type assertion for templates with table/figure descriptions
const templates = reportTemplates as typeof reportTemplates & {
  tableDescriptions: Record<string, { title: string; description: string }>;
  figureDescriptions: Record<string, { title: string; description: string }>;
};

interface ModeFlags {
  includeROKS?: boolean;
  includeVSI?: boolean;
}

function formatCheckBullet(check: CheckDefinition): string {
  const severity = check.severity === 'blocker' ? 'blocker' : check.severity;
  return `${check.name}: ${check.description} (${severity})`;
}

function buildCheckList(modeFlags: ModeFlags): DocumentContent[] {
  const includeROKS = modeFlags.includeROKS ?? true;
  const includeVSI = modeFlags.includeVSI ?? true;
  const bothModes = includeROKS && includeVSI;

  const roksChecks = CHECK_DEFINITIONS.filter(c => c.modes.includes('roks'));
  const vsiChecks = CHECK_DEFINITIONS.filter(c => c.modes.includes('vsi'));

  if (bothModes) {
    // Group into common, ROKS-specific, VSI-specific
    const commonChecks = CHECK_DEFINITIONS.filter(
      c => c.modes.includes('roks') && c.modes.includes('vsi')
    );
    const roksOnly = roksChecks.filter(c => !c.modes.includes('vsi'));
    const vsiOnly = vsiChecks.filter(c => !c.modes.includes('roks'));

    const items: DocumentContent[] = [];

    items.push(createHeading('Common Checks', HeadingLevel.HEADING_3));
    items.push(...createBulletList(commonChecks.map(formatCheckBullet)));

    items.push(createHeading('ROKS-Specific Checks (OpenShift Virtualization)', HeadingLevel.HEADING_3));
    items.push(...createBulletList(roksOnly.map(formatCheckBullet)));

    items.push(createHeading('VSI-Specific Checks (IBM Cloud VPC)', HeadingLevel.HEADING_3));
    items.push(...createBulletList(vsiOnly.map(formatCheckBullet)));

    return items;
  }

  // Single mode — flat list
  const checks = includeROKS ? roksChecks : vsiChecks;
  return createBulletList(checks.map(formatCheckBullet));
}

export function buildMigrationReadiness(checkResults: VMCheckResults[], maxIssueVMs: number, aiInsights?: MigrationInsights | null, modeFlags?: ModeFlags, sectionNum?: number): DocumentContent[] {
  const readinessTemplates = reportTemplates.migrationReadiness;
  const blockerVMs = checkResults.filter((r) => r.blockerCount > 0).slice(0, maxIssueVMs);
  const warningVMs = checkResults.filter((r) => r.warningCount > 0 && r.blockerCount === 0).slice(0, maxIssueVMs);
  const allBlockerCount = checkResults.filter((r) => r.blockerCount > 0).length;
  const allWarningCount = checkResults.filter((r) => r.warningCount > 0 && r.blockerCount === 0).length;
  const s = sectionNum != null ? sectionNum : 3;

  // Local sub-counter for sequential numbering (conditional sections don't create gaps)
  let sub = 0;
  const nextSub = () => ++sub;

  const checksNum = nextSub(); // 1
  const sections: DocumentContent[] = [
    createHeading(`${s}. ` + readinessTemplates.title, HeadingLevel.HEADING_1),
    createParagraph(readinessTemplates.introduction),
    createParagraph(
      'This readiness assessment is based on RVTools metadata. The migration partner will conduct detailed discovery including application dependency mapping, performance baselining, and stakeholder interviews to produce a comprehensive readiness assessment.'
    ),
    createHeading(`${s}.${checksNum} ` + readinessTemplates.checksPerformed.title, HeadingLevel.HEADING_2),
    ...buildCheckList(modeFlags ?? {}),
  ];

  // Blockers table - description above, label below
  if (blockerVMs.length > 0) {
    const blockersNum = nextSub();
    sections.push(
      new Paragraph({ spacing: { before: 240 } }),
      createHeading(`${s}.${blockersNum} ` + readinessTemplates.blockersSummary.title, HeadingLevel.HEADING_2),
      createParagraph(readinessTemplates.blockersSummary.description),
      // Description above table
      ...createTableDescription(
        templates.tableDescriptions.blockerVMs.title,
        templates.tableDescriptions.blockerVMs.description
      ),
      new Table({
        width: { size: 100, type: 'pct' as const },
        columnWidths: [3000, 2000, 4000],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          left: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          right: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
        },
        rows: [
          new TableRow({
          cantSplit: true,
            children: [
              createTableCell('VM Name', { header: true }),
              createTableCell('Cluster', { header: true }),
              createTableCell('Issues', { header: true }),
            ],
          }),
          ...blockerVMs.map(
            (vm) =>
              new TableRow({
          cantSplit: true,
                children: [
                  createTableCell(vm.vmName.length > 30 ? vm.vmName.substring(0, 27) + '...' : vm.vmName),
                  createTableCell(vm.cluster),
                  createTableCell(getIssueLabels(vm).join(', ')),
                ],
              })
          ),
        ],
      }),
      // Label below table
      createTableLabel(templates.tableDescriptions.blockerVMs.title)
    );
    if (allBlockerCount > maxIssueVMs) {
      sections.push(
        createParagraph(
          `Note: Showing ${maxIssueVMs} of ${allBlockerCount} VMs with blockers. See Appendix A for the complete list.`,
          { spacing: { before: 120 } }
        )
      );
    }
  }

  // Warnings table - description above, label below
  if (warningVMs.length > 0) {
    const warningsNum = nextSub();
    sections.push(
      new Paragraph({ spacing: { before: 240 } }),
      createHeading(`${s}.${warningsNum} ` + readinessTemplates.warningsSummary.title, HeadingLevel.HEADING_2),
      createParagraph(readinessTemplates.warningsSummary.description),
      // Description above table
      ...createTableDescription(
        templates.tableDescriptions.warningVMs.title,
        templates.tableDescriptions.warningVMs.description
      ),
      new Table({
        width: { size: 100, type: 'pct' as const },
        columnWidths: [3000, 2000, 4000],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          left: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          right: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
        },
        rows: [
          new TableRow({
          cantSplit: true,
            children: [
              createTableCell('VM Name', { header: true }),
              createTableCell('Cluster', { header: true }),
              createTableCell('Warnings', { header: true }),
            ],
          }),
          ...warningVMs.map(
            (vm) =>
              new TableRow({
          cantSplit: true,
                children: [
                  createTableCell(vm.vmName.length > 30 ? vm.vmName.substring(0, 27) + '...' : vm.vmName),
                  createTableCell(vm.cluster),
                  createTableCell(getIssueLabels(vm).join(', ')),
                ],
              })
          ),
        ],
      }),
      // Label below table
      createTableLabel(templates.tableDescriptions.warningVMs.title)
    );
    if (allWarningCount > maxIssueVMs) {
      sections.push(
        createParagraph(
          `Note: Showing ${maxIssueVMs} of ${allWarningCount} VMs with warnings. See Appendix B for the complete list.`,
          { spacing: { before: 120 } }
        )
      );
    }
  }

  // Key Migration Risks section
  const risksNum = nextSub();
  sections.push(
    new Paragraph({ spacing: { before: 240 } }),
    createHeading(`${s}.${risksNum} Key Migration Risks`, HeadingLevel.HEADING_2),
    createParagraph(
      'The following risks have been identified based on the environment analysis. These should be addressed during migration planning.',
      { spacing: { after: 200 } }
    )
  );

  const riskItems: string[] = [];

  // Count VMs with specific check failures by check ID
  const countByCheck = (checkId: string) =>
    checkResults.filter(r => r.checks[checkId]?.status === 'fail').length;

  const unsupportedOSCount = countByCheck('vsi-os') + countByCheck('os-compatible');
  if (unsupportedOSCount > 0) {
    riskItems.push(`Unsupported Operating Systems: ${unsupportedOSCount} VMs have operating systems that may not be supported on the target platform. Review and plan for OS upgrades or alternative migration approaches.`);
  }

  const snapshotCount = countByCheck('old-snapshots');
  if (snapshotCount > 0) {
    riskItems.push(`Snapshot Sprawl: ${snapshotCount} VMs have snapshots older than 30 days. Consolidate or remove snapshots before migration to reduce migration time and storage requirements.`);
  }

  const rdmCount = countByCheck('rdm-disks');
  if (rdmCount > 0) {
    riskItems.push(`Raw Device Mappings (RDM): ${rdmCount} VMs use RDM disks which require special handling. Plan for storage reconfiguration or alternative storage solutions.`);
  }

  const noToolsCount = countByCheck('tools-installed');
  if (noToolsCount > 0) {
    riskItems.push(`Missing VMware Tools: ${noToolsCount} VMs do not have VMware Tools installed. Install tools or plan for post-migration agent deployment.`);
  }

  riskItems.push('Skills Gap (ROKS): If selecting ROKS with OpenShift Virtualization, ensure the operations team has Kubernetes expertise or plan for training and enablement.');
  riskItems.push('Cost Variance: Actual costs may differ significantly from estimates based on negotiated enterprise agreements, reserved capacity commitments, and actual usage patterns.');
  riskItems.push('Application Dependencies: Without application dependency mapping, there is risk of service disruption if dependent VMs are migrated in separate waves.');

  sections.push(...createBulletList(riskItems));

  // Common migration risks (static, from industry experience)
  sections.push(
    new Paragraph({ spacing: { before: 240 } }),
    createHeading(`${s}.${risksNum}.1 Common Migration Risks`, HeadingLevel.HEADING_3),
    createParagraph(
      'In addition to the environment-specific risks above, the following risks are commonly encountered in VMware migration projects and should be considered during planning.'
    ),
    ...createBulletList([
      'VMware lock-in — processes relying on VMware-specific tooling (vMotion, SRM workflows, proprietary appliances, third-party integrations) may require alternative approaches on the target platform.',
      'Hypervisor-dependent tooling — tools that rely on the VMware hypervisor layer will not function on IBM Cloud VPC VSI or ROKS. This includes disaster recovery tools (Zerto, VMware SRM), continuous data protection (Veeam CDP with VMware agents), operational management (VMware Aria Operations, Aria Automation), and any solution that depends on vSphere APIs, VADP, or CBT for ongoing operations. Replacement solutions must be identified and deployed as part of the migration — see Section 4 for recommended alternatives.',
      'Large monolithic workloads — VMs tightly coupled to specific storage or network topology may require additional design work.',
      'Multi-TB VMDKs — very large disk images increase replication time and extend maintenance windows; warm migration is strongly recommended.',
      'Data residency — regulatory requirements may restrict geographic transfer if no IBM Cloud VPC region exists in the required country.',
      'No application owner — VMs without an identified business owner cannot be validated post-migration, creating risk of undetected functional issues.',
      'Skill gaps — client teams unfamiliar with VPC or OpenShift may need upskilling before they can operate the target environment independently.',
    ])
  );

  // Add AI risk assessment if available
  if (aiInsights?.riskAssessment) {
    sections.push(
      ...createAISection(
        `${s}.${nextSub()} AI Risk Assessment`,
        aiInsights.riskAssessment,
        HeadingLevel.HEADING_2
      )
    );
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));

  return sections;
}
