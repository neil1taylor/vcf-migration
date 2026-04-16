// IBM Cloud IT Requirements Template Excel Generator
// Generates Excel in the IBM Cloud Public Cloud Solutioning Tool import format
// with Project Settings, Data Domains, and Revision History sheets

import ExcelJS from 'exceljs';
import type { RegionCode, DiscountType } from '../costEstimation';
import type { VMDetail } from './bomXlsxGenerator';
import {
  getProfileFamilyFromName,
  getProfileTypeFromName,
  hasInstanceStorage,
} from '../migration/vsiProfileMapping';

// ── Column Headers (46 columns matching the IT Requirements Template) ──

const PROJECT_SETTINGS_HEADERS = [
  'Requirement Type',            // 1
  'VPC name',                    // 2
  'Geography',                   // 3
  'Region',                      // 4
  'Data Center',                 // 5
  'Expected Internet Traffic (GB)', // 6
  'VPN Type',                    // 7
  'Load Balancer Type',          // 8
  'Expected hours per month',    // 9
  'VPN server modes',            // 10
  'Subnet name',                 // 11
  'Subnet purpose',              // 12
  'Subnet access',               // 13
  'Access',                      // 14
  'Expected GB per month',       // 15
  'Compute name',                // 16
  'Compute Architecture',        // 17
  'Confidential Computing',      // 18
  'Compute Server Type',         // 19
  'Feature BM',                  // 20
  'Compute Category BM',         // 21
  'Compute Family BM',           // 22
  'Operating System BM',         // 23
  'Operating System Version BM', // 24
  'Feature VS',                  // 25
  'Compute Category VS',         // 26
  'Compute Family VS',           // 27
  'Operating System VS',         // 28
  'Operating System Version VS', // 29
  'Number of instances',         // 30
  'Billing Type',                // 31
  'Boot Volume Size (GB)',       // 32
  'IOPS',                        // 33
  'Data Volume Size (GB)',       // 34
  'Direct Link Name',            // 35
  'Direct Link Type',            // 36
  'Direct Link Version',         // 37
  'Port Metering',               // 38
  'Routing Type',                // 39
  'Speed',                       // 40
  'Location',                    // 41
  'Transfer Charges',            // 42
  'High Availability',           // 43
  'File storage description',    // 44
  'File storage size',           // 45
  'File storage Max IOPS (Gbs)', // 46
];

// ── Data Domains lookup values ──

