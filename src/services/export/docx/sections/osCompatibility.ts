// OS Compatibility Matrix Section

import { Paragraph, PageBreak, HeadingLevel, AlignmentType, ExternalHyperlink, TextRun } from 'docx';
import type { DocumentContent } from '../types';
import { STYLES, FONT_FAMILY } from '../types';
import type { RVToolsData } from '@/types/rvtools';
import {
  getVSIOSCompatibility,
  getROKSOSCompatibility,
} from '@/services/migration/osCompatibility';
import type { VSIOSCompatibility, ROKSOSCompatibility } from '@/services/migration/osCompatibility';
import {
  createHeading,
  createParagraph,
  createStyledTable,
  createBulletList,
  createTableDescription,
  createTableLabel,
} from '../utils/helpers';

interface OSGroup {
  displayName: string;
  vmCount: number;
  status: string;
  notes: string;
  documentationLink?: string;
  additionalLinks?: Record<string, string>;
  eolDate?: string;
  recommendedUpgrade?: string;
}

function groupByOSFamily<T>(
  vms: Array<{ guestOS: string }>,
  getCompat: (os: string) => T,
  getKey: (c: T) => string,
  getStatus: (c: T) => string,
  getNotes: (c: T) => string,
  getExtra?: (c: T) => Partial<Pick<OSGroup, 'documentationLink' | 'additionalLinks' | 'eolDate' | 'recommendedUpgrade'>>,
): OSGroup[] {
  const groups = new Map<string, OSGroup>();

  for (const vm of vms) {
    const compat = getCompat(vm.guestOS);
    const key = getKey(compat);
    const existing = groups.get(key);
    if (existing) {
      existing.vmCount++;
    } else {
      const extra = getExtra?.(compat) ?? {};
      groups.set(key, {
        displayName: key,
        vmCount: 1,
        status: getStatus(compat),
        notes: getNotes(compat),
        ...extra,
      });
    }
  }

  return [...groups.values()].sort((a, b) => b.vmCount - a.vmCount);
}

function buildRemediationSubsection(
  groups: OSGroup[],
  platformLabel: string,
): DocumentContent[] {
  const needsRemediation = groups.filter(g => g.status === 'Unsupported' || g.status === 'BYOL');
  if (needsRemediation.length === 0) return [];

  const items: DocumentContent[] = [
    createHeading('Remediation Required', HeadingLevel.HEADING_3),
    createParagraph(
      `The following operating systems require remediation before migration to ${platformLabel}. OS upgrades, re-platforming, and licence compliance activities are the client's responsibility to complete prior to migration. The Migration Partner will provide guidance and validate completion.`
    ),
  ];

  for (const group of needsRemediation) {
    items.push(
      createHeading(`${group.displayName} (${group.vmCount} VM${group.vmCount !== 1 ? 's' : ''})`, HeadingLevel.HEADING_4),
      createParagraph(group.notes),
    );
    if (group.eolDate) {
      items.push(createParagraph(`End of Life: ${group.eolDate}`));
    }
    if (group.recommendedUpgrade) {
      items.push(createParagraph(`Upgrade Path: ${group.recommendedUpgrade}`));
    }
    const links: { label: string; url: string }[] = [];
    if (group.documentationLink) {
      links.push({ label: 'Platform Documentation', url: group.documentationLink });
    }
    if (group.additionalLinks) {
      const linkLabels: Record<string, string> = {
        virtioDriverEOL: 'VirtIO Driver Status',
        microsoftLifecycle: 'Microsoft Lifecycle',
        ibmCloudEOSConsiderations: 'IBM Cloud EOS Considerations',
        vmCompatibilityChecker: 'Red Hat VM Compatibility Checker',
        vendorLifecycle: 'Vendor Lifecycle',
      };
      for (const [key, url] of Object.entries(group.additionalLinks)) {
        links.push({ label: linkLabels[key] || key, url });
      }
    }
    if (links.length > 0) {
      for (const link of links) {
        items.push(
          new Paragraph({
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({ text: `${link.label}: `, size: STYLES.smallSize, color: STYLES.secondaryColor, font: FONT_FAMILY }),
              new ExternalHyperlink({
                link: link.url,
                children: [
                  new TextRun({ text: link.url, style: 'Hyperlink', size: STYLES.smallSize, color: STYLES.primaryColor, underline: {}, font: FONT_FAMILY }),
                ],
              }),
            ],
          })
        );
      }
    }
  }
  return items;
}

