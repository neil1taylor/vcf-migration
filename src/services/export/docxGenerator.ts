// DOCX report generator for client migration assessment reports
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  PageBreak,
  BorderStyle,
  ShadingType,
  Packer,
  convertInchesToTwip,
  ImageRun,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from 'docx';
import type { ITableCellOptions } from 'docx';

// Type alias for document content elements
type DocumentContent = Paragraph | Table;
import type {
  RVToolsData,
  VirtualMachine,
  VDiskInfo,
  VNetworkInfo,
  VSnapshotInfo,
  VToolsInfo,
} from '@/types/rvtools';
import { mibToGiB, mibToTiB, getHardwareVersionNumber } from '@/utils/formatters';
import { HW_VERSION_MINIMUM, SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';
import reportTemplates from '@/data/reportTemplates.json';
import ibmCloudConfig from '@/data/ibmCloudConfig.json';
import osCompatibilityData from '@/data/redhatOSCompatibility.json';

// ===== TYPES =====

export interface DocxExportOptions {
  clientName?: string;
  preparedBy?: string;
  companyName?: string;
  includeROKS?: boolean;
  includeVSI?: boolean;
  includeCosts?: boolean;
  maxIssueVMs?: number;
}

interface VMReadiness {
  vmName: string;
  cluster: string;
  guestOS: string;
  cpus: number;
  memoryGiB: number;
  storageGiB: number;
  hasBlocker: boolean;
  hasWarning: boolean;
  issues: string[];
}

interface ROKSSizing {
  workerNodes: number;
  profileName: string;
  totalCores: number;
  totalThreads: number;
  totalMemoryGiB: number;
  totalNvmeTiB: number;
  odfUsableTiB: number;
  monthlyCost: number;
}

interface VSIMapping {
  vmName: string;
  sourceVcpus: number;
  sourceMemoryGiB: number;
  sourceStorageGiB: number;
  bootDiskGiB: number;
  dataDiskGiB: number;
  profile: string;
  profileVcpus: number;
  profileMemoryGiB: number;
  family: string;
  computeCost: number;
  bootStorageCost: number;
  dataStorageCost: number;
  storageCost: number;
  monthlyCost: number;
}

// VSI Storage Configuration
// Boot volume constraints: 10GB minimum, 250GB maximum, general-purpose only
const BOOT_DISK_SIZE_GIB = 100; // Assumed boot disk size
const BOOT_STORAGE_COST_PER_GB = 0.08; // general-purpose tier (3 IOPS/GB)

// Data volume storage tier distribution (assumed workload mix)
const DATA_STORAGE_TIER_DISTRIBUTION = {
  generalPurpose: 0.50, // 50% at general-purpose (3 IOPS/GB) - $0.08/GB
  tier5iops: 0.30,      // 30% at 5iops-tier - $0.10/GB
  tier10iops: 0.20,     // 20% at 10iops-tier - $0.13/GB
};

// Weighted average data storage cost based on tier distribution
const DATA_STORAGE_COST_PER_GB =
  (DATA_STORAGE_TIER_DISTRIBUTION.generalPurpose * 0.08) +
  (DATA_STORAGE_TIER_DISTRIBUTION.tier5iops * 0.10) +
  (DATA_STORAGE_TIER_DISTRIBUTION.tier10iops * 0.13); // = $0.096/GB

// ===== STYLING CONSTANTS =====

const FONT_FAMILY = 'IBM Plex Sans';

const STYLES = {
  titleSize: 56,
  heading1Size: 32,
  heading2Size: 26,
  heading3Size: 22,
  bodySize: 22,
  smallSize: 20,
  primaryColor: '0f62fe', // IBM Blue
  secondaryColor: '393939',
  accentColor: '24a148', // Green
  warningColor: 'ff832b', // Orange
  errorColor: 'da1e28', // Red
  purpleColor: '8a3ffc', // Purple
  tealColor: '009d9a', // Teal
  magentaColor: 'ee5396', // Magenta
  cyanColor: '1192e8', // Cyan
  lightGray: 'f4f4f4',
  mediumGray: 'e0e0e0',
};

// Chart colors for visual consistency
const CHART_COLORS = [
  '#0f62fe', // IBM Blue
  '#24a148', // Green
  '#8a3ffc', // Purple
  '#ff832b', // Orange
  '#009d9a', // Teal
  '#ee5396', // Magenta
  '#1192e8', // Cyan
  '#da1e28', // Red
];

// ===== HELPER FUNCTIONS =====

function getOSCompatibility(guestOS: string) {
  const osLower = guestOS.toLowerCase();
  for (const entry of osCompatibilityData.osEntries) {
    if (entry.patterns.some((p: string) => osLower.includes(p))) {
      return entry;
    }
  }
  return osCompatibilityData.defaultEntry;
}

function mapVMToVSIProfile(vcpus: number, memoryGiB: number) {
  const vsiProfiles = ibmCloudConfig.vsiProfiles;
  const memToVcpuRatio = memoryGiB / vcpus;

  let family: 'balanced' | 'compute' | 'memory' = 'balanced';
  if (memToVcpuRatio <= 2.5) {
    family = 'compute';
  } else if (memToVcpuRatio >= 6) {
    family = 'memory';
  }

  const profiles = vsiProfiles[family];
  const bestFit = profiles.find(
    (p: { vcpus: number; memoryGiB: number }) => p.vcpus >= vcpus && p.memoryGiB >= memoryGiB
  );
  return { ...(bestFit || profiles[profiles.length - 1]), family };
}

function getVSIPricing(profileName: string): number {
  const pricing = ibmCloudConfig.vsiPricing as Record<string, { monthlyRate: number }>;
  return pricing[profileName]?.monthlyRate || 0;
}

function getBaremetalPricing(profileName: string): number {
  const pricing = ibmCloudConfig.bareMetalPricing as Record<string, { monthlyRate: number }>;
  return pricing[profileName]?.monthlyRate || 0;
}

function createTableCell(
  text: string,
  options: Partial<ITableCellOptions> & {
    bold?: boolean;
    header?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    altRow?: boolean;
  } = {}
): TableCell {
  const { bold, header, align, altRow, ...cellOptions } = options;

  // Header cells get grey background, all other rows are white
  let fillColor: string | undefined;
  if (header) {
    fillColor = '525252'; // Medium grey for headers
  }
  // No fill color for data rows (white background)

  // Text colors - white on header, black on all data rows
  const textColor = header ? 'ffffff' : '161616'; // White on header, black on data rows

  return new TableCell({
    ...cellOptions,
    shading: fillColor ? { fill: fillColor, type: ShadingType.SOLID } : undefined,
    margins: {
      top: 100,
      bottom: 100,
      left: 140,
      right: 140,
    },
    children: [
      new Paragraph({
        alignment: align || AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: bold || header,
            size: header ? STYLES.bodySize : STYLES.smallSize,
            color: textColor,
          }),
        ],
      }),
    ],
  });
}

// Create styled table with IBM design language
function createStyledTable(
  headers: string[],
  rows: string[][],
  options: {
    columnAligns?: ((typeof AlignmentType)[keyof typeof AlignmentType])[];
    columnWidths?: number[];
  } = {}
): Table {
  const { columnAligns = [], columnWidths } = options;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: columnWidths,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
      left: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
      right: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
    },
    rows: [
      // Header row
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) =>
          createTableCell(h, { header: true, align: columnAligns[i] })
        ),
      }),
      // Data rows with alternating colors
      ...rows.map((row, rowIndex) =>
        new TableRow({
          children: row.map((cell, cellIndex) =>
            createTableCell(cell, {
              align: columnAligns[cellIndex],
              altRow: rowIndex % 2 === 1,
            })
          ),
        })
      ),
    ],
  });
}

function createHeading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        color: STYLES.secondaryColor,
      }),
    ],
  });
}

function createParagraph(text: string, options: { bold?: boolean; spacing?: { before?: number; after?: number } } = {}): Paragraph {
  return new Paragraph({
    spacing: options.spacing || { after: 120 },
    children: [
      new TextRun({
        text,
        size: STYLES.bodySize,
        bold: options.bold,
      }),
    ],
  });
}

function createBulletList(items: string[]): Paragraph[] {
  return items.map(
    (item) =>
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: item,
            size: STYLES.bodySize,
          }),
        ],
      })
  );
}

// ===== CHART GENERATION FUNCTIONS =====

interface ChartData {
  label: string;
  value: number;
  color?: string;
}

// High-DPI scale factor for crisp charts (3x for retina quality)
const CHART_SCALE = 3;

