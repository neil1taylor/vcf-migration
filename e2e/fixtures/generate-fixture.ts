/**
 * Generate a minimal RVTools .xlsx fixture for E2E tests.
 *
 * Run: npx tsx e2e/fixtures/generate-fixture.ts
 *
 * Produces: e2e/fixtures/test-rvtools.xlsx
 */
import * as XLSX from 'xlsx';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const wb = XLSX.utils.book_new();

// ── vInfo ────────────────────────────────────────────────────────────────────
const vInfoRows = [
  {
    VM: 'web-server-01',
    Powerstate: 'poweredOn',
    Template: 'FALSE',
    CPUs: 4,
    Memory: 8192,
    NICs: 1,
    Disks: 1,
    'Provisioned MB': 102400,
    'In Use MB': 51200,
    'Guest OS': 'Red Hat Enterprise Linux 8 (64-bit)',
    Cluster: 'prod-cluster-01',
    Host: 'esxi-host-01.lab.local',
    Datacenter: 'dc-east',
    'VM UUID': '5001-aaa-bbb-ccc',
    'HW version': 'vmx-19',
    'Consolidation Needed': 'FALSE',
    Annotation: '',
    'Guest Hostname': 'web-server-01',
    'Guest IP': '10.10.1.10',
    Folder: 'Production',
    'DNS Name': 'web-server-01.lab.local',
  },
  {
    VM: 'db-server-01',
    Powerstate: 'poweredOn',
    Template: 'FALSE',
    CPUs: 8,
    Memory: 32768,
    NICs: 2,
    Disks: 2,
    'Provisioned MB': 512000,
    'In Use MB': 256000,
    'Guest OS': 'Microsoft Windows Server 2019 (64-bit)',
    Cluster: 'prod-cluster-01',
    Host: 'esxi-host-02.lab.local',
    Datacenter: 'dc-east',
    'VM UUID': '5002-ddd-eee-fff',
    'HW version': 'vmx-19',
    'Consolidation Needed': 'FALSE',
    Annotation: 'Production database',
    'Guest Hostname': 'db-server-01',
    'Guest IP': '10.10.1.20',
    Folder: 'Production',
    'DNS Name': 'db-server-01.lab.local',
  },
  {
    VM: 'app-server-01',
    Powerstate: 'poweredOn',
    Template: 'FALSE',
    CPUs: 2,
    Memory: 4096,
    NICs: 1,
    Disks: 1,
    'Provisioned MB': 51200,
    'In Use MB': 25600,
    'Guest OS': 'Ubuntu Linux (64-bit)',
    Cluster: 'prod-cluster-01',
    Host: 'esxi-host-01.lab.local',
    Datacenter: 'dc-east',
    'VM UUID': '5003-ggg-hhh-iii',
    'HW version': 'vmx-19',
    'Consolidation Needed': 'FALSE',
    Annotation: '',
    'Guest Hostname': 'app-server-01',
    'Guest IP': '10.10.1.30',
    Folder: 'Production',
    'DNS Name': 'app-server-01.lab.local',
  },
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vInfoRows), 'vInfo');

// ── vDisk (required sheet) ───────────────────────────────────────────────────
const vDiskRows = [
  { VM: 'web-server-01', Powerstate: 'poweredOn', Template: 'FALSE', Disk: 'Hard disk 1', 'Capacity MB': 102400, Thin: 'TRUE', Datacenter: 'dc-east', Cluster: 'prod-cluster-01', Host: 'esxi-host-01.lab.local' },
  { VM: 'db-server-01', Powerstate: 'poweredOn', Template: 'FALSE', Disk: 'Hard disk 1', 'Capacity MB': 256000, Thin: 'FALSE', Datacenter: 'dc-east', Cluster: 'prod-cluster-01', Host: 'esxi-host-02.lab.local' },
  { VM: 'db-server-01', Powerstate: 'poweredOn', Template: 'FALSE', Disk: 'Hard disk 2', 'Capacity MB': 256000, Thin: 'FALSE', Datacenter: 'dc-east', Cluster: 'prod-cluster-01', Host: 'esxi-host-02.lab.local' },
  { VM: 'app-server-01', Powerstate: 'poweredOn', Template: 'FALSE', Disk: 'Hard disk 1', 'Capacity MB': 51200, Thin: 'TRUE', Datacenter: 'dc-east', Cluster: 'prod-cluster-01', Host: 'esxi-host-01.lab.local' },
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vDiskRows), 'vDisk');

