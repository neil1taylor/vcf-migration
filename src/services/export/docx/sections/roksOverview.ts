// ROKS Overview Section

import { Paragraph, PageBreak, HeadingLevel, AlignmentType } from 'docx';
import type { RVToolsData } from '@/types/rvtools';
import reportTemplates from '@/data/reportTemplates.json';
import { type DocumentContent, type ROKSSizing, type WavePlanningPreference, type PlatformSelectionExport } from '../types';
import { createHeading, createParagraph, createBulletList, createStyledTable, createTableDescription, createTableLabel, createDocLink } from '../utils/helpers';
import { DOC_LINKS } from '../utils/docLinks';
import { computeWavesForMode, buildWaveTable, getStrategyLabel } from './migrationStrategy';

// Type assertion for templates with table/figure descriptions
const templates = reportTemplates as typeof reportTemplates & {
  tableDescriptions: Record<string, { title: string; description: string }>;
  figureDescriptions: Record<string, { title: string; description: string }>;
};

export function buildROKSOverview(
  sizing: ROKSSizing,
  rawData?: RVToolsData,
  wavePlanningPreference?: WavePlanningPreference | null,
  platformSelection?: PlatformSelectionExport | null,
  sectionNum?: number,
): DocumentContent[] {
  const roksTemplates = reportTemplates.roksOverview;
  const s = sectionNum != null ? sectionNum : 6;

  const sections: DocumentContent[] = [
    createHeading(`${s}. ` + roksTemplates.title, HeadingLevel.HEADING_1),
    createParagraph(roksTemplates.introduction),

    createHeading(`${s}.1 ` + roksTemplates.whatIsRoks.title, HeadingLevel.HEADING_2),
    createParagraph(roksTemplates.whatIsRoks.content),
    createDocLink(
      'For the OpenShift Virtualization reference architecture, see',
      'ROKS Reference Architecture',
      DOC_LINKS.roksArchitecture
    ),

    createHeading(`${s}.2 ` + roksTemplates.architecture.title, HeadingLevel.HEADING_2),
    createParagraph(roksTemplates.architecture.content),
    ...createBulletList(roksTemplates.architecture.components),
    createDocLink(
      'For detailed compute design guidance, see',
      'OpenShift Compute Design',
      DOC_LINKS.roksCompute
    ),
    createDocLink(
      'For detailed storage design guidance, see',
      'OpenShift Storage Design',
      DOC_LINKS.roksStorage
    ),
    createDocLink(
      'For detailed networking design guidance, see',
      'OpenShift Network Design',
      DOC_LINKS.roksNetworking
    ),

    createHeading(`${s}.3 ` + roksTemplates.benefits.title, HeadingLevel.HEADING_2),
    ...roksTemplates.benefits.items.flatMap((b) => [
      createParagraph(b.title, { bold: true }),
      createParagraph(b.description),
    ]),

    createHeading(`${s}.4 ` + roksTemplates.considerations.title, HeadingLevel.HEADING_2),
    ...createBulletList(roksTemplates.considerations.items),

    createHeading(`${s}.5 ` + roksTemplates.sizing.title, HeadingLevel.HEADING_2),
    createParagraph(roksTemplates.sizing.description),
    createParagraph(roksTemplates.sizing.methodology, { spacing: { after: 120 } }),

    createHeading(`${s}.5.1 ODF Storage Sizing`, HeadingLevel.HEADING_3),
    createParagraph(
      'OpenShift Data Foundation (ODF) uses Ceph for software-defined storage with 3-way replication for data protection. ' +
      'The sizing calculation reserves 25% of usable capacity for ODF operational overhead, resulting in 75% operational capacity.',
      { spacing: { after: 60 } }
    ),
    ...createBulletList([
      'Ceph rebalancing operations during node maintenance or failures',
      'Automatic data recovery and reconstruction after disk or node failures',
      'Storage system metadata and internal operations',
      'Headroom for workload growth without immediate capacity expansion',
    ]),

    createHeading(`${s}.5.2 ODF Edition Comparison`, HeadingLevel.HEADING_3),
    createParagraph(
      'Red Hat OpenShift Data Foundation is available in two editions: Essentials and Advanced. ' +
      'Essentials provides core block and file storage with Ceph 3-way replication. ' +
      'Advanced adds object storage, client-side encryption, external mode, and disaster recovery capabilities.',
      { spacing: { after: 120 } }
    ),
    createStyledTable(
      ['Feature', 'Essentials', 'Advanced'],
      [
        ['Block storage (RBD)', 'Yes', 'Yes'],
        ['File storage (CephFS)', 'Yes', 'Yes'],
        ['Ceph 3-way replication', 'Yes', 'Yes'],
        ['Snapshot & clone', 'Yes', 'Yes'],
        ['Thick / thin provisioning', 'Yes', 'Yes'],
        ['Multicloud Object Gateway (MCG)', '-', 'Yes'],
        ['Client-side encryption (per-PV)', '-', 'Yes'],
        ['External mode (dedicated storage cluster)', '-', 'Yes'],
        ['Regional DR (metro stretch / async)', '-', 'Yes'],
        ['ODF Disaster Recovery (RHACM integration)', '-', 'Yes'],
        ['Ceph RGW (S3-compatible object storage)', '-', 'Yes'],
      ],
      { columnAligns: [AlignmentType.LEFT, AlignmentType.CENTER, AlignmentType.CENTER] }
    ),
    createParagraph(
      'This report\'s cost estimation uses the ODF tier selected in the sizing calculator. ' +
      'ODF Advanced is recommended for environments requiring disaster recovery or object storage.',
      { spacing: { before: 120, after: 120 } }
    ),

    createHeading(`${s}.5.3 CPU Over-commitment`, HeadingLevel.HEADING_3),
    createParagraph(
      `OpenShift Virtualization supports CPU over-commitment. The sizing calculations in this report use a ${sizing.cpuOvercommit}:1 CPU over-commit ratio.`,
      { spacing: { after: 120 } }
    ),
    ...createBulletList([
      'Workload Characteristics: CPU-intensive applications may require lower over-commit ratios',
      'Performance Monitoring: Monitor CPU ready time and utilization metrics',
      'Node Capacity: OpenShift reserves ~15% CPU for system services',
    ]),

    createHeading(`${s}.5.4 Memory Over-commitment`, HeadingLevel.HEADING_3),
    createParagraph(
      'Memory over-commitment is supported but not enabled by default. This sizing uses 1:1 memory allocation for predictable VM performance.',
      { spacing: { after: 120 } }
    ),
    ...createBulletList([
      'Not Recommended by Default: This sizing uses 1:1 memory allocation',
      'Performance Impact: RAM is ~1000x faster than NVMe; heavy swap usage causes latency',
      'Workload Suitability: Only suitable for workloads tolerant of occasional degradation',
    ]),

    new Paragraph({ spacing: { before: 240 } }),
    createHeading(`${s}.5.5 Recommended Configuration`, HeadingLevel.HEADING_3),
    // ROKS sizing table - description above, label below
    ...createTableDescription(
      templates.tableDescriptions.roksSizing.title,
      templates.tableDescriptions.roksSizing.description
    ),
    createStyledTable(
      ['Configuration', 'Value'],
      sizing.solutionType === 'bm-disaggregated'
        ? [
            ['Architecture', 'Disaggregated Bare Metal (Compute + Storage Pools)'],
            ['Compute Profile', sizing.profileName],
            ['Compute Nodes', `${sizing.workerNodes}`],
            ['Total Compute Cores', `${sizing.totalCores}`],
            ['Total Compute Threads', `${sizing.totalThreads}`],
            ['Total Compute Memory', `${sizing.totalMemoryGiB} GiB`],
            ['Storage Profile', sizing.storageProfileName || 'N/A'],
            ['Storage Nodes (ODF)', `${sizing.storageNodes || 0}`],
            ['Total Raw NVMe (Storage Pool)', `${sizing.storageTotalNvmeTiB || sizing.totalNvmeTiB} TiB`],
            ['ODF Usable Storage', `${sizing.odfUsableTiB} TiB`],
          ]
        : sizing.solutionType === 'bm-nfs-csi'
        ? [
            ['Architecture', 'Bare Metal + NFS File Storage (CSI)'],
            ['Bare Metal Profile', sizing.profileName],
            ['Worker Nodes', `${sizing.workerNodes}`],
            ['Total Physical Cores', `${sizing.totalCores}`],
            ['Total Threads', `${sizing.totalThreads}`],
            ['Total Memory', `${sizing.totalMemoryGiB} GiB`],
            ['Storage', 'VPC File Storage (NFS) via dp2 CSI driver'],
          ]
        : sizing.solutionType === 'bm-block-csi'
        ? [
            ['Architecture', 'Bare Metal + Block Storage (CSI)'],
            ['Bare Metal Profile', sizing.profileName],
            ['Worker Nodes', `${sizing.workerNodes}`],
            ['Total Physical Cores', `${sizing.totalCores}`],
            ['Total Threads', `${sizing.totalThreads}`],
            ['Total Memory', `${sizing.totalMemoryGiB} GiB`],
            ['Storage', 'VPC Block Storage via CSI driver'],
          ]
        : [
            ['Bare Metal Profile', sizing.profileName],
            ['Worker Nodes', `${sizing.workerNodes}`],
            ['Total Physical Cores', `${sizing.totalCores}`],
            ['Total Threads', `${sizing.totalThreads}`],
            ['Total Memory', `${sizing.totalMemoryGiB} GiB`],
            ['Total Raw NVMe', `${sizing.totalNvmeTiB} TiB`],
            ['ODF Usable Storage', `${sizing.odfUsableTiB} TiB`],
          ],
      { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT] }
    ),
    createTableLabel(templates.tableDescriptions.roksSizing.title),
  ];

  // 6.6 Red Hat OpenShift Virtualization (ROV)
  sections.push(
    createHeading(`${s}.6 Red Hat OpenShift Virtualization (ROV)`, HeadingLevel.HEADING_2),
    createParagraph(
      'ROV is a cost-optimised variant of ROKS for environments without containerisation requirements. ' +
      'It uses the same bare metal infrastructure, the same ODF storage, and the same MTV migration tooling as full ROKS.',
      { spacing: { after: 120 } }
    ),
    ...createBulletList([
      'Reduced OpenShift licence cost using the OVE tier (OpenShift Virtualization Engine) instead of full OCP',
      'Same bare metal worker nodes, ODF storage, and networking as full ROKS',
      'Same migration tooling (MTV) and same operational model',
      'Recommended when the platform selection questionnaire identifies no containerisation needs',
      'Can be upgraded to full ROKS at any time if containerisation requirements emerge',
    ]),
  );
  if (platformSelection?.score?.roksVariant === 'rov') {
    sections.push(
      createParagraph(
        'Based on the platform selection assessment, the ROV variant is recommended for this environment as no containerisation requirements were identified.',
        { spacing: { before: 120, after: 120 } }
      ),
    );
  }

  // Deployment architecture options
  sections.push(
    createHeading(`${s}.7 Deployment Architecture Options`, HeadingLevel.HEADING_2),
    createParagraph(
      'ROKS supports multiple deployment architectures depending on storage and performance requirements:',
      { spacing: { after: 120 } }
    ),
    ...createBulletList([
      'NVMe Converged — Bare metal workers with local NVMe drives, ODF provides software-defined storage on-node. Highest performance, single node type.',
      'Hybrid (BM + VSI) — Bare metal compute workers with separate VSI storage nodes running ODF on VPC Block Storage. Separates compute and storage scaling.',
      'BM + Block Storage (CSI) — Bare metal workers with no local storage, VPC Block Storage volumes attached directly via CSI driver. No ODF overhead, simplest storage model.',
      'BM + Block Storage + ODF — Bare metal workers with no local storage, ODF backed by VPC Block Storage volumes. Provides ODF abstraction layer on diskless servers.',
      'Disaggregated Bare Metal — Diskless bare metal compute pool (all CPU/memory for VMs) with a separate NVMe bare metal pool dedicated to ODF storage. Independent profile selection and scaling for compute and storage.',
      'BM + NFS File Storage (CSI) — Bare metal workers with all storage via VPC File Storage (NFS) dp2 CSI driver. Boot and data volumes on NFS with selectable IOPS tiers (Standard 500 / Performance 1,000 / High Performance 3,000). No ODF overhead.',
    ]),
  );

  // ROKS Wave Summary (moved from strategy)
  let subNum = 8;
  if (rawData && wavePlanningPreference) {
    const roksWaves = computeWavesForMode(rawData, 'roks', wavePlanningPreference);
    const isComplexity = wavePlanningPreference.wavePlanningMode === 'complexity';
    sections.push(
      createHeading(`${s}.${subNum} ROKS Wave Summary`, HeadingLevel.HEADING_2),
      createParagraph(
        `${roksWaves.length} wave${roksWaves.length !== 1 ? 's' : ''} generated for ROKS (OpenShift Virtualization) migration using the ${getStrategyLabel(wavePlanningPreference)} strategy:`,
        { spacing: { after: 120 } }
      ),
      buildWaveTable(roksWaves, isComplexity),
    );
    subNum++;
  }

  // ROKS Migration Considerations (moved from strategy)
  sections.push(
    createHeading(`${s}.${subNum} ROKS Migration Considerations`, HeadingLevel.HEADING_2),
    createParagraph(
      'For ROKS with OpenShift Virtualization, subnet-based migration aligns with the Migration Toolkit for Virtualization (MTV) workflow:',
      { spacing: { after: 120 } }
    ),
    ...createBulletList([
      'MTV supports network mapping to translate VMware port groups to OpenShift network attachment definitions',
      'OVN-Kubernetes secondary networks can mirror the original VLAN structure for seamless connectivity',
      'VMs can retain their original IP addresses when migrated to appropriately configured secondary networks',
      'Migration plans in MTV naturally map to port group waves, enabling orchestrated cutover',
      'During coexistence, traffic between migrated VMs in OpenShift and non-migrated on-prem VMs will traverse the Direct Link or VPN, introducing latency for cross-environment communication',
    ]),
  );

  sections.push(new Paragraph({ children: [new PageBreak()] }));

  return sections;
}
