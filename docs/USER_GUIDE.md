# VCF Migration Planning Tool - User Guide

This guide provides step-by-step instructions for using the VCF Migration Planning Tool to analyze your VMware environment and plan migrations to IBM Cloud.

---

## Quick Start

Get started in 5 simple steps:

1. **Request RVTools Export** - Ask your VMware administrator to generate an RVTools export from your vCenter
2. **Upload the Excel File** - Drag and drop or browse to upload the `.xlsx` file on the landing page
3. **Review the Dashboard** - Get an instant overview of your infrastructure including VMs, resources, and health metrics
4. **Run Migration Assessment** - Navigate to ROKS Migration or VSI Migration to assess your workloads
5. **Export Reports** - Generate PDF, Excel, or Word reports for planning and stakeholder communication

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Importing Data](#2-importing-data)
3. [Understanding the Dashboard](#3-understanding-the-dashboard)
4. [Infrastructure Analysis](#4-infrastructure-analysis)
5. [Workload Discovery](#5-workload-discovery)
6. [VM Management](#6-vm-management)
7. [Risk Assessment](#7-risk-assessment)
8. [Migration Timeline](#8-migration-timeline)
9. [Network Design](#9-network-design)
10. [Migration Assessment](#10-migration-assessment)
11. [Wave Planning](#11-wave-planning)
12. [Cost Estimation](#12-cost-estimation)
13. [AI Features (Optional)](#13-ai-features-optional)
14. [Generating Reports](#14-generating-reports)
15. [Reference Documentation](#15-reference-documentation)

---

## 1. Getting Started

### Prerequisites

Before using this tool, you need:

- **RVTools Export** - An Excel file exported from your VMware vCenter environment
- **Modern Web Browser** - Chrome, Firefox, Edge, or Safari (latest versions recommended)

### Requesting RVTools Export

RVTools is a free utility that exports VMware vSphere environment data to Excel. To request an export:

1. Contact your VMware administrator
2. Request an RVTools export from your vCenter Server(s)
3. Ask for all sheets to be included (the tool uses 16+ different sheets)
4. The export should be in `.xlsx` format (Excel)

### RVTools Version Requirements

- **Minimum Version**: RVTools 4.0+
- **Recommended Version**: Latest stable release
- **Export Format**: Excel (.xlsx or .xls)

### Recommended Sheets

For full analysis capabilities, ensure these sheets are included:

| Sheet | Purpose |
|-------|---------|
| vInfo | VM inventory and configuration (required — only mandatory sheet) |
| vCPU | CPU allocation and reservations |
| vMemory | Memory allocation details |
| vDisk | Virtual disk information (recommended — enables Storage page) |
| vPartition | Guest OS partition data |
| vNetwork | Network adapter configuration (recommended — enables Network pages) |
| vCD | CD/DVD drive configuration |
| vSnapshot | VM snapshot details |
| vTools | VMware Tools status |
| vRP | Resource pool hierarchy |
| vCluster | Cluster configuration (recommended — enables Clusters page) |
| vHost | ESXi host inventory (recommended — enables Hosts page) |
| vDatastore | Storage datastore info (recommended — enables Storage page) |
| vHealth | Environment health checks |
| vSource | vCenter server information |

---

## 2. Importing Data

### Using the Upload Feature

1. Navigate to the **Upload** page (landing page)
2. Either:
   - **Drag and drop** your RVTools Excel file onto the upload area
   - **Click Browse** to select the file from your computer
3. Wait for the file to be parsed (typically a few seconds)
4. Once complete, you'll be automatically redirected to the Dashboard

### Supported File Formats

- `.xlsx` - Excel 2007+ format (recommended)
- `.xls` - Legacy Excel format

### File Size Limits

- Maximum file size: **50 MB**
- Large environments (10,000+ VMs) may take longer to parse

### What Data Is Extracted

The tool parses and analyzes data from multiple RVTools sheets:

- **Virtual Machine Inventory** - Names, configurations, power states
- **Resource Allocations** - vCPU, memory, storage per VM
- **Storage Details** - Disk sizes, datastores, thin/thick provisioning
- **Network Configuration** - NICs, port groups, IP addresses
- **Cluster Information** - HA/DRS status, host counts
- **Host Details** - ESXi versions, hardware specs
- **Health Status** - VMware Tools, snapshots, hardware versions

### Troubleshooting Import Issues

| Issue | Solution |
|-------|----------|
| File won't upload | Ensure file is .xlsx or .xls format |
| Parsing fails | Check that vInfo sheet exists and has data |
| Missing data | Verify RVTools export included all sheets |
| Slow parsing | Large files (50MB+) may need more time |

---

## 3. Understanding the Dashboard

The Dashboard provides an executive summary of your VMware environment.

### Key Metrics

| Metric | Description |
|--------|-------------|
| Total VMs | Full RVTools inventory count (includes templates and infrastructure VMs), with migration scope shown as detail |
| Total vCPUs | Sum of all allocated virtual CPUs |
| Total Memory | Aggregate memory allocated to VMs |
| Provisioned Storage | Total storage capacity allocated |
| In Use Storage | Actual storage consumed |

### Power State Distribution

A donut chart showing VMs by power state:
- **Powered On** (green) - Running VMs
- **Powered Off** (gray) - Stopped VMs
- **Suspended** (yellow) - Paused VMs

### OS Distribution

Bar chart showing the breakdown of guest operating systems:
- Windows versions (Server 2019, 2022, etc.)
- Linux distributions (RHEL, Ubuntu, CentOS, etc.)
- Other operating systems

### Hardware Version Analysis

Shows the distribution of VM hardware versions:
- **v14+** (green) - Recommended for migration
- **v10-13** (yellow) - Meets minimum requirements
- **Below v10** (red) - May require upgrade before migration

### Configuration Analysis

Quick view of potential issues:
- VMware Tools status
- Snapshot counts and ages
- CD-ROM connections
- Consolidation needs

### Interactive Features

- **Click on chart segments** to filter the view
- **Hover over data points** for detailed tooltips
- **Export buttons** for generating reports

---

## 4. Infrastructure Analysis

### Compute Page

Analyze CPU and memory allocations across your environment.

**Features:**
- vCPU distribution histogram (1-2, 3-4, 5-8, 9-16, 17-32, 33+ cores)
- Memory distribution by size ranges
- Top consumers by vCPU and memory
- Average resource allocation statistics
- CPU/Memory overcommitment ratios

**Use Cases:**
- Identify oversized or undersized VMs
- Find right-sizing opportunities
- Plan capacity requirements

### Storage Page

Understand storage utilization and capacity.

**Features:**
- Datastore utilization with capacity/used/free breakdown
- High utilization warnings (>80% yellow, >90% red)
- VM storage consumption analysis
- Thin vs thick provisioning breakdown
- Click on a datastore to see associated VMs

**Use Cases:**
- Identify storage capacity risks
- Plan storage migration sizing
- Find VMs consuming the most storage

### Network Page

Analyze network configuration and topology.

**Features:**
- NIC count and type distribution (VMXNET3, E1000, etc.)
- Port group summary with VM counts
- Subnet detection (auto-guessed from IP addresses)
- Editable subnet column for manual corrections
- Network topology visualization
- VMs with multiple NICs listing

**Inline Subnet Editing:**
1. Click on any subnet cell in the Network Summary table
2. Enter the correct CIDR (e.g., `10.0.1.0/24`)
3. For multiple subnets, use comma-separated values
4. Press Enter to save or Escape to cancel
5. Your changes are saved to localStorage

### Clusters Page

Review cluster health and configuration.

**Features:**
- HA (High Availability) status per cluster
- DRS (Distributed Resource Scheduler) configuration
- EVC (Enhanced vMotion Compatibility) mode
- Host counts and effective resources
- CPU/Memory overcommitment ratios
- Click on a cluster to see its VMs

**Use Cases:**
- Understand cluster architecture
- Identify single points of failure
- Plan migration wave groupings

### Hosts Page

Inventory of physical ESXi hosts.

**Features:**
- Host hardware specifications (CPU model, cores, memory)
- ESXi version distribution
- Host-to-VM mapping
- Resource utilization per host

### Resource Pools Page

View resource pool hierarchy and reservations.

**Features:**
- Tree structure of resource pools
- CPU and memory reservations
- Limits and shares configuration
- VM assignments per pool

---

## 5. Workload Discovery

The Workload Discovery page automatically categorizes VMs based on naming patterns and configurations.

### Accessing Workload Discovery

Navigate to **Workload Discovery** in the sidebar.

### Discovery Categories

| Category | Examples |
|----------|----------|
| **Databases** | Oracle, SQL Server, MySQL, PostgreSQL, MongoDB |
| **Middleware** | WebSphere, JBoss, Tomcat, WebLogic |
| **Web Servers** | Apache, IIS, Nginx |
| **Enterprise Apps** | SAP, Citrix, Exchange |
| **Infrastructure** | DNS, DHCP, Active Directory |
| **Monitoring** | Nagios, Zabbix, Splunk |

### Tabs Overview

- **Infrastructure** - Source data center selector, target IBM Cloud MZR dropdown, environment summary (vCenter, clusters, hosts, datastores)
- **Workload** - VM workload classification with auto-detection and manual overrides
- **Networks** - Port group and subnet mapping from vNetwork data

### Using Discovery Data

1. Review auto-detected workload categories
2. Click on a category tile to filter the VM list
3. Export filtered lists to CSV for further analysis
4. Use this information to plan migration waves by application tier

---

## 6. VM Management

Customize which VMs are included in migration analysis.

### Accessing VM Management

Navigate to **Workload Discovery** > **VMs** tab.

### Features

#### Exclude/Include VMs

1. Find the VM in the table
2. Click the **Exclude** button to remove from migration scope
3. Excluded VMs show a strikethrough and "Excluded" tag
4. Click **Include** to add back to migration scope

#### Bulk Operations

1. Use checkboxes to select multiple VMs
2. Click **Exclude Selected** or **Include Selected** in the toolbar
3. All selected VMs are updated at once

#### Override Workload Types

1. Click the workload type dropdown for any VM
2. Select from predefined categories or type a custom value
3. Custom workload types appear in the "Custom" tab

#### Set Burstable / Instance Storage

1. In the VM table, click the **Burstable** tag to toggle between `Standard` and `Burstable` (shared CPU, lower cost)
2. Click the **Instance Storage** tag to toggle between `Block` (persistent, tiered) and `NVMe` (fast local I/O, ephemeral — suitable for DB scratch, Kafka)
3. These selections drive VSI profile mapping on the VSI Migration page

#### Add Notes

1. Click the notes icon for any VM
2. Enter planning notes (e.g., "Contact app owner before migration")
3. Notes are preserved across sessions

### Persistence

All VM customizations are saved to browser localStorage:
- Exclusions persist across sessions
- Workload overrides are remembered
- Burstable and instance storage selections are remembered
- Notes are preserved

### Export/Import Settings

**Export:**
1. Click **Export Settings** in the toolbar
2. JSON file downloads with all VM overrides

**Import:**
1. Click **Import Settings** in the toolbar
2. Select a previously exported JSON file
3. Choose to merge or replace existing settings

### Environment Fingerprinting

The tool tracks which vCenter environment the settings belong to:
- If you upload a new RVTools file from the same vCenter, settings apply automatically
- If the environment changes, you'll be prompted to apply, clear, or export existing settings

---

## 7. Risk Assessment

Review and manage migration risks with a flat risk table that combines auto-detected, curated, and user-added risks.

### Accessing Risk Assessment

Navigate to **Migration Assessment** > **Migration Review** > **Risk Assessment** tab.

### Risk Table

The Risk Assessment tab shows a flat table of all migration risks with traffic light status (Red / Amber / Green). Risks come from three sources:

| Source | Description |
|--------|-------------|
| **Auto-detected** | Generated from your RVTools data (pre-flight blockers, complexity, cost comparison, OS compatibility, scale, VMware licenses) |
| **Curated defaults** | 13 common migration risks covering Financial, Technical, Business, Skills, Ops, and Backup/DR categories |
| **User-added** | Custom risks you add via the "Add Risk" button |

### Editing Risks

All cells in the risk table are editable:

1. **Category** — Click to open a dropdown with the 6 risk categories (Financial, Business / Org, Skills / Knowledge, Ops & Tooling, Backup & DR, Technical)
2. **Risk Description** — Click to open an inline text editor
3. **Impact Area** — Click to edit inline
4. **Status** — Use the dropdown to set Red, Amber, or Green
5. **Mitigation Plan** — Click to edit inline
6. **Evidence / Detail** — Click to edit inline

All edits are saved to localStorage and persist across sessions.

### Deleting Risks

Click the trash icon on any row to delete it. For auto-detected and curated rows, deleted rows are hidden and will reappear when you click **Reset All**.

### Filtering

Use the **category filter dropdown** in the toolbar to show only risks from a specific category (e.g., Technical, Financial).

### Summary Badges

Summary tags at the top show the count of Red, Amber, and Green risks at a glance.

### Reset All

Click **Reset All** to clear all overrides, restore deleted rows, and remove user-added rows — returning the table to its default state.

---

## 8. Migration Timeline

Plan and visualize the migration schedule with an interactive Gantt chart.

### Accessing Migration Timeline

Navigate to **Assess** > **Migration Timeline** in the sidebar.

### Timeline Phases

The timeline automatically generates phases based on your wave planning:

| Phase Type | Default Duration | Description |
|------------|-----------------|-------------|
| Preparation | 2 weeks | Environment setup and planning |
| Pilot | Auto (0.5 day/VM) | Small set of test VMs to prove the migration process |
| Production Wave N | Auto (0.5 day/VM) | One phase per migration wave |
| Validation | 1 week | Post-migration verification |
| Buffer | 1 week | Contingency time |

### Duration Formula

Wave durations (pilot and production) are estimated based on data volume at **500 GB/day** migration throughput, with a minimum of **0.25 days per VM** for setup and validation overhead, rounded up to the nearest week. The migration partner will revise and enhance the timeline after discovery and further planning.

### Customizing the Timeline

1. **Adjust Phase Durations** — Use the number inputs in the phase table to change week counts (minimum 1 week)
2. **Set Start Date** — Pick a start date to calculate projected end dates
3. **Reset to Defaults** — Click "Reset to Defaults" to restore original durations

### Gantt Chart

The horizontal bar chart visualizes all phases with:
- Color-coded bars by phase type (preparation, pilot, production, validation, buffer)
- Week markers on the x-axis
- Phase names on the y-axis

### Metrics

Summary cards at the top show:
- Total duration in weeks
- Number of migration waves
- Total phases
- Estimated end date (when start date is set)

---

## 9. Network Design

Map your VMware network topology to an IBM Cloud VPC design.

### Accessing Network Design

Navigate to **Migration Assessment** > **VSI Migration** and select the **Network Design** tab.

### How It Works

The Network Design panel automatically:
1. Extracts port groups from your RVTools vNetwork data
2. Maps each port group to a VPC subnet
3. Distributes subnets across 3 availability zones (round-robin)
4. Generates security groups based on workload classifications
5. Creates ACL suggestions for each subnet

### Region Selection

Use the dropdown to select your target IBM Cloud region (default: us-south). This determines the zone names (e.g., us-south-1, us-south-2, us-south-3).

### VPC Topology Diagram

The interactive D3 visualization shows:
- Region container with VPC
- 3 zone columns
- Subnet boxes color-coded by workload type
- Hover for VM count and CIDR details

### Tabs

#### Subnets Tab
Editable table showing:
- Subnet name, source port group, CIDR, zone, VM count, security group
- Click to edit subnet names, CIDRs, and zone assignments

#### Security Groups Tab
Security group rules organized by workload type:
- Inbound and outbound rules with protocol, port range, and source/destination
- Based on templates in `vpcSecurityGroupTemplates.json`

#### ACLs Tab
Read-only ACL suggestions per subnet with:
- Direction (inbound/outbound), action (allow/deny), protocol, port range, source/destination

#### Transit Gateway Tab
Toggle transit gateway on/off and select connection type (VPC or Classic).

---

## 10. Migration Assessment

### ROKS Migration (OpenShift Virtualization)

Plan migrations to Red Hat OpenShift on IBM Cloud using MTV (Migration Toolkit for Virtualization).

#### Pre-Flight Checks

Navigate to **ROKS Migration** > **Pre-Flight** tab.

The tool checks for:

| Check | Severity | Description |
|-------|----------|-------------|
| VMware Tools | Blocker | Must be installed for migration |
| Hardware Version | Warning | v10+ required, v14+ recommended |
| Snapshots | Blocker | Old snapshots (>30 days) block migration |
| RDM Disks | Blocker | Raw device mappings not supported |
| Shared Disks | Warning | Multi-writer disks need special handling |
| CD-ROM Connected | Warning | Should be disconnected before migration |
| OS Compatibility | Varies | Based on Red Hat compatibility matrix |

#### OS Compatibility

The tool validates guest operating systems against the Red Hat certified guest OS matrix:

- **Fully Supported** (green) - Certified for OpenShift Virtualization
- **Supported with Caveats** (yellow) - May need additional configuration
- **Unsupported** (red) - Not certified, may still work

#### Worker Node Sizing

Navigate to **ROKS Migration** > **Sizing** tab.

1. Review the computed resource requirements
2. Adjust infrastructure reservations (default 15%)
3. Select storage calculation method:
   - **Disk Capacity** - Full VMDK sizes
   - **In Use** (recommended) - Actual consumed storage
   - **Provisioned** - Thin-provisioned capacity
4. Choose bare metal profile family:
   - **Balanced (bx2d)** - General purpose workloads
   - **Compute (cx2d)** - CPU-intensive workloads
   - **Memory (mx2d)** - Memory-intensive workloads

#### ODF Storage Planning

For OpenShift Data Foundation (Ceph) storage:

1. Select **Hybrid (ODF)** architecture
2. Review the storage capacity calculations
3. Consider the replication factor (3x for production)
4. Plan for 30-40% free space headroom

### VSI Migration (VPC Virtual Servers)

Plan lift-and-shift migrations to IBM Cloud VPC Virtual Server Instances.

#### Pre-Flight Checks

Navigate to **VSI Migration** > **Pre-Flight** tab.

VSI-specific checks include:

| Check | Severity | Description |
|-------|----------|-------------|
| Boot Disk Size | Blocker | Must be 10GB - 250GB |
| Disk Count | Warning | Maximum 12 disks per VSI |
| Memory Limits | Warning | Check against profile maximums |
| OS Support | Varies | IBM Cloud stock image availability |

#### Profile Selection

Navigate to **VSI Migration** > **Sizing** tab.

1. VMs are automatically mapped to VSI profiles based on vCPU/memory ratio
2. Profile families:
   - **Balanced (bx2)** - Equal vCPU-to-memory ratio
   - **Compute (cx2)** - Higher vCPU ratio
   - **Memory (mx2)** - Higher memory ratio
3. Profile selection follows the decision tree in `public/vpc_vsi_profile_selection.svg`:
   - **Burstable** toggle (set in Discovery VM table) → selects flex (f-suffix) profiles for variable workloads
   - **Instance Storage** toggle (set in Discovery VM table) → selects NVMe (d-suffix) profiles for workloads needing fast local I/O (e.g., DB scratch, Kafka)
   - Gen3 profiles (Sapphire Rapids) are preferred; BIOS firmware VMs fall back to Gen2
4. Click the edit icon to override the auto-selected profile
5. Define custom profiles for specific requirements

#### VM-to-Profile Mapping

The mapping table shows:
- Source VM specifications
- Recommended VSI profile
- Resource delta (over/under provisioned)
- Per-VM cost estimate

---

## 11. Wave Planning

Organize VMs into migration waves for phased execution.

### Accessing Wave Planning

Wave planning is available on the **Migration Planning** tab of the Migration Review page.

### Complexity-Based Waves

VMs are automatically grouped by migration complexity:

| Wave | Criteria | Description |
|------|----------|-------------|
| Wave 1: Pilot | Simple, fully supported | Validation and learning |
| Wave 2: Quick Wins | Low complexity, no blockers | Build confidence |
| Wave 3: Standard | Moderate complexity | Bulk migration |
| Wave 4: Complex | High complexity | Careful planning required |
| Wave 5: Remediation | Has blockers | Fix issues first |

### Wave Features

- Click on a wave tile to see its VMs
- View VM details including complexity score and blockers
- Export wave assignments for project planning

### Using Wave Data

1. Review the wave distribution
2. Identify VMs in the "Remediation" wave that need fixes
3. Plan resources and timelines for each wave
4. Use exports to create project plans

---

## 12. Cost Estimation

Estimate monthly and annual costs for your IBM Cloud deployment.

### Accessing Cost Estimation

Cost panels are available on both ROKS and VSI migration pages.

### Configuration Options

#### Region Selection

Select your target IBM Cloud region:
- US regions (Dallas, Washington DC)
- Europe (London, Frankfurt)
- Asia Pacific (Tokyo, Sydney, Osaka)

Regional pricing varies based on local market rates.

#### Discount Types

| Type | Discount | Commitment |
|------|----------|------------|
| On-Demand | 0% | None |
| 1-Year Reserved | ~20% | 1-year commitment |
| 3-Year Reserved | ~35% | 3-year commitment |

#### Networking Options

Add networking components to your estimate:

- **VPN Gateway** - Site-to-site connectivity
- **Transit Gateway** - Multi-VPC connectivity
- **Load Balancers** - Application or network load balancing
- **Floating IPs** - Public IP addresses

### Cost Breakdown

The cost summary shows:

| Category | Includes |
|----------|----------|
| Compute | Bare metal servers or VSI instances |
| Licensing | OpenShift Container Platform (OCP) license per vCPU (ROKS only) |
| Storage | Block storage volumes by IOPS tier |
| Storage - ODF | OpenShift Data Foundation license (ROKS only) |
| Networking | Load balancers, gateways, IPs |
| **Total** | Monthly and annual projections |

### Pricing Data Sources

The pricing indicator shows the data source:
- **Live API** (green) - Real-time IBM Cloud Global Catalog pricing
- **Cache** (gray) - Locally cached or static bundled pricing

---

## 13. AI Features (Optional)

The application includes optional AI-powered features using IBM watsonx.ai (Granite models). AI features are **disabled by default** and must be enabled in the Settings page.

### Enabling AI Features

1. Navigate to **Settings** (`/settings`) in the sidebar
2. Toggle **Enable AI Features** on
3. The app will test connectivity to the AI proxy
4. Once connected, AI features become available throughout the app

### Available AI Features

| Feature | Description | Location |
|---------|-------------|----------|
| **Workload Classification** | LLM-based VM workload detection with confidence scores | Discovery page |
| **Right-Sizing** | AI-recommended VSI profiles considering workload context | VSI Migration sizing |
| **Migration Insights** | Executive summaries, risk assessments, and recommendations | Migration pages |
| **Chat Assistant** | Conversational interface for migration planning questions | Chat widget (bottom-right) |
| **Wave Suggestions** | AI-powered wave strategy with risk narratives | Wave Planning |
| **Cost Optimization** | Prioritized cost reduction recommendations | Cost panels |
| **Remediation Guidance** | Step-by-step remediation for migration blockers | Pre-flight pages |
| **Target Selection** | AI-powered ROKS vs VSI vs PowerVS classification per VM | Migration Review |
| **Anomaly Detection** | Statistical outlier detection with AI narrative | Discovery page |
| **Risk Analysis** | AI-enhanced risk severity suggestions | Risk Assessment |
| **Report Narrative** | AI-generated executive summaries for exports | Export functions |
| **Discovery Questions** | Structured interview questions by topic | Discovery page |
| **Interactive Interview** | Step-by-step consultant-style interview | Discovery page |

### AI Chat Assistant

The chat assistant is available as a floating widget throughout the app:

1. Click the **chat icon** in the bottom-right corner
2. Ask questions about your migration (e.g., "What are the main risks?")
3. The assistant is aware of your loaded environment data
4. Responses stream in real-time with markdown formatting
5. Chat history is preserved across navigation

### Data Privacy

- Only **aggregated environment summaries** are sent to watsonx.ai (VM counts, resource totals, workload categories)
- **Individual VM names, IP addresses, and raw RVTools data are never transmitted**
- AI features can be disabled at any time via the Settings page

### AI-Enhanced Reports

When AI is enabled, exported reports (PDF, Word, Excel, BOM) include additional AI-generated sections:
- Executive summary
- Risk assessment narrative
- Cost optimization recommendations
- Migration recommendations

All AI-generated content is marked with a watsonx.ai disclaimer.

---

## 14. Generating Reports

Export your analysis in multiple formats for stakeholders and planning.

### Available Export Formats

#### PDF Reports

Professional assessment documents with:
- Executive summary
- Infrastructure overview with charts
- Migration readiness analysis
- Cost estimates
- Recommendations

**To export:**
1. Click **Export PDF** on any migration page
2. Select sections to include
3. PDF downloads automatically

#### Excel Reports

Detailed workbooks with multiple sheets:
- VM inventory with all specifications
- Migration readiness by VM
- Profile mapping details
- Cost breakdown

**To export:**
1. Click **Export Excel** on any migration page
2. Multi-sheet workbook downloads

#### Word Documents

Comprehensive migration assessment documents:
- Formatted for editing and customization
- Tables and charts included
- Ready for stakeholder review

**To export:**
1. Click **Export Word** on any migration page
2. DOCX file downloads

#### Bill of Materials (BOM)

Detailed cost spreadsheets with formulas:

**Formats:**
- **Excel BOM** - Full spreadsheet with formulas and styling
- **Text BOM** - Plain text summary
- **JSON BOM** - Machine-readable format
- **CSV BOM** - For import into other tools

**To export:**
1. Click **Export BOM** dropdown
2. Select desired format

#### YAML for MTV

Migration Toolkit for Virtualization configuration:
- Pre-configured for MTV operator
- VM migration definitions
- Network mapping templates

**To export:**
1. On ROKS Migration page, click **Export YAML**
2. Use with MTV operator on OpenShift

#### Handover File

Bundle your RVTools data with all current analysis settings for handing off to a colleague:
- **Includes**: VM overrides, platform selection, target assignments, risk assessments, timeline config, subnet overrides, and more
- **Workflow**: The recipient uploads the single handover file and is prompted to restore all bundled settings automatically
- **Access**: Available on the Export & Reports page and via the DataShare icon in the top navigation bar

**To export:**
1. Navigate to **Export & Reports** page and click **Export Handover File**, or
2. Click the **DataShare icon** (↗) in the top navigation bar (visible when data is loaded)

> **Note:** The handover export requires an uploaded RVTools file. The button is disabled until a file is loaded.

#### Import Settings from Handover File

Restore settings from a previous handover export onto a fresh RVTools file. This enables a two-step workflow: upload new data, then apply old settings.

- **Includes**: All settings categories from the handover file (VM overrides, platform selection, target assignments, risk assessments, timeline config, etc.)
- **Confirmation**: A modal shows the source filename, export date, and a list of settings that will be restored before you confirm
- **Access**: Available on the Settings page, Export & Reports page, and via the DocumentImport icon in the top navigation bar

**To import:**
1. Upload a fresh RVTools file as your data source
2. Navigate to **Settings** or **Export & Reports** and click **Import from Handover File**, or click the **DocumentImport icon** in the top navigation bar
3. Select a previous handover export file (`.xlsx`)
4. Review the confirmation modal and click **Import Settings**
5. The page reloads with all settings restored

> **Note:** Importing settings overwrites your current settings. This action cannot be undone.

#### RackWare RMM CSV

For automated migration with RackWare:
- VM inventory in RMM format
- Ready for import into RackWare Manager

**To export:**
1. On VSI Migration page, click **Export RackWare CSV**

---

## 15. Reference Documentation

### In-App Reference Pages

| Page | Description |
|------|-------------|
| **Sizing Guide** | Detailed sizing methodology and formulas |
| **Documentation** | Metric definitions and data sources |
| **VSI Migration Methods** | Comparison of VSI migration approaches |
| **MTV Guide** | Migration Toolkit for Virtualization details |
| **About** | Version information and changelog |

### External Resources

- [IBM Cloud VPC Documentation](https://cloud.ibm.com/docs/vpc)
- [Red Hat OpenShift on IBM Cloud](https://cloud.ibm.com/docs/openshift)
- [Migration Toolkit for Virtualization](https://access.redhat.com/documentation/en-us/migration_toolkit_for_virtualization)
- [RVTools](https://www.robware.net/rvtools/)

### Getting Help

If you encounter issues:
1. Check the Documentation page for metric definitions
2. Review this User Guide for step-by-step instructions
3. Check the About page for version information

---

## Data Privacy

Your data stays private:

- **All processing happens in your browser** - RVTools files are never uploaded
- **No tracking or analytics** - Your usage is not monitored
- **Local storage only** - Cached data can be cleared anytime
- **IBM Cloud API calls** - Only fetch public pricing/profile data, never send your VM information

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Escape` | Close modals and dialogs |
| `Enter` | Confirm inline edits |
| `Tab` | Navigate between form fields |

---

## Glossary

| Term | Definition |
|------|------------|
| **BOM** | Bill of Materials - detailed cost breakdown |
| **DRS** | Distributed Resource Scheduler - VMware load balancing |
| **EVC** | Enhanced vMotion Compatibility - CPU compatibility mode |
| **HA** | High Availability - automatic VM restart on host failure |
| **MTV** | Migration Toolkit for Virtualization |
| **NVMe** | Non-Volatile Memory Express - high-speed storage |
| **ODF** | OpenShift Data Foundation - software-defined storage |
| **ROKS** | Red Hat OpenShift on IBM Cloud |
| **RVTools** | VMware inventory export utility |
| **VSI** | Virtual Server Instance - IBM Cloud virtual machine |
| **VPC** | Virtual Private Cloud - IBM Cloud network isolation |