async function generatePieChart(
  data: ChartData[],
  title: string,
  width: number = 480,
  height: number = 260
): Promise<Uint8Array> {
  // Create high-resolution canvas for crisp rendering
  const canvas = document.createElement('canvas');
  canvas.width = width * CHART_SCALE;
  canvas.height = height * CHART_SCALE;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Scale context for high-DPI rendering
  ctx.scale(CHART_SCALE, CHART_SCALE);

  // Enable anti-aliasing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Calculate total for percentages
  const total = data.reduce((sum, d) => sum + d.value, 0);

  // Layout: pie on left, legend on right
  const titleHeight = 36;
  const pieSize = Math.min(width * 0.45, height - titleHeight - 20);
  const radius = pieSize / 2;
  const centerX = radius + 30;
  const centerY = titleHeight + (height - titleHeight) / 2;
  const legendAreaX = centerX + radius + 40;

  // Draw title with IBM Blue underline
  ctx.font = `bold 13px ${FONT_FAMILY}, Arial, sans-serif`;
  ctx.fillStyle = '#161616';
  ctx.textAlign = 'left';
  ctx.fillText(title, 20, 22);

  // Title underline
  ctx.strokeStyle = '#0f62fe';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, 28);
  ctx.lineTo(20 + ctx.measureText(title).width, 28);
  ctx.stroke();

  // Draw pie slices - ensure perfect circle
  let currentAngle = -Math.PI / 2; // Start from top

  data.forEach((item, index) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    const color = item.color || CHART_COLORS[index % CHART_COLORS.length];

    // Draw slice
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // Draw slice border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Calculate label position
    const labelAngle = currentAngle + sliceAngle / 2;
    const labelRadius = radius * 0.6;
    const labelX = centerX + Math.cos(labelAngle) * labelRadius;
    const labelY = centerY + Math.sin(labelAngle) * labelRadius;

    // Draw percentage label if slice is big enough
    const percent = Math.round((item.value / total) * 100);
    if (percent >= 10) {
      ctx.font = `bold 11px ${FONT_FAMILY}, Arial, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${percent}%`, labelX, labelY);
    }

    currentAngle += sliceAngle;
  });

  // Draw legend on the right side
  const legendItemHeight = 22;
  const legendStartY = titleHeight + (height - titleHeight - data.length * legendItemHeight) / 2;

  data.forEach((item, index) => {
    const color = item.color || CHART_COLORS[index % CHART_COLORS.length];
    const legendY = legendStartY + index * legendItemHeight;

    // Draw color box
    ctx.fillStyle = color;
    ctx.fillRect(legendAreaX, legendY - 5, 12, 12);

    // Draw label and value on same line
    ctx.font = `11px ${FONT_FAMILY}, Arial, sans-serif`;
    ctx.fillStyle = '#525252';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const percent = Math.round((item.value / total) * 100);
    ctx.fillText(`${item.label}: ${item.value.toLocaleString()} (${percent}%)`, legendAreaX + 18, legendY + 1);
  });

  // Convert to blob and then to Uint8Array
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        blob.arrayBuffer().then((buffer) => {
          resolve(new Uint8Array(buffer));
        });
      } else {
        reject(new Error('Failed to create blob from canvas'));
      }
    }, 'image/png');
  });
}

function createChartParagraph(imageData: Uint8Array, width: number, height: number): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 240 },
    children: [
      new ImageRun({
        data: imageData,
        transformation: {
          width,
          height,
        },
        type: 'png',
      }),
    ],
  });
}

// ===== DATA CALCULATION FUNCTIONS =====

function calculateVMReadiness(rawData: RVToolsData): VMReadiness[] {
  const vms = rawData.vInfo.filter((vm) => vm.powerState === 'poweredOn' && !vm.template);
  const toolsMap = new Map(rawData.vTools.map((t: VToolsInfo) => [t.vmName, t]));
  const snapshotSet = new Set(
    rawData.vSnapshot
      .filter((s: VSnapshotInfo) => s.ageInDays > SNAPSHOT_BLOCKER_AGE_DAYS)
      .map((s: VSnapshotInfo) => s.vmName)
  );
  const rdmSet = new Set(rawData.vDisk.filter((d: VDiskInfo) => d.raw).map((d: VDiskInfo) => d.vmName));

  return vms.map((vm: VirtualMachine) => {
    const tool = toolsMap.get(vm.vmName);
    const osCompat = getOSCompatibility(vm.guestOS);
    const hwVersion = getHardwareVersionNumber(vm.hardwareVersion);

    const issues: string[] = [];
    let hasBlocker = false;
    let hasWarning = false;

    if (!tool || tool.toolsStatus === 'toolsNotInstalled') {
      issues.push('No VMware Tools');
      hasBlocker = true;
    }
    if (snapshotSet.has(vm.vmName)) {
      issues.push('Old Snapshots (>30d)');
      hasBlocker = true;
    }
    if (rdmSet.has(vm.vmName)) {
      issues.push('RDM Disk');
      hasBlocker = true;
    }
    if (osCompat.compatibilityStatus === 'unsupported') {
      issues.push('Unsupported OS');
      hasBlocker = true;
    }
    if (hwVersion < HW_VERSION_MINIMUM) {
      issues.push(`HW Version v${hwVersion}`);
      hasWarning = true;
    }
    if (tool?.toolsStatus === 'toolsOld') {
      issues.push('Outdated VMware Tools');
      hasWarning = true;
    }

    return {
      vmName: vm.vmName,
      cluster: vm.cluster || 'N/A',
      guestOS: vm.guestOS,
      cpus: vm.cpus,
      memoryGiB: Math.round(mibToGiB(vm.memory)),
      storageGiB: Math.round(mibToGiB(vm.provisionedMiB)),
      hasBlocker,
      hasWarning,
      issues,
    };
  });
}

function calculateROKSSizing(rawData: RVToolsData): ROKSSizing {
  const { odfSizing, ocpVirtSizing, bareMetalProfiles: bmProfiles } = ibmCloudConfig;
  // Flatten bare metal profiles from family-organized structure
  const bareMetalProfiles = [
    ...bmProfiles.balanced,
    ...bmProfiles.compute,
    ...bmProfiles.memory,
  ];
  const poweredOnVMs = rawData.vInfo.filter(
    (vm: VirtualMachine) => vm.powerState === 'poweredOn' && !vm.template
  );

  const totalVCPUs = poweredOnVMs.reduce((sum: number, vm: VirtualMachine) => sum + vm.cpus, 0);
  const totalMemoryGiB = poweredOnVMs.reduce(
    (sum: number, vm: VirtualMachine) => sum + mibToGiB(vm.memory),
    0
  );
  const totalStorageGiB = poweredOnVMs.reduce(
    (sum: number, vm: VirtualMachine) => sum + mibToGiB(vm.provisionedMiB),
    0
  );

  // ODF sizing
  const replicaFactor = odfSizing.replicaFactor;
  const operationalCapacity = odfSizing.operationalCapacityPercent / 100;
  const cephEfficiency = 1 - odfSizing.cephOverheadPercent / 100;
  const requiredRawStorageGiB = Math.ceil(
    (totalStorageGiB * replicaFactor) / operationalCapacity / cephEfficiency
  );
  const adjustedVCPUs = Math.ceil(totalVCPUs / ocpVirtSizing.cpuOvercommitConservative);

  const recommendedProfile = bareMetalProfiles.find(
    (p: { name: string }) => p.name === 'bx2d.metal.96x384'
  ) || bareMetalProfiles[0];

  const usableThreadsPerNode = Math.floor(recommendedProfile.vcpus * 0.85);
  const usableMemoryPerNode = recommendedProfile.memoryGiB - ocpVirtSizing.systemReservedMemoryGiB;
  const usableNvmePerNode = recommendedProfile.totalNvmeGiB || 0;

  const nodesForCPU = Math.ceil(adjustedVCPUs / usableThreadsPerNode);
  const nodesForMemory = Math.ceil(totalMemoryGiB / usableMemoryPerNode);
  const nodesForStorage = usableNvmePerNode > 0 ? Math.ceil(requiredRawStorageGiB / usableNvmePerNode) : 0;
  const baseNodeCount = Math.max(odfSizing.minOdfNodes, nodesForCPU, nodesForMemory, nodesForStorage);
  const recommendedWorkers = baseNodeCount + ocpVirtSizing.nodeRedundancy;

  const totalClusterNvmeGiB = recommendedWorkers * (recommendedProfile.totalNvmeGiB || 0);
  const odfUsableTiB =
    ((totalClusterNvmeGiB / replicaFactor) * operationalCapacity * cephEfficiency) / 1024;

  const monthlyCost = recommendedWorkers * getBaremetalPricing('bx2d.metal.96x384');

  return {
    workerNodes: recommendedWorkers,
    profileName: recommendedProfile.name,
    totalCores: recommendedWorkers * recommendedProfile.physicalCores,
    totalThreads: recommendedWorkers * recommendedProfile.vcpus,
    totalMemoryGiB: recommendedWorkers * recommendedProfile.memoryGiB,
    totalNvmeTiB: Math.round(totalClusterNvmeGiB / 1024),
    odfUsableTiB: parseFloat(odfUsableTiB.toFixed(1)),
    monthlyCost,
  };
}

function calculateVSIMappings(rawData: RVToolsData): VSIMapping[] {
  const poweredOnVMs = rawData.vInfo.filter(
    (vm: VirtualMachine) => vm.powerState === 'poweredOn' && !vm.template
  );

  return poweredOnVMs.map((vm: VirtualMachine) => {
    const memGiB = mibToGiB(vm.memory);
    const totalStorageGiB = mibToGiB(vm.inUseMiB || vm.provisionedMiB); // Use in-use storage, fallback to provisioned
    const profile = mapVMToVSIProfile(vm.cpus, memGiB);
    const computeCost = getVSIPricing(profile.name);

    // Boot disk: Fixed size using general-purpose tier (3 IOPS/GB)
    // Boot volumes must use general-purpose profile and are limited to 10-250GB
    const bootDiskGiB = Math.min(BOOT_DISK_SIZE_GIB, Math.max(10, totalStorageGiB * 0.2)); // ~20% or max 100GB for boot
    const bootStorageCost = bootDiskGiB * BOOT_STORAGE_COST_PER_GB;

    // Data disks: Remaining storage using weighted average of tier distribution
    // Assumed mix: 50% general-purpose, 30% 5iops-tier, 20% 10iops-tier
    const dataDiskGiB = Math.max(0, totalStorageGiB - bootDiskGiB);
    const dataStorageCost = dataDiskGiB * DATA_STORAGE_COST_PER_GB;

    const storageCost = bootStorageCost + dataStorageCost;

    return {
      vmName: vm.vmName,
      sourceVcpus: vm.cpus,
      sourceMemoryGiB: Math.round(memGiB),
      sourceStorageGiB: Math.round(totalStorageGiB),
      bootDiskGiB: Math.round(bootDiskGiB),
      dataDiskGiB: Math.round(dataDiskGiB),
      profile: profile.name,
      profileVcpus: profile.vcpus,
      profileMemoryGiB: profile.memoryGiB,
      family: profile.family.charAt(0).toUpperCase() + profile.family.slice(1),
      computeCost,
      bootStorageCost,
      dataStorageCost,
      storageCost,
      monthlyCost: computeCost + storageCost,
    };
  });
}

