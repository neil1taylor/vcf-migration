// VPC VSI Migration Methods page
import { Grid, Column, Tile, Accordion, AccordionItem, UnorderedList, ListItem, Tag, CodeSnippet } from '@carbon/react';
import { CheckmarkFilled, WarningFilled, InformationFilled } from '@carbon/icons-react';
import './DocumentationPage.scss';

interface MigrationMethod {
  id: string;
  name: string;
  description: string;
  whenToUse: string[];
  requirements: string[];
  steps: string[];
  pros: string[];
  cons: string[];
  complexity: 'Low' | 'Medium' | 'High';
}

const migrationMethods: MigrationMethod[] = [
  {
    id: 'rackware-rmm',
    name: 'Method 1: RackWare RMM (Recommended)',
    description: 'Use RackWare RMM (RackWare Management Module) to migrate VMs directly to IBM Cloud VPC VSIs with automated orchestration, driver injection, and support for IP address retention.',
    whenToUse: [
      'Large-scale migrations requiring automation and orchestration',
      'VMs on isolated NSX overlay segments without direct network access',
      'Migrations requiring IP address retention on target VSIs',
      'Organizations wanting minimal downtime with delta sync capabilities',
      'Mixed Windows and Linux environments',
    ],
    requirements: [
      'RackWare RMM server deployed in IBM Cloud VPC',
      'Bridge server for isolated network connectivity (if NSX overlay)',
      'Transit Gateway connecting Classic and VPC (if using bridge)',
      'SSH access configured on source VMs (rackware user for Linux, RackWare SSHD for Windows)',
      'IBM Cloud API credentials for auto-provisioning',
    ],
    steps: [
      'Deploy RackWare RMM server in VPC and configure IBM Cloud credentials',
      'Set up bridge server with NAT if source VMs are on isolated NSX segments',
      'Configure SSH keys between RMM, source VMs, and target VSIs',
      'Create migration wave in RMM with source VM details (IP/NAT address)',
      'RMM discovers source VM metadata (OS, disks, network)',
      'RMM auto-provisions target VSI or uses pre-provisioned server',
      'RMM performs Direct Sync with Passthrough (Source → RMM → Target)',
      'RMM installs bootloader and drivers, then reboots target',
      'Perform delta syncs as needed before final cutover',
    ],
    pros: [
      'Automated orchestration reduces manual effort',
      'Supports IP address retention on migrated VMs',
      'Delta sync minimizes cutover downtime',
      'Works with isolated NSX overlay networks via bridge server',
      'Single tool handles discovery, provisioning, and data transfer',
      'Built-in driver injection for target hardware',
      'Wave-based migration for organized cutovers',
    ],
    cons: [
      'Requires RackWare licensing',
      'Initial setup complexity for bridge server configuration',
      'Bridge server needed for NSX isolated networks',
      'Requires SSH access to source VMs',
    ],
    complexity: 'Medium',
  },
  {
    id: 'image-based',
    name: 'Method 3: Image-Based Import',
    description: 'Export VM disk to VMDK, convert to QCOW2, upload to Cloud Object Storage, and create a custom VSI image.',
    whenToUse: [
      'Simple single-disk migrations',
      'Organizations wanting reusable image templates',
      'Standard OS deployments that will be replicated',
    ],
    requirements: [
      'Single disk VM (additional disks require separate handling)',
      'IBM Cloud Object Storage bucket',
      'QEMU image conversion tools (qemu-img)',
      'Sufficient local storage for image conversion',
    ],
    steps: [
      'Export VMDK from VMware (or use vSphere API)',
      'Convert VMDK to QCOW2 format using qemu-img',
      'Upload QCOW2 image to COS bucket',
      'Create custom image in VPC image service',
      'Launch VSI from custom image',
    ],
    pros: [
      'Straightforward process',
      'Reusable image template for multiple deployments',
      'Well-documented IBM Cloud workflow',
    ],
    cons: [
      'Inefficient for single-use migrations',
      'Does not scale well for multi-disk VMs',
      'Requires significant storage for image files',
    ],
    complexity: 'Low',
  },
  {
    id: 'direct-volume',
    name: 'Method 4: Direct Volume Copy',
    description: 'Write exported VM disks directly to VPC block volumes via a temporary worker VSI.',
    whenToUse: [
      'Multi-disk VMs',
      'Organizations wanting to preserve custom configurations',
      'VMs with complex disk layouts',
    ],
    requirements: [
      'Worker VSI with sufficient storage',
      'Temporary VSI for volume creation',
      'QEMU tools for disk conversion',
      'Optional: virt-v2v for driver injection',
    ],
    steps: [
      'Create ephemeral VSI to generate boot volume',
      'Delete VSI to free volumes (volumes persist)',
      'Attach volumes to worker VSI',
      'Convert and write VMDK to block devices using qemu-img or dd',
      'Optionally apply virt-v2v transformations for driver injection',
      'Detach volumes and create final VSI',
    ],
    pros: [
      'Handles multiple disks natively',
      'Flexible transformation options',
      'Preserves disk configurations',
    ],
    cons: [
      'Labor-intensive process',
      'Requires multiple create/delete cycles',
      'More complex orchestration needed',
    ],
    complexity: 'Medium',
  },
  {
    id: 'iso-network',
    name: 'Method 5: ISO-Based Network Transfer',
    description: 'Boot source VM from ISO image (Ubuntu installer, TinyCore Linux, or virt-p2v); transfer disks over network to worker VSI using tools like dd and gzip.',
    whenToUse: [
      'Avoiding VMDK export inefficiencies',
      'Network-connected environments with Transit Gateway',
      'Large VMs where file transfer is impractical',
      'Organizations preferring streaming transfer',
    ],
    requirements: [
      'Transit Gateway connecting source and destination environments',
      'Linux ISO or specialized boot medium (virt-p2v)',
      'Worker VSI with listener configured',
      'Network connectivity between VMware and IBM Cloud',
    ],
    steps: [
      'Boot source VM from ISO (Ubuntu Live, TinyCore, or virt-p2v)',
      'Configure networking on booted ISO environment',
      'On worker VSI, set up netcat listener with volume write',
      'Use dd and gzip to read source disk and stream via netcat',
      'Optionally apply virt-v2v transformations on target',
      'Create final VSI from processed volumes',
    ],
    pros: [
      'Avoids VMDK export inefficiencies',
      'Flexible transfer options',
      'Network-efficient compression with gzip',
      'Direct disk-to-disk transfer',
    ],
    cons: [
      'Requires Transit Gateway setup',
      'Network dependency for transfer',
      'VM downtime during transfer',
    ],
    complexity: 'Medium',
  },
  {
    id: 'vddk-direct',
    name: 'Method 6: Direct VDDK Extraction',
    description: 'Use virt-v2v with VMware VDDK plugin to directly connect to vCenter and extract VM disks while applying transformations.',
    whenToUse: [
      'Direct vCenter access available',
      'Wanting to minimize manual steps',
      'Automated migration pipelines',
      'Windows VMs requiring driver injection',
    ],
    requirements: [
      'vCenter access credentials',
      'VMware VDDK toolkit installed on worker',
      'vCenter certificate thumbprint',
      'Host identification within cluster',
      'Ubuntu build of libguestfs (for Windows VMs with SCSI drivers)',
    ],
    steps: [
      'Obtain vCenter credentials and SSL certificate thumbprint',
      'Install VDDK toolkit on worker VSI',
      'Identify target VM and ESXi host in cluster',
      'Execute virt-v2v with VDDK input plugin',
      'Output transformed disks directly to block volumes',
      'Create final VSI from processed volumes',
    ],
    pros: [
      'Direct extraction from vCenter',
      'Automated transformation and driver injection',
      'Minimal manual disk handling',
      'Supports incremental/changed block tracking',
    ],
    cons: [
      'Complex initial setup',
      'Competing tool limitations (RHEL vs Ubuntu)',
      'Requires vCenter access (not standalone ESXi)',
      'VDDK licensing considerations',
    ],
    complexity: 'High',
  },
];

