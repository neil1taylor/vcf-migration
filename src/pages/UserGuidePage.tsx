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
                      <tr><td>vInfo</td><td>VM inventory and configuration (required)</td></tr>
                      <tr><td>vCPU</td><td>CPU allocation and reservations</td></tr>
                      <tr><td>vMemory</td><td>Memory allocation details</td></tr>
                      <tr><td>vDisk</td><td>Virtual disk information (required)</td></tr>
                      <tr><td>vNetwork</td><td>Network adapter configuration</td></tr>
                      <tr><td>vHost</td><td>ESXi host inventory</td></tr>
                      <tr><td>vCluster</td><td>Cluster configuration</td></tr>
                      <tr><td>vDatastore</td><td>Storage datastore info (required)</td></tr>
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
                  <UnorderedList>
                    <ListItem><code>.xlsx</code> - Excel 2007+ format (recommended)</ListItem>
                    <ListItem><code>.xls</code> - Legacy Excel format</ListItem>
                  </UnorderedList>
                  <p style={{ marginTop: '1rem' }}><strong>Maximum file size:</strong> 50 MB</p>
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
                      <tr><td>Total VMs</td><td>Count of virtual machines (excluding templates)</td></tr>
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
                    <ListItem><strong>Workloads</strong> - VMs grouped by detected application type</ListItem>
                    <ListItem><strong>Appliances</strong> - Virtual appliances (vCenter, NSX, etc.)</ListItem>
                    <ListItem><strong>Network Equipment</strong> - Virtual network devices</ListItem>
                    <ListItem><strong>VMs</strong> - Full VM listing with management capabilities</ListItem>
                    <ListItem><strong>Custom</strong> - VMs with manually assigned workload types</ListItem>
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
                  <h4>Persistence &amp; Export</h4>
                  <p>All VM customizations are saved to browser localStorage and persist across sessions.</p>
                  <UnorderedList>
                    <ListItem><strong>Export Settings</strong> - Download all overrides as JSON</ListItem>
                    <ListItem><strong>Import Settings</strong> - Load previously exported settings</ListItem>
                  </UnorderedList>
                </Tile>
              </div>
            </AccordionItem>

            {/* Migration Assessment */}
            <AccordionItem title="7. Migration Assessment">
              <div className="user-guide-page__section">
                <Tile className="user-guide-page__card">
                  <h4>ROKS Migration (OpenShift Virtualization)</h4>
                  <p>Plan migrations to Red Hat OpenShift on IBM Cloud using MTV (Migration Toolkit for Virtualization).</p>
                  <UnorderedList>
                    <ListItem><strong>Pre-Flight Checks</strong> - VMware Tools, hardware version, snapshots, RDM disks, OS compatibility</ListItem>
                    <ListItem><strong>OS Compatibility</strong> - Validation against Red Hat certified guest OS matrix</ListItem>
                    <ListItem><strong>Worker Node Sizing</strong> - Bare metal profile selection and capacity planning</ListItem>
                    <ListItem><strong>ODF Storage Planning</strong> - OpenShift Data Foundation sizing with replication factors</ListItem>
                  </UnorderedList>
                </Tile>

                <Tile className="user-guide-page__card">
                  <h4>VSI Migration (VPC Virtual Servers)</h4>
                  <p>Plan lift-and-shift migrations to IBM Cloud VPC Virtual Server Instances.</p>
                  <UnorderedList>
                    <ListItem><strong>Pre-Flight Checks</strong> - Boot disk size (10-250GB), disk count (max 12), memory limits</ListItem>
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
            <AccordionItem title="8. Wave Planning">
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

            {/* Cost Estimation */}
            <AccordionItem title="9. Cost Estimation">
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
                      <tr><td>Storage</td><td>Block storage volumes by IOPS tier</td></tr>
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

            {/* Generating Reports */}
            <AccordionItem title="10. Generating Reports">
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
              </div>
            </AccordionItem>

            {/* Reference Documentation */}
            <AccordionItem title="11. Reference Documentation">
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