// ===== SECTION BUILDERS =====

function buildCoverPage(options: DocxExportOptions): DocumentContent[] {
  const templates = reportTemplates.coverPage;
  const placeholders = reportTemplates.placeholders;

  return [
    new Paragraph({
      spacing: { before: 2400, after: 480 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: templates.title,
          bold: true,
          size: STYLES.titleSize,
          color: STYLES.primaryColor,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 960 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: templates.subtitle,
          size: STYLES.heading2Size,
          color: STYLES.secondaryColor,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 480, after: 240 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Prepared for: ${options.clientName || placeholders.clientName}`,
          size: STYLES.heading3Size,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 240 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Prepared by: ${options.preparedBy || placeholders.preparedBy}`,
          size: STYLES.heading3Size,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 240 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: options.companyName || placeholders.companyName,
          size: STYLES.heading3Size,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 480 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          size: STYLES.bodySize,
          color: STYLES.secondaryColor,
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

async function buildExecutiveSummary(rawData: RVToolsData, readiness: VMReadiness[]): Promise<DocumentContent[]> {
  const templates = reportTemplates.executiveSummary;
  const vms = rawData.vInfo.filter((vm) => !vm.template);
  const poweredOnVMs = vms.filter((vm) => vm.powerState === 'poweredOn');

  const totalVCPUs = poweredOnVMs.reduce((sum, vm) => sum + vm.cpus, 0);
  const totalMemoryTiB = mibToTiB(poweredOnVMs.reduce((sum, vm) => sum + vm.memory, 0));
  const totalStorageTiB = mibToTiB(poweredOnVMs.reduce((sum, vm) => sum + vm.provisionedMiB, 0));

  const readyCount = readiness.filter((r) => !r.hasBlocker && !r.hasWarning).length;
  const warningCount = readiness.filter((r) => r.hasWarning && !r.hasBlocker).length;
  const blockerCount = readiness.filter((r) => r.hasBlocker).length;
  const readinessPercent = readiness.length > 0 ? Math.round((readyCount / readiness.length) * 100) : 0;

  // Generate Migration Readiness pie chart
  const readinessChartData: ChartData[] = [
    { label: 'Ready', value: readyCount, color: CHART_COLORS[1] }, // Green
    { label: 'Needs Prep', value: warningCount, color: CHART_COLORS[3] }, // Orange
    { label: 'Blocked', value: blockerCount, color: CHART_COLORS[7] }, // Red
  ].filter(d => d.value > 0);

  const readinessChart = await generatePieChart(readinessChartData, 'Migration Readiness');

  // Generate Power State pie chart
  const poweredOffCount = vms.filter(vm => vm.powerState === 'poweredOff').length;
  const suspendedCount = vms.filter(vm => vm.powerState === 'suspended').length;
  const powerStateChartData: ChartData[] = [
    { label: 'Powered On', value: poweredOnVMs.length, color: CHART_COLORS[1] },
    { label: 'Powered Off', value: poweredOffCount, color: CHART_COLORS[0] },
    { label: 'Suspended', value: suspendedCount, color: CHART_COLORS[3] },
  ].filter(d => d.value > 0);

  const powerStateChart = await generatePieChart(powerStateChartData, 'VM Power State Distribution');

  const sections: DocumentContent[] = [
    createHeading('1. ' + templates.title, HeadingLevel.HEADING_1),
    createParagraph(templates.introduction),

    // At-a-Glance Summary Box
    createHeading('Assessment At-a-Glance', HeadingLevel.HEADING_2),
    new Paragraph({
      spacing: { after: 60 },
      bullet: { level: 0 },
      children: [
        new TextRun({
          text: `Environment: ${poweredOnVMs.length} VMs analyzed across ${rawData.vCluster.length} clusters with ${totalVCPUs.toLocaleString()} vCPUs and ${totalStorageTiB.toFixed(1)} TiB storage`,
          size: STYLES.bodySize,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      bullet: { level: 0 },
      children: [
        new TextRun({
          text: `Migration Readiness: ${readinessPercent}% of VMs are ready to migrate; ${blockerCount} VMs have blockers requiring remediation`,
          size: STYLES.bodySize,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      bullet: { level: 0 },
      children: [
        new TextRun({
          text: 'Recommended Platform: ROKS for organizations planning modernization; VSI for lift-and-shift with minimal change',
          size: STYLES.bodySize,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      bullet: { level: 0 },
      children: [
        new TextRun({
          text: 'Key Risks: Unsupported operating systems, snapshot sprawl, RDM disk usage, and Kubernetes skills gap (if ROKS)',
          size: STYLES.bodySize,
        }),
      ],
    }),

    // Source file info
    new Paragraph({
      spacing: { before: 120, after: 120 },
      children: [
        new TextRun({
          text: 'Source Data: ',
          bold: true,
          size: STYLES.bodySize,
        }),
        new TextRun({
          text: rawData.metadata.fileName || 'RVTools Export',
          size: STYLES.bodySize,
        }),
        new TextRun({
          text: rawData.metadata.collectionDate
            ? ` (Collected: ${new Date(rawData.metadata.collectionDate).toLocaleDateString()})`
            : '',
          size: STYLES.bodySize,
          color: STYLES.secondaryColor,
        }),
      ],
    }),

    createHeading(templates.keyFindings.title, HeadingLevel.HEADING_2),
    createParagraph(templates.keyFindings.environmentOverview),

    // Environment Summary Table
    createStyledTable(
      ['Metric', 'Value'],
      [
        ['Total VMs (Powered On)', `${poweredOnVMs.length}`],
        ['Total vCPUs', `${totalVCPUs.toLocaleString()}`],
        ['Total Memory', `${totalMemoryTiB.toFixed(1)} TiB`],
        ['Total Storage', `${totalStorageTiB.toFixed(1)} TiB`],
        ['Clusters', `${rawData.vCluster.length}`],
        ['ESXi Hosts', `${rawData.vHost.length}`],
      ],
      { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT] }
    ),

    // Power State Chart
    new Paragraph({ spacing: { before: 240 } }),
    createChartParagraph(powerStateChart, 480, 260),

    new Paragraph({ spacing: { before: 240 } }),
    createHeading('Migration Readiness Overview', HeadingLevel.HEADING_2),
    createStyledTable(
      ['Status', 'VM Count', 'Percentage'],
      [
        ['Ready to Migrate', `${readyCount}`, `${readinessPercent}%`],
        ['Needs Preparation', `${warningCount}`, `${readiness.length > 0 ? Math.round((warningCount / readiness.length) * 100) : 0}%`],
        ['Has Blockers', `${blockerCount}`, `${readiness.length > 0 ? Math.round((blockerCount / readiness.length) * 100) : 0}%`],
      ],
      { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT, AlignmentType.RIGHT] }
    ),

    // Readiness Chart
    createChartParagraph(readinessChart, 480, 260),

    new Paragraph({ spacing: { before: 240 } }),
    createHeading(templates.recommendations.title, HeadingLevel.HEADING_2),
    createParagraph(templates.recommendations.intro),

    // ROKS Recommendations
    new Paragraph({ spacing: { before: 200 } }),
    createParagraph(templates.recommendations.roksTitle, { bold: true }),
    createParagraph(templates.recommendations.roksRecommended),
    ...createBulletList(templates.recommendations.roksReasons),

    // VSI Recommendations
    new Paragraph({ spacing: { before: 200 } }),
    createParagraph(templates.recommendations.vsiTitle, { bold: true }),
    createParagraph(templates.recommendations.vsiRecommended),
    ...createBulletList(templates.recommendations.vsiReasons),

    new Paragraph({ children: [new PageBreak()] }),
  ];

  return sections;
}

function buildAssumptionsAndScope(): DocumentContent[] {
  return [
    createHeading('1.1 Assessment Assumptions & Scope', HeadingLevel.HEADING_2),
    createParagraph(
      'This assessment is based on the following assumptions and scope limitations. These should be considered when reviewing the recommendations and cost estimates.',
      { spacing: { after: 200 } }
    ),

    createParagraph('Data Source', { bold: true }),
    createParagraph(
      'Analysis is based on a point-in-time RVTools export from the VMware vSphere environment. Results reflect the environment state at the time of data collection.'
    ),

    new Paragraph({ spacing: { before: 120 } }),
    createParagraph('Scope Limitations', { bold: true }),
    ...createBulletList([
      'No application dependency mapping - workload dependencies between VMs have not been analyzed',
      'No performance benchmarking - actual CPU, memory, and storage utilization patterns are not assessed',
      'No licensing optimization - existing software licenses and cloud licensing options are not evaluated',
      'No network traffic analysis - bandwidth requirements between workloads are not measured',
      'No security or compliance review - regulatory requirements are not assessed in this report',
    ]),

    new Paragraph({ spacing: { before: 120 } }),
    createParagraph('Cost Estimate Assumptions', { bold: true }),
    ...createBulletList([
      'List pricing without enterprise discounts or committed use agreements',
      'US East region pricing (actual costs may vary by region)',
      'Standard support tier included',
      'Network egress and data transfer costs not included',
      'Operating system licensing for non-Linux workloads may incur additional costs on VSI',
    ]),

    new Paragraph({ spacing: { before: 120 } }),
    createParagraph('Recommendations', { bold: true }),
    createParagraph(
      'For a comprehensive migration plan, consider conducting application discovery, dependency mapping, and performance analysis to refine the sizing recommendations and identify optimal migration waves.'
    ),

    new Paragraph({ spacing: { before: 200 } }),
  ];
}

async function buildEnvironmentAnalysis(rawData: RVToolsData): Promise<DocumentContent[]> {
  const templates = reportTemplates.environmentAnalysis;
  const vms = rawData.vInfo.filter((vm) => !vm.template);
  const poweredOnVMs = vms.filter((vm) => vm.powerState === 'poweredOn');

  const totalVCPUs = poweredOnVMs.reduce((sum, vm) => sum + vm.cpus, 0);
  const totalMemoryGiB = poweredOnVMs.reduce((sum, vm) => sum + mibToGiB(vm.memory), 0);
  const totalVMStorageGiB = poweredOnVMs.reduce((sum, vm) => sum + mibToGiB(vm.provisionedMiB), 0);
  const avgStoragePerVM = poweredOnVMs.length > 0 ? totalVMStorageGiB / poweredOnVMs.length : 0;

  // Storage metrics
  const totalDatastoreCapacity = rawData.vDatastore.reduce((sum, ds) => sum + ds.capacityMiB, 0);
  const totalDatastoreUsed = rawData.vDatastore.reduce((sum, ds) => sum + ds.inUseMiB, 0);

  // Network metrics
  const totalNICs = rawData.vNetwork.length;
  const uniquePortGroups = new Set(rawData.vNetwork.map((n: VNetworkInfo) => n.networkName)).size;
  const uniqueSwitches = new Set(rawData.vNetwork.map((n: VNetworkInfo) => n.switchName)).size;

  // Generate vCPU distribution chart
  const vcpuBuckets = [
    { label: '1-2 vCPUs', min: 1, max: 2 },
    { label: '3-4 vCPUs', min: 3, max: 4 },
    { label: '5-8 vCPUs', min: 5, max: 8 },
    { label: '9-16 vCPUs', min: 9, max: 16 },
    { label: '17+ vCPUs', min: 17, max: Infinity },
  ];
  const vcpuData: ChartData[] = vcpuBuckets.map((bucket, index) => ({
    label: bucket.label,
    value: poweredOnVMs.filter(vm => vm.cpus >= bucket.min && vm.cpus <= bucket.max).length,
    color: CHART_COLORS[index % CHART_COLORS.length],
  })).filter(d => d.value > 0);

  const vcpuChart = await generatePieChart(vcpuData, 'vCPU Distribution');

  // Generate memory distribution chart
  const memBuckets = [
    { label: '0-4 GiB', min: 0, max: 4 },
    { label: '5-8 GiB', min: 5, max: 8 },
    { label: '9-16 GiB', min: 9, max: 16 },
    { label: '17-32 GiB', min: 17, max: 32 },
    { label: '33-64 GiB', min: 33, max: 64 },
    { label: '65+ GiB', min: 65, max: Infinity },
  ];
  const memData: ChartData[] = memBuckets.map((bucket, index) => {
    const memGiB = (vm: VirtualMachine) => mibToGiB(vm.memory);
    return {
      label: bucket.label,
      value: poweredOnVMs.filter(vm => memGiB(vm) >= bucket.min && memGiB(vm) <= bucket.max).length,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
  }).filter(d => d.value > 0);

  const memChart = await generatePieChart(memData, 'Memory Distribution');

  // Generate datastore type distribution chart
  const datastoreTypes = rawData.vDatastore.reduce((acc, ds) => {
    const type = ds.type || 'Other';
    acc[type] = (acc[type] || 0) + mibToGiB(ds.capacityMiB);
    return acc;
  }, {} as Record<string, number>);

  const dsTypeData: ChartData[] = Object.entries(datastoreTypes).map(([type, capacity], index) => ({
    label: type,
    value: Math.round(capacity),
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  const dsTypeChart = await generatePieChart(dsTypeData, 'Storage by Type (GiB)');

  return [
    createHeading('2. ' + templates.title, HeadingLevel.HEADING_1),
    createParagraph(templates.introduction),

    // Infrastructure overview
    createHeading('2.1 ' + templates.sections.infrastructure.title, HeadingLevel.HEADING_2),
    createParagraph(templates.sections.infrastructure.description),
    createStyledTable(
      ['Component', 'Count'],
      [
        ['vCenter Servers', `${rawData.vSource.length}`],
        ['Clusters', `${rawData.vCluster.length}`],
        ['ESXi Hosts', `${rawData.vHost.length}`],
        ['Virtual Machines', `${vms.length}`],
        ['Datastores', `${rawData.vDatastore.length}`],
      ],
      { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT] }
    ),

    // Compute resources
    new Paragraph({ spacing: { before: 240 } }),
    createHeading('2.2 ' + templates.sections.compute.title, HeadingLevel.HEADING_2),
    createParagraph(templates.sections.compute.description),
    createStyledTable(
      ['Resource', 'Value'],
      [
        ['Total vCPUs Allocated', `${totalVCPUs.toLocaleString()}`],
        ['Total Memory Allocated', `${(totalMemoryGiB / 1024).toFixed(1)} TiB`],
        ['Average vCPUs per VM', `${poweredOnVMs.length > 0 ? (totalVCPUs / poweredOnVMs.length).toFixed(1) : 0}`],
        ['Average Memory per VM', `${poweredOnVMs.length > 0 ? (totalMemoryGiB / poweredOnVMs.length).toFixed(0) : 0} GiB`],
      ],
      { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT] }
    ),

    // Compute distribution charts
    createChartParagraph(vcpuChart, 480, 260),
    createChartParagraph(memChart, 480, 260),

    // Storage analysis
    new Paragraph({ spacing: { before: 240 } }),
    createHeading('2.3 ' + templates.sections.storage.title, HeadingLevel.HEADING_2),
    createParagraph(templates.sections.storage.description),
    createStyledTable(
      ['Metric', 'Value'],
      [
        ['Total Datastore Capacity', `${mibToTiB(totalDatastoreCapacity).toFixed(1)} TiB`],
        ['Total Datastore Used', `${mibToTiB(totalDatastoreUsed).toFixed(1)} TiB`],
        ['Datastore Utilization', `${totalDatastoreCapacity > 0 ? ((totalDatastoreUsed / totalDatastoreCapacity) * 100).toFixed(0) : 0}%`],
        ['Total VM Storage Provisioned', `${(totalVMStorageGiB / 1024).toFixed(1)} TiB`],
        ['Average Storage per VM', `${avgStoragePerVM.toFixed(0)} GiB`],
      ],
      { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT] }
    ),

    // Storage type chart
    createChartParagraph(dsTypeChart, 480, 260),

    // Network summary
    new Paragraph({ spacing: { before: 240 } }),
    createHeading('2.4 ' + templates.sections.network.title, HeadingLevel.HEADING_2),
    createParagraph(templates.sections.network.description),
    createStyledTable(
      ['Component', 'Count'],
      [
        ['Total NICs', `${totalNICs}`],
        ['Port Groups', `${uniquePortGroups}`],
        ['Virtual Switches', `${uniqueSwitches}`],
      ],
      { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT] }
    ),

    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function buildMigrationReadiness(readiness: VMReadiness[], maxIssueVMs: number): DocumentContent[] {
  const templates = reportTemplates.migrationReadiness;
  const blockerVMs = readiness.filter((r) => r.hasBlocker).slice(0, maxIssueVMs);
  const warningVMs = readiness.filter((r) => r.hasWarning && !r.hasBlocker).slice(0, maxIssueVMs);

  const sections: DocumentContent[] = [
    createHeading('3. ' + templates.title, HeadingLevel.HEADING_1),
    createParagraph(templates.introduction),
    createHeading('3.1 ' + templates.checksPerformed.title, HeadingLevel.HEADING_2),
    ...createBulletList(
      templates.checksPerformed.checks.map((c) => `${c.name}: ${c.description}`)
    ),
  ];

  // Blockers table
  if (blockerVMs.length > 0) {
    sections.push(
      new Paragraph({ spacing: { before: 240 } }),
      createHeading('3.2 ' + templates.blockersSummary.title, HeadingLevel.HEADING_2),
      createParagraph(templates.blockersSummary.description),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3000, 2000, 4000],
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
              createTableCell('VM Name', { header: true }),
              createTableCell('Cluster', { header: true }),
              createTableCell('Issues', { header: true }),
            ],
          }),
          ...blockerVMs.map(
            (vm) =>
              new TableRow({
                children: [
                  createTableCell(vm.vmName.length > 30 ? vm.vmName.substring(0, 27) + '...' : vm.vmName),
                  createTableCell(vm.cluster),
                  createTableCell(vm.issues.join(', ')),
                ],
              })
          ),
        ],
      })
    );
    if (readiness.filter((r) => r.hasBlocker).length > maxIssueVMs) {
      sections.push(
        createParagraph(
          `Note: Showing ${maxIssueVMs} of ${readiness.filter((r) => r.hasBlocker).length} VMs with blockers. See Appendix A for the complete list.`,
          { spacing: { before: 120 } }
        )
      );
    }
  }

  // Warnings table
  if (warningVMs.length > 0) {
    sections.push(
      new Paragraph({ spacing: { before: 240 } }),
      createHeading('3.3 ' + templates.warningsSummary.title, HeadingLevel.HEADING_2),
      createParagraph(templates.warningsSummary.description),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3000, 2000, 4000],
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
              createTableCell('VM Name', { header: true }),
              createTableCell('Cluster', { header: true }),
              createTableCell('Warnings', { header: true }),
            ],
          }),
          ...warningVMs.map(
            (vm) =>
              new TableRow({
                children: [
                  createTableCell(vm.vmName.length > 30 ? vm.vmName.substring(0, 27) + '...' : vm.vmName),
                  createTableCell(vm.cluster),
                  createTableCell(vm.issues.join(', ')),
                ],
              })
          ),
        ],
      })
    );
    if (readiness.filter((r) => r.hasWarning && !r.hasBlocker).length > maxIssueVMs) {
      sections.push(
        createParagraph(
          `Note: Showing ${maxIssueVMs} of ${readiness.filter((r) => r.hasWarning && !r.hasBlocker).length} VMs with warnings. See Appendix B for the complete list.`,
          { spacing: { before: 120 } }
        )
      );
    }
  }

  // Key Migration Risks section
  sections.push(
    new Paragraph({ spacing: { before: 240 } }),
    createHeading('3.4 Key Migration Risks', HeadingLevel.HEADING_2),
    createParagraph(
      'The following risks have been identified based on the environment analysis. These should be addressed during migration planning.',
      { spacing: { after: 200 } }
    )
  );

  // Build risk items based on actual findings
  const riskItems: string[] = [];

  const unsupportedOSCount = readiness.filter(r => r.issues.includes('Unsupported OS')).length;
  if (unsupportedOSCount > 0) {
    riskItems.push(`Unsupported Operating Systems: ${unsupportedOSCount} VMs have operating systems that may not be supported on the target platform. Review and plan for OS upgrades or alternative migration approaches.`);
  }

  const snapshotCount = readiness.filter(r => r.issues.includes('Old Snapshots (>30d)')).length;
  if (snapshotCount > 0) {
    riskItems.push(`Snapshot Sprawl: ${snapshotCount} VMs have snapshots older than 30 days. Consolidate or remove snapshots before migration to reduce migration time and storage requirements.`);
  }

  const rdmCount = readiness.filter(r => r.issues.includes('RDM Disk')).length;
  if (rdmCount > 0) {
    riskItems.push(`Raw Device Mappings (RDM): ${rdmCount} VMs use RDM disks which require special handling. Plan for storage reconfiguration or alternative storage solutions.`);
  }

  const noToolsCount = readiness.filter(r => r.issues.includes('No VMware Tools')).length;
  if (noToolsCount > 0) {
    riskItems.push(`Missing VMware Tools: ${noToolsCount} VMs do not have VMware Tools installed. Install tools or plan for post-migration agent deployment.`);
  }

  // Add general risks that apply to all migrations
  riskItems.push('Skills Gap (ROKS): If selecting ROKS with OpenShift Virtualization, ensure the operations team has Kubernetes expertise or plan for training and enablement.');
  riskItems.push('Cost Variance: Actual costs may differ significantly from estimates based on negotiated enterprise agreements, reserved capacity commitments, and actual usage patterns.');
  riskItems.push('Application Dependencies: Without application dependency mapping, there is risk of service disruption if dependent VMs are migrated in separate waves.');

  sections.push(...createBulletList(riskItems));

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  return sections;
}