// ── vHost ────────────────────────────────────────────────────────────────────
const vHostRows = [
  { Name: 'esxi-host-01.lab.local', 'Power State': 'poweredOn', 'CPU Model': 'Intel Xeon Gold 6248', Speed: 2500, '# CPU': 2, 'Cores per Socket': 20, '# Cores': 40, Memory: 524288, '# VMs': 2, Vendor: 'Dell Inc.', Model: 'PowerEdge R640', 'ESXi Version': '8.0.0', Datacenter: 'dc-east', Cluster: 'prod-cluster-01' },
  { Name: 'esxi-host-02.lab.local', 'Power State': 'poweredOn', 'CPU Model': 'Intel Xeon Gold 6248', Speed: 2500, '# CPU': 2, 'Cores per Socket': 20, '# Cores': 40, Memory: 524288, '# VMs': 1, Vendor: 'Dell Inc.', Model: 'PowerEdge R640', 'ESXi Version': '8.0.0', Datacenter: 'dc-east', Cluster: 'prod-cluster-01' },
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vHostRows), 'vHost');

// ── vDatastore ───────────────────────────────────────────────────────────────
const vDatastoreRows = [
  { Name: 'datastore-ssd-01', Type: 'VMFS', 'Capacity MB': 2097152, 'Provisioned MB': 1572864, 'In Use MB': 1048576, 'Free MB': 1048576, '# VMs': 3, '# Hosts': 2, Datacenter: 'dc-east', Cluster: 'prod-cluster-01' },
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vDatastoreRows), 'vDatastore');

// ── vCluster ─────────────────────────────────────────────────────────────────
const vClusterRows = [
  { Name: 'prod-cluster-01', '# VMs': 3, '# Hosts': 2, '# CPU Cores': 80, '# CPU Threads': 160, 'Total CPU': 200000, 'Total Memory': 1048576, 'HA Enabled': 'TRUE', 'DRS Enabled': 'TRUE', Datacenter: 'dc-east' },
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vClusterRows), 'vCluster');

// ── vSnapshot ────────────────────────────────────────────────────────────────
// One old snapshot (>30 days) to trigger the "Old Snapshots" blocker
const oldDate = new Date();
oldDate.setDate(oldDate.getDate() - 45);
const vSnapshotRows = [
  { VM: 'db-server-01', Powerstate: 'poweredOn', Snapshot: 'pre-update-backup', 'Date / time': oldDate.toISOString(), 'Size MB': 2048, Datacenter: 'dc-east', Cluster: 'prod-cluster-01', Host: 'esxi-host-02.lab.local' },
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vSnapshotRows), 'vSnapshot');

// ── vTools ───────────────────────────────────────────────────────────────────
const vToolsRows = [
  { VM: 'web-server-01', Powerstate: 'poweredOn', Template: 'FALSE', 'Tools Status': 'toolsOk', 'Tools Version': '12352' },
  { VM: 'db-server-01', Powerstate: 'poweredOn', Template: 'FALSE', 'Tools Status': 'toolsNotInstalled', 'Tools Version': '' },
  { VM: 'app-server-01', Powerstate: 'poweredOn', Template: 'FALSE', 'Tools Status': 'toolsOk', 'Tools Version': '12352' },
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vToolsRows), 'vTools');

// ── vCD ──────────────────────────────────────────────────────────────────────
const vCDRows = [
  { VM: 'db-server-01', Powerstate: 'poweredOn', Template: 'FALSE', Device: 'CD/DVD drive 1', Connected: 'TRUE', 'Start Connected': 'TRUE', 'Device Type': 'Client Device', Datacenter: 'dc-east', Cluster: 'prod-cluster-01', Host: 'esxi-host-02.lab.local' },
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vCDRows), 'vCD');

// ── vNetwork ─────────────────────────────────────────────────────────────────
const vNetworkRows = [
  { VM: 'web-server-01', Powerstate: 'poweredOn', Template: 'FALSE', Network: 'VM Network', Connected: 'TRUE', 'IP Address': '10.10.1.10', Datacenter: 'dc-east', Cluster: 'prod-cluster-01', Host: 'esxi-host-01.lab.local' },
  { VM: 'db-server-01', Powerstate: 'poweredOn', Template: 'FALSE', Network: 'VM Network', Connected: 'TRUE', 'IP Address': '10.10.1.20', Datacenter: 'dc-east', Cluster: 'prod-cluster-01', Host: 'esxi-host-02.lab.local' },
  { VM: 'app-server-01', Powerstate: 'poweredOn', Template: 'FALSE', Network: 'VM Network', Connected: 'TRUE', 'IP Address': '10.10.1.30', Datacenter: 'dc-east', Cluster: 'prod-cluster-01', Host: 'esxi-host-01.lab.local' },
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vNetworkRows), 'vNetwork');

// ── vSource ──────────────────────────────────────────────────────────────────
const vSourceRows = [
  { Server: 'vcenter.lab.local', 'IP Address': '10.10.0.5', Version: '8.0.2', Build: '22385739', 'OS Type': 'linux-x64', 'Full Name': 'VMware vCenter Server 8.0.2', 'Instance UUID': 'aaaa-bbbb-cccc-dddd' },
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vSourceRows), 'vSource');

// ── Write ────────────────────────────────────────────────────────────────────
const outPath = path.resolve(__dirname, 'test-rvtools.xlsx');
XLSX.writeFile(wb, outPath);
console.log(`Fixture written to ${outPath}`);