export function buildOSCompatibilitySection(
  rawData: RVToolsData,
  options: { includeROKS: boolean; includeVSI: boolean },
  sectionNum?: number
): DocumentContent[] {
  const title = sectionNum ? `${sectionNum}. OS Compatibility Matrix` : 'OS Compatibility Matrix';
  const sections: DocumentContent[] = [
    createHeading(title, HeadingLevel.HEADING_1),
    createParagraph(
      'This section evaluates the guest operating systems in the environment against IBM Cloud target platform compatibility. Each OS is checked against known supported images and compatibility matrices.'
    ),
  ];

  const poweredOnVMs = rawData.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template);

  if (poweredOnVMs.length === 0) {
    sections.push(createParagraph('No powered-on, non-template VMs found for OS compatibility analysis.'));
    sections.push(new Paragraph({ children: [new PageBreak()] }));
    return sections;
  }

  // VSI compatibility table
  if (options.includeVSI) {
    const vsiGroups = groupByOSFamily<VSIOSCompatibility>(
      poweredOnVMs,
      os => getVSIOSCompatibility(os),
      c => c.displayName,
      c => c.status === 'supported' ? 'Supported' : c.status === 'byol' ? 'BYOL' : 'Unsupported',
      c => c.notes,
      c => ({ documentationLink: c.documentationLink, additionalLinks: c.additionalLinks, eolDate: c.eolDate }),
    );

    const statusLabel: Record<string, string> = {
      'Supported': 'Stock image available',
      'BYOL': 'Custom image required (Bring Your Own License)',
      'Unsupported': 'No compatible IBM Cloud image',
    };

    const vsiRows = vsiGroups.map(g => [
      g.displayName,
      `${g.vmCount}`,
      g.status,
      statusLabel[g.status] || g.notes,
    ]);

    sections.push(
      createHeading('VPC VSI Compatibility', HeadingLevel.HEADING_2),
      ...createTableDescription('VSI OS Compatibility', 'Operating system compatibility with IBM Cloud VPC Virtual Server Instances.'),
      createStyledTable(
        ['OS Family', 'VM Count', 'Status', 'Notes'],
        vsiRows,
        { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT, AlignmentType.LEFT, AlignmentType.LEFT] }
      ),
      createTableLabel('VSI OS Compatibility'),
    );
    sections.push(...buildRemediationSubsection(vsiGroups, 'IBM Cloud VPC VSI'));
  }

  // ROKS compatibility table
  if (options.includeROKS) {
    const roksGroups = groupByOSFamily<ROKSOSCompatibility>(
      poweredOnVMs,
      os => getROKSOSCompatibility(os),
      c => c.displayName,
      c => c.compatibilityStatus === 'fully-supported' ? 'Fully Supported'
        : c.compatibilityStatus === 'supported-with-caveats' ? 'Supported (Caveats)'
        : 'Unsupported',
      c => c.notes,
      c => ({ documentationLink: c.documentationLink, additionalLinks: c.additionalLinks, eolDate: c.eolDate, recommendedUpgrade: c.recommendedUpgrade }),
    );

    const roksRows = roksGroups.map(g => [
      g.displayName,
      `${g.vmCount}`,
      g.status,
      g.notes.length > 60 ? g.notes.substring(0, 57) + '...' : g.notes,
    ]);

    sections.push(
      createHeading('ROKS / OpenShift Virtualization Compatibility', HeadingLevel.HEADING_2),
      ...createTableDescription('ROKS OS Compatibility', 'Operating system compatibility with Red Hat OpenShift Virtualization on IBM Cloud.'),
      createStyledTable(
        ['OS Family', 'VM Count', 'Status', 'Notes'],
        roksRows,
        { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT, AlignmentType.LEFT, AlignmentType.LEFT] }
      ),
      createTableLabel('ROKS OS Compatibility'),
    );
    sections.push(...buildRemediationSubsection(roksGroups, 'ROKS / OpenShift Virtualization'));
  }

  // Recommendations
  const recommendations: string[] = [];

  // Count unsupported across both platforms
  const vsiUnsupported = new Set(
    poweredOnVMs
      .filter(vm => getVSIOSCompatibility(vm.guestOS).status === 'unsupported')
      .map(vm => getVSIOSCompatibility(vm.guestOS).displayName)
  );
  const roksUnsupported = new Set(
    poweredOnVMs
      .filter(vm => getROKSOSCompatibility(vm.guestOS).compatibilityStatus === 'unsupported')
      .map(vm => getROKSOSCompatibility(vm.guestOS).displayName)
  );

  if (options.includeVSI && vsiUnsupported.size > 0) {
    recommendations.push(`${vsiUnsupported.size} OS famil${vsiUnsupported.size > 1 ? 'ies are' : 'y is'} unsupported for VPC VSI. Consider OS upgrades or alternative migration paths.`);
  }
  if (options.includeROKS && roksUnsupported.size > 0) {
    recommendations.push(`${roksUnsupported.size} OS famil${roksUnsupported.size > 1 ? 'ies are' : 'y is'} unsupported for ROKS. These VMs may need to target VSI or PowerVS instead.`);
  }

  const byolCount = poweredOnVMs.filter(vm => getVSIOSCompatibility(vm.guestOS).status === 'byol').length;
  if (options.includeVSI && byolCount > 0) {
    recommendations.push(`${byolCount} VM${byolCount > 1 ? 's require' : ' requires'} BYOL custom images. Ensure licence agreements cover IBM Cloud deployment.`);
  }

  if (recommendations.length === 0) {
    recommendations.push('All operating systems in the environment are compatible with the selected target platforms.');
  }

  sections.push(
    createHeading('Recommendations', HeadingLevel.HEADING_2),
    ...createBulletList(recommendations),
    new Paragraph({ children: [new PageBreak()] }),
  );

  return sections;
}