function buildMigrationOptions(): DocumentContent[] {
  const templates = reportTemplates.migrationOptions;

  return [
    createHeading('4. ' + templates.title, HeadingLevel.HEADING_1),
    createParagraph(templates.introduction),
    createParagraph(templates.comparisonIntro),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
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
            createTableCell('VM to container platform'),
            createTableCell('Lift-and-shift'),
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
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

interface NetworkWave {
  portGroup: string;
  vSwitch: string;
  vmCount: number;
  vcpus: number;
  memoryGiB: number;
  storageGiB: number;
  subnet: string;
}

function buildMigrationStrategy(rawData: RVToolsData): DocumentContent[] {
  const networks = rawData.vNetwork;
  const vms = rawData.vInfo.filter((vm: VirtualMachine) => vm.powerState === 'poweredOn' && !vm.template);

  // Build network summary by port group
  const portGroupMap = new Map<string, {
    vSwitch: string;
    vmNames: Set<string>;
    ips: string[];
  }>();

  networks.forEach((nic: VNetworkInfo) => {
    const pg = nic.networkName || 'Unknown';
    if (!portGroupMap.has(pg)) {
      portGroupMap.set(pg, {
        vSwitch: nic.switchName || 'Unknown',
        vmNames: new Set(),
        ips: [],
      });
    }
    const data = portGroupMap.get(pg)!;
    data.vmNames.add(nic.vmName);
    if (nic.ipv4Address) {
      data.ips.push(nic.ipv4Address);
    }
  });

  // Convert to waves with resource totals
  const networkWaves: NetworkWave[] = [];
  portGroupMap.forEach((data, portGroup) => {
    // Get VMs in this port group
    const vmNames = Array.from(data.vmNames);
    const waveVMs = vms.filter((vm: VirtualMachine) => vmNames.includes(vm.vmName));

    // Calculate subnet from most common IP prefix
    let subnet = 'N/A';
    if (data.ips.length > 0) {
      const prefixCounts = new Map<string, number>();
      data.ips.forEach(ip => {
        const parts = ip.split('.');
        if (parts.length >= 3) {
          const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
          prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
        }
      });
      let maxCount = 0;
      let mostCommonPrefix = '';
      prefixCounts.forEach((count, prefix) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonPrefix = prefix;
        }
      });
      if (mostCommonPrefix) {
        subnet = `${mostCommonPrefix}.0/24`;
      }
    }

    networkWaves.push({
      portGroup,
      vSwitch: data.vSwitch,
      vmCount: waveVMs.length,
      vcpus: waveVMs.reduce((sum: number, vm: VirtualMachine) => sum + vm.cpus, 0),
      memoryGiB: Math.round(waveVMs.reduce((sum: number, vm: VirtualMachine) => sum + mibToGiB(vm.memory), 0)),
      storageGiB: Math.round(waveVMs.reduce((sum: number, vm: VirtualMachine) => sum + mibToGiB(vm.provisionedMiB), 0)),
      subnet,
    });
  });

  // Sort by VM count (smaller waves first for pilot)
  networkWaves.sort((a, b) => a.vmCount - b.vmCount);

  // Get top 20 waves for the table
  const topWaves = networkWaves.slice(0, 20);

  return [
    createHeading('5. Migration Strategy', HeadingLevel.HEADING_1),
    createParagraph(
      'This section outlines the recommended migration approach based on network topology analysis. Migrating workloads by subnet or port group minimizes network reconfiguration and reduces risk during cutover.',
      { spacing: { after: 200 } }
    ),

    createHeading('5.1 Subnet-Based Migration Approach', HeadingLevel.HEADING_2),
    createParagraph(
      'The recommended migration strategy groups virtual machines by their network port group (subnet). This approach is preferred for both ROKS and VSI migrations because:',
      { spacing: { after: 120 } }
    ),
    ...createBulletList([
      'Network Continuity: VMs within the same subnet typically communicate with each other. Migrating them together maintains application functionality during cutover.',
      'Simplified Cutover: Entire subnets can be switched over at once, reducing the complexity of managing split-brain scenarios during migration.',
      'Consistent IP Addressing: Preserving IP addresses within a migrated subnet reduces the need for DNS updates and application reconfiguration.',
      'Predictable Waves: Port groups provide natural migration wave boundaries with known VM counts and resource requirements.',
      'Reduced Testing Scope: Each wave can be validated as a unit before proceeding to the next, with clear rollback boundaries.',
    ]),

    createHeading('5.2 ROKS Migration Considerations', HeadingLevel.HEADING_2),
    createParagraph(
      'For ROKS with OpenShift Virtualization, subnet-based migration aligns with the Migration Toolkit for Virtualization (MTV) workflow:',
      { spacing: { after: 120 } }
    ),
    ...createBulletList([
      'MTV supports network mapping to translate VMware port groups to OpenShift network attachment definitions',
      'OVN-Kubernetes secondary networks can mirror the original VLAN structure for seamless connectivity',
      'VMs can retain their original IP addresses when migrated to appropriately configured secondary networks',
      'Migration plans in MTV naturally map to port group waves, enabling orchestrated cutover',
    ]),

    createHeading('5.3 VSI Migration Considerations', HeadingLevel.HEADING_2),
    createParagraph(
      'For VPC Virtual Server migration, subnet-based waves simplify VPC network design:',
      { spacing: { after: 120 } }
    ),
    ...createBulletList([
      'Each VMware port group maps to a VPC subnet with equivalent CIDR range',
      'Security groups can be pre-configured to match existing firewall rules before migration',
      'VPN or Direct Link connectivity can route traffic to migrated subnets during transition',
      'Phased cutover allows gradual DNS updates as each subnet completes migration',
    ]),

    createHeading('5.4 Network Wave Summary', HeadingLevel.HEADING_2),
    createParagraph(
      `The environment contains ${networkWaves.length} unique port groups. The following table shows the proposed migration waves based on network topology:`,
      { spacing: { after: 120 } }
    ),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
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
            createTableCell('Wave', { header: true }),
            createTableCell('Port Group', { header: true }),
            createTableCell('Subnet', { header: true }),
            createTableCell('VMs', { header: true, align: AlignmentType.RIGHT }),
            createTableCell('vCPUs', { header: true, align: AlignmentType.RIGHT }),
            createTableCell('Memory', { header: true, align: AlignmentType.RIGHT }),
          ],
        }),
        ...topWaves.map((wave, idx) =>
          new TableRow({
            children: [
              createTableCell(`Wave ${idx + 1}`),
              createTableCell(wave.portGroup.length > 25 ? wave.portGroup.substring(0, 22) + '...' : wave.portGroup),
              createTableCell(wave.subnet),
              createTableCell(`${wave.vmCount}`, { align: AlignmentType.RIGHT }),
              createTableCell(`${wave.vcpus}`, { align: AlignmentType.RIGHT }),
              createTableCell(`${wave.memoryGiB} GiB`, { align: AlignmentType.RIGHT }),
            ],
          })
        ),
      ],
    }),
    networkWaves.length > 20 ? createParagraph(
      `Note: Showing 20 of ${networkWaves.length} port groups. Smaller waves are listed first to identify pilot migration candidates.`,
      { spacing: { before: 120 } }
    ) : new Paragraph({}),

    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function buildROKSOverview(sizing: ROKSSizing): DocumentContent[] {
  const templates = reportTemplates.roksOverview;

  return [
    createHeading('6. ' + templates.title, HeadingLevel.HEADING_1),
    createParagraph(templates.introduction),

    createHeading('6.1 ' + templates.whatIsRoks.title, HeadingLevel.HEADING_2),
    createParagraph(templates.whatIsRoks.content),

    createHeading('6.2 ' + templates.architecture.title, HeadingLevel.HEADING_2),
    createParagraph(templates.architecture.content),
    ...createBulletList(templates.architecture.components),

    createHeading('6.3 ' + templates.benefits.title, HeadingLevel.HEADING_2),
    ...templates.benefits.items.flatMap((b) => [
      createParagraph(b.title, { bold: true }),
      createParagraph(b.description),
    ]),

    createHeading('6.4 ' + templates.considerations.title, HeadingLevel.HEADING_2),
    ...createBulletList(templates.considerations.items),

    createHeading('6.5 ' + templates.sizing.title, HeadingLevel.HEADING_2),
    createParagraph(templates.sizing.description),
    createParagraph(templates.sizing.methodology, { spacing: { after: 120 } }),

    // ODF operational capacity explanation
    createHeading('6.5.1 ODF Storage Sizing', HeadingLevel.HEADING_3),
    createParagraph(
      'OpenShift Data Foundation (ODF) uses Ceph for software-defined storage with 3-way replication for data protection. ' +
      'The sizing calculation reserves 25% of usable capacity for ODF operational overhead, resulting in 75% operational capacity. ' +
      'This reserve ensures space for:',
      { spacing: { after: 60 } }
    ),
    ...createBulletList([
      'Ceph rebalancing operations during node maintenance or failures',
      'Automatic data recovery and reconstruction after disk or node failures',
      'Storage system metadata and internal operations',
      'Headroom for workload growth without immediate capacity expansion',
    ]),
    createParagraph(
      'The "ODF Usable Storage" value in the table below represents the effective storage available for VM workloads after accounting for 3x replication, 75% operational capacity, and Ceph overhead.',
      { spacing: { before: 120, after: 240 } }
    ),

    // CPU Over-commitment explanation
    createHeading('6.5.2 CPU Over-commitment', HeadingLevel.HEADING_3),
    createParagraph(
      'OpenShift Virtualization supports CPU over-commitment, allowing you to allocate more virtual CPUs (vCPUs) to VMs than physical CPUs available on the host. ' +
      'This is a standard practice in virtualization that can increase efficiency when workloads do not fully utilize their allocated CPU resources.',
      { spacing: { after: 120 } }
    ),
    createParagraph(
      'The sizing calculations in this report use a conservative 1.8:1 CPU over-commit ratio. This means for every physical CPU thread, ' +
      '1.8 vCPUs can be allocated to virtual machines. This conservative ratio ensures reliable performance for production workloads while still benefiting from consolidation.',
      { spacing: { after: 120 } }
    ),
    createParagraph('Key considerations for CPU over-commitment:', { bold: true, spacing: { after: 60 } }),
    ...createBulletList([
      'Workload Characteristics: CPU-intensive applications may require lower over-commit ratios (1:1 to 1.5:1), while typical enterprise workloads can use 2:1 or higher',
      'Performance Monitoring: Monitor CPU ready time and utilization metrics to ensure VMs are not CPU-constrained',
      'Node Capacity: OpenShift reserves CPU for system services (kubelet, CRI-O, OS); approximately 15% overhead is factored into sizing',
    ]),

    // Memory over-commitment explanation
    new Paragraph({ spacing: { before: 200 } }),
    createHeading('6.5.3 Memory Over-commitment', HeadingLevel.HEADING_3),
    createParagraph(
      'Memory over-commitment is supported in OpenShift Virtualization (4.16+) but is not enabled by default and requires careful consideration. ' +
      'Unlike CPU, memory cannot be "time-shared" - when physical memory is exhausted, the system must use swap storage or terminate processes.',
      { spacing: { after: 120 } }
    ),
    createParagraph(
      'OpenShift Virtualization provides the wasp-agent component to enable safe memory over-commitment by configuring swap storage on worker nodes. ' +
      'This allows VMs to page memory to disk during contention, enabling higher VM density at the cost of potential performance degradation.',
      { spacing: { after: 120 } }
    ),
    createParagraph('Memory over-commitment considerations:', { bold: true, spacing: { after: 60 } }),
    ...createBulletList([
      'Not Recommended by Default: This sizing uses 1:1 memory allocation for predictable VM performance',
      'Swap Requirements: If enabled, swap space should equal or exceed the over-committed RAM amount',
      'Performance Impact: RAM access is ~1000x faster than NVMe storage; heavy swap usage causes significant latency',
      'Dedicated Storage: Use fast, dedicated NVMe devices for swap rather than shared storage',
      'Workload Suitability: Only suitable for workloads tolerant of occasional performance degradation',
    ]),
    createParagraph(
      'For more information on resource over-commitment, refer to:',
      { spacing: { before: 120, after: 60 } }
    ),
    ...createBulletList([
      'Red Hat: Evaluating Memory Overcommitment - https://developers.redhat.com/articles/2025/04/24/evaluating-memory-overcommitment-openshift-virtualization',
      'Red Hat: Memory Management in OpenShift Virtualization - https://developers.redhat.com/blog/2025/01/31/memory-management-openshift-virtualization',
      'OpenShift Virtualization 4.16 Documentation - https://docs.redhat.com/en/documentation/openshift_container_platform/4.16/html-single/virtualization/index',
    ]),

    new Paragraph({ spacing: { before: 240 } }),
    createHeading('6.5.4 Recommended Configuration', HeadingLevel.HEADING_3),
    createStyledTable(
      ['Configuration', 'Value'],
      [
        ['Bare Metal Profile', sizing.profileName],
        ['Worker Nodes (N+2)', `${sizing.workerNodes}`],
        ['Total Physical Cores', `${sizing.totalCores}`],
        ['Total Threads', `${sizing.totalThreads}`],
        ['Total Memory', `${sizing.totalMemoryGiB} GiB`],
        ['Total Raw NVMe', `${sizing.totalNvmeTiB} TiB`],
        ['ODF Usable Storage', `${sizing.odfUsableTiB} TiB`],
      ],
      { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT] }
    ),

    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function buildVSIOverview(mappings: VSIMapping[], maxVMs: number): DocumentContent[] {
  const templates = reportTemplates.vsiOverview;

  // Profile distribution summary
  const profileDistribution = mappings.reduce((acc, m) => {
    acc[m.family] = (acc[m.family] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return [
    createHeading('7. ' + templates.title, HeadingLevel.HEADING_1),
    createParagraph(templates.introduction),

    createHeading('7.1 ' + templates.whatIsVsi.title, HeadingLevel.HEADING_2),
    createParagraph(templates.whatIsVsi.content),

    createHeading('7.2 ' + templates.architecture.title, HeadingLevel.HEADING_2),
    createParagraph(templates.architecture.content),
    ...createBulletList(templates.architecture.components),

    createHeading('7.3 ' + templates.profileFamilies.title, HeadingLevel.HEADING_2),
    createParagraph(templates.profileFamilies.description),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
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
            createTableCell('Family', { header: true }),
            createTableCell('CPU:Memory', { header: true }),
            createTableCell('Use Case', { header: true }),
          ],
        }),
        ...templates.profileFamilies.families.map(
          (f) =>
            new TableRow({
              children: [
                createTableCell(f.name),
                createTableCell(f.ratio),
                createTableCell(f.useCase),
              ],
            })
        ),
      ],
    }),

    createHeading('7.4 ' + templates.benefits.title, HeadingLevel.HEADING_2),
    ...templates.benefits.items.flatMap((b) => [
      createParagraph(b.title, { bold: true }),
      createParagraph(b.description),
    ]),

    createHeading('7.5 ' + templates.considerations.title, HeadingLevel.HEADING_2),
    ...createBulletList(templates.considerations.items),

    createHeading('7.6 ' + templates.sizing.title, HeadingLevel.HEADING_2),
    createParagraph(templates.sizing.description),

    // Profile distribution
    createHeading('7.6.1 Profile Distribution', HeadingLevel.HEADING_3),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
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
            createTableCell('Profile Family', { header: true }),
            createTableCell('VM Count', { header: true, align: AlignmentType.RIGHT }),
          ],
        }),
        ...Object.entries(profileDistribution).map(
          ([family, count]) =>
            new TableRow({
              children: [
                createTableCell(family),
                createTableCell(`${count}`, { align: AlignmentType.RIGHT }),
              ],
            })
        ),
      ],
    }),

    // Sample mappings table
    new Paragraph({ spacing: { before: 240 } }),
    createHeading('7.6.2 Sample VM to VSI Mappings', HeadingLevel.HEADING_3),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
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
            createTableCell('VM Name', { header: true }),
            createTableCell('vCPUs', { header: true, align: AlignmentType.RIGHT }),
            createTableCell('Memory', { header: true, align: AlignmentType.RIGHT }),
            createTableCell('Profile', { header: true }),
          ],
        }),
        ...mappings.slice(0, maxVMs).map(
          (m) =>
            new TableRow({
              children: [
                createTableCell(m.vmName.length > 25 ? m.vmName.substring(0, 22) + '...' : m.vmName),
                createTableCell(`${m.sourceVcpus}`, { align: AlignmentType.RIGHT }),
                createTableCell(`${m.sourceMemoryGiB} GiB`, { align: AlignmentType.RIGHT }),
                createTableCell(m.profile),
              ],
            })
        ),
      ],
    }),
    mappings.length > maxVMs
      ? createParagraph(`Note: Showing ${maxVMs} of ${mappings.length} VM mappings.`, { spacing: { before: 120 } })
      : new Paragraph({}),

    // Block Storage Profiles section
    new Paragraph({ spacing: { before: 360 } }),
    createHeading('7.7 Block Storage Profiles', HeadingLevel.HEADING_2),
    createParagraph(
      'IBM Cloud offers multiple storage profiles for VSI disk volumes, each optimized for different performance requirements. ' +
      'Understanding these profiles is essential for proper workload placement and cost optimization.'
    ),

    createHeading('7.7.1 First-Generation Storage Profiles', HeadingLevel.HEADING_3),
    createParagraph(
      'The first-generation storage profiles provide reliable block storage with predictable IOPS performance:'
    ),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
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
            createTableCell('Profile', { header: true }),
            createTableCell('IOPS/GB', { header: true, align: AlignmentType.CENTER }),
            createTableCell('Use Case', { header: true }),
            createTableCell('Boot Volume', { header: true, align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('general-purpose'),
            createTableCell('3', { align: AlignmentType.CENTER }),
            createTableCell('Standard workloads, file servers, development'),
            createTableCell('Yes (Required)', { align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('5iops-tier'),
            createTableCell('5', { align: AlignmentType.CENTER }),
            createTableCell('Moderate I/O applications, web servers'),
            createTableCell('No', { align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('10iops-tier'),
            createTableCell('10', { align: AlignmentType.CENTER }),
            createTableCell('High-performance databases, transactional workloads'),
            createTableCell('No', { align: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('custom'),
            createTableCell('100-48000', { align: AlignmentType.CENTER }),
            createTableCell('Custom IOPS configuration for specific requirements'),
            createTableCell('No', { align: AlignmentType.CENTER }),
          ],
        }),
      ],
    }),

    createParagraph('Boot Volume Requirements:', { bold: true, spacing: { before: 200 } }),
    ...createBulletList([
      'Boot volumes must use the general-purpose profile exclusively',
      'Boot disk size is limited to 10 GiB minimum and 250 GiB maximum',
      'VSI instances cannot have more than 12 attached disk volumes',
    ]),

    createHeading('7.7.2 Second-Generation Storage (SDP)', HeadingLevel.HEADING_3),
    createParagraph(
      'The sdp (second-generation) storage profile provides enhanced IOPS performance and finer control. ' +
      'However, there are important limitations to consider before deployment:'
    ),
    ...createBulletList([
      'SDP volumes can only be snapshotted individually, not as part of a consistency group',
      'SDP volumes may not reliably detect GPT formatted volumes and could boot to BIOS rather than UEFI - avoid using for boot volumes, especially with secure boot',
      'SDP volumes are not available in all regions (notably Montreal, and may not be immediately available in newly announced regions)',
      'Over time, SDP capabilities are expected to match and exceed first-generation profiles',
    ]),

    createParagraph('Recommendation:', { bold: true, spacing: { before: 160 } }),
    createParagraph(
      'For VMware migrations, use first-generation storage profiles for predictability and full feature support. ' +
      'Consider SDP volumes only for specific workloads requiring enhanced performance where snapshot consistency groups are not needed.',
      { spacing: { after: 120 } }
    ),

    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function buildCostEstimation(
  roksSizing: ROKSSizing,
  vsiMappings: VSIMapping[]
): DocumentContent[] {
  const templates = reportTemplates.costEstimation;

  // VSI cost breakdown
  const totalVSIComputeCost = vsiMappings.reduce((sum, m) => sum + m.computeCost, 0);
  const totalBootStorageCost = vsiMappings.reduce((sum, m) => sum + m.bootStorageCost, 0);
  const totalDataStorageCost = vsiMappings.reduce((sum, m) => sum + m.dataStorageCost, 0);
  const totalVSIStorageCost = totalBootStorageCost + totalDataStorageCost;
  const totalVSIMonthlyCost = totalVSIComputeCost + totalVSIStorageCost;
  const totalBootStorageGiB = vsiMappings.reduce((sum, m) => sum + m.bootDiskGiB, 0);
  const totalDataStorageGiB = vsiMappings.reduce((sum, m) => sum + m.dataDiskGiB, 0);
  const totalVSIStorageGiB = totalBootStorageGiB + totalDataStorageGiB;
  const roksMonthlyCost = roksSizing.monthlyCost;

  // Calculate cost ratio for recommendation
  const costRatio = totalVSIMonthlyCost > 0 ? (roksMonthlyCost / totalVSIMonthlyCost).toFixed(1) : 'N/A';
  const annualDifference = (roksMonthlyCost - totalVSIMonthlyCost) * 12;

  return [
    createHeading('8. ' + templates.title, HeadingLevel.HEADING_1),
    createParagraph(templates.introduction),
    createParagraph(templates.disclaimer, { spacing: { after: 240 } }),

    createHeading('8.1 ' + templates.sections.comparison.title, HeadingLevel.HEADING_2),
    createParagraph(templates.sections.comparison.description),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
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
            createTableCell('Platform', { header: true }),
            createTableCell('Compute', { header: true, align: AlignmentType.RIGHT }),
            createTableCell('Storage', { header: true, align: AlignmentType.RIGHT }),
            createTableCell('Monthly Total', { header: true, align: AlignmentType.RIGHT }),
            createTableCell('Annual Total', { header: true, align: AlignmentType.RIGHT }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('ROKS (Bare Metal)'),
            createTableCell(`$${roksMonthlyCost.toLocaleString()}`, { align: AlignmentType.RIGHT }),
            createTableCell('Included', { align: AlignmentType.RIGHT }),
            createTableCell(`$${roksMonthlyCost.toLocaleString()}`, { align: AlignmentType.RIGHT }),
            createTableCell(`$${(roksMonthlyCost * 12).toLocaleString()}`, { align: AlignmentType.RIGHT }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('VPC VSI'),
            createTableCell(`$${Math.round(totalVSIComputeCost).toLocaleString()}`, { align: AlignmentType.RIGHT }),
            createTableCell(`$${Math.round(totalVSIStorageCost).toLocaleString()}`, { align: AlignmentType.RIGHT }),
            createTableCell(`$${Math.round(totalVSIMonthlyCost).toLocaleString()}`, { align: AlignmentType.RIGHT }),
            createTableCell(`$${Math.round(totalVSIMonthlyCost * 12).toLocaleString()}`, { align: AlignmentType.RIGHT }),
          ],
        }),
      ],
    }),

    // VSI Storage breakdown
    new Paragraph({ spacing: { before: 200 } }),
    createParagraph('VSI Block Storage Breakdown', { bold: true }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
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
            createTableCell('Storage Type', { header: true }),
            createTableCell('Capacity', { header: true, align: AlignmentType.RIGHT }),
            createTableCell('Profile', { header: true }),
            createTableCell('Monthly Cost', { header: true, align: AlignmentType.RIGHT }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('Boot Volumes'),
            createTableCell(`${Math.round(totalBootStorageGiB)} GiB`, { align: AlignmentType.RIGHT }),
            createTableCell('general-purpose (3 IOPS/GB)'),
            createTableCell(`$${Math.round(totalBootStorageCost).toLocaleString()}`, { align: AlignmentType.RIGHT }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('Data Volumes'),
            createTableCell(`${Math.round(totalDataStorageGiB)} GiB`, { align: AlignmentType.RIGHT }),
            createTableCell('Tiered (see assumptions)'),
            createTableCell(`$${Math.round(totalDataStorageCost).toLocaleString()}`, { align: AlignmentType.RIGHT }),
          ],
        }),
        new TableRow({
          children: [
            createTableCell('Total Storage', { bold: true }),
            createTableCell(`${Math.round(totalVSIStorageGiB / 1024)} TiB`, { align: AlignmentType.RIGHT, bold: true }),
            createTableCell(''),
            createTableCell(`$${Math.round(totalVSIStorageCost).toLocaleString()}`, { align: AlignmentType.RIGHT, bold: true }),
          ],
        }),
      ],
    }),

    // Storage tier assumptions
    new Paragraph({ spacing: { before: 160 } }),
    createParagraph('Data Volume Storage Tier Assumptions:', { bold: true }),
    ...createBulletList([
      '50% general-purpose (3 IOPS/GB) at $0.08/GB - Standard workloads, file servers',
      '30% 5iops-tier (5 IOPS/GB) at $0.10/GB - Moderate I/O applications',
      '20% 10iops-tier (10 IOPS/GB) at $0.13/GB - Database and high-performance workloads',
    ]),

    // Cost Analysis and Recommendations
    new Paragraph({ spacing: { before: 240 } }),
    createHeading('8.2 Cost Analysis & Recommendations', HeadingLevel.HEADING_2),

    // Cost delta callout
    new Paragraph({
      spacing: { before: 120, after: 120 },
      shading: { fill: 'fff8e6', type: ShadingType.SOLID },
      children: [
        new TextRun({
          text: 'Key Finding: ',
          bold: true,
          size: STYLES.bodySize,
        }),
        new TextRun({
          text: `At list pricing, ROKS with OpenShift Virtualization is approximately ${costRatio}× higher cost than VPC VSI, representing an annual difference of $${Math.abs(Math.round(annualDifference)).toLocaleString()}.`,
          size: STYLES.bodySize,
        }),
      ],
    }),

    // Use-case justification
    createParagraph('Platform Selection Guidance', { bold: true, spacing: { before: 200 } }),
    ...createBulletList([
      'Choose ROKS if: Your organization plans to modernize applications to containers, requires hybrid cloud portability, or wants a unified platform for VMs and containers. The higher infrastructure cost is justified by the modernization pathway and operational efficiency gains.',
      'Choose VSI if: Your primary goal is a straightforward lift-and-shift migration with minimal operational change. VSI provides familiar VM management at lower infrastructure cost, suitable for stable workloads without near-term modernization plans.',
    ]),

    // Discount disclaimer
    new Paragraph({ spacing: { before: 200 } }),
    createParagraph('Important Pricing Considerations', { bold: true }),
    createParagraph(
      'The estimates above are based on IBM Cloud list pricing. Actual costs may differ significantly based on:',
      { spacing: { after: 60 } }
    ),
    ...createBulletList([
      'Enterprise discount agreements - Large organizations typically negotiate 20-40% discounts',
      'Reserved capacity commitments - 1-year or 3-year commitments can reduce costs by 30-50%',
      'Hybrid cloud entitlements - Existing Red Hat subscriptions may offset ROKS licensing costs',
      'Promotional pricing - IBM frequently offers migration incentives for VMware customers',
    ]),
    createParagraph(
      'Contact your IBM representative or authorized partner for a customized quote based on your specific requirements and existing agreements.',
      { spacing: { before: 120 } }
    ),

    new Paragraph({ spacing: { before: 240 } }),
    createHeading('8.3 ' + templates.notes.title, HeadingLevel.HEADING_2),
    ...createBulletList(templates.notes.items),

    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function buildNextSteps(options: DocxExportOptions): DocumentContent[] {
  const templates = reportTemplates.nextSteps;
  const placeholders = reportTemplates.placeholders;

  const sections: DocumentContent[] = [
    createHeading('9. ' + templates.title, HeadingLevel.HEADING_1),
    createParagraph(templates.introduction),
  ];

  templates.steps.forEach((phase, index) => {
    sections.push(
      createHeading(`9.${index + 1} ${phase.phase}`, HeadingLevel.HEADING_2),
      ...createBulletList(phase.items)
    );
  });

  sections.push(
    new Paragraph({ spacing: { before: 480 } }),
    createHeading('9.5 ' + templates.contact.title, HeadingLevel.HEADING_2),
    createParagraph(templates.contact.content),
    createParagraph(options.companyName || placeholders.companyName, { bold: true }),
    createParagraph(options.preparedBy || placeholders.preparedBy),
    createParagraph(placeholders.contactEmail),
    createParagraph(placeholders.contactPhone)
  );

  return sections;
}

