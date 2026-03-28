// Migration Options Section

import { Paragraph, Table, TableRow, PageBreak, HeadingLevel, BorderStyle } from 'docx';
import reportTemplates from '@/data/reportTemplates.json';
import factorsData from '@/data/platformSelectionFactors.json';
import { STYLES, type DocumentContent } from '../types';
import { createHeading, createParagraph, createBulletList, createStyledTable, createTableCell, createTableDescription, createTableLabel, createDocLink } from '../utils/helpers';
import { DOC_LINKS } from '../utils/docLinks';

// Type assertion for templates with table/figure descriptions
const templates = reportTemplates as typeof reportTemplates & {
  tableDescriptions: Record<string, { title: string; description: string }>;
  figureDescriptions: Record<string, { title: string; description: string }>;
};

export function buildMigrationOptions(sectionNum?: number): DocumentContent[] {
  const optTemplates = reportTemplates.migrationOptions;
  const s = sectionNum != null ? sectionNum : 4;

  return [
    createHeading(`${s}. ` + optTemplates.title, HeadingLevel.HEADING_1),
    createParagraph(optTemplates.introduction),
    createParagraph(optTemplates.comparisonIntro),

    // Migration Review table - description above, label below
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
          cantSplit: true,
          children: [
            createTableCell('Characteristic', { header: true }),
            createTableCell('ROKS + OpenShift Virt', { header: true }),
            createTableCell('VPC Virtual Servers', { header: true }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            createTableCell('Migration Approach', { bold: true }),
            createTableCell('Lift-convert-shift (MTV)'),
            createTableCell('Lift-convert-shift (Wanclouds VPC+, RackWare RMM, migration provider tools)'),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            createTableCell('Infrastructure', { bold: true }),
            createTableCell('Bare Metal with local NVMe'),
            createTableCell('Multi-tenant virtual servers'),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            createTableCell('Storage', { bold: true }),
            createTableCell('ODF (Ceph) with 3x replication'),
            createTableCell('Block storage volumes'),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            createTableCell('Modernization Path', { bold: true }),
            createTableCell('Containerization ready'),
            createTableCell('Traditional VM operations'),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            createTableCell('Operational Model', { bold: true }),
            createTableCell('Kubernetes/GitOps'),
            createTableCell('Traditional VM management, Terraform/Ansible'),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            createTableCell('Best For', { bold: true }),
            createTableCell('Application modernization'),
            createTableCell('Quick migration with minimal change'),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            createTableCell('Backup & Recovery', { bold: true }),
            createTableCell('OADP, Veeam Kasten K10, other third party kubernetes backup solution. IBM Cloud Backup and Recovery (future)'),
            createTableCell('IBM Cloud native snapshots, IBM Cloud Backup, IBM Cloud Backup and Recovery, Veeam and other third part agent based solutions'),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            createTableCell('Disaster Recovery', { bold: true }),
            createTableCell('ODF Regional DR with multi-cluster + RHACM'),
            createTableCell('IBM Cloud VPC cross-region snapshots, Wanclouds VPC+, RackWare RMM'),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            createTableCell('Observability', { bold: true }),
            createTableCell('Built-in OpenShift monitoring + IBM Cloud Monitoring & Logging'),
            createTableCell('IBM Cloud Monitoring & Logging'),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            createTableCell('Security Model', { bold: true }),
            createTableCell('OpenShift RBAC + VPC security groups'),
            createTableCell('VPC security groups, firewalls, IAM'),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            createTableCell('Encryption', { bold: true }),
            createTableCell('ODF client-side encryption (per-PV) with Advanced edition; etcd encryption at rest'),
            createTableCell('IBM Cloud Block Storage encryption at rest (provider-managed or customer-managed keys via Key Protect / HPCS)'),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            createTableCell('Networking', { bold: true }),
            createTableCell('OpenShift OVN SDN + VPC networking'),
            createTableCell('VPC subnets, security groups, ACLs'),
          ],
        }),
      ],
    }),
    createTableLabel(templates.tableDescriptions.migrationComparison.title),

    // Decision factors guide
    ...buildDecisionFactorsSection(),

    // Migration Process section
    ...buildMigrationProcess(s),

    // Build-Ahead section
    ...buildBuildAheadSection(s),

    // Partner Engagement section
    ...buildPartnerEngagementSection(s),

    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function buildDecisionFactorsSection(): DocumentContent[] {
  const TARGET_LABELS: Record<string, string> = {
    vsi: 'VPC VSI',
    roks: 'ROKS',
    dynamic: 'Dynamic (cost)',
  };

  // Group: VSI factors first, then ROKS, then dynamic
  const sortedFactors = [...factorsData.factors].sort((a, b) => {
    const order: Record<string, number> = { vsi: 0, roks: 1, dynamic: 2 };
    return (order[a.target] ?? 3) - (order[b.target] ?? 3);
  });

  const rows = sortedFactors.map(factor => [
    factor.label,
    TARGET_LABELS[factor.target] ?? factor.target,
  ]);

  return [
    createHeading('Choosing the Right Target', HeadingLevel.HEADING_2),
    createParagraph(
      'The choice between VPC Virtual Servers and ROKS with OpenShift Virtualization depends on your team\'s skills, modernisation goals, and workload characteristics. The following table summarises the key decision factors.'
    ),
    createStyledTable(['Factor', 'Favours'], rows),
    createParagraph(
      'Many clients benefit from a multi-platform approach. Enterprise workloads such as SAP HANA and Oracle databases are best served by Power Virtual Server (PowerVS), which provides dedicated POWER hardware optimised for these workloads. All IBM Cloud environments — VPC, ROKS, and PowerVS — can be interconnected via Transit Gateways, enabling a unified hybrid architecture.',
      { spacing: { after: 200 } }
    ),
  ];
}