const linuxPreparation = [
  'Remove stale network configuration files from /etc/sysconfig/network-scripts/',
  'Clean NetworkManager connection files if present',
  'Uninstall VMware Tools (open-vm-tools or vmware-tools)',
  'Check for and remove UUID override file (/etc/machine-id may need regeneration)',
  'Verify no hard-coded MAC addresses in network configs',
  'Ensure cloud-init is installed for IBM Cloud initialization',
];

const windowsPreparation = [
  'Install virtio drivers from Red Hat virtio-win ISO (vioscsi, viostor, netkvm)',
  'Update both boot disk and recovery image with virtio drivers',
  'Use either sysprep OR libguestfs approach for driver binding',
  'Install cloudbase-init for cloud initialization',
  'Ensure VMware Tools is uninstalled',
  'Perform clean shutdown before migration (not suspend/hibernate)',
];

const limitations = [
  { item: 'Maximum 12 disks per VSI', severity: 'warning' },
  { item: 'Boot disk must be 10-250 GB', severity: 'warning' },
  { item: 'No shared block volumes supported', severity: 'error' },
  { item: 'No warm migration available (cold migration only)', severity: 'info' },
  { item: 'VSI boot disk uses virtio-SCSI, data volumes use virtio-blk', severity: 'info' },
  { item: 'Red Hat virtio drivers support Windows Server 2008 R2 through 2025, Windows 7-11', severity: 'info' },
];

