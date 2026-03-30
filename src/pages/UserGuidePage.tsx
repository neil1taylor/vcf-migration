// User Guide page - Step-by-step instructions for using the application
import { Grid, Column, Tile, Accordion, AccordionItem, UnorderedList, ListItem, OrderedList, Tag, Link } from '@carbon/react';
import { ROUTES } from '@/utils/constants';
import { useNavigate } from 'react-router-dom';
import './UserGuidePage.scss';

export function UserGuidePage() {
  const navigate = useNavigate();

  return (
    <div className="user-guide-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="user-guide-page__title">User Guide</h1>
          <p className="user-guide-page__subtitle">
            Step-by-step instructions for using the VCF Migration Planning Tool
          </p>
        </Column>

        {/* Quick Start Section */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="user-guide-page__quick-start">
            <h2>Quick Start</h2>
            <p>Get started in 5 simple steps:</p>
            <OrderedList>
              <ListItem>
                <strong>Request RVTools Export</strong> - Ask your VMware administrator to generate an RVTools export from your vCenter
              </ListItem>
              <ListItem>
                <strong>Upload the Excel File</strong> - Drag and drop or browse to upload the <code>.xlsx</code> file on the{' '}
                <Link onClick={() => navigate(ROUTES.home)} style={{ cursor: 'pointer' }}>Upload page</Link>
              </ListItem>
              <ListItem>
                <strong>Review the Dashboard</strong> - Get an instant overview of your infrastructure including VMs, resources, and health metrics
              </ListItem>
              <ListItem>
                <strong>Run Migration Assessment</strong> - Navigate to ROKS Migration or VSI Migration to assess your workloads
              </ListItem>
              <ListItem>
                <strong>Export Reports</strong> - Generate PDF, Excel, or Word reports for planning and stakeholder communication
              </ListItem>
            </OrderedList>
          </Tile>
        </Column>

        {/* Main Content Accordion */}
        <Column lg={16} md={8} sm={4}>
          <Accordion>
            {/* Getting Started */}
            <AccordionItem title="1. Getting Started">
              <div className="user-guide-page__section">
                <Tile className="user-guide-page__card">
                  <h4>Prerequisites</h4>
                  <p>Before using this tool, you need:</p>
                  <UnorderedList>
                    <ListItem><strong>RVTools Export</strong> - An Excel file exported from your VMware vCenter environment</ListItem>
                    <ListItem><strong>Modern Web Browser</strong> - Chrome, Firefox, Edge, or Safari (latest versions recommended)</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Requesting RVTools Export</h4>
                  <p>RVTools is a free utility that exports VMware vSphere environment data to Excel. To request an export:</p>
                  <OrderedList>
                    <ListItem>Contact your VMware administrator</ListItem>
                    <ListItem>Request an RVTools export from your vCenter Server(s)</ListItem>
                    <ListItem>Ask for all sheets to be included (the tool uses 16+ different sheets)</ListItem>
                    <ListItem>The export should be in <code>.xlsx</code> format (Excel)</ListItem>
                  </OrderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Recommended RVTools Sheets</h4>
                  <p>For full analysis capabilities, ensure these sheets are included:</p>
                  <table className="user-guide-page__table">
                    <thead>
                      <tr>
                        <th>Sheet</th>
                        <th>Purpose</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td>vInfo</td><td>VM inventory and configuration (required — only mandatory sheet)</td></tr>
                      <tr><td>vCPU</td><td>CPU allocation and reservations</td></tr>
                      <tr><td>vMemory</td><td>Memory allocation details</td></tr>
                      <tr><td>vDisk</td><td>Virtual disk information (recommended — enables Storage page)</td></tr>
                      <tr><td>vNetwork</td><td>Network adapter configuration (recommended — enables Network pages)</td></tr>
                      <tr><td>vHost</td><td>ESXi host inventory (recommended — enables Hosts page)</td></tr>
                      <tr><td>vCluster</td><td>Cluster configuration (recommended — enables Clusters page)</td></tr>
                      <tr><td>vDatastore</td><td>Storage datastore info (recommended — enables Storage page)</td></tr>
                      <tr><td>vSnapshot</td><td>VM snapshot details</td></tr>
                      <tr><td>vTools</td><td>VMware Tools status</td></tr>
                    </tbody>
                  </table>
                </Tile>
              </div>
            </AccordionItem>

            {/* Importing Data */}
            <AccordionItem title="2. Importing Data">
              <div className="user-guide-page__section">
                <Tile className="user-guide-page__card">
                  <h4>Using the Upload Feature</h4>
                  <OrderedList>
                    <ListItem>Navigate to the <strong>Upload</strong> page (landing page)</ListItem>
                    <ListItem>Either <strong>drag and drop</strong> your RVTools Excel file onto the upload area, or <strong>click Browse</strong> to select the file</ListItem>
                    <ListItem>Wait for the file to be parsed (typically a few seconds)</ListItem>
                    <ListItem>Once complete, you'll be automatically redirected to the Dashboard</ListItem>
                  </OrderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Supported File Formats</h4>
                  <p>The tool auto-detects the file type based on sheet names. You can drop any supported file on the upload area.</p>
                  <table className="user-guide-page__table" style={{ marginTop: '0.5rem' }}>
                    <thead>
                      <tr>
                        <th>Format</th>
                        <th>Extensions</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td>RVTools Export</td><td><code>.xlsx</code>, <code>.xls</code></td><td>VMware vCenter inventory export (recommended)</td></tr>
                      <tr><td>vInventory Export</td><td><code>.xlsx</code>, <code>.xls</code></td><td>PowerShell-based VMware inventory (auto-detected and converted)</td></tr>
                      <tr><td>IBM Cloud Billing</td><td><code>.xls</code></td><td>IBM Cloud Classic billing report (optional, enhances Source BOM)</td></tr>
                    </tbody>
                  </table>
                  <p style={{ marginTop: '1rem' }}><strong>Maximum file size:</strong> 50 MB</p>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>IBM Cloud Billing Data (Optional)</h4>
                  <p>Upload your IBM Cloud Classic billing export to replace estimated Source BOM costs with actual invoiced amounts:</p>
                  <UnorderedList>
                    <ListItem><strong>Main drop zone</strong> — Drop a billing file after loading RVTools data and it will be auto-detected</ListItem>
                    <ListItem><strong>Source BOM tab</strong> — Navigate to Discovery &gt; Source BOM and click "Upload Billing File" in the banner</ListItem>
                  </UnorderedList>
                  <p style={{ marginTop: '0.5rem' }}>When billing data is loaded, matched ESXi hosts show <Tag type="green" size="sm">Actual</Tag> costs and unmatched RVTools hosts show <Tag type="gray" size="sm">Estimated</Tag> costs. The match rate is based on RVTools hosts (not total billing servers). Non-ESXi billing servers (backup vaults, gateways, firewalls) are shown as informational and their costs appear under Additional Costs. Additional categories (networking, OS, software) are surfaced as new line items.</p>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>What Data Is Extracted</h4>
                  <p>The tool parses and analyzes data from multiple RVTools sheets:</p>
                  <UnorderedList>
                    <ListItem><strong>Virtual Machine Inventory</strong> - Names, configurations, power states</ListItem>
                    <ListItem><strong>Resource Allocations</strong> - vCPU, memory, storage per VM</ListItem>
                    <ListItem><strong>Storage Details</strong> - Disk sizes, datastores, thin/thick provisioning</ListItem>
                    <ListItem><strong>Network Configuration</strong> - NICs, port groups, IP addresses</ListItem>
                    <ListItem><strong>Cluster Information</strong> - HA/DRS status, host counts</ListItem>
                    <ListItem><strong>Host Details</strong> - ESXi versions, hardware specs</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Troubleshooting Import Issues</h4>
                  <table className="user-guide-page__table">
                    <thead>
                      <tr>
                        <th>Issue</th>
                        <th>Solution</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td>File won't upload</td><td>Ensure file is .xlsx or .xls format</td></tr>
                      <tr><td>Parsing fails</td><td>Check that vInfo sheet exists and has data</td></tr>
                      <tr><td>Missing data</td><td>Verify RVTools export included all sheets</td></tr>
                      <tr><td>Slow parsing</td><td>Large files (50MB+) may need more time</td></tr>
                    </tbody>
                  </table>
                </Tile>
              </div>
            </AccordionItem>

            {/* Understanding the Dashboard */}
            <AccordionItem title="3. Understanding the Dashboard">
              <div className="user-guide-page__section">
                <Tile className="user-guide-page__card">
                  <h4>Key Metrics</h4>
                  <table className="user-guide-page__table">
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td>Total VMs</td><td>Full RVTools inventory count, with migration scope shown as detail line</td></tr>
                      <tr><td>Total vCPUs</td><td>Sum of all allocated virtual CPUs</td></tr>
                      <tr><td>Total Memory</td><td>Aggregate memory allocated to VMs</td></tr>
                      <tr><td>Provisioned Storage</td><td>Total storage capacity allocated</td></tr>
                      <tr><td>In Use Storage</td><td>Actual storage consumed</td></tr>
                    </tbody>
                  </table>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Power State Distribution</h4>
                  <p>A donut chart showing VMs by power state:</p>
                  <div className="user-guide-page__status-list">
                    <div className="user-guide-page__status-item">
                      <Tag type="green">Powered On</Tag>
                      <span>Running VMs</span>
                    </div>
                    <div className="user-guide-page__status-item">
                      <Tag type="gray">Powered Off</Tag>
                      <span>Stopped VMs</span>
                    </div>
                    <div className="user-guide-page__status-item">
                      <Tag type="high-contrast">Suspended</Tag>
                      <span>Paused VMs</span>
                    </div>
                  </div>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Interactive Features</h4>
                  <UnorderedList>
                    <ListItem><strong>Click on chart segments</strong> to filter the view</ListItem>
                    <ListItem><strong>Hover over data points</strong> for detailed tooltips</ListItem>
                    <ListItem><strong>Export buttons</strong> for generating reports</ListItem>
                  </UnorderedList>
                </Tile>
              </div>
            </AccordionItem>

            {/* Infrastructure Analysis */}
            <AccordionItem title="4. Infrastructure Analysis">
              <div className="user-guide-page__section">
                <Tile className="user-guide-page__card">
                  <h4>Compute Page</h4>
                  <p>Analyze CPU and memory allocations across your environment.</p>
                  <UnorderedList>
                    <ListItem>vCPU distribution histogram (1-2, 3-4, 5-8, 9-16, 17-32, 33+ cores)</ListItem>
                    <ListItem>Memory distribution by size ranges</ListItem>
                    <ListItem>Top consumers by vCPU and memory</ListItem>
                    <ListItem>CPU/Memory overcommitment ratios</ListItem>
                  </UnorderedList>
                  <p style={{ marginTop: '0.5rem' }}><strong>Use Cases:</strong> Identify oversized VMs, find right-sizing opportunities</p>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Storage Page</h4>
                  <p>Understand storage utilization and capacity.</p>
                  <UnorderedList>
                    <ListItem>Datastore utilization with capacity/used/free breakdown</ListItem>
                    <ListItem>High utilization warnings (&gt;80% yellow, &gt;90% red)</ListItem>
                    <ListItem>Click on a datastore to see associated VMs</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Network Page</h4>
                  <p>Analyze network configuration and topology.</p>
                  <UnorderedList>
                    <ListItem>NIC count and type distribution (VMXNET3, E1000, etc.)</ListItem>
                    <ListItem>Port group summary with VM counts</ListItem>
                    <ListItem>Subnet detection (auto-guessed from IP addresses)</ListItem>
                    <ListItem><strong>Editable subnet column</strong> - Click to manually correct subnet CIDRs</ListItem>
                    <ListItem>Network topology visualization</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Clusters Page</h4>
                  <p>Review cluster health and configuration.</p>
                  <UnorderedList>
                    <ListItem>HA (High Availability) and DRS status per cluster</ListItem>
                    <ListItem>Host counts and effective resources</ListItem>
                    <ListItem>CPU/Memory overcommitment ratios</ListItem>
                    <ListItem>Click on a cluster to see its VMs</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Hosts Page</h4>
                  <p>Inventory of physical ESXi hosts with hardware specifications, ESXi versions, and host-to-VM mapping.</p>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Resource Pools Page</h4>
                  <p>View resource pool hierarchy, CPU/memory reservations, limits, and VM assignments.</p>
                </Tile>
              </div>
            </AccordionItem>

            {/* Workload Discovery */}
            <AccordionItem title="5. Workload Discovery">
              <div className="user-guide-page__section">
                <Tile className="user-guide-page__card">
                  <h4>Automatic Detection</h4>
                  <p>The Workload Discovery page automatically categorizes VMs based on naming patterns and configurations.</p>
                  <table className="user-guide-page__table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Examples</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td>Databases</td><td>Oracle, SQL Server, MySQL, PostgreSQL, MongoDB</td></tr>
                      <tr><td>Middleware</td><td>WebSphere, JBoss, Tomcat, WebLogic</td></tr>
                      <tr><td>Web Servers</td><td>Apache, IIS, Nginx</td></tr>
                      <tr><td>Enterprise Apps</td><td>SAP, Citrix, Exchange</td></tr>
                      <tr><td>Infrastructure</td><td>DNS, DHCP, Active Directory</td></tr>
                    </tbody>
                  </table>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Tabs Overview</h4>
                  <UnorderedList>
                    <ListItem><strong>Infrastructure</strong> - Source data center selector, target IBM Cloud MZR dropdown, environment summary (vCenter, clusters, hosts, datastores)</ListItem>
                    <ListItem><strong>Workload</strong> - VM workload classification with auto-detection and manual overrides</ListItem>
                    <ListItem><strong>Networks</strong> - Port group and subnet mapping from vNetwork data</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Target MZR Selection</h4>
                  <p>The Infrastructure tab includes a <strong>Target IBM Cloud MZR</strong> dropdown that auto-selects the nearest multi-zone region based on the source data center.</p>
                  <UnorderedList>
                    <ListItem>Auto-populated when you select a source data center (e.g. LON04 selects eu-gb)</ListItem>
                    <ListItem>Shows &quot;Choose&quot; placeholder when source is on-premise</ListItem>
                    <ListItem>Can be manually overridden to any MZR regardless of source</ListItem>
                    <ListItem>Changing the source data center re-auto-selects the Target MZR</ListItem>
                  </UnorderedList>
                </Tile>
              </div>
            </AccordionItem>

            {/* VM Management */}
            <AccordionItem title="6. VM Management">
              <div className="user-guide-page__section">
                <Tile className="user-guide-page__card">
                  <h4>Exclude/Include VMs</h4>
                  <p>Customize which VMs are included in migration analysis:</p>
                  <OrderedList>
                    <ListItem>Navigate to <strong>Workload Discovery</strong> &gt; <strong>VMs</strong> tab</ListItem>
                    <ListItem>Find the VM in the table</ListItem>
                    <ListItem>Click the <strong>Exclude</strong> button to remove from migration scope</ListItem>
                    <ListItem>Excluded VMs show a strikethrough and "Excluded" tag</ListItem>
                    <ListItem>Click <strong>Include</strong> to add back to migration scope</ListItem>
                  </OrderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Bulk Operations</h4>
                  <OrderedList>
                    <ListItem>Use checkboxes to select multiple VMs</ListItem>
                    <ListItem>Click <strong>Exclude Selected</strong> or <strong>Include Selected</strong> in the toolbar</ListItem>
                    <ListItem>All selected VMs are updated at once</ListItem>
                  </OrderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Override Workload Types</h4>
                  <OrderedList>
                    <ListItem>Click the workload type dropdown for any VM</ListItem>
                    <ListItem>Select from predefined categories or type a custom value</ListItem>
                    <ListItem>Custom workload types appear in the "Custom" tab</ListItem>
                  </OrderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>VM Options (Storage IOPS, Burstable, GPU, etc.)</h4>
                  <p>The <strong>Options</strong> column shows per-VM settings. Click the settings icon to open a popover with all options:</p>
                  <UnorderedList>
                    <ListItem><strong>Profile</strong> — Standard or Burstable (shared CPU)</ListItem>
                    <ListItem><strong>Storage</strong> — Block (persistent) or NVMe (ephemeral, fast I/O)</ListItem>
                    <ListItem><strong>GPU / Bandwidth</strong> — Flag VMs requiring GPU or high bandwidth profiles</ListItem>
                    <ListItem><strong>Boot IOPS</strong> — Storage tier for boot volumes (Standard by default)</ListItem>
                    <ListItem><strong>Data IOPS</strong> — Storage tier for data volumes (auto-detected from workload, overrideable)</ListItem>
                  </UnorderedList>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                    <strong>Storage IOPS Tiers:</strong> Standard (3 IOPS/GB · 500 IOPS) | Performance (5 IOPS/GB · 1,000 IOPS) | High Performance (10 IOPS/GB · 3,000 IOPS).
                    Used for non-ODF solutions and VPC VSI. ODF solutions ignore these settings. VPC VSI boot is always Standard.
                  </p>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Persistence &amp; Export</h4>
                  <p>All VM customizations are saved to browser localStorage and persist across sessions.</p>
                  <UnorderedList>
                    <ListItem><strong>Export Settings</strong> - Download all overrides as JSON</ListItem>
                    <ListItem><strong>Import Settings</strong> - Load previously exported settings</ListItem>
                  </UnorderedList>
                </Tile>
              </div>
            </AccordionItem>

            {/* Risk Assessment */}
            <AccordionItem title="7. Risk Assessment">
              <div className="user-guide-page__section">
                <Tile className="user-guide-page__card">
                  <h4>Overview</h4>
                  <p>Review and manage migration risks in a flat table with traffic light status. Navigate to <strong>Migration Review</strong> &gt; <strong>Risk Assessment</strong> tab.</p>
                  <table className="user-guide-page__table">
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td>Auto-detected</td><td>Generated from your data (blockers, complexity, cost, OS compatibility, scale, licenses)</td></tr>
                      <tr><td>Curated defaults</td><td>13 common migration risks across 6 categories</td></tr>
                      <tr><td>User-added</td><td>Custom risks you add via &quot;Add Risk&quot;</td></tr>
                    </tbody>
                  </table>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Editing Risks</h4>
                  <p>All cells in the risk table are editable — click any cell to modify it inline:</p>
                  <UnorderedList>
                    <ListItem><strong>Category</strong> — Click to select from 6 risk categories via dropdown</ListItem>
                    <ListItem><strong>Description, Impact Area, Evidence</strong> — Click to open an inline text editor</ListItem>
                    <ListItem><strong>Status</strong> — Use the dropdown to set Red, Amber, or Green</ListItem>
                    <ListItem><strong>Mitigation Plan</strong> — Click to edit inline</ListItem>
                  </UnorderedList>
                  <p>All edits persist in localStorage across sessions.</p>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Managing Risks</h4>
                  <UnorderedList>
                    <ListItem><strong>Add Risk</strong> — Click the button in the toolbar to add a custom risk row</ListItem>
                    <ListItem><strong>Delete</strong> — Click the trash icon on any row to remove it</ListItem>
                    <ListItem><strong>Filter</strong> — Use the category dropdown to filter by risk category</ListItem>
                    <ListItem><strong>Reset All</strong> — Clear all overrides and restore deleted rows to defaults</ListItem>
                  </UnorderedList>
                </Tile>
              </div>
            </AccordionItem>

            {/* Migration Timeline */}
            <AccordionItem title="8. Migration Timeline">
              <div className="user-guide-page__section">
                <Tile className="user-guide-page__card">
                  <h4>Overview</h4>
                  <p>Plan and visualize the migration schedule with an interactive Gantt chart. Navigate to <strong>Assess</strong> &gt; <strong>Migration Timeline</strong>.</p>
                  <table className="user-guide-page__table">
                    <thead>
                      <tr>
                        <th>Phase Type</th>
                        <th>Default Duration</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td>Preparation</td><td>2 weeks</td><td>Environment setup and planning</td></tr>
                      <tr><td>Pilot</td><td>2 weeks</td><td>Pilot wave migration and validation</td></tr>
                      <tr><td>Production Wave N</td><td>2 weeks each</td><td>One phase per migration wave</td></tr>
                      <tr><td>Validation</td><td>1 week</td><td>Post-migration verification</td></tr>
                      <tr><td>Buffer</td><td>1 week</td><td>Contingency time</td></tr>
                    </tbody>
                  </table>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Customizing the Timeline</h4>
                  <OrderedList>
                    <ListItem>Adjust phase durations using the number inputs in the phase table (minimum 1 week)</ListItem>
                    <ListItem>Set a start date to calculate projected end dates</ListItem>
                    <ListItem>Click &quot;Reset to Defaults&quot; to restore original durations</ListItem>
                  </OrderedList>
                </Tile>
              </div>
            </AccordionItem>

            {/* Network Design */}
            <AccordionItem title="9. Network Design">
              <div className="user-guide-page__section">
                <Tile className="user-guide-page__card">
                  <h4>Overview</h4>
                  <p>Map your VMware network topology to an IBM Cloud VPC design. Navigate to <strong>Migration Assessment</strong> &gt; <strong>VSI Migration</strong> and select the <strong>Network Design</strong> tab.</p>
                  <p>The page automatically:</p>
                  <OrderedList>
                    <ListItem>Extracts port groups from your RVTools vNetwork data</ListItem>
                    <ListItem>Maps each port group to a VPC subnet</ListItem>
                    <ListItem>Distributes subnets across 3 availability zones</ListItem>
                    <ListItem>Generates security groups based on workload classifications</ListItem>
                    <ListItem>Creates ACL suggestions for each subnet</ListItem>
                  </OrderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Tabs</h4>
                  <UnorderedList>
                    <ListItem><strong>Subnets</strong> - Editable table with subnet name, CIDR, zone, VM count, security group</ListItem>
                    <ListItem><strong>Security Groups</strong> - Inbound/outbound rules organized by workload type</ListItem>
                    <ListItem><strong>ACLs</strong> - Read-only ACL suggestions per subnet</ListItem>
                    <ListItem><strong>Transit Gateway</strong> - Toggle on/off and select connection type</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>VPC Topology Diagram</h4>
                  <p>Interactive D3 visualization showing region, VPC, zone columns, and subnets color-coded by workload type. Hover over subnets for VM count and CIDR details.</p>
                </Tile>
              </div>
            </AccordionItem>

            {/* Migration Assessment */}
            <AccordionItem title="10. Migration Assessment">
              <div className="user-guide-page__section">
                <Tile className="user-guide-page__card">
                  <h4>ROKS Migration (OpenShift Virtualization)</h4>
                  <p>Plan migrations to Red Hat OpenShift on IBM Cloud using MTV (Migration Toolkit for Virtualization).</p>
                  <UnorderedList>
                    <ListItem><strong>Pre-Flight Checks</strong> - VMware Tools, hardware version, snapshots, RDM disks, OS compatibility</ListItem>
                    <ListItem><strong>OS Compatibility</strong> - Validation against Red Hat certified guest OS matrix. Legacy Windows note: current VirtIO drivers (virtio-win 0.1.215+) support Windows Server 2012 R2+; Windows 2008/2008 R2 drivers dropped from current releases; Windows 2003 has no viable drivers</ListItem>
                    <ListItem><strong>Worker Node Sizing</strong> - Bare metal profile selection and capacity planning</ListItem>
                    <ListItem><strong>6 Solution Architectures</strong> - NVMe Converged, Hybrid (BM+VSI), BM + Block Storage, BM + Block + ODF, BM Disaggregated, BM + NFS (CSI)</ListItem>
                    <ListItem><strong>Storage IOPS Tiers</strong> - Standard (3 IOPS/GB · 500 IOPS), Performance (5 IOPS/GB · 1,000 IOPS), High Performance (10 IOPS/GB · 3,000 IOPS)</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>VSI Migration (VPC Virtual Servers)</h4>
                  <p>Plan lift-and-shift migrations to IBM Cloud VPC Virtual Server Instances.</p>
                  <UnorderedList>
                    <ListItem><strong>Pre-Flight Checks</strong> - Boot disk size (10-250GB), disk count (max 12), memory limits, VirtIO driver readiness</ListItem>
                    <ListItem><strong>VirtIO Drivers</strong> - Required for VPC boot. Current virtio-win supports Windows Server 2012 R2+. Windows 2008 R2 requires archived drivers (unsupported). Windows 2003 has no viable drivers and cannot boot on VPC.</ListItem>
                    <ListItem><strong>Profile Selection</strong> - Automatic mapping to Balanced (bx2), Compute (cx2), or Memory (mx2) families</ListItem>
                    <ListItem><strong>VM-to-Profile Mapping</strong> - Table showing source specs, recommended profile, and cost</ListItem>
                    <ListItem><strong>Custom Profiles</strong> - Override auto-selected profiles or define custom ones</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Pre-Flight Check Severity</h4>
                  <div className="user-guide-page__status-list">
                    <div className="user-guide-page__status-item">
                      <Tag type="red">Blocker</Tag>
                      <span>Must be resolved before migration can proceed</span>
                    </div>
                    <div className="user-guide-page__status-item">
                      <Tag type="high-contrast">Warning</Tag>
                      <span>Should be addressed but won't block migration</span>
                    </div>
                    <div className="user-guide-page__status-item">
                      <Tag type="green">Ready</Tag>
                      <span>VM passes all checks</span>
                    </div>
                  </div>
                </Tile>
              </div>
            </AccordionItem>

            {/* Wave Planning */}
            <AccordionItem title="11. Wave Planning">
              <div className="user-guide-page__section">
                <Tile className="user-guide-page__card">
                  <h4>Complexity-Based Waves</h4>
                  <p>VMs are automatically grouped by migration complexity:</p>
                  <table className="user-guide-page__table">
                    <thead>
                      <tr>
                        <th>Wave</th>
                        <th>Criteria</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td>Wave 1: Pilot</td><td>Simple, fully supported</td><td>Validation and learning</td></tr>
                      <tr><td>Wave 2: Quick Wins</td><td>Low complexity</td><td>Build confidence</td></tr>
                      <tr><td>Wave 3: Standard</td><td>Moderate complexity</td><td>Bulk migration</td></tr>
                      <tr><td>Wave 4: Complex</td><td>High complexity</td><td>Careful planning required</td></tr>
                      <tr><td>Wave 5: Remediation</td><td>Has blockers</td><td>Fix issues first</td></tr>
                    </tbody>
                  </table>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Using Wave Data</h4>
                  <OrderedList>
                    <ListItem>Click on a wave tile to see its VMs</ListItem>
                    <ListItem>View VM details including complexity score and blockers</ListItem>
                    <ListItem>Identify VMs in "Remediation" wave that need fixes</ListItem>
                    <ListItem>Export wave assignments for project planning</ListItem>
                  </OrderedList>
                </Tile>
              </div>
            </AccordionItem>

            {/* Cost Comparison */}
            <AccordionItem title="12. Cost Comparison">
              <div className="user-guide-page__section">
                <Tile className="user-guide-page__card">
                  <h4>Overview</h4>
                  <p>Compare your source VMware infrastructure costs against all IBM Cloud target options. Navigate to <strong>Migration Review</strong> &gt; <strong>Cost Comparison</strong> tab.</p>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Summary Tiles</h4>
                  <table className="user-guide-page__table">
                    <thead>
                      <tr>
                        <th>Tile</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td>Source Monthly</td><td>Total monthly cost of VMware on IBM Cloud Classic bare metal</td></tr>
                      <tr><td>Cheapest ROKS</td><td>Lowest-cost ROKS architecture with name</td></tr>
                      <tr><td>Cheapest ROVe</td><td>Lowest-cost ROVe architecture with name</td></tr>
                      <tr><td>VPC VSI</td><td>Total monthly cost for VPC Virtual Server Instances</td></tr>
                      <tr><td>Best Savings</td><td>Best savings percentage across all targets vs source</td></tr>
                    </tbody>
                  </table>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Comparison Table</h4>
                  <UnorderedList>
                    <ListItem><strong>Source BOM column</strong> stays pinned while scrolling through 13 target columns. Shows <Tag type="green" size="sm">Actual</Tag> tag when billing data is loaded, <Tag type="gray" size="sm">Estimated</Tag> otherwise.</ListItem>
                    <ListItem><strong>Target columns</strong> include all 6 ROKS architectures (full + ROVe) plus VPC VSI</ListItem>
                    <ListItem><strong>Category rows</strong> (Compute, Storage, Networking, Licensing, ODF) — click to expand line items</ListItem>
                    <ListItem><strong>Delta tags</strong> show green for savings, red for cost increases relative to source</ListItem>
                    <ListItem><strong>Future architectures</strong> shown at reduced opacity with purple tag</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Tips</h4>
                  <OrderedList>
                    <ListItem>Expand category rows to see where cost differences originate</ListItem>
                    <ListItem>Source BOM requires vHost data in your RVTools export</ListItem>
                    <ListItem>Upload your IBM Cloud billing export on the Source BOM tab to replace estimates with actual invoiced costs — the Cost Comparison automatically uses actuals when available</ListItem>
                    <ListItem>Change your target region on the Discovery Infrastructure tab to see regional pricing effects</ListItem>
                    <ListItem>Region and discount settings are inherited from your current selections</ListItem>
                  </OrderedList>
                </Tile>
              </div>
            </AccordionItem>

            {/* Cost Estimation */}
            <AccordionItem title="13. Cost Estimation">
              <div className="user-guide-page__section">
                <Tile className="user-guide-page__card">
                  <h4>Configuration Options</h4>
                  <UnorderedList>
                    <ListItem><strong>Region Selection</strong> - Choose your target IBM Cloud region (pricing varies by region)</ListItem>
                    <ListItem><strong>Discount Types</strong> - On-Demand (0%), 1-Year Reserved (~20%), 3-Year Reserved (~35%)</ListItem>
                    <ListItem><strong>Networking Options</strong> - VPN Gateway, Transit Gateway, Load Balancers, Floating IPs</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Cost Breakdown</h4>
                  <table className="user-guide-page__table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Includes</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td>Compute</td><td>Bare metal servers or VSI instances</td></tr>
                      <tr><td>Licensing</td><td>OpenShift Container Platform (OCP) license per vCPU (ROKS only)</td></tr>
                      <tr><td>Storage - Block</td><td>Block storage volumes by IOPS tier (BM + Block CSI, VPC VSI)</td></tr>
                      <tr><td>Storage - File</td><td>NFS file storage via dp2 CSI driver (BM + NFS CSI)</td></tr>
                      <tr><td>Storage - ODF</td><td>OpenShift Data Foundation license (ODF solutions only)</td></tr>
                      <tr><td>Networking</td><td>Load balancers, gateways, IPs</td></tr>
                      <tr><td><strong>Total</strong></td><td>Monthly and annual projections</td></tr>
                    </tbody>
                  </table>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Pricing Data Sources</h4>
                  <div className="user-guide-page__status-list">
                    <div className="user-guide-page__status-item">
                      <Tag type="green">Live API</Tag>
                      <span>Real-time IBM Cloud Global Catalog pricing</span>
                    </div>
                    <div className="user-guide-page__status-item">
                      <Tag type="gray">Cache</Tag>
                      <span>Locally cached or static bundled pricing</span>
                    </div>
                  </div>
                </Tile>
              </div>
            </AccordionItem>

            {/* AI Features */}
            <AccordionItem title="14. AI Features (Optional)">
              <div className="user-guide-page__section">
                <Tile className="user-guide-page__card">
                  <h4>Overview</h4>
                  <p>The application includes optional AI-powered features using IBM watsonx.ai (Granite models). AI features are <strong>disabled by default</strong> and must be enabled in the{' '}
                    <Link onClick={() => navigate(ROUTES.settings)} style={{ cursor: 'pointer' }}>Settings page</Link>.
                  </p>
                  <OrderedList>
                    <ListItem>Navigate to <strong>Settings</strong> in the sidebar</ListItem>
                    <ListItem>Toggle <strong>Enable AI Features</strong> on</ListItem>
                    <ListItem>The app will test connectivity to the AI proxy</ListItem>
                    <ListItem>Once connected, AI features become available throughout the app</ListItem>
                  </OrderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Available AI Features</h4>
                  <table className="user-guide-page__table">
                    <thead>
                      <tr>
                        <th>Feature</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td>Workload Classification</td><td>LLM-based VM workload detection with confidence scores</td></tr>
                      <tr><td>Right-Sizing</td><td>AI-recommended VSI profiles considering workload context</td></tr>
                      <tr><td>Migration Insights</td><td>Executive summaries, risk assessments, and recommendations</td></tr>
                      <tr><td>Chat Assistant</td><td>Conversational interface for migration planning questions</td></tr>
                      <tr><td>Wave Suggestions</td><td>AI-powered wave strategy with risk narratives</td></tr>
                      <tr><td>Cost Optimization</td><td>Prioritized cost reduction recommendations</td></tr>
                      <tr><td>Remediation Guidance</td><td>Step-by-step remediation for migration blockers</td></tr>
                      <tr><td>Target Selection</td><td>AI-powered ROKS vs VSI classification per VM</td></tr>
                      <tr><td>Anomaly Detection</td><td>Statistical outlier detection with AI narrative</td></tr>
                      <tr><td>Risk Analysis</td><td>AI-enhanced risk severity suggestions</td></tr>
                      <tr><td>Report Narrative</td><td>AI-generated executive summaries for exports</td></tr>
                      <tr><td>Discovery Questions</td><td>Structured interview questions by topic</td></tr>
                      <tr><td>Interactive Interview</td><td>Step-by-step consultant-style interview</td></tr>
                    </tbody>
                  </table>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Data Privacy</h4>
                  <UnorderedList>
                    <ListItem>Only <strong>aggregated environment summaries</strong> are sent to watsonx.ai (VM counts, resource totals, workload categories)</ListItem>
                    <ListItem><strong>Individual VM names, IP addresses, and raw RVTools data are never transmitted</strong></ListItem>
                    <ListItem>AI features can be disabled at any time via the Settings page</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>AI-Enhanced Reports</h4>
                  <p>When AI is enabled, exported reports (PDF, Word, Excel, BOM) include additional AI-generated sections such as executive summaries, risk narratives, and cost optimization recommendations. All AI-generated content is marked with a watsonx.ai disclaimer.</p>
                </Tile>
              </div>
            </AccordionItem>

            {/* Generating Reports */}
            <AccordionItem title="15. Generating Reports">
              <div className="user-guide-page__section">
                <Tile className="user-guide-page__card">
                  <h4>PDF Reports</h4>
                  <p>Professional assessment documents with executive summary, infrastructure overview, migration readiness, and cost estimates.</p>
                  <OrderedList>
                    <ListItem>Click <strong>Export PDF</strong> on any migration page</ListItem>
                    <ListItem>Select sections to include</ListItem>
                    <ListItem>PDF downloads automatically</ListItem>
                  </OrderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Excel Reports</h4>
                  <p>Detailed workbooks with VM inventory, migration readiness, profile mapping, and cost breakdown sheets.</p>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Word Documents</h4>
                  <p>Comprehensive migration assessment documents formatted for editing and stakeholder review.</p>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Bill of Materials (BOM)</h4>
                  <p>Detailed cost spreadsheets with formulas. Available formats:</p>
                  <UnorderedList>
                    <ListItem><strong>Excel BOM</strong> - Full spreadsheet with formulas and styling</ListItem>
                    <ListItem><strong>Text BOM</strong> - Plain text summary</ListItem>
                    <ListItem><strong>JSON BOM</strong> - Machine-readable format</ListItem>
                    <ListItem><strong>CSV BOM</strong> - For import into other tools</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>YAML for MTV</h4>
                  <p>Migration Toolkit for Virtualization configuration files for automated migration on OpenShift.</p>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>RackWare RMM CSV</h4>
                  <p>VM inventory in RackWare Manager format for automated VSI migration.</p>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>Handover File</h4>
                  <p>
                    Bundle your uploaded RVTools file with all current analysis settings — VM overrides, platform selection, target assignments, risk assessments, timeline config, and more.
                    The recipient uploads this single file and is prompted to restore all bundled settings automatically.
                    Available on the Export &amp; Reports page and via the handover icon in the top navigation bar.
                  </p>
                </Tile>
              </div>
            </AccordionItem>

            {/* Reference Documentation */}
            <AccordionItem title="16. Reference Documentation">
              <div className="user-guide-page__section">
                <Tile className="user-guide-page__card">
                  <h4>In-App Reference Pages</h4>
                  <table className="user-guide-page__table">
                    <thead>
                      <tr>
                        <th>Page</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><Link onClick={() => navigate(ROUTES.info)} style={{ cursor: 'pointer' }}>Sizing Guide</Link></td>
                        <td>Detailed sizing methodology and formulas</td>
                      </tr>
                      <tr>
                        <td><Link onClick={() => navigate(ROUTES.documentation)} style={{ cursor: 'pointer' }}>Documentation</Link></td>
                        <td>Metric definitions and data sources</td>
                      </tr>
                      <tr>
                        <td><Link onClick={() => navigate(ROUTES.vsiMigrationMethods)} style={{ cursor: 'pointer' }}>VSI Migration Methods</Link></td>
                        <td>Comparison of VSI migration approaches</td>
                      </tr>
                      <tr>
                        <td><Link onClick={() => navigate(ROUTES.mtvDocumentation)} style={{ cursor: 'pointer' }}>MTV Guide</Link></td>
                        <td>Migration Toolkit for Virtualization details</td>
                      </tr>
                      <tr>
                        <td><Link onClick={() => navigate(ROUTES.about)} style={{ cursor: 'pointer' }}>About</Link></td>
                        <td>Version information and changelog</td>
                      </tr>
                    </tbody>
                  </table>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>External Resources</h4>
                  <UnorderedList>
                    <ListItem>
                      <Link href="https://cloud.ibm.com/docs/vpc" target="_blank" rel="noopener noreferrer">
                        IBM Cloud VPC Documentation
                      </Link>
                    </ListItem>
                    <ListItem>
                      <Link href="https://cloud.ibm.com/docs/openshift" target="_blank" rel="noopener noreferrer">
                        Red Hat OpenShift on IBM Cloud
                      </Link>
                    </ListItem>
                    <ListItem>
                      <Link href="https://access.redhat.com/documentation/en-us/migration_toolkit_for_virtualization" target="_blank" rel="noopener noreferrer">
                        Migration Toolkit for Virtualization
                      </Link>
                    </ListItem>
                    <ListItem>
                      <Link href="https://www.robware.net/rvtools/" target="_blank" rel="noopener noreferrer">
                        RVTools
                      </Link>
                    </ListItem>
                  </UnorderedList>
                </Tile>
              </div>
            </AccordionItem>

            {/* Data Privacy */}
            <AccordionItem title="Data Privacy">
              <div className="user-guide-page__section">
                <Tile className="user-guide-page__card">
                  <h4>Your Data Stays Private</h4>
                  <UnorderedList>
                    <ListItem><strong>All processing happens in your browser</strong> - RVTools files are never uploaded to any server</ListItem>
                    <ListItem><strong>No tracking or analytics</strong> - Your usage is not monitored</ListItem>
                    <ListItem><strong>Local storage only</strong> - Cached data can be cleared anytime</ListItem>
                    <ListItem><strong>IBM Cloud API calls</strong> - Only fetch public pricing/profile data, never send your VM information</ListItem>
                  </UnorderedList>
                </Tile>
              </div>
            </AccordionItem>

            {/* Keyboard Shortcuts */}
            <AccordionItem title="Keyboard Shortcuts">
              <div className="user-guide-page__section">
                <Tile className="user-guide-page__card">
                  <h4>Keyboard Shortcuts</h4>
                  <table className="user-guide-page__table">
                    <thead>
                      <tr>
                        <th>Shortcut</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td><code>Escape</code></td><td>Close modals and dialogs</td></tr>
                      <tr><td><code>Enter</code></td><td>Confirm inline edits</td></tr>
                      <tr><td><code>Tab</code></td><td>Navigate between form fields</td></tr>
                    </tbody>
                  </table>
                </Tile>
              </div>
            </AccordionItem>

            {/* Glossary */}
            <AccordionItem title="Glossary">
              <div className="user-guide-page__section">
                <Tile className="user-guide-page__card">
                  <h4>Common Terms</h4>
                  <table className="user-guide-page__table">
                    <thead>
                      <tr>
                        <th>Term</th>
                        <th>Definition</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td>BOM</td><td>Bill of Materials - detailed cost breakdown</td></tr>
                      <tr><td>DRS</td><td>Distributed Resource Scheduler - VMware load balancing</td></tr>
                      <tr><td>EVC</td><td>Enhanced vMotion Compatibility - CPU compatibility mode</td></tr>
                      <tr><td>HA</td><td>High Availability - automatic VM restart on host failure</td></tr>
                      <tr><td>MTV</td><td>Migration Toolkit for Virtualization</td></tr>
                      <tr><td>NVMe</td><td>Non-Volatile Memory Express - high-speed storage</td></tr>
                      <tr><td>ODF</td><td>OpenShift Data Foundation - software-defined storage</td></tr>
                      <tr><td>ROKS</td><td>Red Hat OpenShift on IBM Cloud</td></tr>
                      <tr><td>RVTools</td><td>VMware inventory export utility</td></tr>
                      <tr><td>VSI</td><td>Virtual Server Instance - IBM Cloud virtual machine</td></tr>
                      <tr><td>VPC</td><td>Virtual Private Cloud - IBM Cloud network isolation</td></tr>
                    </tbody>
                  </table>
                </Tile>
              </div>
            </AccordionItem>
          </Accordion>
        </Column>
      </Grid>
    </div>
  );
}