function buildMigrationProcess(s: number): DocumentContent[] {
  return [
    createHeading(`${s}.1 How the Migration Works`, HeadingLevel.HEADING_2),
    createParagraph(
      'A common concern when planning a cloud migration is whether applications will need to be rewritten or significantly modified. This is not the case. Migrating VMware virtual machines to IBM Cloud VPC VIS or ROKS/ROV is a well-established, repeatable process that has been successfully completed for thousands of enterprise environments worldwide. Your applications, operating systems, and data remain exactly as they are today — the migration simply moves them from one infrastructure platform to another.'
    ),
    createParagraph(
      'The process is best described as "lift, convert, and shift." Each virtual machine is lifted from the VMware environment, its disk format is converted from the VMware-specific format (VMDK) to a cloud-compatible format (QCOW2 or raw image). VMware drivers are replaced with virtio drivers, and the resulting image is transferred to IBM Cloud where it runs on the new infrastructure. No application code changes are required. No databases need to be restructured. No users need to be retrained. From the perspective of the applications and services running inside each virtual machine, the migration is transparent — they continue to operate exactly as before.',
      { spacing: { after: 200 } }
    ),
    createDocLink(
      'For an overview of IBM Cloud virtualization solutions, see',
      'IBM Cloud Virtualization Solutions',
      DOC_LINKS.overview
    ),

    createHeading(`${s}.1.1 The Disk Conversion Step`, HeadingLevel.HEADING_3),
    createParagraph(
      'Virtual machines on VMware store their data in a proprietary disk format called VMDK (Virtual Machine Disk). Cloud platforms, including IBM Cloud and OpenShift, use open industry-standard formats such as QCOW2 or raw disk images. As part of the migration, each VM\'s disk is converted from VMDK to the appropriate target format. This is a fully automated, mechanical process handled by well-proven tooling — it does not alter the contents of the disk in any way. The operating system, installed applications, configuration files, and data all remain identical. The conversion simply changes the container format, much like saving a document from one file format to another without changing its content.'
    ),
    createParagraph(
      'For ROKS migrations, the Migration Toolkit for Virtualization (MTV) performs this conversion automatically as part of its migration workflow — no manual intervention is required. For VPC Virtual Server migrations, established tools such as Wanclouds VPC+, RackWare RMM and other migration provider tooling handle the conversion and transfer as a single orchestrated operation. In both cases, the conversion step is invisible to the end user and fully managed by the migration tooling.',
      { spacing: { after: 200 } }
    ),

    createHeading(`${s}.1.2 Migration Approaches: Warm and Cold`, HeadingLevel.HEADING_3),
    createParagraph(
      'There are two approaches to transferring a virtual machine, commonly referred to as "warm" and "cold" migration. Both approaches require a maintenance window for the final cutover, but they differ in how long that window needs to be.'
    ),
    createParagraph(
      'Cold migration is the simpler approach: the virtual machine is shut down, its disks are copied in full to the target platform, and the VM is started on the target platform. The maintenance window lasts for the duration of the full disk copy. This approach is straightforward, reliable, and well suited to smaller VMs or workloads that can tolerate a longer planned outage.',
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

    createHeading(`${s}.1.3 Migration Tooling`, HeadingLevel.HEADING_3),
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
      'For VPC Virtual Server migrations using RackWare RMM (RackWare Migration Module) for example:',
      { bold: true, spacing: { before: 120, after: 60 } }
    ),
    ...createBulletList([
      'RackWare is an IBM partner with extensive experience in cloud migration software.',
      'RackWare automates discovery, provisioning of target VSIs, disk transfer, and driver installation. It supports wave-based migration with delta synchronisation to minimise downtime.',
      'Additional proven methods are available for specific scenarios, including Wanclouds VPC+ and image-based import via IBM Cloud Object Storage, direct volume copy, and direct extraction from vCenter using the VMware VDDK toolkit.',
      'All methods handle the necessary driver updates (such as virtio drivers for Linux and Windows) automatically for supported operating systems (Windows Server 2012 R2+, modern Linux distributions), ensuring VMs boot correctly on the new platform. Legacy OS versions (Windows Server 2008 R2 and earlier) may require manual driver injection or OS upgrades prior to migration.',
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

    createHeading(`${s}.1.4 What Does Not Change`, HeadingLevel.HEADING_3),
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

    createHeading(`${s}.1.5 Level of Effort`, HeadingLevel.HEADING_3),
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
      'The migration approach limits the effort needed from application developers, database administrators, and end users in the process. It is primarily an infrastructure operation carried out by the infrastructure and migration team, using established tooling and well-documented procedures.'
    ),
    createDocLink(
      'For pre-migration planning guidance, see',
      'Pre-Migration Planning',
      DOC_LINKS.vsiPreMigration
    ),

    createHeading(`${s}.1.6 Replacing Hypervisor-Dependent Tooling`, HeadingLevel.HEADING_3),
    createParagraph(
      'Tools that depend on the VMware hypervisor layer — including those that use vSphere APIs, VADP (vStorage APIs for Data Protection), or Changed Block Tracking (CBT) — will not function on IBM Cloud VPC VSI or ROKS, because neither platform runs a VMware hypervisor. Replacement solutions must be identified and validated as part of the migration project. The table below maps common VMware-dependent tools to their IBM Cloud equivalents.'
    ),
    createStyledTable(
      ['VMware Tool', 'Function', 'ROKS Replacement', 'VPC VSI Replacement'],
      [
        ['VMware SRM', 'Disaster Recovery', 'ODF Regional DR + RHACM', 'IBM Cloud cross-region snapshots, Wanclouds VPC+, RackWare RMM'],
        ['Zerto', 'DR / CDP', 'ODF Regional DR + RHACM', 'IBM Cloud cross-region snapshots, Wanclouds VPC+, RackWare RMM'],
        ['Veeam B&R (VADP)', 'Backup via VMware APIs', 'OADP, Veeam Kasten, third party agent based backup', 'IBM Cloud Backup, IBM Cloud Backup and Recovery, Veeam or other third party agent based backup'],
        ['Veeam CDP', 'Continuous Data Protection', 'ODF Regional DR + RHACM', 'IBM Cloud cross-region snapshots, Wanclouds VPC+, RackWare RMM'],
        ['Aria Operations', 'Monitoring / Capacity', 'OpenShift Monitoring + IBM Cloud Monitoring', 'IBM Cloud Monitoring + Instana'],
        ['Aria Logging', 'Logging', 'OpenShift Events + IBM Cloud Logging', 'IBM Cloud Logging'],
        ['Aria Automation', 'Provisioning / IaC', 'OpenShift GitOps (ArgoCD) + Ansible', 'Terraform + Ansible + Schematics'],
        ['vSphere DRS/HA', 'Cluster Management', 'Kubernetes scheduling + pod anti-affinity', 'VPC placement groups + auto-recovery'],
      ]
    ),
    createParagraph(
      'The PoV/PoC phase (Section 4.3.1) should validate replacement tooling alongside the VM migration itself. Early testing ensures that backup, DR, monitoring, and provisioning workflows are operational on the target platform before production workloads are migrated.',
      { spacing: { after: 200 } }
    ),
  ];
}

function buildBuildAheadSection(s: number): DocumentContent[] {
  return [
    createHeading(`${s}.2 Build-Ahead: Alternative for Infrastructure Services`, HeadingLevel.HEADING_2),
    createParagraph(
      'Not all workloads benefit from a lift-and-shift approach. Infrastructure services such as Active Directory, DNS, monitoring, and backup are often better served by provisioning fresh cloud-native or managed services on IBM Cloud and migrating only the data and configuration. This reduces complexity, eliminates legacy configuration debt, and takes advantage of cloud-native capabilities such as managed high availability, auto-scaling, and built-in patching.'
    ),
    createParagraph(
      'The build-ahead approach complements lift-and-shift by addressing workloads where recreating the service is simpler and more reliable than migrating the underlying virtual machine. It applies to a subset of VMs — typically infrastructure services rather than business applications — and runs in parallel with the main migration waves.',
      { spacing: { after: 200 } }
    ),

    createHeading(`${s}.2.1 When to Use Build-Ahead`, HeadingLevel.HEADING_3),
    createParagraph(
      'Build-ahead is the preferred approach when:'
    ),
    ...createBulletList([
      'The workload is an infrastructure service rather than a business application.',
      'A cloud-native or managed equivalent exists on IBM Cloud.',
      'The service\'s data can be replicated or exported independently of the VM (e.g., AD replication, DNS zone transfer, database logical export).',
      'The legacy VM carries configuration debt — old operating system, manual patches, undocumented customisations.',
      'The service supports native replication or synchronisation, enabling a low-risk parallel cutover.',
    ]),

    createHeading(`${s}.2.2 Build-Ahead Candidates`, HeadingLevel.HEADING_3),
    createParagraph(
      'The following table maps common infrastructure workload types to their recommended IBM Cloud replacements and the typical migration path for each.',
      { spacing: { after: 120 } }
    ),
    createStyledTable(
      ['Workload Type', 'IBM Cloud Alternative', 'Migration Path'],
      [
        [
          'Active Directory / Domain Controllers',
          'Fresh Windows Server VMs in VPC',
          'Promote new cloud DCs \u2192 replicate AD \u2192 transfer FSMO roles \u2192 demote old DCs',
        ],
        [
          'DNS Servers',
          'IBM Cloud DNS Services or fresh DNS VMs in VPC',
          'Export zones \u2192 import to cloud DNS \u2192 update NS delegation \u2192 decommission',
        ],
        [
          'Database Servers',
          'IBM Cloud Databases (managed) or fresh DB VMs',
          'Logical export/replication \u2192 validate \u2192 cutover application connection strings',
        ],
        [
          'Backup & Recovery',
          'Veeam on IBM Cloud + Object Storage',
          'Deploy cloud backup \u2192 redirect backup jobs \u2192 validate restores \u2192 retire appliance',
        ],
        [
          'Monitoring & Observability',
          'IBM Cloud Monitoring / Instana',
          'Deploy cloud monitoring \u2192 install agents on migrated VMs \u2192 retire legacy',
        ],
        [
          'Container Platforms',
          'Target ROKS cluster',
          'Migrate container workloads via MTC \u2192 consolidate \u2192 retire source cluster VMs',
        ],
        [
          'CI/CD & DevOps',
          'Jenkins on ROKS / GitHub Actions / GitLab CI',
          'Rebuild pipelines targeting cloud \u2192 parallel run \u2192 retire old CI server',
        ],
        [
          'Network Appliances',
          'VPC Load Balancer, Security Groups, DNS Services',
          'Design VPC networking \u2192 cutover traffic at DNS/LB layer \u2192 retire appliance VMs',
        ],
        [
          'Storage Appliances',
          'Block Storage, File Storage, Object Storage',
          'Migrate data to cloud storage \u2192 retarget application mounts \u2192 retire appliance',
        ],
        [
          'Security Tools',
          'IBM Cloud SCC, VPC Security Groups, Red Hat ACS',
          'Deploy cloud security \u2192 migrate policies \u2192 validate compliance \u2192 retire VMs',
        ],
      ]
    ),

    createHeading(`${s}.2.3 The Build-Ahead Process`, HeadingLevel.HEADING_3),
    createParagraph(
      'The build-ahead process follows a consistent pattern regardless of the specific workload type:'
    ),
    ...createBulletList([
      'Provision — Deploy the replacement service on IBM Cloud, whether a managed service or a fresh virtual machine.',
      'Configure — Apply equivalent policies, rules, and settings from the source environment.',
      'Replicate — Synchronise data using native replication mechanisms (AD replication, database logical replication, DNS zone transfer, backup job redirect).',
      'Validate — Verify the cloud service operates correctly in parallel with the source, confirming data consistency and functional equivalence.',
      'Cutover — Switch traffic and clients to the cloud service (DNS update, connection string change, FSMO role transfer).',
      'Decommission — Retire the legacy VM once the cloud service is confirmed stable and all dependent workloads have been validated.',
    ]),
    createParagraph(
      'Build-ahead VMs are typically excluded from the lift-and-shift migration waves. They should be provisioned early in the migration timeline — during the Environment Preparation phase — so that they are ready to serve migrated workloads as they arrive.',
      { spacing: { after: 200 } }
    ),
  ];
}

function buildPartnerEngagementSection(s: number): DocumentContent[] {
  return [
    createHeading(`${s}.3 Next Steps: Migration Partner Engagement`, HeadingLevel.HEADING_2),
    createParagraph(
      'This assessment provides the analytical foundation for migration planning — identifying workloads, assessing readiness, estimating sizing, and recommending target platforms. The next step is to engage an IBM migration partner who will work with your team to translate these findings into a detailed, executable migration plan tailored to your environment and business requirements.'
    ),

    createHeading(`${s}.3.1 Proof of Value / Proof of Concept`, HeadingLevel.HEADING_3),
    createParagraph(
      'Before committing to a full-scale migration, a Proof of Value (PoV) or Proof of Concept (PoC) is typically conducted. This is a structured, time-boxed exercise — usually 2 to 4 weeks — in which a small number of representative workloads are migrated to IBM Cloud to validate the approach end to end.'
    ),
    createParagraph(
      'The PoV/PoC validates that:',
      { spacing: { after: 60 } }
    ),
    ...createBulletList([
      'Migration tooling works correctly with your VMware environment and vCenter configuration.',
      'Network connectivity between source and target (Direct Link or VPN) meets latency and throughput requirements.',
      'Application functionality is preserved after migration — validated by your application owners.',
      'Performance on the target platform meets or exceeds current baseline.',
      'Cutover procedures and rollback processes work as designed.',
      'Operational processes (monitoring, backup, patching) function on the new platform.',
    ]),
    createParagraph(
      'The PoV/PoC provides concrete evidence that the migration approach works for your specific environment, reducing risk before the production migration begins.',
      { spacing: { after: 200 } }
    ),

    createHeading(`${s}.3.2 What the Migration Partner Delivers`, HeadingLevel.HEADING_3),
    createParagraph(
      'Once engaged, the IBM migration partner will develop a comprehensive migration plan that builds on this assessment. Key deliverables include:'
    ),
    ...createBulletList([
      'Detailed migration design — network topology, storage mapping, security architecture, and connectivity design specific to your environment.',
      'Migration runbook — step-by-step procedures for each migration wave, including pre-checks, execution steps, validation criteria, and rollback procedures.',
      'Risk register and mitigation plan — identified risks with severity, likelihood, and specific mitigation actions.',
      'Timeline and wave plan — sequenced migration waves with dependencies, maintenance windows, and resource assignments.',
      'Testing and validation plan — acceptance criteria for each workload, performance baselines, and sign-off procedures.',
      'Operational handover — documentation, training, and knowledge transfer for day-2 operations on IBM Cloud.',
    ]),
    createParagraph(
      'This assessment report is designed to accelerate that engagement by providing a comprehensive inventory of your VMware environment, a readiness assessment with identified blockers and remediation steps, workload classification, target platform recommendations, and preliminary sizing and cost estimates. The migration partner can use these findings as the starting point for detailed planning, significantly reducing the time required to move from assessment to execution.',
      { spacing: { after: 200 } }
    ),

    createHeading(`${s}.3.3 IBM Migration Support Programme`, HeadingLevel.HEADING_3),
    createParagraph(
      'IBM provides a structured support programme to help clients migrate from VMware. The programme includes:'
    ),
    ...createBulletList([
      'Complimentary assessment — IBM\'s CoE Solutioning Architect assesses your environment, sizes the target, and produces the initial migration design at no cost.',
      'Free Proof of Concept environment — up to 10% of your VMware footprint provisioned on IBM Cloud for 90 days to validate the migration approach.',
      'Dual-run credits — 90 days of credits to cover the cost of running workloads on both VMware and IBM Cloud during the transition period.',
      'Free migration services — specialist migration partner assigned to execute the migration at no additional cost.',
      'Continuous engagement — your assigned IBM resource remains throughout the migration until steady state is achieved.',
    ]),

    createHeading(`${s}.3.4 Roles and Responsibilities`, HeadingLevel.HEADING_3),
    createParagraph(
      'A successful migration requires coordinated effort from both IBM and the client organisation. The key roles are outlined below.'
    ),
    createParagraph('IBM Team:', { bold: true, spacing: { after: 60 } }),
    ...createBulletList([
      'Customer Success Manager (CSM) — primary IBM contact; coordinates meetings, manages the relationship, liaises with the migration partner.',
      'Technical Account Manager (TAM) — provides account context and infrastructure knowledge.',
      'CoE Solutioning Architect — assesses the environment, sizes the target, recommends a landing zone, produces the migration design and handover pack.',
      'Migration Partner — executes detailed discovery, designs target infrastructure, migrates workloads.',
    ]),
    createParagraph('Client Team:', { bold: true, spacing: { before: 120, after: 60 } }),
    ...createBulletList([
      'Client Stakeholders / Decision Makers — approve timelines, budgets, and scope; make go/no-go decisions.',
      'VMware / Infrastructure Administrator — provides RVTools exports, network diagrams, and IaaS component details; performs pre-migration remediation.',
      'Application Owners — validate workload functionality post-migration; confirm dependencies and criticality per VM.',
    ]),
  ];
}