const DATA_DOMAINS = {
  requirementTypes: ['Zone', 'VPN', 'Subnet', 'Load Balancer', 'Compute', 'Data Volume', 'Direct Link', 'File Storage'],
  regions: ['au-syd', 'br-sao', 'ca-tor', 'eu-de', 'eu-gb', 'eu-es', 'jp-osa', 'jp-tok', 'us-east', 'us-south', 'in-che'],
  dataCenters: [
    'au-syd-1', 'au-syd-2', 'au-syd-3',
    'br-sao-1', 'br-sao-2', 'br-sao-3',
    'ca-tor-1', 'ca-tor-2', 'ca-tor-3',
    'eu-de-1', 'eu-de-2', 'eu-de-3',
    'eu-gb-1', 'eu-gb-2', 'eu-gb-3',
    'eu-es-1', 'eu-es-2', 'eu-es-3',
    'jp-osa-1', 'jp-osa-2', 'jp-osa-3',
    'jp-tok-1', 'jp-tok-2', 'jp-tok-3',
    'us-east-1', 'us-east-2', 'us-east-3',
    'us-south-1', 'us-south-2', 'us-south-3',
    'in-che-1', 'in-che-2', 'in-che-3',
  ],
  subnetAccess: ['Public', 'Private'],
  access: ['Public', 'Private'],
  computeServerType: ['Virtual Server', 'Bare Metal Server'],
  computeArchitecture: ['x86', 's390x'],
  computeCategoryVS: [
    'Flex-Balanced', 'Flex-Compute', 'Flex-Memory', 'Flex-Nano',
    'Balanced', 'Compute', 'Memory', 'GPU', 'High memory', 'Storage optimized',
  ],
  computeProfileVS: [
    'bz2e-1x4', 'bz2-1x4', 'bz2e-2x8', 'bz2-2x8', 'bz2-4x16', 'bz2e-4x16',
    'bz2e-8x32', 'bz2-8x32', 'bz2-16x64', 'bz2e-16x64',
    'cz2e-2x4', 'cz2-2x4', 'cz2-4x8', 'cz2e-4x8', 'cz2-8x16', 'cz2e-8x16',
    'cz2e-16x32', 'cz2-16x32',
    'mz2e-2x16', 'mz2-2x16', 'mz2e-4x32', 'mz2-4x32', 'mz2e-8x64', 'mz2-8x64',
    'mz2-16x128', 'mz2e-16x128',
    'bx2d-2x8', 'bx2-2x8', 'bx2-4x16', 'bx2d-4x16', 'bx2d-8x32', 'bx2-8x32',
    'bx2d-16x64', 'bx2-16x64', 'bx2d-32x128', 'bx2-32x128', 'bx2-48x192',
    'bx2d-48x192', 'bx2d-64x256', 'bx2-64x256', 'bx2-96x384', 'bx2d-96x384',
    'bx2d-128x512', 'bx2-128x512',
    'cx2d-2x4', 'cx2-2x4', 'cx2-4x8', 'cx2d-4x8', 'cx2-8x16', 'cx2d-8x16',
    'cx2d-16x32', 'cx2-16x32', 'cx2d-32x64', 'cx2-32x64', 'cx2-48x96',
    'cx2d-48x96', 'cx2-64x128', 'cx2d-64x128', 'cx2-96x192', 'cx2d-96x192',
    'cx2-128x256', 'cx2d-128x256',
    'mx2-2x16', 'mx2d-2x16', 'mx2d-4x32', 'mx2-4x32', 'mx2-8x64', 'mx2d-8x64',
    'mx2-16x128', 'mx2d-16x128', 'mx2-32x256', 'mx2d-32x256', 'mx2-48x384',
    'mx2d-48x384', 'mx2d-64x512', 'mx2-64x512', 'mx2-96x768', 'mx2d-96x768',
    'mx2-128x1024', 'mx2d-128x1024',
    'ux2d-2x56', 'ux2d-4x112', 'ux2d-8x224', 'ux2d-16x448', 'ux2d-36x1008',
    'ux2d-48x1344', 'ux2d-72x2016', 'ux2d-100x2800', 'ux2d-200x5600',
    'gx2-8x64x1v100', 'gx2-16x128x1v100', 'gx2-16x128x2v100', 'gx2-32x256x2v100',
    'ox2-2x16', 'ox2-4x32', 'ox2-8x64', 'ox2-16x128', 'ox2-32x256', 'ox2-64x512',
    'ox2-96x768', 'ox2-128x1024',
    'vx2d-2x28', 'vx2d-4x56', 'vx2d-8x112', 'vx2d-16x224', 'vx2d-44x616',
    'vx2d-88x1232', 'vx2d-144x2016', 'vx2d-176x2464',
    'bx3d-2x10', 'bx3d-4x20', 'bx3d-8x40', 'bx3d-16x80', 'bx3d-24x120',
    'bx3d-32x160', 'bx3d-48x240', 'bx3d-64x320', 'bx3d-96x480', 'bx3d-128x640',
    'bx3d-176x880',
    'cx3d-2x5', 'cx3d-4x10', 'cx3d-8x20', 'cx3d-16x40', 'cx3d-24x60',
    'cx3d-32x80', 'cx3d-48x120', 'cx3d-64x160', 'cx3d-96x240', 'cx3d-128x320',
    'cx3d-176x440',
    'mx3d-2x20', 'mx3d-4x40', 'mx3d-8x80', 'mx3d-16x160', 'mx3d-24x240',
    'mx3d-32x320', 'mx3d-48x480', 'mx3d-64x640', 'mx3d-96x960', 'mx3d-128x1280',
    'mx3d-176x1760',
    'gx3-16x80x1l4', 'gx3-32x160x2l4', 'gx3-64x320x4l4', 'gx3-24x120x1l40s',
    'gx3-48x240x2l40s', 'gx3d-160x1792x8h100',
    'nxf-2x1', 'nxf-2x2',
    'bxf-2x8', 'bxf-4x16', 'bxf-8x32', 'bxf-16x64', 'bxf-24x96', 'bxf-32x128',
    'bxf-48x192', 'bxf-64x256',
    'cxf-2x4', 'cxf-4x8', 'cxf-8x16', 'cxf-16x32', 'cxf-24x48', 'cxf-32x64',
    'cxf-48x96', 'cxf-64x128',
    'mxf-2x16', 'mxf-4x32', 'mxf-8x64', 'mxf-16x128', 'mxf-24x192', 'mxf-32x256',
    'mxf-48x384', 'mxf-64x512',
  ],
  featureVS: ['{}', '{High Bandwidth}', '{High Bandwidth, Instance Storage}', '{Instance Storage}'],
  operatingSystemVS: [
    'CentOS', 'CentOS Stream', 'Debian GNU/Linux', 'Fedora CoreOS',
    'Red Hat Enterprise Linux', 'Red Hat Enterprise Linux for SAP',
    'Rocky Linux', 'SUSE Linux Enterprise Server', 'SUSE Linux Enterprise Server for SAP',
    'Ubuntu Linux', 'Windows Server', 'Windows Server with SQL Server',
    'IBM Z', 'Hyper Protect',
  ],
  operatingSystemVersionVS: [
    'ibm-centos-7-9-minimal-amd64-12', 'ibm-centos-stream-9-amd64-4',
    'ibm-centos-stream-8-amd64-4', 'ibm-debian-12-0-minimal-amd64-1',
    'ibm-debian-11-7-minimal-amd64-2', 'ibm-debian-10-13-minimal-amd64-4',
    'ibm-fedora-coreos-38-testing-2', 'ibm-fedora-coreos-38-stable-2',
    'ibm-redhat-9-2-minimal-amd64-2', 'ibm-redhat-9-0-minimal-amd64-4',
    'ibm-redhat-8-8-minimal-amd64-2', 'ibm-redhat-8-6-minimal-amd64-6',
    'ibm-redhat-7-9-minimal-amd64-11',
    'ibm-redhat-9-2-amd64-sap-hana-1', 'ibm-redhat-9-2-amd64-sap-applications-1',
    'ibm-redhat-9-0-amd64-sap-hana-3', 'ibm-redhat-9-0-amd64-sap-applications-3',
    'ibm-redhat-8-8-amd64-sap-hana-1', 'ibm-redhat-8-8-amd64-sap-applications-1',
    'ibm-redhat-8-6-amd64-sap-hana-4', 'ibm-redhat-8-6-amd64-sap-applications-4',
    'ibm-redhat-8-4-amd64-sap-hana-8', 'ibm-redhat-8-4-amd64-sap-applications-8',
    'ibm-redhat-7-9-amd64-sap-hana-4', 'ibm-redhat-7-9-amd64-sap-applications-4',
    'ibm-rocky-linux-8-7-minimal-amd64-3',
    'ibm-sles-15-5-amd64-1', 'ibm-sles-15-4-amd64-5', 'ibm-sles-12-5-amd64-6',
    'ibm-sles-15-5-amd64-sap-hana-1', 'ibm-sles-15-5-amd64-sap-applications-1',
    'ibm-sles-15-4-amd64-sap-hana-5', 'ibm-sles-15-4-amd64-sap-applications-6',
    'ibm-sles-15-3-amd64-sap-hana-8', 'ibm-sles-15-3-amd64-sap-applications-9',
    'ibm-sles-15-2-amd64-sap-hana-6', 'ibm-sles-15-2-amd64-sap-applications-6',
    'ibm-sles-15-1-amd64-sap-hana-6', 'ibm-sles-15-1-amd64-sap-applications-6',
    'ibm-sles-12-5-amd64-sap-hana-8', 'ibm-sles-12-5-amd64-sap-applications-8',
    'ibm-ubuntu-22-04-3-minimal-amd64-1', 'ibm-ubuntu-20-04-6-minimal-amd64-2',
    'ibm-windows-server-2022-full-standard-amd64-9',
    'ibm-windows-server-2019-full-standard-amd64-15',
    'ibm-windows-server-2019-core-amd64-11',
    'ibm-windows-server-2016-full-standard-amd64-15',
    'ibm-windows-server-2016-core-amd64-12',
    'ibm-windows-server-2019-full-sqlsvr-2019-amd64-7',
    'ibm-esxi-7-0u3n-21930508-amd64-1', 'ibm-esxi-7-0u3l-21424296-amd64-2',
    'byol',
  ],
  billingType: ['PAYG', '1 Yr Reserved', '3 Yr Reserved'],
  iops: ['3', '5', '10'],
  vpnType: ['Site to Site', 'Client to Site'],
  loadBalancerType: ['Application', 'Network'],
  vpnServerModes: ['Standalone mode', 'HA mode'],
};