function buildAppendices(readiness: VMReadiness[], maxIssueVMs: number): DocumentContent[] {
  const allBlockerVMs = readiness.filter((r) => r.hasBlocker);
  const allWarningVMs = readiness.filter((r) => r.hasWarning && !r.hasBlocker);

  // Only include appendices if there are more VMs than shown in main body
  if (allBlockerVMs.length <= maxIssueVMs && allWarningVMs.length <= maxIssueVMs) {
    return [];
  }

  const sections: DocumentContent[] = [
    createHeading('Appendices', HeadingLevel.HEADING_1),
    createParagraph(
      'The following appendices contain the complete lists of virtual machines with migration issues that were summarized in the main report.',
      { spacing: { after: 200 } }
    ),
  ];

  // Appendix A: Full Blockers List
  if (allBlockerVMs.length > maxIssueVMs) {
    sections.push(
      new Paragraph({ spacing: { before: 240 } }),
      createHeading('Appendix A: Complete List of VMs with Blockers', HeadingLevel.HEADING_2),
      createParagraph(
        `This appendix contains all ${allBlockerVMs.length} virtual machines with migration blockers that must be resolved before migration.`,
        { spacing: { after: 120 } }
      ),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [2500, 1500, 1500, 1500, 3500],
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
              createTableCell('VM Name', { header: true }),
              createTableCell('Cluster', { header: true }),
              createTableCell('vCPUs', { header: true, align: AlignmentType.RIGHT }),
              createTableCell('Memory', { header: true, align: AlignmentType.RIGHT }),
              createTableCell('Issues', { header: true }),
            ],
          }),
          ...allBlockerVMs.map(
            (vm, index) =>
              new TableRow({
                children: [
                  createTableCell(
                    vm.vmName.length > 25 ? vm.vmName.substring(0, 22) + '...' : vm.vmName,
                    { altRow: index % 2 === 1 }
                  ),
                  createTableCell(vm.cluster, { altRow: index % 2 === 1 }),
                  createTableCell(`${vm.cpus}`, { align: AlignmentType.RIGHT, altRow: index % 2 === 1 }),
                  createTableCell(`${vm.memoryGiB} GiB`, { align: AlignmentType.RIGHT, altRow: index % 2 === 1 }),
                  createTableCell(vm.issues.join(', '), { altRow: index % 2 === 1 }),
                ],
              })
          ),
        ],
      })
    );
  }

  // Appendix B: Full Warnings List
  if (allWarningVMs.length > maxIssueVMs) {
    sections.push(
      new Paragraph({ children: [new PageBreak()] }),
      createHeading('Appendix B: Complete List of VMs with Warnings', HeadingLevel.HEADING_2),
      createParagraph(
        `This appendix contains all ${allWarningVMs.length} virtual machines with warnings that should be reviewed before migration.`,
        { spacing: { after: 120 } }
      ),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [2500, 1500, 1500, 1500, 3500],
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
              createTableCell('VM Name', { header: true }),
              createTableCell('Cluster', { header: true }),
              createTableCell('vCPUs', { header: true, align: AlignmentType.RIGHT }),
              createTableCell('Memory', { header: true, align: AlignmentType.RIGHT }),
              createTableCell('Warnings', { header: true }),
            ],
          }),
          ...allWarningVMs.map(
            (vm, index) =>
              new TableRow({
                children: [
                  createTableCell(
                    vm.vmName.length > 25 ? vm.vmName.substring(0, 22) + '...' : vm.vmName,
                    { altRow: index % 2 === 1 }
                  ),
                  createTableCell(vm.cluster, { altRow: index % 2 === 1 }),
                  createTableCell(`${vm.cpus}`, { align: AlignmentType.RIGHT, altRow: index % 2 === 1 }),
                  createTableCell(`${vm.memoryGiB} GiB`, { align: AlignmentType.RIGHT, altRow: index % 2 === 1 }),
                  createTableCell(vm.issues.join(', '), { altRow: index % 2 === 1 }),
                ],
              })
          ),
        ],
      })
    );
  }

  return sections;
}

