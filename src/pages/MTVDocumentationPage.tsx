// MTV (Migration Toolkit for Virtualization) Documentation page
import { Grid, Column, Tile, Accordion, AccordionItem, UnorderedList, ListItem, Tag, OrderedList } from '@carbon/react';
import { CheckmarkFilled, WarningFilled, ErrorFilled, InformationFilled } from '@carbon/icons-react';
import { HW_VERSION_MINIMUM, HW_VERSION_RECOMMENDED, SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';
import './DocumentationPage.scss';

interface PreflightCheck {
  id: string;
  name: string;
  description: string;
  severity: 'blocker' | 'warning' | 'info';
  remediation: string;
  category: string;
}

const blockerChecks: PreflightCheck[] = [
  {
    id: 'tools-installed',
    name: 'VMware Tools Installed',
    description: 'VMware Tools must be installed for warm migration and guest customization',
    severity: 'blocker',
    remediation: 'Install VMware Tools via vCenter',
    category: 'Tools',
  },
  {
    id: 'old-snapshots',
    name: 'No Old Snapshots',
    description: `Snapshots older than ${SNAPSHOT_BLOCKER_AGE_DAYS} days must be consolidated before migration`,
    severity: 'blocker',
    remediation: 'Delete or consolidate old snapshots before migration',
    category: 'Storage',
  },
  {
    id: 'no-rdm',
    name: 'No Raw Device Mappings',
    description: 'RDM disks cannot be migrated directly and must be converted',
    severity: 'blocker',
    remediation: 'Convert RDM disks to VMDK before migration',
    category: 'Storage',
  },
  {
    id: 'no-shared-disks',
    name: 'No Shared/Multi-Writer Disks',
    description: 'Shared disks are not supported in OpenShift Virtualization',
    severity: 'blocker',
    remediation: 'Redesign shared disk architecture before migration',
    category: 'Storage',
  },
  {
    id: 'independent-disk',
    name: 'No Independent Disk Mode',
    description: 'Disks in independent mode (persistent or nonpersistent) cannot be transferred by MTV',
    severity: 'blocker',
    remediation: 'Change disk mode from Independent to Dependent before migration',
    category: 'Storage',
  },
  {
    id: 'no-pci-passthrough',
    name: 'No PCI/GPU Passthrough',
    description: 'PCI passthrough and GPU devices are not supported in OpenShift Virtualization',
    severity: 'blocker',
    remediation: 'Remove PCI passthrough devices; consider alternative solutions for GPU workloads',
    category: 'Hardware',
  },
];

const warningChecks: PreflightCheck[] = [
  {
    id: 'tools-running',
    name: 'VMware Tools Running',
    description: 'VMware Tools should be running for optimal migration',
    severity: 'warning',
    remediation: 'Start VMware Tools service in the guest OS',
    category: 'Tools',
  },
  {
    id: 'cbt-enabled',
    name: 'Changed Block Tracking (CBT)',
    description: 'CBT must be enabled for warm migration to track disk changes incrementally',
    severity: 'warning',
    remediation: 'Enable CBT in VM settings: Edit Settings > VM Options > Advanced > Changed Block Tracking',
    category: 'Storage',
  },
  {
    id: 'hw-version',
    name: 'Hardware Version Compatible',
    description: `VM hardware version ${HW_VERSION_MINIMUM} or later required (${HW_VERSION_RECOMMENDED}+ recommended)`,
    severity: 'warning',
    remediation: 'Upgrade VM hardware version in vCenter (requires VM shutdown)',
    category: 'Config',
  },
  {
    id: 'cd-disconnected',
    name: 'CD-ROM Disconnected',
    description: 'CD-ROM drives must be disconnected (no ISO mounted)',
    severity: 'warning',
    remediation: 'Disconnect CD-ROM drive in vCenter VM settings',
    category: 'Hardware',
  },
  {
    id: 'vm-name-rfc1123',
    name: 'VM Name RFC 1123 Compliant',
    description: 'VM names must be valid DNS subdomain names: lowercase, max 63 chars, alphanumeric and hyphens',
    severity: 'warning',
    remediation: 'Rename VM to a valid DNS name or configure a custom name during migration',
    category: 'Config',
  },
  {
    id: 'cpu-hot-plug',
    name: 'CPU Hot Plug Enabled',
    description: 'CPU hot add/remove is not supported in OpenShift Virtualization',
    severity: 'warning',
    remediation: 'Review CPU requirements; hot plug will be disabled post-migration',
    category: 'Config',
  },
  {
    id: 'memory-hot-plug',
    name: 'Memory Hot Plug Enabled',
    description: 'Memory hot add/remove is not supported in OpenShift Virtualization',
    severity: 'warning',
    remediation: 'Review memory requirements; hot plug will be disabled post-migration',
    category: 'Config',
  },
  {
    id: 'hostname-missing',
    name: 'Hostname Missing or Invalid',
    description: 'Guest hostname is empty, missing, or set to localhost which may cause issues',
    severity: 'warning',
    remediation: 'Configure a proper hostname in the guest OS before migration',
    category: 'Config',
  },
  {
    id: 'static-ip-powered-off',
    name: 'Static IP Requires Powered On',
    description: 'Static IP preservation requires VMware Tools running, which needs the VM powered on',
    severity: 'warning',
    remediation: 'Power on VM before migration if static IP preservation is required',
    category: 'Network',
  },
];

const workflowPhases = [
  {
    phase: 1,
    name: 'Analysis',
    description: 'Assess VMware environment compatibility and identify migration candidates',
    color: '#0f62fe',
    activities: [
      'Export data from RVTools',
      'Upload to RVTools Analyzer',
      'Review MTV pre-flight results',
      'Identify blockers and remediation steps',
      'Estimate sizing requirements',
      'Plan migration waves',
    ],
  },
  {
    phase: 2,
    name: 'Preparation',
    description: 'Resolve blockers and prepare VMs for migration',
    color: '#8a3ffc',
    activities: [
      'Consolidate or delete snapshots',
      'Disconnect CD-ROM drives',
      'Convert RDM disks to VMDK',
      'Install or update VMware Tools',
      'Upgrade hardware versions if needed',
      'Enable CBT for warm migration candidates',
      'Fix non-compliant VM names',
    ],
  },
  {
    phase: 3,
    name: 'Migration',
    description: 'Execute migration waves using MTV operator',
    color: '#198038',
    activities: [
      'Deploy MTV operator in OpenShift',
      'Configure VMware provider credentials',
      'Create network and storage mappings',
      'Define migration plans for each wave',
      'Execute warm or cold migrations',
      'Monitor migration progress and logs',
    ],
  },
  {
    phase: 4,
    name: 'Validation',
    description: 'Verify migrated VMs and complete cutover',
    color: '#fa4d56',
    activities: [
      'Verify VM functionality in OpenShift',
      'Test application connectivity',
      'Validate storage and network access',
      'Update DNS and load balancers',
      'Perform application testing',
      'Decommission source VMs',
    ],
  },
];

const migrationTypes = [
  {
    type: 'Cold Migration',
    description: 'VM is powered off during the entire migration process',
    useCase: 'VMs that can tolerate extended downtime',
    requirements: [
      'VM must be powered off',
      'No CBT requirement',
      'Simpler execution',
    ],
    downtime: 'Extended (hours)',
  },
  {
    type: 'Warm Migration',
    description: 'Initial disk copy while VM runs, brief cutover at the end',
    useCase: 'Production VMs requiring minimal downtime',
    requirements: [
      'VMware Tools installed and running',
      'CBT enabled on VM',
      'VM must be powered on during copy',
    ],
    downtime: 'Minimal (minutes)',
  },
];

const networkMappingOptions = [
  {
    option: 'pod',
    name: 'Pod Network',
    description: 'VM uses Kubernetes pod networking with NAT',
    useCase: 'Internal services, microservices architecture',
  },
  {
    option: 'multus',
    name: 'Multus Secondary Network',
    description: 'VM connects to external network via bridge or SR-IOV',
    useCase: 'VMs requiring direct network access, legacy applications',
  },
];

const storageMappingOptions = [
  {
    option: 'ocs-storagecluster-ceph-rbd',
    name: 'ODF Block (RBD)',
    description: 'OpenShift Data Foundation Ceph block storage',
    useCase: 'Most VM workloads, replicated storage',
  },
  {
    option: 'ocs-storagecluster-cephfs',
    name: 'ODF File (CephFS)',
    description: 'OpenShift Data Foundation Ceph filesystem',
    useCase: 'Shared filesystem access across multiple VMs',
  },
  {
    option: 'local-storage',
    name: 'Local Storage',
    description: 'Node-local storage (NVMe, SSD)',
    useCase: 'High performance, single-node access',
  },
];

export function MTVDocumentationPage() {
  return (
    <div className="documentation-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="documentation-page__title">Migration Toolkit for Virtualization (MTV)</h1>
          <p className="documentation-page__subtitle">
            Comprehensive guide to migrating VMware VMs to OpenShift Virtualization using MTV
          </p>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <Tile className="documentation-page__overview-tile">
            <h2>Overview</h2>
            <p>
              The Migration Toolkit for Virtualization (MTV) is a Red Hat operator that enables
              migration of virtual machines from VMware vSphere to OpenShift Virtualization.
              MTV supports both cold and warm migration strategies, allowing organizations to
              minimize downtime while modernizing their virtualization infrastructure.
            </p>
            <div style={{ marginTop: '1rem' }}>
              <Tag type="blue">MTV 2.6</Tag>
              <Tag type="green" style={{ marginLeft: '0.5rem' }}>OpenShift 4.14+</Tag>
              <Tag type="purple" style={{ marginLeft: '0.5rem' }}>VDDK 8.0</Tag>
            </div>
          </Tile>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <Accordion>
            {/* Migration Workflow */}
            <AccordionItem title="Migration Workflow Phases">
              <div className="documentation-page__section">
                {workflowPhases.map((phase) => (
                  <Tile key={phase.phase} className="documentation-page__metric-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: phase.color,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '1.25rem',
                      }}>
                        {phase.phase}
                      </div>
                      <div>
                        <h4 style={{ margin: 0 }}>{phase.name}</h4>
                        <p style={{ margin: 0, color: '#525252' }}>{phase.description}</p>
                      </div>
                    </div>
                    <UnorderedList>
                      {phase.activities.map((activity, idx) => (
                        <ListItem key={idx}>{activity}</ListItem>
                      ))}
                    </UnorderedList>
                  </Tile>
                ))}
              </div>
            </AccordionItem>

            {/* Pre-flight Checks - Blockers */}
            <AccordionItem title="Pre-Flight Checks: Blockers">
              <div className="documentation-page__section">
                <Tile className="documentation-page__metric-card">
                  <h4 style={{ color: '#da1e28' }}>
                    <ErrorFilled style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    Migration Blockers
                  </h4>
                  <p>These issues must be resolved before migration can proceed:</p>
                </Tile>

                {blockerChecks.map((check) => (
                  <Tile key={check.id} className="documentation-page__metric-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4>{check.name}</h4>
                      <div>
                        <Tag type="red">Blocker</Tag>
                        <Tag type="gray" style={{ marginLeft: '0.5rem' }}>{check.category}</Tag>
                      </div>
                    </div>
                    <p>{check.description}</p>
                    <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#f4f4f4', borderRadius: '4px' }}>
                      <strong>Remediation:</strong> {check.remediation}
                    </div>
                  </Tile>
                ))}
              </div>
            </AccordionItem>

            {/* Pre-flight Checks - Warnings */}
            <AccordionItem title="Pre-Flight Checks: Warnings">
              <div className="documentation-page__section">
                <Tile className="documentation-page__metric-card">
                  <h4 style={{ color: '#f1c21b' }}>
                    <WarningFilled style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    Migration Warnings
                  </h4>
                  <p>These issues should be addressed for optimal migration but are not blocking:</p>
                </Tile>

                {warningChecks.map((check) => (
                  <Tile key={check.id} className="documentation-page__metric-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4>{check.name}</h4>
                      <div>
                        <Tag type="magenta">Warning</Tag>
                        <Tag type="gray" style={{ marginLeft: '0.5rem' }}>{check.category}</Tag>
                      </div>
                    </div>
                    <p>{check.description}</p>
                    <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#f4f4f4', borderRadius: '4px' }}>
                      <strong>Remediation:</strong> {check.remediation}
                    </div>
                  </Tile>
                ))}
              </div>
            </AccordionItem>

            {/* Migration Types */}
            <AccordionItem title="Migration Types: Cold vs Warm">
              <div className="documentation-page__section">
                {migrationTypes.map((mig, idx) => (
                  <Tile key={idx} className="documentation-page__metric-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4>{mig.type}</h4>
                      <Tag type={mig.type === 'Warm Migration' ? 'green' : 'blue'}>
                        Downtime: {mig.downtime}
                      </Tag>
                    </div>
                    <p>{mig.description}</p>
                    <p style={{ marginTop: '0.5rem' }}><strong>Use Case:</strong> {mig.useCase}</p>
                    <div style={{ marginTop: '0.5rem' }}>
                      <strong>Requirements:</strong>
                      <UnorderedList>
                        {mig.requirements.map((req, ridx) => (
                          <ListItem key={ridx}>{req}</ListItem>
                        ))}
                      </UnorderedList>
                    </div>
                  </Tile>
                ))}

                <Tile className="documentation-page__metric-card">
                  <h4>
                    <InformationFilled style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    Warm Migration Process
                  </h4>
                  <OrderedList>
                    <ListItem><strong>Precopy:</strong> Initial full disk copy while VM runs (bulk data transfer)</ListItem>
                    <ListItem><strong>Incremental Copies:</strong> CBT-based delta sync captures changes since last copy</ListItem>
                    <ListItem><strong>Cutover:</strong> Final delta, VM shutdown, boot on target (brief downtime)</ListItem>
                  </OrderedList>
                </Tile>
              </div>
            </AccordionItem>

            {/* Network Mapping */}
            <AccordionItem title="Network Mapping Options">
              <div className="documentation-page__section">
                <Tile className="documentation-page__metric-card">
                  <h4>Network Configuration</h4>
                  <p>
                    MTV requires mapping VMware port groups to OpenShift network configurations.
                    Choose the appropriate network type based on your connectivity requirements.
                  </p>
                </Tile>

                {networkMappingOptions.map((opt, idx) => (
                  <Tile key={idx} className="documentation-page__metric-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4>{opt.name}</h4>
                      <Tag type="blue">{opt.option}</Tag>
                    </div>
                    <p>{opt.description}</p>
                    <p style={{ marginTop: '0.5rem' }}><strong>Best For:</strong> {opt.useCase}</p>
                  </Tile>
                ))}
              </div>
            </AccordionItem>

            {/* Storage Mapping */}
            <AccordionItem title="Storage Mapping Options">
              <div className="documentation-page__section">
                <Tile className="documentation-page__metric-card">
                  <h4>Storage Configuration</h4>
                  <p>
                    Map VMware datastores to OpenShift storage classes. The target storage class
                    determines performance characteristics and availability.
                  </p>
                </Tile>

                {storageMappingOptions.map((opt, idx) => (
                  <Tile key={idx} className="documentation-page__metric-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4>{opt.name}</h4>
                      <Tag type="purple">{opt.option}</Tag>
                    </div>
                    <p>{opt.description}</p>
                    <p style={{ marginTop: '0.5rem' }}><strong>Best For:</strong> {opt.useCase}</p>
                  </Tile>
                ))}
              </div>
            </AccordionItem>

            {/* MTV Components */}
            <AccordionItem title="MTV Architecture & Components">
              <div className="documentation-page__section">
                <Tile className="documentation-page__metric-card">
                  <h4>MTV Operator Components</h4>
                  <UnorderedList>
                    <ListItem><strong>forklift-controller:</strong> Main controller managing migration lifecycle</ListItem>
                    <ListItem><strong>forklift-validation:</strong> Validates migration plans and VM compatibility</ListItem>
                    <ListItem><strong>forklift-ui:</strong> Web console for migration management</ListItem>
                    <ListItem><strong>forklift-must-gather:</strong> Diagnostic data collection</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>MTV Custom Resources</h4>
                  <UnorderedList>
                    <ListItem><strong>Provider:</strong> Defines source (VMware) and destination (OpenShift) environments</ListItem>
                    <ListItem><strong>NetworkMap:</strong> Maps VMware port groups to OpenShift networks</ListItem>
                    <ListItem><strong>StorageMap:</strong> Maps VMware datastores to OpenShift storage classes</ListItem>
                    <ListItem><strong>Plan:</strong> Defines which VMs to migrate and how</ListItem>
                    <ListItem><strong>Migration:</strong> Executes a migration plan</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>VDDK (VMware Virtual Disk Development Kit)</h4>
                  <p>
                    MTV uses VDDK for efficient disk access and CBT-based incremental copies.
                    VDDK must be provided separately due to VMware licensing.
                  </p>
                  <UnorderedList>
                    <ListItem>Download VDDK from VMware (requires account)</ListItem>
                    <ListItem>Create a container image with VDDK libraries</ListItem>
                    <ListItem>Push to accessible registry</ListItem>
                    <ListItem>Configure MTV operator with VDDK image reference</ListItem>
                  </UnorderedList>
                </Tile>
              </div>
            </AccordionItem>

            {/* Best Practices */}
            <AccordionItem title="Best Practices">
              <div className="documentation-page__section">
                <Tile className="documentation-page__metric-card">
                  <h4>
                    <CheckmarkFilled style={{ marginRight: '0.5rem', verticalAlign: 'middle', color: '#24a148' }} />
                    Planning Best Practices
                  </h4>
                  <UnorderedList>
                    <ListItem>Start with pilot migrations (simple, non-critical VMs)</ListItem>
                    <ListItem>Group VMs by application or network for wave planning</ListItem>
                    <ListItem>Plan migration windows during low-usage periods</ListItem>
                    <ListItem>Document rollback procedures before starting</ListItem>
                    <ListItem>Test connectivity between VMware and OpenShift environments</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>
                    <CheckmarkFilled style={{ marginRight: '0.5rem', verticalAlign: 'middle', color: '#24a148' }} />
                    Execution Best Practices
                  </h4>
                  <UnorderedList>
                    <ListItem>Use warm migration for production workloads requiring minimal downtime</ListItem>
                    <ListItem>Monitor disk I/O during migration to avoid storage bottlenecks</ListItem>
                    <ListItem>Verify VMware Tools status before warm migration</ListItem>
                    <ListItem>Limit concurrent migrations based on network bandwidth</ListItem>
                    <ListItem>Keep source VMs available until validation is complete</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>
                    <CheckmarkFilled style={{ marginRight: '0.5rem', verticalAlign: 'middle', color: '#24a148' }} />
                    Post-Migration Best Practices
                  </h4>
                  <UnorderedList>
                    <ListItem>Verify all services are running correctly</ListItem>
                    <ListItem>Test application functionality end-to-end</ListItem>
                    <ListItem>Update monitoring and alerting for new environment</ListItem>
                    <ListItem>Document any configuration changes made</ListItem>
                    <ListItem>Retain source VMs for rollback period before decommissioning</ListItem>
                  </UnorderedList>
                </Tile>
              </div>
            </AccordionItem>

            {/* Resources */}
            <AccordionItem title="Additional Resources">
              <div className="documentation-page__section">
                <Tile className="documentation-page__metric-card">
                  <h4>Official Documentation</h4>
                  <UnorderedList>
                    <ListItem>
                      <a href="https://docs.openshift.com/container-platform/latest/virt/virtual_machines/importing_vms/virt-importing-vmware-vm.html" target="_blank" rel="noopener noreferrer">
                        OpenShift - Importing VMware VMs
                      </a>
                    </ListItem>
                    <ListItem>
                      <a href="https://access.redhat.com/documentation/en-us/migration_toolkit_for_virtualization/" target="_blank" rel="noopener noreferrer">
                        MTV Documentation (Red Hat)
                      </a>
                    </ListItem>
                    <ListItem>
                      <a href="https://docs.openshift.com/container-platform/latest/virt/about_virt/about-virt.html" target="_blank" rel="noopener noreferrer">
                        OpenShift Virtualization Overview
                      </a>
                    </ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>Training Resources</h4>
                  <UnorderedList>
                    <ListItem>
                      <a href="https://github.com/RedHatQuickCourses/architect-the-ocpvirt" target="_blank" rel="noopener noreferrer">
                        Red Hat Quick Course - Architect OpenShift Virtualization
                      </a>
                    </ListItem>
                    <ListItem>
                      <a href="https://github.com/RedHatQuickCourses/ocpvirt-migration" target="_blank" rel="noopener noreferrer">
                        Red Hat Quick Course - OpenShift Virtualization Migration
                      </a>
                    </ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="documentation-page__metric-card">
                  <h4>Compatibility References</h4>
                  <UnorderedList>
                    <ListItem>
                      <a href="https://access.redhat.com/articles/973163" target="_blank" rel="noopener noreferrer">
                        RHEL Life Cycle Dates
                      </a>
                    </ListItem>
                    <ListItem>
                      <a href="https://access.redhat.com/articles/6718611" target="_blank" rel="noopener noreferrer">
                        OpenShift Virtualization Supported Guest OS
                      </a>
                    </ListItem>
                    <ListItem>
                      <a href="https://lifecycle.vmware.com" target="_blank" rel="noopener noreferrer">
                        VMware Product Lifecycle
                      </a>
                    </ListItem>
                  </UnorderedList>
                </Tile>
              </div>
            </AccordionItem>
          </Accordion>
        </Column>
      </Grid>
    </div>
  );
}