const DATA_DOMAINS_HEADERS = [
  'Requirement Types',
  'Region',
  'Data Center',
  'Subnet access',
  'Access',
  'Compute Server Type',
  'Compute Architecture',
  'Compute Category VS',
  'Compute Category BM',
  'Compute Profile VS',
  'Compute Profile BM',
  'Feature VS',
  'Feature BM',
  'Operating System VS',
  'Operating System BM',
  'Operating System Version VS',
  'Operating System Version BM',
  'VPN Type',
  'Load Balancer Type',
  'VPN server modes',
  'IOPS',
  'Billing Type',
  'Direct Link Type',
  'Direct Link Version',
  'Port Metering',
  'Routing Type',
  'Speed',
  'Location',
];

// ── Mapping Functions ──

function mapDiscountToBillingType(discount: DiscountType): string {
  switch (discount) {
    case 'reserved1Year': return '1 Yr Reserved';
    case 'reserved3Year': return '3 Yr Reserved';
    default: return 'PAYG';
  }
}

function mapProfileToComputeCategory(profile: string): string {
  const family = getProfileFamilyFromName(profile);
  const type = getProfileTypeFromName(profile);
  if (type === 'Flex') return `Flex-${family}`;
  return family;
}

function mapProfileToFeatureVS(profile: string): string {
  return hasInstanceStorage(profile) ? '{Instance Storage}' : '{}';
}