const tools = [
  {
    name: 'RackWare RMM',
    description: 'Commercial migration platform with automated discovery, provisioning, data transfer, and driver injection',
    usage: 'https://<RMM_IP>/  # Web-based UI for wave management',
  },
  {
    name: 'virt-v2v',
    description: 'Transforms VM images; installs virtio drivers; connects to vCenter via VDDK',
    usage: 'virt-v2v -i vmx source.vmx -o local -os /output',
  },
  {
    name: 'qemu-img',
    description: 'Converts between disk formats (VMDK to QCOW2, raw, etc.)',
    usage: 'qemu-img convert -f vmdk -O qcow2 source.vmdk target.qcow2',
  },
  {
    name: 'libguestfs',
    description: 'Toolkit enabling disk manipulation and driver injection without booting the VM',
    usage: 'guestfish -a disk.qcow2 -i',
  },
  {
    name: 'dd + gzip + netcat',
    description: 'Direct disk reading, compression, and network transfer',
    usage: 'dd if=/dev/sda bs=4M | gzip -c | nc target-ip 9000',
  },
];

// RackWare RMM supported operating systems
const rackwareSupportedOS = {
  linux: [
    'RHEL 5.2-5.11, 6.x, 7.x, 8.x, 9.x',
    'CentOS 5.2-5.11, 6.x, 7.x, 8.x',
    'Oracle Linux 5.6-5.11, 6.x, 7.x, 8.x, 9.x',
    'SLES 11 (including 32-bit), 12, 15 (no btrfs)',
    'Ubuntu 12-24 (including 32-bit for 12)',
    'Debian 8, 9, 10, 11, 12',
    'AlmaLinux 8, 9',
    'Rocky Linux 8, 9',
  ],
  windows: [
    'Windows Server 2008 R2',
    'Windows Server 2012, 2016, 2019, 2022',
  ],
};

