// Information page with sizing best practices and documentation
import { Grid, Column, Tile, Accordion, AccordionItem, Tag } from '@carbon/react';
import { RedHatDocLinksGroup } from '@/components/common';
import './InfoPage.scss';

export function InfoPage() {
  return (
    <div className="info-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="info-page__title">Sizing & Best Practices Guide</h1>
          <p className="info-page__subtitle">
            Reference documentation for OpenShift Virtualization and ODF storage sizing.
            Use the interactive calculator on the Migration → ROKS Sizing tab.
          </p>
        </Column>

        {/* OpenShift Virtualization Sizing */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="info-page__section-tile">
            <h2 className="info-page__section-title">OpenShift Virtualization Sizing</h2>
            <p className="info-page__description">
              OpenShift Virtualization requires bare metal worker nodes with hardware virtualization support (Intel VT-x/AMD-V).
              These guidelines are based on Red Hat's official recommendations.
            </p>

            <Accordion>
              <AccordionItem title="Hyperthreading (SMT)">
                <div className="info-page__accordion-content">
                  <h4>Simultaneous Multithreading Efficiency</h4>
                  <p>
                    Hyperthreading (Intel) or SMT (AMD) allows each physical core to run two threads simultaneously.
                    However, the second thread does <strong>not</strong> provide 100% additional performance.
                  </p>
                  <table className="info-page__table">
                    <thead>
                      <tr>
                        <th>Multiplier</th>
                        <th>Scenario</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><Tag type="green">1.15-1.20×</Tag></td>
                        <td>Compute-intensive</td>
                        <td>CPU-bound workloads see minimal benefit</td>
                      </tr>
                      <tr>
                        <td><Tag type="blue">1.25-1.30×</Tag></td>
                        <td>Mixed workloads (Default)</td>
                        <td>Intel's official claim is "up to 30%" improvement</td>
                      </tr>
                      <tr>
                        <td><Tag type="purple">1.40-1.50×</Tag></td>
                        <td>I/O-heavy</td>
                        <td>Workloads with idle time see best results</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="info-page__callout info-page__callout--info">
                    <strong>Formula:</strong> Effective cores = Physical cores × HT multiplier × CPU overcommit ratio
                  </div>
                  <p className="info-page__note">
                    <strong>Example:</strong> 48 cores × 1.25 HT × 1.8 overcommit = 108 effective vCPU capacity per node
                  </p>
                </div>
              </AccordionItem>

              <AccordionItem title="CPU Overcommitment">
                <div className="info-page__accordion-content">
                  <h4>Recommended Ratios</h4>
                  <table className="info-page__table">
                    <thead>
                      <tr>
                        <th>Ratio</th>
                        <th>Use Case</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><Tag type="green">4:1</Tag></td>
                        <td>Conservative</td>
                        <td>Industry standard for production workloads requiring consistent performance</td>
                      </tr>
                      <tr>
                        <td><Tag type="blue">5:1</Tag></td>
                        <td>Standard (Recommended)</td>
                        <td>Red Hat KVM safe ratio for workloads under 100% utilization</td>
                      </tr>
                      <tr>
                        <td><Tag type="purple">10:1</Tag></td>
                        <td>Maximum</td>
                        <td>OpenShift Virtualization default; not recommended beyond this</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="info-page__callout info-page__callout--info">
                    <strong>Red Hat guidance:</strong> "KVM should safely support guest VMs with loads under 100% at a ratio
                    of five vCPUs to one physical CPU." Do not exceed 10:1 total allocated vCPUs per physical core.
                  </div>
                  <p className="info-page__note">
                    <strong>Note:</strong> CPU overcommitment is expected as most VMs don't use all their allocated CPU resources at all times.
                    The actual safe ratio depends on your workload characteristics and requires testing before production deployment.
                  </p>
                </div>
              </AccordionItem>

              <AccordionItem title="Memory Allocation">
                <div className="info-page__accordion-content">
                  <h4>Key Principle: No Memory Overcommitment</h4>
                  <p>
                    Red Hat does <strong>not recommend memory overcommitment</strong> for virtual machines.
                    Unlike CPU, memory cannot be "shared" effectively - when a VM needs memory, it needs it immediately.
                  </p>
                  <div className="info-page__callout info-page__callout--warning">
                    <strong>Memory is the leading sizing factor</strong> for OpenShift Virtualization clusters.
                    Plan your cluster size based on total VM memory requirements.
                  </div>
                  <p className="info-page__note">
                    <strong>Note:</strong> See the Infrastructure Reservations section below for details on how much memory
                    is reserved for OpenShift system processes and ODF/Ceph daemons.
                  </p>
                </div>
              </AccordionItem>

              <AccordionItem title="Infrastructure Reservations">
                <div className="info-page__accordion-content">
                  <h4>Why Reservations Matter</h4>
                  <p>
                    OpenShift worker nodes require CPU and memory resources for infrastructure components.
                    These resources are <strong>not available for VM workloads</strong> and must be subtracted
                    from the node's total capacity when sizing.
                  </p>

                  <h4>OpenShift System Reserved</h4>
                  <p>
                    The <code>systemReserved</code> kubelet setting reserves resources for node-level system daemons:
                  </p>
                  <ul>
                    <li><strong>kubelet</strong> - Node agent managing pods</li>
                    <li><strong>cri-o</strong> - Container runtime</li>
                    <li><strong>NetworkManager, sshd</strong> - System services</li>
                    <li><strong>Monitoring agents</strong> - Prometheus node exporter, etc.</li>
                  </ul>
                  <table className="info-page__table">
                    <thead>
                      <tr>
                        <th>Resource</th>
                        <th>Recommended</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>CPU</td>
                        <td><Tag type="blue">~1 core</Tag></td>
                        <td>500m minimum, scales with node size</td>
                      </tr>
                      <tr>
                        <td>Memory</td>
                        <td><Tag type="blue">~4 GiB</Tag></td>
                        <td>Varies by workload density</td>
                      </tr>
                    </tbody>
                  </table>

                  <h4>ODF/Ceph Reserved</h4>
                  <p>
                    OpenShift Data Foundation runs Ceph storage daemons on each worker node.
                    Resources scale with the number of storage devices (OSDs):
                  </p>
                  <table className="info-page__table">
                    <thead>
                      <tr>
                        <th>Component</th>
                        <th>CPU</th>
                        <th>Memory</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>ODF Base (per node)</td>
                        <td>~5 cores</td>
                        <td>~21 GiB</td>
                        <td>MON, MGR, MDS daemons (cluster total ÷ 3)</td>
                      </tr>
                      <tr>
                        <td>Per NVMe Device (OSD)</td>
                        <td>+2 cores</td>
                        <td>+5 GiB</td>
                        <td>Each storage device runs an OSD daemon</td>
                      </tr>
                    </tbody>
                  </table>

                  <h4>Total Reservation Formula</h4>
                  <div className="info-page__formula-block">
                    <div className="info-page__formula">
                      <code>Reserved CPU = System (1) + ODF Base (5) + (NVMe Devices × 2)</code>
                    </div>
                    <div className="info-page__formula">
                      <code>Reserved Memory = System (4) + ODF Base (21) + (NVMe Devices × 5)</code>
                    </div>
                  </div>

                  <h4>Example: bx2d.metal.96x384 (8 NVMe)</h4>
                  <table className="info-page__table">
                    <thead>
                      <tr>
                        <th>Resource</th>
                        <th>Total</th>
                        <th>Reserved</th>
                        <th>Available for VMs</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Physical Cores</td>
                        <td>48</td>
                        <td>22 (1+5+16)</td>
                        <td><strong>26 cores</strong></td>
                      </tr>
                      <tr>
                        <td>Memory</td>
                        <td>384 GiB</td>
                        <td>65 GiB (4+21+40)</td>
                        <td><strong>319 GiB</strong></td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="info-page__callout info-page__callout--info">
                    <strong>Sizing Calculator:</strong> The interactive calculator automatically computes these
                    reservations based on the selected bare metal profile and number of NVMe devices.
                  </div>
                </div>
              </AccordionItem>

              <AccordionItem title="Bare Metal Node Requirements">
                <div className="info-page__accordion-content">
                  <h4>Recommended IBM Cloud Bare Metal Profile</h4>
                  <table className="info-page__table">
                    <thead>
                      <tr>
                        <th>Profile</th>
                        <th>Cores</th>
                        <th>Threads</th>
                        <th>Memory</th>
                        <th>NVMe Storage</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>bx2d.metal.96x384</strong></td>
                        <td>48</td>
                        <td>96</td>
                        <td>384 GiB</td>
                        <td>8x 3.2 TiB NVMe</td>
                      </tr>
                      <tr>
                        <td>bx2d.metal.192x768</td>
                        <td>96</td>
                        <td>192</td>
                        <td>768 GiB</td>
                        <td>8x 3.2 TiB NVMe</td>
                      </tr>
                      <tr>
                        <td>mx2d.metal.96x768</td>
                        <td>48</td>
                        <td>96</td>
                        <td>768 GiB</td>
                        <td>8x 3.2 TiB NVMe</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="info-page__note">
                    The 'd' suffix indicates NVMe local storage, required for ODF deployment.
                  </p>
                </div>
              </AccordionItem>

              <AccordionItem title="N+2 Redundancy">
                <div className="info-page__accordion-content">
                  <h4>Why N+2?</h4>
                  <p>
                    The N+2 model ensures your cluster can handle:
                  </p>
                  <ul>
                    <li><strong>Planned maintenance:</strong> One node can be cordoned for updates</li>
                    <li><strong>Unexpected failure:</strong> One node can fail without service impact</li>
                    <li><strong>ODF rebalancing:</strong> Sufficient capacity for data redistribution</li>
                  </ul>
                  <div className="info-page__formula">
                    <code>Total Nodes = max(Nodes for CPU, Nodes for Memory, Nodes for Storage) + 2</code>
                  </div>
                </div>
              </AccordionItem>
            </Accordion>
          </Tile>
        </Column>

        {/* ODF Storage Sizing */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="info-page__section-tile">
            <h2 className="info-page__section-title">ODF Storage Sizing (Ceph)</h2>
            <p className="info-page__description">
              OpenShift Data Foundation (ODF) provides software-defined storage using Ceph on local NVMe drives.
              Understanding the storage efficiency calculations is critical for proper sizing.
            </p>

            <Accordion>
              <AccordionItem title="Storage Efficiency Formula">
                <div className="info-page__accordion-content">
                  <h4>Usable Storage Calculation</h4>
                  <div className="info-page__formula-block">
                    <div className="info-page__formula">
                      <code>Usable Storage = Raw Storage × Efficiency Factor</code>
                    </div>
                    <div className="info-page__formula">
                      <code>Efficiency Factor = (1 / Replica Factor) × Operational Capacity × (1 - Ceph Overhead)</code>
                    </div>
                    <div className="info-page__formula">
                      <code>Efficiency Factor = (1/3) × 0.75 × 0.85 ≈ <strong>21.25%</strong></code>
                    </div>
                  </div>
                  <p>This means for every 100 TiB of raw NVMe storage, approximately 21 TiB is usable for VM data.</p>
                </div>
              </AccordionItem>

              <AccordionItem title="3x Replication">
                <div className="info-page__accordion-content">
                  <h4>Data Protection Strategy</h4>
                  <p>
                    ODF uses <strong>3-way mirroring</strong> by default, meaning every piece of data is stored on 3 different OSDs (Object Storage Daemons).
                  </p>
                  <table className="info-page__table">
                    <thead>
                      <tr>
                        <th>Aspect</th>
                        <th>Value</th>
                        <th>Impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Replica Count</td>
                        <td>3</td>
                        <td>33.3% storage efficiency</td>
                      </tr>
                      <tr>
                        <td>Min Replicas for Read</td>
                        <td>1</td>
                        <td>High availability</td>
                      </tr>
                      <tr>
                        <td>Min Replicas for Write</td>
                        <td>2</td>
                        <td>Data durability</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="info-page__callout info-page__callout--info">
                    <strong>Alternative:</strong> Erasure Coding (EC 4+2) can provide ~60% efficiency but is better suited for larger,
                    less frequently accessed data. For VM workloads, replication is recommended.
                  </div>
                </div>
              </AccordionItem>

              <AccordionItem title="75% Operational Capacity">
                <div className="info-page__accordion-content">
                  <h4>Why Not Use 100%?</h4>
                  <p>
                    Ceph requires headroom for critical operations:
                  </p>
                  <ul>
                    <li><strong>Rebalancing:</strong> When nodes are added/removed, data must redistribute</li>
                    <li><strong>Recovery:</strong> When a disk fails, data must be rebuilt on remaining disks</li>
                    <li><strong>Performance:</strong> Heavily loaded OSDs have degraded performance</li>
                  </ul>
                  <table className="info-page__table">
                    <thead>
                      <tr>
                        <th>Threshold</th>
                        <th>Level</th>
                        <th>Behavior</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>75%</td>
                        <td><Tag type="green">Target</Tag></td>
                        <td>Normal operation with headroom</td>
                      </tr>
                      <tr>
                        <td>85%</td>
                        <td><Tag type="magenta">Near Full</Tag></td>
                        <td>Warnings, new writes may be throttled</td>
                      </tr>
                      <tr>
                        <td>95%</td>
                        <td><Tag type="red">Full</Tag></td>
                        <td>Writes blocked, immediate action required</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </AccordionItem>

              <AccordionItem title="~15% Ceph Overhead">
                <div className="info-page__accordion-content">
                  <h4>What Consumes the Overhead?</h4>
                  <ul>
                    <li><strong>BlueStore DB:</strong> RocksDB metadata storage</li>
                    <li><strong>BlueStore WAL:</strong> Write-ahead logging</li>
                    <li><strong>Object metadata:</strong> RADOS object attributes</li>
                    <li><strong>Filesystem overhead:</strong> Block allocation tables</li>
                    <li><strong>OSD journal:</strong> Transaction logging</li>
                  </ul>
                  <p className="info-page__note">
                    The actual overhead varies from 10-20% depending on workload characteristics and object sizes.
                    15% is a conservative estimate for VM workloads.
                  </p>
                </div>
              </AccordionItem>

              <AccordionItem title="Inverse Formula (Sizing)">
                <div className="info-page__accordion-content">
                  <h4>Calculating Required Raw Storage</h4>
                  <p>When sizing a cluster, you know how much <em>usable</em> storage you need. Use this formula to calculate raw NVMe required:</p>
                  <div className="info-page__formula-block">
                    <div className="info-page__formula">
                      <code>Required Raw = Usable × Replica Factor ÷ Operational Capacity ÷ (1 - Overhead)</code>
                    </div>
                    <div className="info-page__formula">
                      <code>Required Raw = Usable × 3 ÷ 0.75 ÷ 0.85</code>
                    </div>
                    <div className="info-page__formula">
                      <code>Required Raw ≈ Usable × <strong>4.71</strong></code>
                    </div>
                  </div>
                  <h4>Example</h4>
                  <p>For 100 TiB of usable VM storage:</p>
                  <ul>
                    <li>Required Raw NVMe: 100 × 4.71 = <strong>471 TiB</strong></li>
                    <li>Using bx2d.metal.96x384 (25 TiB/node): 471 ÷ 25 = <strong>19 nodes</strong> (minimum)</li>
                    <li>With N+2 redundancy: <strong>21 nodes</strong></li>
                  </ul>
                </div>
              </AccordionItem>
            </Accordion>
          </Tile>
        </Column>

        {/* Quick Reference */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="info-page__reference-tile">
            <h3>Quick Reference: Sizing Factors</h3>
            <table className="info-page__table info-page__table--compact">
              <tbody>
                <tr>
                  <td>Hyperthreading Multiplier</td>
                  <td><strong>1.25× (typical)</strong></td>
                </tr>
                <tr>
                  <td>CPU Overcommit (Standard)</td>
                  <td><strong>5:1</strong></td>
                </tr>
                <tr>
                  <td>Memory Overcommit</td>
                  <td><strong>1:1 (None)</strong></td>
                </tr>
                <tr>
                  <td>ODF Replica Factor</td>
                  <td><strong>3×</strong></td>
                </tr>
                <tr>
                  <td>Operational Capacity</td>
                  <td><strong>75%</strong></td>
                </tr>
                <tr>
                  <td>Ceph Overhead</td>
                  <td><strong>~15%</strong></td>
                </tr>
                <tr>
                  <td>Effective Storage Efficiency</td>
                  <td><strong>~21.25%</strong></td>
                </tr>
                <tr>
                  <td>Node Redundancy</td>
                  <td><strong>N+2</strong></td>
                </tr>
                <tr>
                  <td>Infrastructure Reserved CPU</td>
                  <td><strong>~22 cores/node*</strong></td>
                </tr>
                <tr>
                  <td>Infrastructure Reserved Memory</td>
                  <td><strong>~65 GiB/node*</strong></td>
                </tr>
              </tbody>
            </table>
            <p className="info-page__note" style={{ marginTop: '0.5rem', fontSize: '0.7rem' }}>
              *Based on 8 NVMe devices. Formula: System + ODF base + (devices × per-device overhead)
            </p>
          </Tile>
        </Column>

        <Column lg={8} md={8} sm={4}>
          <Tile className="info-page__reference-tile">
            <h3>Sizing Decision Tree</h3>
            <ol className="info-page__decision-tree">
              <li><strong>CPU:</strong> Total vCPUs ÷ (cores × HT × overcommit) → nodes</li>
              <li><strong>Memory:</strong> Total GiB ÷ (node RAM - 12 reserved) → nodes</li>
              <li><strong>Storage:</strong> Total GiB ÷ usable per node → nodes</li>
              <li>Take the <strong>maximum</strong> of the three (min 3)</li>
              <li>Add <strong>+2</strong> for N+2 redundancy</li>
              <li>Result: Recommended bare metal node count</li>
            </ol>
            <p className="info-page__note" style={{ marginTop: '1rem' }}>
              <strong>Example (bx2d.metal.96x384, 8 NVMe):</strong><br />
              CPU: (48 - 22 reserved) × 1.25 HT × 5.0 = 162 vCPU/node<br />
              Memory: (384 - 65 reserved) × 1.0 = 319 GiB/node<br />
              Storage: 25 TiB × 21.25% = 5.3 TiB/node
            </p>
          </Tile>
        </Column>

        {/* Documentation Links */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="info-page__docs-tile">
            <RedHatDocLinksGroup
              title="Reference Documentation"
              links={[
                {
                  href: 'https://developers.redhat.com/articles/2025/12/05/right-sizing-recommendations-openshift-virtualization',
                  label: 'Right-Sizing OpenShift Virtualization',
                  description: 'Red Hat Developer guide on VM resource optimization',
                },
                {
                  href: 'https://access.redhat.com/solutions/5843241',
                  label: 'System Reserved Resources',
                  description: 'CPU and memory reservation guidelines for OpenShift nodes',
                },
                {
                  href: 'https://developers.redhat.com/articles/2025/10/24/how-modify-system-reserved-parameters-openshift-nodes',
                  label: 'Modify System Reserved Parameters',
                  description: 'How to configure system-reserved CPU and memory on OpenShift nodes',
                },
                {
                  href: 'https://docs.redhat.com/en/documentation/red_hat_openshift_data_foundation/4.16/html/planning_your_deployment/infrastructure-requirements_rhodf',
                  label: 'ODF Infrastructure Requirements',
                  description: 'CPU, memory, and storage requirements for ODF deployment',
                },
                {
                  href: 'https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/7/html/virtualization_deployment_and_administration_guide/sect-overcommitting_with_kvm-overcommitting_virtualized_cpus',
                  label: 'KVM CPU Overcommitment',
                  description: 'Red Hat KVM guidance: 5:1 safe ratio, 10:1 maximum',
                },
                {
                  href: 'https://www.redhat.com/en/blog/capacity-management-overcommitment-best-practices-openshift',
                  label: 'Capacity Management Best Practices',
                  description: 'Overcommitment and capacity planning for OpenShift',
                },
                {
                  href: 'https://fullvalence.com/2025/09/25/openshift-virtualization-on-ibm-cloud-part-3-deploying-and-configuring-roks-odf-and-ocp-virt/',
                  label: 'OpenShift Virt on IBM Cloud',
                  description: 'Detailed guide for ROKS with ODF and OpenShift Virtualization',
                },
                {
                  href: 'https://docs.openshift.com/container-platform/latest/virt/about_virt/about-virt.html',
                  label: 'OpenShift Virtualization Docs',
                  description: 'Official Red Hat OpenShift Virtualization documentation',
                },
                {
                  href: 'https://access.redhat.com/documentation/en-us/red_hat_openshift_data_foundation',
                  label: 'ODF Documentation',
                  description: 'Red Hat OpenShift Data Foundation official docs',
                },
              ]}
              layout="horizontal"
            />
          </Tile>
        </Column>
      </Grid>
    </div>
  );
}