function mapStorageTierToIOPS(tier?: string): number {
  switch (tier) {
    case '5iops': return 5;
    case '10iops': return 10;
    default: return 3;
  }
}

// Map confidential computing profiles (bx3dc, cx3dc) to their standard equivalents
// since the Solutioning Tool doesn't include CC variants in its valid profile list
function normalizeProfileForExport(profile: string): string {
  return profile.replace(/^(bx3|cx3)dc-/, '$1d-');
}

function mapRegionToGeography(region: string): string {
  if (region.startsWith('us-') || region.startsWith('ca-')) return 'US';
  if (region.startsWith('eu-')) return 'Europe';
  if (region.startsWith('jp-') || region.startsWith('au-') || region.startsWith('kr-') || region.startsWith('in-')) return 'Asia Pacific';
  if (region.startsWith('br-')) return 'South America';
  return 'US';
}

function mapRegionToDataCenter(region: string): string {
  return `${region}-1`;
}

function formatOS(guestOS: string): string {
  const osLower = guestOS.toLowerCase();
  if (osLower.includes('rhel') || osLower.includes('red hat')) return 'Red Hat Enterprise Linux';
  if (osLower.includes('ubuntu')) return 'Ubuntu Linux';
  if (osLower.includes('centos stream')) return 'CentOS Stream';
  if (osLower.includes('centos')) return 'CentOS';
  if (osLower.includes('windows server') || osLower.includes('microsoft windows server')) return 'Windows Server';
  if (osLower.includes('windows')) return 'Windows Server';
  if (osLower.includes('sles') || osLower.includes('suse')) return 'SUSE Linux Enterprise Server';
  if (osLower.includes('debian')) return 'Debian GNU/Linux';
  if (osLower.includes('rocky')) return 'Rocky Linux';
  if (osLower.includes('fedora')) return 'Fedora CoreOS';
  return guestOS.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// ── Sheet Builders ──

function addProjectSettingsSheet(
  sheet: ExcelJS.Worksheet,
  vmDetails: VMDetail[],
  opts: {
    vpcName: string;
    geography: string;
    region: string;
    dataCenter: string;
    billingType: string;
  },
): void {
  // Header row
  const headerRow = sheet.getRow(1);
  PROJECT_SETTINGS_HEADERS.forEach((header, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = header;
    cell.font = { bold: true };
  });

  let currentRow = 2;

  // Zone row
  const zoneRow = sheet.getRow(currentRow);
  zoneRow.getCell(1).value = 'Zone';
  zoneRow.getCell(2).value = opts.vpcName;
  zoneRow.getCell(3).value = opts.geography;
  zoneRow.getCell(4).value = opts.region;
  zoneRow.getCell(5).value = opts.dataCenter;
  currentRow++;

  // Subnet row (required by the Solutioning Tool before Compute rows)
  const subnetRow = sheet.getRow(currentRow);
  subnetRow.getCell(1).value = 'Subnet';
  subnetRow.getCell(2).value = opts.vpcName;
  subnetRow.getCell(11).value = `${opts.vpcName}-subnet-1`;
  subnetRow.getCell(13).value = 'Private';
  currentRow++;

  // Compute + Data Volume rows per VM
  for (const vm of vmDetails) {
    const computeRow = sheet.getRow(currentRow);
    computeRow.getCell(1).value = 'Compute';
    computeRow.getCell(2).value = opts.vpcName;
    computeRow.getCell(16).value = vm.vmName;
    computeRow.getCell(17).value = 'x86';
    computeRow.getCell(19).value = 'Virtual Server';
    computeRow.getCell(25).value = mapProfileToFeatureVS(vm.profile);
    computeRow.getCell(26).value = mapProfileToComputeCategory(vm.profile);
    computeRow.getCell(27).value = normalizeProfileForExport(vm.profile);
    computeRow.getCell(28).value = formatOS(vm.guestOS);
    computeRow.getCell(29).value = 'byol';
    computeRow.getCell(30).value = 1;
    computeRow.getCell(31).value = opts.billingType;
    computeRow.getCell(32).value = Math.min(Math.max(vm.bootVolumeGiB, 100), 250);
    computeRow.getCell(33).value = mapStorageTierToIOPS(vm.storageTier);
    currentRow++;

    // Data Volume rows
    for (const vol of vm.dataVolumes) {
      const dvRow = sheet.getRow(currentRow);
      dvRow.getCell(1).value = 'Data Volume';
      dvRow.getCell(2).value = opts.vpcName;
      dvRow.getCell(33).value = mapStorageTierToIOPS(vm.storageTier);
      dvRow.getCell(34).value = vol.sizeGiB;
      currentRow++;
    }
  }
}

function addDataDomainsSheet(sheet: ExcelJS.Worksheet): void {
  // Header row
  const headerRow = sheet.getRow(1);
  DATA_DOMAINS_HEADERS.forEach((header, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = header;
    cell.font = { bold: true };
  });

  // Map columns to their value arrays
  const columns: (string[] | undefined)[] = [
    DATA_DOMAINS.requirementTypes,     // 1: Requirement Types
    DATA_DOMAINS.regions,              // 2: Region
    DATA_DOMAINS.dataCenters,          // 3: Data Center
    DATA_DOMAINS.subnetAccess,         // 4: Subnet access
    DATA_DOMAINS.access,               // 5: Access
    DATA_DOMAINS.computeServerType,    // 6: Compute Server Type
    DATA_DOMAINS.computeArchitecture,  // 7: Compute Architecture
    DATA_DOMAINS.computeCategoryVS,    // 8: Compute Category VS
    undefined,                         // 9: Compute Category BM (skip)
    DATA_DOMAINS.computeProfileVS,     // 10: Compute Profile VS
    undefined,                         // 11: Compute Profile BM (skip)
    DATA_DOMAINS.featureVS,            // 12: Feature VS
    undefined,                         // 13: Feature BM (skip)
    DATA_DOMAINS.operatingSystemVS,    // 14: Operating System VS
    undefined,                         // 15: Operating System BM (skip)
    DATA_DOMAINS.operatingSystemVersionVS, // 16: Operating System Version VS
    undefined,                         // 17: Operating System Version BM (skip)
    DATA_DOMAINS.vpnType,              // 18: VPN Type
    DATA_DOMAINS.loadBalancerType,     // 19: Load Balancer Type
    DATA_DOMAINS.vpnServerModes,       // 20: VPN server modes
    DATA_DOMAINS.iops,                 // 21: IOPS
    DATA_DOMAINS.billingType,          // 22: Billing Type
  ];

  // Write values column by column
  for (let col = 0; col < columns.length; col++) {
    const values = columns[col];
    if (!values) continue;
    for (let row = 0; row < values.length; row++) {
      sheet.getRow(row + 2).getCell(col + 1).value = values[row];
    }
  }
}

function addRevisionHistorySheet(sheet: ExcelJS.Worksheet): void {
  sheet.getRow(2).getCell(1).value = 'Version';
  sheet.getRow(2).getCell(2).value = '1.0.0';

  sheet.getRow(4).getCell(1).value = 'Template revision history';

  sheet.getRow(5).getCell(1).value = 'Version';
  sheet.getRow(5).getCell(2).value = 'Date';
  sheet.getRow(5).getCell(3).value = 'Changes';
  sheet.getRow(5).getCell(4).value = 'Source';
  sheet.getRow(5).eachCell(cell => { cell.font = { bold: true }; });

  sheet.getRow(6).getCell(1).value = '1.0.0';
  sheet.getRow(6).getCell(2).value = new Date();
  sheet.getRow(6).getCell(3).value = 'Auto-generated from VCF migration assessment';
  sheet.getRow(6).getCell(4).value = 'VCF Migration Tool';
}

// ── Public API ──

export async function generateITRequirementsExcel(
  vmDetails: VMDetail[],
  vpcName: string = 'Default VPC',
  region: RegionCode = 'us-south',
  discountType: DiscountType = 'onDemand',
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VCF Migration Tool';
  workbook.created = new Date();

  const geography = mapRegionToGeography(region);
  const dataCenter = mapRegionToDataCenter(region);
  const billingType = mapDiscountToBillingType(discountType);

  const settingsSheet = workbook.addWorksheet('Project Settings');
  addProjectSettingsSheet(settingsSheet, vmDetails, {
    vpcName, geography, region, dataCenter, billingType,
  });

  const domainsSheet = workbook.addWorksheet('Data Domains');
  addDataDomainsSheet(domainsSheet);

  const revisionSheet = workbook.addWorksheet('Revision History');
  addRevisionHistorySheet(revisionSheet);

  return workbook;
}

export async function downloadITRequirementsExcel(
  vmDetails: VMDetail[],
  vpcName?: string,
  region?: RegionCode,
  discountType?: DiscountType,
  filename?: string,
): Promise<void> {
  const workbook = await generateITRequirementsExcel(
    vmDetails,
    vpcName,
    region,
    discountType,
  );
  const defaultFilename = `it-requirements-${region || 'us-south'}-${new Date().toISOString().split('T')[0]}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || defaultFilename;
  a.click();
  URL.revokeObjectURL(url);
}
