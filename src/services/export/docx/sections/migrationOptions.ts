// Migration Options Section

import { Paragraph, Table, TableRow, PageBreak, HeadingLevel, BorderStyle } from 'docx';
import reportTemplates from '@/data/reportTemplates.json';
import { STYLES, type DocumentContent } from '../types';
import { createHeading, createParagraph, createBulletList, createTableCell, createTableDescription, createTableLabel, createDocLink } from '../utils/helpers';
import { DOC_LINKS } from '../utils/docLinks';

// Type assertion for templates with table/figure descriptions
const templates = reportTemplates as typeof reportTemplates & {
  tableDescriptions: Record<string, { title: string; description: string }>;
  figureDescriptions: Record<string, { title: string; description: string }>;
};

export function buildMigrationOptions(): DocumentContent[] {
  const optTemplates = reportTemplates.migrationOptions;

  return [
    createHeading('4. ' + optTemplates.title, HeadingLevel.HEADING_1),
    createParagraph(optTemplates.introduction),
    createParagraph(optTemplates.comparisonIntro),

    // Migration comparison table - description above, label below
    ...createTableDescription(
      templates.tableDescriptions.migrationComparison.title,
      templates.tableDescriptions.migrationComparison.description
    ),
    new Table({
      width: { size: 100, type: 'pct' as const },
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
          children: [
            createTableCell('Characteristic', { header: true }),
            createTableCell('ROKS + OpenShift Virt', { header: true }),
            createTableCell('VPC Virtual Servers', { header: true }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('Migration Approach', { bold: true }),
            createTableCell('Lift-convert-shift (MTV)'),
            createTableCell('Lift-convert-shift (RackWare RMM)'),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('Infrastructure', { bold: true }),
            createTableCell('Bare Metal with local NVMe'),
            createTableCell('Multi-tenant virtual servers'),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('Storage', { bold: true }),
            createTableCell('ODF (Ceph) with 3x replication'),
            createTableCell('Block storage volumes'),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('Modernization Path', { bold: true }),
            createTableCell('Containerization ready'),
            createTableCell('Traditional VM operations'),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('Operational Model', { bold: true }),
            createTableCell('Kubernetes/GitOps'),
            createTableCell('Traditional VM management'),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('Best For', { bold: true }),
            createTableCell('Application modernization'),
            createTableCell('Quick migration with minimal change'),
          ],
        }),
      ],
    }),
    createTableLabel(templates.tableDescriptions.migrationComparison.title),

    // Migration Process section
    ...buildMigrationProcess(),

    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function buildMigrationProcess(): DocumentContent[] {
  return [
    createHeading('4.1 How the Migration Works', HeadingLevel.HEADING_2),
    createParagraph(
      'A common concern when planning a cloud migration is whether applications will need to be rewritten or significantly modified. This is not the case. Migrating VMware virtual machines to IBM Cloud is a well-established, repeatable process that has been successfully completed for thousands of enterprise environments worldwide. Your applications, operating systems, and data remain exactly as they are today — the migration simply moves them from one infrastructure platform to another.'
    ),
    createParagraph(
      'The process is best described as "lift, convert, and shift." Each virtual machine is lifted from the VMware environment, its disk format is converted from the VMware-specific format (VMDK) to a cloud-compatible format (QCOW2 or raw image), and the resulting image is transferred to IBM Cloud where it runs on the new infrastructure. No application code changes are required. No databases need to be restructured. No users need to be retrained. From the perspective of the applications and services running inside each virtual machine, the migration is transparent — they continue to operate exactly as before.',
      { spacing: { after: 200 } }
    ),
    createDocLink(
      'For an overview of IBM Cloud virtualization solutions, see',
      'IBM Cloud Virtualization Solutions',
      DOC_LINKS.overview
    ),

    createHeading('4.1.1 The Disk Conversion Step', HeadingLevel.HEADING_3),
    createParagraph(
      'Virtual machines on VMware store their data in a proprietary disk format called VMDK (Virtual Machine Disk). Cloud platforms, including IBM Cloud, use open industry-standard formats such as QCOW2 or raw disk images. As part of the migration, each VM\'s disk is converted from VMDK to the appropriate target format. This is a fully automated, mechanical process handled by well-proven tooling — it does not alter the contents of the disk in any way. The operating system, installed applications, configuration files, and data all remain identical. The conversion simply changes the container format, much like saving a document from one file format to another without changing its content.'
    ),
    createParagraph(
      'For ROKS migrations, the Migration Toolkit for Virtualization (MTV) performs this conversion automatically as part of its migration workflow — no manual intervention is required. For VPC Virtual Server migrations, established tools such as RackWare RMM handle the conversion and transfer as a single orchestrated operation. In both cases, the conversion step is invisible to the end user and fully managed by the migration tooling.',
      { spacing: { after: 200 } }
    ),

    createHeading('4.1.2 Migration Approaches: Warm and Cold', HeadingLevel.HEADING_3),
    createParagraph(
      'There are two approaches to transferring a virtual machine, commonly referred to as "warm" and "cold" migration. Both approaches require a maintenance window for the final cutover, but they differ in how long that window needs to be.'
    ),
    createParagraph(
      'Cold migration is the simpler approach: the virtual machine is shut down, its disks are copied in full to the target platform, and the VM is started on IBM Cloud. The maintenance window lasts for the duration of the full disk copy. This approach is straightforward, reliable, and well suited to smaller VMs or workloads that can tolerate a longer planned outage.',
      { spacing: { after: 120 } }
    ),
    createParagraph(
      'Warm migration significantly reduces the maintenance window. While the source VM continues to run, the migration tooling performs an initial copy of all disk data in the background — this can take hours or days depending on the data volume, but causes no disruption to the running workload. The tooling tracks which disk blocks change during this initial copy. When the bulk transfer is complete, a short maintenance window is scheduled during which the VM is briefly shut down, only the changed blocks are transferred (a much smaller and faster operation), and the VM is started on the target platform. This approach typically reduces the actual downtime to minutes rather than hours.',
      { spacing: { after: 120 } }
    ),
    createParagraph(
      'Regardless of which approach is used, a maintenance window is always required for the final cutover. This ensures a clean, consistent transition with no data loss. The duration of that window is a planning decision that can be tailored to each workload\'s availability requirements.',
      { spacing: { after: 200 } }
    ),

    createHeading('4.1.3 Migration Tooling', HeadingLevel.HEADING_3),
    createParagraph(
      'Both migration targets benefit from purpose-built, industry-proven migration tooling that automates the process end to end. These are not custom scripts or experimental approaches — they are supported products with established track records in enterprise migrations.'
    ),
    createParagraph(
      'For ROKS (OpenShift Virtualization) migrations:',
      { bold: true, spacing: { after: 60 } }
    ),
    ...createBulletList([
      'The Migration Toolkit for Virtualization (MTV) is the standard tool for migrating VMware VMs to OpenShift. MTV is developed and supported by Red Hat and is purpose-built for this exact use case.',
      'MTV connects directly to the VMware vCenter, discovers the VMs to be migrated, and orchestrates the entire process — including disk conversion, data transfer, and network mapping — through a graphical interface.',
      'MTV supports both warm and cold migration. Warm migration uses VMware\'s Changed Block Tracking (CBT) technology to minimise cutover downtime.',
      'Migration is performed in planned waves, allowing the team to validate each group of VMs before proceeding to the next. This provides natural checkpoints and rollback opportunities.',
    ]),
    createDocLink(
      'For detailed guidance on the Migration Toolkit for Virtualization, see',
      'MTV Migration Design',
      DOC_LINKS.migrationToolkit
    ),
    createParagraph(
      'For VPC Virtual Server migrations:',
      { bold: true, spacing: { before: 120, after: 60 } }
    ),
    ...createBulletList([
      'RackWare RMM (RackWare Migration Module) is the recommended tool for enterprise-scale VSI migrations. RackWare is an IBM partner with extensive experience in cloud migration projects.',
      'RackWare automates discovery, provisioning of target VSIs, disk transfer, and driver installation. It supports wave-based migration with delta synchronisation to minimise downtime.',
      'Additional proven methods are available for specific scenarios, including image-based import via IBM Cloud Object Storage, direct volume copy, and direct extraction from vCenter using the VMware VDDK toolkit.',
      'All methods handle the necessary driver updates (such as virtio drivers for Linux and Windows) automatically, ensuring VMs boot correctly on the new platform.',
    ]),
    createDocLink(
      'For VPC migration methods and tooling options, see',
      'VPC Migration Methods',
      DOC_LINKS.vsiMigrationMethods
    ),
    createDocLink(
      'For the RackWare RMM technical guide, see',
      'RackWare Migration Guide',
      DOC_LINKS.rackwareGuide
    ),
    createParagraph(
      'In both cases, the migration team does not need to understand the internal workings of each application. The tooling operates at the infrastructure level — copying disks, mapping networks, and configuring storage — while the applications inside each VM remain completely untouched.',
      { spacing: { after: 200 } }
    ),

    createHeading('4.1.4 What Does Not Change', HeadingLevel.HEADING_3),
    createParagraph(
      'It is important to emphasise what remains the same after migration. The following elements are preserved exactly as they are today:'
    ),
    ...createBulletList([
      'Applications and services: All software installed inside each VM continues to run without modification. Application code, libraries, and runtime environments are unchanged.',
      'Operating systems: The guest operating system (Windows Server, Red Hat Enterprise Linux, Ubuntu, etc.) is transferred as-is. No reinstallation or reconfiguration is required.',
      'Data: All files, databases, and application data are copied exactly. There is no transformation, restructuring, or data migration step beyond the disk copy.',
      'Internal configuration: Hostnames, local user accounts, installed packages, scheduled tasks, and service configurations are all preserved.',
      'Application architecture: Multi-tier applications, database clusters, and service dependencies continue to function with the same architecture. No re-engineering is needed.',
    ]),
    createParagraph(
      'The only changes are at the infrastructure level: the underlying hardware platform, the virtual networking configuration (mapped to IBM Cloud VPC equivalents), and the storage subsystem. These infrastructure-level changes are handled by the migration tooling and are transparent to the workloads running inside each VM.',
      { spacing: { after: 200 } }
    ),

    createHeading('4.1.5 Level of Effort', HeadingLevel.HEADING_3),
    createParagraph(
      'Because the migration is a tooling-driven infrastructure operation rather than an application transformation, the level of effort is significantly lower than a traditional re-platforming or modernisation project. The primary activities are:'
    ),
    ...createBulletList([
      'Pre-migration preparation: Resolving any identified blockers (such as consolidating old snapshots or disconnecting CD-ROM drives), which are routine VMware administration tasks.',
      'Target environment setup: Provisioning the IBM Cloud infrastructure, configuring networking and connectivity — performed once before migration begins.',
      'Migration execution: Running the migration tooling in planned waves. Each wave is largely automated, with the migration team monitoring progress and validating results.',
      'Post-migration validation: Confirming that applications are functioning correctly on the new platform, updating DNS records, and performing any necessary network cutover.',
    ]),
    createParagraph(
      'The migration does not require application developers, database administrators, or end users to be involved in the process. It is an infrastructure operation carried out by the infrastructure and migration team, using established tooling and well-documented procedures.'
    ),
    createDocLink(
      'For pre-migration planning guidance, see',
      'Pre-Migration Planning',
      DOC_LINKS.vsiPreMigration
    ),
  ];
}
