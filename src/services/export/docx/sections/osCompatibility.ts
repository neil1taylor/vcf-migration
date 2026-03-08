// OS Compatibility Matrix Section

import { Paragraph, PageBreak, HeadingLevel, AlignmentType } from 'docx';
import type { DocumentContent } from '../types';
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
}

function groupByOSFamily<T>(
  vms: Array<{ guestOS: string }>,
  getCompat: (os: string) => T,
  getKey: (c: T) => string,
  getStatus: (c: T) => string,
  getNotes: (c: T) => string,
): OSGroup[] {
  const groups = new Map<string, OSGroup>();

  for (const vm of vms) {
    const compat = getCompat(vm.guestOS);
    const key = getKey(compat);
    const existing = groups.get(key);
    if (existing) {
      existing.vmCount++;
    } else {
      groups.set(key, {
        displayName: key,
        vmCount: 1,
        status: getStatus(compat),
        notes: getNotes(compat),
      });
    }
  }

  return [...groups.values()].sort((a, b) => b.vmCount - a.vmCount);
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
        { columnAligns: [undefined, AlignmentType.RIGHT, undefined, undefined] }
      ),
      createTableLabel('VSI OS Compatibility'),
    );
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
        { columnAligns: [undefined, AlignmentType.RIGHT, undefined, undefined] }
      ),
      createTableLabel('ROKS OS Compatibility'),
    );
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