// ===== MAIN EXPORT FUNCTIONS =====

export async function generateDocxReport(
  rawData: RVToolsData,
  options: DocxExportOptions = {}
): Promise<Blob> {
  const finalOptions: Required<DocxExportOptions> = {
    clientName: options.clientName || reportTemplates.placeholders.clientName,
    preparedBy: options.preparedBy || reportTemplates.placeholders.preparedBy,
    companyName: options.companyName || reportTemplates.placeholders.companyName,
    includeROKS: options.includeROKS ?? true,
    includeVSI: options.includeVSI ?? true,
    includeCosts: options.includeCosts ?? true,
    maxIssueVMs: options.maxIssueVMs ?? 20,
  };

  // Calculate all data
  const readiness = calculateVMReadiness(rawData);
  const roksSizing = calculateROKSSizing(rawData);
  const vsiMappings = calculateVSIMappings(rawData);

  // Build document sections (await async functions)
  const executiveSummary = await buildExecutiveSummary(rawData, readiness);
  const environmentAnalysis = await buildEnvironmentAnalysis(rawData);

  const sections: DocumentContent[] = [
    ...buildCoverPage(finalOptions),
    ...executiveSummary,
    ...buildAssumptionsAndScope(),
    ...environmentAnalysis,
    ...buildMigrationReadiness(readiness, finalOptions.maxIssueVMs),
    ...buildMigrationOptions(),
    ...buildMigrationStrategy(rawData),
  ];

  if (finalOptions.includeROKS) {
    sections.push(...buildROKSOverview(roksSizing));
  }

  if (finalOptions.includeVSI) {
    sections.push(...buildVSIOverview(vsiMappings, 20));
  }

  if (finalOptions.includeCosts && (finalOptions.includeROKS || finalOptions.includeVSI)) {
    sections.push(...buildCostEstimation(roksSizing, vsiMappings));
  }

  sections.push(...buildNextSteps(finalOptions));

  // Add appendices if there are more VMs than shown in main body
  sections.push(...buildAppendices(readiness, finalOptions.maxIssueVMs));

  // Create document with professional header/footer
  const doc = new Document({
    creator: finalOptions.companyName,
    title: `VMware Migration Assessment - ${finalOptions.clientName}`,
    description: 'VMware to IBM Cloud Migration Assessment Report',
    styles: {
      default: {
        document: {
          run: {
            font: FONT_FAMILY,
            size: STYLES.bodySize,
          },
        },
        heading1: {
          run: {
            font: FONT_FAMILY,
            size: STYLES.heading1Size,
            bold: true,
            color: STYLES.primaryColor,
          },
          paragraph: {
            spacing: { before: 400, after: 200 },
          },
        },
        heading2: {
          run: {
            font: FONT_FAMILY,
            size: STYLES.heading2Size,
            bold: true,
            color: STYLES.secondaryColor,
          },
          paragraph: {
            spacing: { before: 300, after: 150 },
          },
        },
        heading3: {
          run: {
            font: FONT_FAMILY,
            size: STYLES.heading3Size,
            bold: true,
          },
          paragraph: {
            spacing: { before: 200, after: 100 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
            pageNumbers: {
              start: 1,
              formatType: NumberFormat.DECIMAL,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'VMware Cloud Migration Assessment',
                    size: 18,
                    color: STYLES.secondaryColor,
                    font: FONT_FAMILY,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${finalOptions.companyName}`,
                    size: 16,
                    color: STYLES.secondaryColor,
                    font: FONT_FAMILY,
                  }),
                  new TextRun({
                    text: '  |  Page ',
                    size: 16,
                    color: STYLES.secondaryColor,
                    font: FONT_FAMILY,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: STYLES.secondaryColor,
                    font: FONT_FAMILY,
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 16,
                    color: STYLES.secondaryColor,
                    font: FONT_FAMILY,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: STYLES.secondaryColor,
                    font: FONT_FAMILY,
                  }),
                ],
              }),
            ],
          }),
        },
        children: sections,
      },
    ],
  });

  // Generate blob
  return await Packer.toBlob(doc);
}

export async function downloadDocx(
  rawData: RVToolsData,
  options: DocxExportOptions = {},
  filename?: string
): Promise<void> {
  const blob = await generateDocxReport(rawData, options);

  // Create download link
  const date = new Date().toISOString().split('T')[0];
  const clientName = options.clientName?.replace(/[^a-zA-Z0-9]/g, '-') || 'client';
  const finalFilename = filename || `migration-assessment_${clientName}_${date}.docx`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