export function VSIMigrationMethodsPage() {
  return (
    <div className="documentation-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="documentation-page__title">VPC VSI Migration Methods</h1>
          <p className="documentation-page__subtitle">
            Six approaches to migrating VMware VMs to IBM Cloud VPC Virtual Server Instances
          </p>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <Tile className="documentation-page__overview-tile">
            <h2>Overview</h2>
            <p>
              Migrating virtual machines from VMware to IBM Cloud VPC requires careful planning
              and the right approach based on your environment. This guide covers six migration
              methods, with <strong>RackWare RMM recommended</strong> for most enterprise migrations
              due to its automation, wave-based orchestration, and support for IP address retention.
            </p>
            <p style={{ marginTop: '1rem' }}>
              <strong>Sources:</strong>
            </p>
            <UnorderedList>
              <ListItem>
                <a
                  href="https://fullvalence.com/2025/11/10/from-vmware-to-ibm-cloud-vpc-vsi-part-3-migrating-virtual-machines/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  From VMware to IBM Cloud VPC VSI - Part 3: Migrating Virtual Machines
                </a>
              </ListItem>
              <ListItem>
                <a
                  href="https://cloud.ibm.com/docs/cloud-infrastructure?topic=cloud-infrastructure-migrating-on-prem-cloud-vpc"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  IBM Cloud: Migrating to VPC with RackWare RMM
                </a>
              </ListItem>
            </UnorderedList>
          </Tile>
        </Column>

        {/* Migration Methods */}
        <Column lg={16} md={8} sm={4}>
          <Accordion>
            {migrationMethods.map((method) => (
              <AccordionItem key={method.id} title={method.name}>
                <div className="documentation-page__section">
                  <Tile className="documentation-page__metric-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <h4>Description</h4>
                      <Tag type={method.complexity === 'Low' ? 'green' : method.complexity === 'Medium' ? 'blue' : 'purple'}>
                        {method.complexity} Complexity
                      </Tag>
                    </div>
                    <p>{method.description}</p>
                  </Tile>

                  <Tile className="documentation-page__metric-card">
                    <h4>When to Use</h4>
                    <UnorderedList>
                      {method.whenToUse.map((item, idx) => (
                        <ListItem key={idx}>{item}</ListItem>
                      ))}
                    </UnorderedList>
                  </Tile>

                  <Tile className="documentation-page__metric-card">
                    <h4>Requirements</h4>
                    <UnorderedList>
                      {method.requirements.map((item, idx) => (
                        <ListItem key={idx}>{item}</ListItem>
                      ))}
                    </UnorderedList>
                  </Tile>

                  <Tile className="documentation-page__metric-card">
                    <h4>Steps</h4>
                    <ol style={{ paddingLeft: '1.5rem' }}>
                      {method.steps.map((step, idx) => (
                        <li key={idx} style={{ marginBottom: '0.5rem' }}>{step}</li>
                      ))}
                    </ol>
                  </Tile>

                  <Grid>
                    <Column lg={8} md={4} sm={4}>
                      <Tile className="documentation-page__metric-card">
                        <h4 style={{ color: '#24a148' }}>
                          <CheckmarkFilled style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                          Pros
                        </h4>
                        <UnorderedList>
                          {method.pros.map((item, idx) => (
                            <ListItem key={idx}>{item}</ListItem>
                          ))}
                        </UnorderedList>
                      </Tile>
                    </Column>
                    <Column lg={8} md={4} sm={4}>
                      <Tile className="documentation-page__metric-card">
                        <h4 style={{ color: '#da1e28' }}>
                          <WarningFilled style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                          Cons
                        </h4>
                        <UnorderedList>
                          {method.cons.map((item, idx) => (
                            <ListItem key={idx}>{item}</ListItem>
                          ))}
                        </UnorderedList>
                      </Tile>
                    </Column>
                  </Grid>
                </div>
              </AccordionItem>
            ))}

            <AccordionItem title="RackWare RMM Deep Dive">
              <div className="documentation-page__section">
                <Tile className="documentation-page__metric-card">
                  <h4>How RackWare RMM Works</h4>
                  <p>
                    RackWare RMM orchestrates migrations using a combination of <strong>Direct Sync</strong> and{' '}
                    <strong>Passthrough</strong> modes. Data transfers directly from source to target without being
                    stored on the RMM server, while RMM acts as a network relay for isolated networks.
                  </p>
                  <CodeSnippet type="multi" feedback="Copied!" hideCopyButton>
{`IBM Cloud VMware-Automated    Bridge Server              IBM Cloud VPC
+----------------+            +----------------+         +----------------+
|                |            | ens192:        |         |                |
|   Source VM    |            | 192.168.10.254 |         |   RMM Server   |
| 192.168.10.11  |----------->|                |<--------|  10.68.70.11   |
|                |            |    ens224:     |         |                |
+----------------+            | 10.134.54.62   |         +----------------+
                              |                |                 |
                              +----------------+                 |
                                                                 v
                                                         +----------------+
                                                         |   Target VSI   |
                                                         | 192.168.10.11  |
                                                         +----------------+`}
                  </CodeSnippet>
                </Tile>

                <Grid>
                  <Column lg={8} md={4} sm={4}>
                    <Tile className="documentation-page__metric-card">
                      <h4>Key RMM Operations</h4>
                      <UnorderedList>
                        <ListItem><strong>Discover:</strong> SSH to source, gather OS/disk/network metadata</ListItem>
                        <ListItem><strong>AutoProvision:</strong> Create target VSI using discovered specs</ListItem>
                        <ListItem><strong>Direct Sync:</strong> Transfer data source → target (via RMM if passthrough)</ListItem>
                        <ListItem><strong>Delta Sync:</strong> Transfer only changed files for minimal downtime</ListItem>
                        <ListItem><strong>Microkernel Boot:</strong> RMM boots target into microkernel for disk prep</ListItem>
                      </UnorderedList>
                    </Tile>
                  </Column>
                  <Column lg={8} md={4} sm={4}>
                    <Tile className="documentation-page__metric-card">
                      <h4>Bridge Server (for NSX Overlay)</h4>
                      <p>When source VMs are on isolated NSX overlay segments:</p>
                      <UnorderedList>
                        <ListItem>Bridge uses iptables NAT to translate addresses</ListItem>
                        <ListItem>RMM connects to NAT IP, bridge DNATs to real VM IP</ListItem>
                        <ListItem>Enables migration without modifying NSX configuration</ListItem>
                        <ListItem>IBM Cloud portable subnet routes to bridge server</ListItem>
                      </UnorderedList>
                    </Tile>
                  </Column>
                </Grid>

                <Tile className="documentation-page__metric-card">
                  <h4>IP Address Retention</h4>
                  <p>
                    RackWare RMM supports retaining IP addresses on migrated workloads. However, VPC subnets have
                    reserved addresses that cannot be used:
                  </p>
                  <div style={{ marginTop: '0.5rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    <UnorderedList>
                      <ListItem><code>.0</code> - Network address</ListItem>
                      <ListItem><code>.1</code> - Default gateway</ListItem>
                      <ListItem><code>.2</code> - DNS address</ListItem>
                      <ListItem><code>.3</code> - Reserved</ListItem>
                      <ListItem><code>.255</code> - Broadcast address</ListItem>
                    </UnorderedList>
                  </div>
                  <p style={{ marginTop: '0.5rem' }}>
                    VMs using these addresses will need to be re-IPed during migration.
                  </p>
                </Tile>

                <Grid>
                  <Column lg={8} md={4} sm={4}>
                    <Tile className="documentation-page__metric-card">
                      <h4>Supported Linux</h4>
                      <UnorderedList>
                        {rackwareSupportedOS.linux.map((os, idx) => (
                          <ListItem key={idx}>{os}</ListItem>
                        ))}
                      </UnorderedList>
                    </Tile>
                  </Column>
                  <Column lg={8} md={4} sm={4}>
                    <Tile className="documentation-page__metric-card">
                      <h4>Supported Windows</h4>
                      <UnorderedList>
                        {rackwareSupportedOS.windows.map((os, idx) => (
                          <ListItem key={idx}>{os}</ListItem>
                        ))}
                      </UnorderedList>
                      <p style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
                        <strong>Note:</strong> Windows requires RackWare SSHD utility (MSI installer) available from
                        the RMM server at <code>/windows/RWSSHDService_x64.msi</code>
                      </p>
                    </Tile>
                  </Column>
                </Grid>

                <Tile className="documentation-page__metric-card">
                  <h4>SSH Key Authentication Flow</h4>
                  <ol style={{ paddingLeft: '1.5rem' }}>
                    <li style={{ marginBottom: '0.5rem' }}>
                      <strong>RMM → Source VM:</strong> Uses RMM SSH key, authenticates as <code>rackware</code> user (Linux) or via SSHD (Windows)
                    </li>
                    <li style={{ marginBottom: '0.5rem' }}>
                      <strong>RMM → Target VSI:</strong> Uses RMM SSH key, authenticates as <code>root</code> user
                    </li>
                    <li style={{ marginBottom: '0.5rem' }}>
                      <strong>Target → Source (via tunnel):</strong> RMM creates reverse SSH tunnel; target pulls data through RMM
                    </li>
                  </ol>
                </Tile>
              </div>
            </AccordionItem>

            <AccordionItem title="VM Preparation: Linux">
              <div className="documentation-page__section">
                <Tile className="documentation-page__metric-card">
                  <h4>Linux VM Preparation Steps</h4>
                  <p>Before migrating Linux VMs, perform these preparation steps:</p>
                  <UnorderedList>
                    {linuxPreparation.map((item, idx) => (
                      <ListItem key={idx}>{item}</ListItem>
                    ))}
                  </UnorderedList>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>cloud-init Behavior</h4>
                  <p>Expect the following system resets on first boot:</p>
                  <UnorderedList>
                    <ListItem>Password changes (root and user accounts)</ListItem>
                    <ListItem>SSH key regeneration</ListItem>
                    <ListItem>SSHD reconfiguration</ListItem>
                    <ListItem>Host key regeneration</ListItem>
                    <ListItem>Network reconfiguration via metadata service</ListItem>
                  </UnorderedList>
                </Tile>
              </div>
            </AccordionItem>

            <AccordionItem title="VM Preparation: Windows">
              <div className="documentation-page__section">
                <Tile className="documentation-page__metric-card">
                  <h4>Windows VM Preparation Steps</h4>
                  <p>Windows VMs require additional preparation for virtio drivers:</p>
                  <UnorderedList>
                    {windowsPreparation.map((item, idx) => (
                      <ListItem key={idx}>{item}</ListItem>
                    ))}
                  </UnorderedList>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>Windows-Specific Considerations</h4>
                  <UnorderedList>
                    <ListItem>VSI presents boot disk as virtio SCSI but other volumes as virtio block devices</ListItem>
                    <ListItem>Red Hat virtio drivers support Windows Server 2008 R2 through 2025</ListItem>
                    <ListItem>Windows 7 through Windows 11 desktop versions supported</ListItem>
                    <ListItem>RHEL libguestfs lacks --block-driver virtio-scsi option</ListItem>
                    <ListItem>Ubuntu libguestfs supports virtio-scsi but lacks VDDK plugin</ListItem>
                  </UnorderedList>
                </Tile>
              </div>
            </AccordionItem>

            <AccordionItem title="Tools Reference">
              <div className="documentation-page__section">
                {tools.map((tool, idx) => (
                  <Tile key={idx} className="documentation-page__metric-card">
                    <h4>{tool.name}</h4>
                    <p>{tool.description}</p>
                    <div style={{ marginTop: '0.5rem' }}>
                      <strong>Example:</strong>
                      <CodeSnippet type="single" feedback="Copied!">
                        {tool.usage}
                      </CodeSnippet>
                    </div>
                  </Tile>
                ))}
              </div>
            </AccordionItem>

            <AccordionItem title="Limitations & Considerations">
              <div className="documentation-page__section">
                <Tile className="documentation-page__metric-card">
                  <h4>IBM Cloud VPC VSI Limitations</h4>
                  <div className="documentation-page__status-list">
                    {limitations.map((limit, idx) => (
                      <div key={idx} className="documentation-page__status-item">
                        <Tag type={limit.severity === 'error' ? 'red' : limit.severity === 'warning' ? 'magenta' : 'blue'}>
                          {limit.severity === 'error' ? 'Blocker' : limit.severity === 'warning' ? 'Warning' : 'Info'}
                        </Tag>
                        <span>{limit.item}</span>
                      </div>
                    ))}
                  </div>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>
                    <InformationFilled style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    Build Compatibility Notes
                  </h4>
                  <UnorderedList>
                    <ListItem><strong>RHEL libguestfs:</strong> Lacks --block-driver virtio-scsi option needed for boot disks</ListItem>
                    <ListItem><strong>Ubuntu libguestfs:</strong> Lacks VDDK plugin for direct vCenter extraction</ListItem>
                    <ListItem><strong>Ubuntu libguestfs:</strong> Lacks virt-v2v-in-place for in-situ transformations</ListItem>
                    <ListItem><strong>virtio-win:</strong> Only available from Red Hat repositories (subscription required)</ListItem>
                  </UnorderedList>
                </Tile>
              </div>
            </AccordionItem>
          </Accordion>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <Tile className="documentation-page__metric-card">
            <h4>Method Selection Guide</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Scenario</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Recommended Method</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e0e0e0', backgroundColor: '#d0e2ff' }}>
                  <td style={{ padding: '0.75rem' }}>Enterprise migration, automation needed</td>
                  <td style={{ padding: '0.75rem' }}><Tag type="green">RackWare RMM</Tag> <Tag type="cyan" size="sm">Recommended</Tag></td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e0e0e0', backgroundColor: '#d0e2ff' }}>
                  <td style={{ padding: '0.75rem' }}>Need to retain IP addresses</td>
                  <td style={{ padding: '0.75rem' }}><Tag type="green">RackWare RMM</Tag></td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e0e0e0', backgroundColor: '#d0e2ff' }}>
                  <td style={{ padding: '0.75rem' }}>VMs on isolated NSX overlay segments</td>
                  <td style={{ padding: '0.75rem' }}><Tag type="green">RackWare RMM</Tag> (with bridge server)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e0e0e0', backgroundColor: '#d0e2ff' }}>
                  <td style={{ padding: '0.75rem' }}>Minimal downtime required (delta sync)</td>
                  <td style={{ padding: '0.75rem' }}><Tag type="green">RackWare RMM</Tag></td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '0.75rem' }}>Single-disk VM, need reusable image</td>
                  <td style={{ padding: '0.75rem' }}><Tag type="teal">Image-Based Import</Tag></td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '0.75rem' }}>Multi-disk VM, complex configuration</td>
                  <td style={{ padding: '0.75rem' }}><Tag type="blue">Direct Volume Copy</Tag></td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '0.75rem' }}>Transit Gateway available, large VMs</td>
                  <td style={{ padding: '0.75rem' }}><Tag type="blue">ISO-Based Network Transfer</Tag></td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '0.75rem' }}>vCenter access, DIY automation</td>
                  <td style={{ padding: '0.75rem' }}><Tag type="purple">Direct VDDK Extraction</Tag></td>
                </tr>
                <tr>
                  <td style={{ padding: '0.75rem' }}>Windows VMs (manual approach)</td>
                  <td style={{ padding: '0.75rem' }}><Tag type="purple">Direct VDDK Extraction</Tag> or <Tag type="blue">Direct Volume Copy</Tag></td>
                </tr>
              </tbody>
            </table>
          </Tile>
        </Column>
      </Grid>
    </div>
  );
}
