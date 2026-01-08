// PDF generation service using jsPDF
import jsPDF from 'jspdf';
import type { RVToolsData } from '@/types/rvtools';
import { mibToGiB, mibToTiB, formatNumber } from '@/utils/formatters';

interface PDFOptions {
  includeExecutiveSummary: boolean;
  includeComputeAnalysis: boolean;
  includeStorageAnalysis: boolean;
  includeMTVReadiness: boolean;
  includeVMList: boolean;
}

const DEFAULT_OPTIONS: PDFOptions = {
  includeExecutiveSummary: true,
  includeComputeAnalysis: true,
  includeStorageAnalysis: true,
  includeMTVReadiness: true,
  includeVMList: false, // Can be large
};

// PDF styling constants
const COLORS = {
  primary: [15, 98, 254] as [number, number, number], // IBM Blue 60
  secondary: [82, 82, 82] as [number, number, number], // Gray 70
  success: [36, 161, 72] as [number, number, number], // Green 50
  warning: [240, 171, 0] as [number, number, number], // Yellow 40
  error: [218, 30, 40] as [number, number, number], // Red 50
  text: [22, 22, 22] as [number, number, number], // Gray 100
  lightText: [82, 82, 82] as [number, number, number], // Gray 70
  border: [224, 224, 224] as [number, number, number], // Gray 20
};

const FONTS = {
  title: 24,
  heading: 16,
  subheading: 12,
  body: 10,
  small: 8,
};

const MARGINS = {
  left: 20,
  right: 20,
  top: 20,
  bottom: 20,
};

export class PDFGenerator {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private contentWidth: number;
  private currentY: number;

  constructor() {
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.contentWidth = this.pageWidth - MARGINS.left - MARGINS.right;
    this.currentY = MARGINS.top;
  }

  async generate(data: RVToolsData, options: Partial<PDFOptions> = {}): Promise<Blob> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Title page
    this.addTitlePage(data);

    // Executive Summary
    if (opts.includeExecutiveSummary) {
      this.addNewPage();
      this.addExecutiveSummary(data);
    }

    // Compute Analysis
    if (opts.includeComputeAnalysis) {
      this.addNewPage();
      this.addComputeAnalysis(data);
    }

    // Storage Analysis
    if (opts.includeStorageAnalysis) {
      this.addNewPage();
      this.addStorageAnalysis(data);
    }

    // MTV Readiness
    if (opts.includeMTVReadiness) {
      this.addNewPage();
      this.addMTVReadiness(data);
    }

    // Infrastructure Discovery (always included with MTV Readiness)
    if (opts.includeMTVReadiness) {
      this.addNewPage();
      this.addInfrastructureDiscovery(data);
    }

    // VM List (optional, can be very long)
    if (opts.includeVMList) {
      this.addNewPage();
      this.addVMList(data);
    }

    // Add page numbers
    this.addPageNumbers();

    return this.doc.output('blob');
  }

  private addTitlePage(data: RVToolsData): void {
    const centerX = this.pageWidth / 2;

    // Title
    this.currentY = 80;
    this.doc.setFontSize(FONTS.title);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text('RVTools Analysis Report', centerX, this.currentY, { align: 'center' });

    // Subtitle
    this.currentY += 15;
    this.doc.setFontSize(FONTS.heading);
    this.doc.setTextColor(...COLORS.secondary);
    this.doc.text('VMware Infrastructure Assessment', centerX, this.currentY, { align: 'center' });

    // File info
    this.currentY += 30;
    this.doc.setFontSize(FONTS.body);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(`Source File: ${data.metadata.fileName}`, centerX, this.currentY, { align: 'center' });

    if (data.metadata.collectionDate) {
      this.currentY += 8;
      this.doc.text(
        `Collection Date: ${data.metadata.collectionDate.toLocaleDateString()}`,
        centerX,
        this.currentY,
        { align: 'center' }
      );
    }

    // Report generation date
    this.currentY += 8;
    this.doc.text(
      `Report Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      centerX,
      this.currentY,
      { align: 'center' }
    );

    // Summary box
    this.currentY += 30;
    const vms = data.vInfo.filter(vm => !vm.template);
    const boxY = this.currentY;
    const boxHeight = 50;

    this.doc.setDrawColor(...COLORS.border);
    this.doc.setFillColor(248, 248, 248);
    this.doc.roundedRect(MARGINS.left, boxY, this.contentWidth, boxHeight, 3, 3, 'FD');

    // Quick stats in box
    this.currentY = boxY + 15;
    this.doc.setFontSize(FONTS.subheading);
    this.doc.setTextColor(...COLORS.text);

    const stats = [
      `${formatNumber(vms.length)} Virtual Machines`,
      `${formatNumber(data.vHost.length)} ESXi Hosts`,
      `${formatNumber(data.vCluster.length)} Clusters`,
      `${formatNumber(data.vDatastore.length)} Datastores`,
    ];

    const statWidth = this.contentWidth / stats.length;
    stats.forEach((stat, i) => {
      const x = MARGINS.left + statWidth * i + statWidth / 2;
      this.doc.text(stat, x, this.currentY, { align: 'center' });
    });

    // Footer
    this.doc.setFontSize(FONTS.small);
    this.doc.setTextColor(...COLORS.lightText);
    this.doc.text(
      'Generated by RVTools Analyzer',
      centerX,
      this.pageHeight - MARGINS.bottom,
      { align: 'center' }
    );
  }

  private addExecutiveSummary(data: RVToolsData): void {
    this.addSectionTitle('Executive Summary');

    const vms = data.vInfo.filter(vm => !vm.template);
    const poweredOn = vms.filter(vm => vm.powerState === 'poweredOn');
    const poweredOff = vms.filter(vm => vm.powerState === 'poweredOff');
    const templates = data.vInfo.filter(vm => vm.template);

    const totalVCPUs = vms.reduce((sum, vm) => sum + vm.cpus, 0);
    const totalMemoryMiB = vms.reduce((sum, vm) => sum + vm.memory, 0);
    const totalStorageMiB = vms.reduce((sum, vm) => sum + vm.provisionedMiB, 0);

    // VM Overview
    this.addSubsectionTitle('Virtual Machine Overview');
    this.addMetricRow([
      { label: 'Total VMs', value: formatNumber(vms.length) },
      { label: 'Powered On', value: formatNumber(poweredOn.length) },
      { label: 'Powered Off', value: formatNumber(poweredOff.length) },
      { label: 'Templates', value: formatNumber(templates.length) },
    ]);

    this.currentY += 10;

    // Resource Summary
    this.addSubsectionTitle('Resource Summary');
    this.addMetricRow([
      { label: 'Total vCPUs', value: formatNumber(totalVCPUs) },
      { label: 'Total Memory', value: `${mibToGiB(totalMemoryMiB).toFixed(0)} GiB` },
      { label: 'Total Storage', value: `${mibToTiB(totalStorageMiB).toFixed(1)} TiB` },
    ]);

    this.currentY += 10;

    // Infrastructure
    this.addSubsectionTitle('Infrastructure');
    const uniqueDatacenters = new Set(vms.map(vm => vm.datacenter).filter(Boolean)).size;
    this.addMetricRow([
      { label: 'Datacenters', value: formatNumber(uniqueDatacenters) },
      { label: 'Clusters', value: formatNumber(data.vCluster.length) },
      { label: 'ESXi Hosts', value: formatNumber(data.vHost.length) },
      { label: 'Datastores', value: formatNumber(data.vDatastore.length) },
    ]);

    this.currentY += 10;

    // OS Distribution
    this.addSubsectionTitle('Top Operating Systems');
    const osDistribution = this.getOSDistribution(vms);
    const topOS = osDistribution.slice(0, 5);

    topOS.forEach(({ os, count }) => {
      this.addTextLine(`${os}: ${count} VMs (${((count / vms.length) * 100).toFixed(1)}%)`);
    });
  }

  private addComputeAnalysis(data: RVToolsData): void {
    this.addSectionTitle('Compute Analysis');

    const vms = data.vInfo.filter(vm => !vm.template);
    const poweredOn = vms.filter(vm => vm.powerState === 'poweredOn');

    const totalVCPUs = vms.reduce((sum, vm) => sum + vm.cpus, 0);
    const poweredOnVCPUs = poweredOn.reduce((sum, vm) => sum + vm.cpus, 0);
    const totalMemoryGiB = mibToGiB(vms.reduce((sum, vm) => sum + vm.memory, 0));
    const poweredOnMemoryGiB = mibToGiB(poweredOn.reduce((sum, vm) => sum + vm.memory, 0));

    // CPU Summary
    this.addSubsectionTitle('CPU Summary');
    this.addMetricRow([
      { label: 'Total vCPUs', value: formatNumber(totalVCPUs) },
      { label: 'Powered On vCPUs', value: formatNumber(poweredOnVCPUs) },
      { label: 'Avg vCPUs/VM', value: (totalVCPUs / vms.length).toFixed(1) },
    ]);

    this.currentY += 10;

    // Memory Summary
    this.addSubsectionTitle('Memory Summary');
    this.addMetricRow([
      { label: 'Total Memory', value: `${totalMemoryGiB.toFixed(0)} GiB` },
      { label: 'Powered On', value: `${poweredOnMemoryGiB.toFixed(0)} GiB` },
      { label: 'Avg Memory/VM', value: `${(totalMemoryGiB / vms.length).toFixed(1)} GiB` },
    ]);

    this.currentY += 10;

    // CPU Distribution
    this.addSubsectionTitle('vCPU Distribution');
    const cpuDist = this.getCPUDistribution(vms);
    cpuDist.forEach(({ bucket, count }) => {
      const pct = ((count / vms.length) * 100).toFixed(1);
      this.addTextLine(`${bucket} vCPUs: ${count} VMs (${pct}%)`);
    });

    this.currentY += 10;

    // Top CPU Consumers
    this.addSubsectionTitle('Top 10 CPU Consumers');
    const topCPU = [...vms].sort((a, b) => b.cpus - a.cpus).slice(0, 10);
    topCPU.forEach((vm, i) => {
      this.addTextLine(`${i + 1}. ${vm.vmName}: ${vm.cpus} vCPUs`);
    });
  }

  private addStorageAnalysis(data: RVToolsData): void {
    this.addSectionTitle('Storage Analysis');

    const datastores = data.vDatastore;
    const totalCapacityTiB = mibToTiB(datastores.reduce((sum, ds) => sum + ds.capacityMiB, 0));
    const totalUsedTiB = mibToTiB(datastores.reduce((sum, ds) => sum + ds.inUseMiB, 0));
    const totalFreeTiB = mibToTiB(datastores.reduce((sum, ds) => sum + ds.freeMiB, 0));
    const avgUtilization = totalCapacityTiB > 0 ? (totalUsedTiB / totalCapacityTiB) * 100 : 0;

    // Storage Summary
    this.addSubsectionTitle('Storage Summary');
    this.addMetricRow([
      { label: 'Total Capacity', value: `${totalCapacityTiB.toFixed(1)} TiB` },
      { label: 'Used', value: `${totalUsedTiB.toFixed(1)} TiB` },
      { label: 'Free', value: `${totalFreeTiB.toFixed(1)} TiB` },
      { label: 'Avg Utilization', value: `${avgUtilization.toFixed(1)}%` },
    ]);

    this.currentY += 10;

    // Datastore Types
    this.addSubsectionTitle('Datastore Types');
    const typeDistribution = datastores.reduce((acc, ds) => {
      const type = ds.type || 'Unknown';
      if (!acc[type]) acc[type] = { count: 0, capacityMiB: 0 };
      acc[type].count++;
      acc[type].capacityMiB += ds.capacityMiB;
      return acc;
    }, {} as Record<string, { count: number; capacityMiB: number }>);

    Object.entries(typeDistribution)
      .sort((a, b) => b[1].capacityMiB - a[1].capacityMiB)
      .forEach(([type, info]) => {
        this.addTextLine(`${type}: ${info.count} datastores (${mibToTiB(info.capacityMiB).toFixed(1)} TiB)`);
      });

    this.currentY += 10;

    // High Utilization Datastores
    this.addSubsectionTitle('High Utilization Datastores (>80%)');
    const highUtil = datastores
      .filter(ds => ds.capacityMiB > 0 && (ds.inUseMiB / ds.capacityMiB) * 100 > 80)
      .sort((a, b) => {
        const utilA = (a.inUseMiB / a.capacityMiB) * 100;
        const utilB = (b.inUseMiB / b.capacityMiB) * 100;
        return utilB - utilA;
      })
      .slice(0, 10);

    if (highUtil.length === 0) {
      this.addTextLine('No datastores with utilization above 80%');
    } else {
      highUtil.forEach(ds => {
        const util = ((ds.inUseMiB / ds.capacityMiB) * 100).toFixed(1);
        this.addTextLine(`${ds.name}: ${util}% utilized`);
      });
    }
  }

  private addMTVReadiness(data: RVToolsData): void {
    this.addSectionTitle('Migration Readiness Assessment');

    const vms = data.vInfo.filter(vm => !vm.template && vm.powerState === 'poweredOn');

    // VMware Tools Status
    this.addSubsectionTitle('VMware Tools Status');
    const toolsStatus = this.analyzeToolsStatus(data);
    this.addMetricRow([
      { label: 'Tools Running', value: formatNumber(toolsStatus.running) },
      { label: 'Tools Outdated', value: formatNumber(toolsStatus.outdated) },
      { label: 'Not Installed', value: formatNumber(toolsStatus.notInstalled) },
    ]);

    this.currentY += 10;

    // Snapshots
    this.addSubsectionTitle('Snapshot Analysis');
    const snapshotVMs = new Set(data.vSnapshot.map(s => s.vmName)).size;
    const oldSnapshots = data.vSnapshot.filter(s => s.ageInDays > 7).length;
    this.addMetricRow([
      { label: 'VMs with Snapshots', value: formatNumber(snapshotVMs) },
      { label: 'Total Snapshots', value: formatNumber(data.vSnapshot.length) },
      { label: 'Snapshots >7 days', value: formatNumber(oldSnapshots) },
    ]);

    this.currentY += 10;

    // CD-ROM Status
    this.addSubsectionTitle('CD-ROM Status');
    const connectedCDs = data.vCD.filter(cd => cd.connected).length;
    this.addTextLine(`VMs with connected CD-ROM: ${connectedCDs}`);
    if (connectedCDs > 0) {
      this.doc.setTextColor(...COLORS.warning);
      this.addTextLine('Warning: Disconnect CD-ROMs before migration');
      this.doc.setTextColor(...COLORS.text);
    }

    this.currentY += 10;

    // Hardware Version
    this.addSubsectionTitle('Hardware Version Distribution');
    const hwVersions = vms.reduce((acc, vm) => {
      const version = vm.hardwareVersion || 'Unknown';
      acc[version] = (acc[version] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(hwVersions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([version, count]) => {
        this.addTextLine(`${version}: ${count} VMs`);
      });

    this.currentY += 10;

    // RDM Check
    this.addSubsectionTitle('Storage Blockers');
    const rdmDisks = new Set(data.vDisk.filter(d => d.raw).map(d => d.vmName)).size;
    const sharedDisks = new Set(data.vDisk.filter(d => d.sharingMode && d.sharingMode.toLowerCase() !== 'sharingnone').map(d => d.vmName)).size;
    const independentDisks = new Set(data.vDisk.filter(d => d.diskMode?.toLowerCase().includes('independent')).map(d => d.vmName)).size;

    if (rdmDisks === 0 && sharedDisks === 0 && independentDisks === 0) {
      this.doc.setTextColor(...COLORS.success);
      this.addTextLine('No storage blockers detected - Ready for migration');
    } else {
      if (rdmDisks > 0) {
        this.doc.setTextColor(...COLORS.error);
        this.addTextLine(`${rdmDisks} VMs with RDM disks - Requires remediation`);
      }
      if (sharedDisks > 0) {
        this.doc.setTextColor(...COLORS.error);
        this.addTextLine(`${sharedDisks} VMs with shared/multi-writer disks - Requires remediation`);
      }
      if (independentDisks > 0) {
        this.doc.setTextColor(...COLORS.error);
        this.addTextLine(`${independentDisks} VMs with independent disk mode - Cannot be transferred`);
      }
    }
    this.doc.setTextColor(...COLORS.text);

    this.currentY += 10;

    // CBT (Changed Block Tracking)
    this.addSubsectionTitle('Changed Block Tracking (CBT)');
    const vmsWithoutCBT = vms.filter(vm => !vm.cbtEnabled).length;
    if (vmsWithoutCBT === 0) {
      this.doc.setTextColor(...COLORS.success);
      this.addTextLine('All VMs have CBT enabled - Ready for warm migration');
    } else {
      this.doc.setTextColor(...COLORS.warning);
      this.addTextLine(`${vmsWithoutCBT} VMs without CBT enabled - Warm migration may be slower`);
      this.addTextLine('Enable CBT for incremental data transfer during warm migration');
    }
    this.doc.setTextColor(...COLORS.text);

    this.currentY += 10;

    // VM Name RFC 1123 Compliance
    this.addSubsectionTitle('VM Name Compliance (RFC 1123)');
    const rfc1123Pattern = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
    const vmsWithInvalidNames = vms.filter(vm => !vm.vmName || vm.vmName.length > 63 || !rfc1123Pattern.test(vm.vmName.toLowerCase())).length;
    if (vmsWithInvalidNames === 0) {
      this.doc.setTextColor(...COLORS.success);
      this.addTextLine('All VM names are RFC 1123 compliant');
    } else {
      this.doc.setTextColor(...COLORS.warning);
      this.addTextLine(`${vmsWithInvalidNames} VMs with non-compliant names`);
      this.addTextLine('Names must be: lowercase, max 63 chars, alphanumeric + hyphens');
    }
    this.doc.setTextColor(...COLORS.text);

    this.currentY += 10;

    // Hot Plug Configuration
    this.addSubsectionTitle('Hot Plug Configuration');
    const vCPUMap = new Map(data.vCPU.map(c => [c.vmName, c]));
    const vMemoryMap = new Map(data.vMemory.map(m => [m.vmName, m]));
    const vmsWithCPUHotPlug = vms.filter(vm => vCPUMap.get(vm.vmName)?.hotAddEnabled).length;
    const vmsWithMemHotPlug = vms.filter(vm => vMemoryMap.get(vm.vmName)?.hotAddEnabled).length;

    if (vmsWithCPUHotPlug === 0 && vmsWithMemHotPlug === 0) {
      this.doc.setTextColor(...COLORS.success);
      this.addTextLine('No VMs with hot plug enabled');
    } else {
      this.doc.setTextColor(...COLORS.warning);
      if (vmsWithCPUHotPlug > 0) {
        this.addTextLine(`${vmsWithCPUHotPlug} VMs with CPU hot plug - Will be disabled post-migration`);
      }
      if (vmsWithMemHotPlug > 0) {
        this.addTextLine(`${vmsWithMemHotPlug} VMs with memory hot plug - Will be disabled post-migration`);
      }
    }
    this.doc.setTextColor(...COLORS.text);

    this.currentY += 10;

    // Hostname Status
    this.addSubsectionTitle('Guest Hostname Status');
    const vmsWithInvalidHostname = vms.filter(vm => {
      const hostname = vm.guestHostname?.toLowerCase()?.trim();
      return !hostname || hostname === '' || hostname === 'localhost' ||
             hostname === 'localhost.localdomain' || hostname === 'localhost.local';
    }).length;
    if (vmsWithInvalidHostname === 0) {
      this.doc.setTextColor(...COLORS.success);
      this.addTextLine('All VMs have valid hostnames configured');
    } else {
      this.doc.setTextColor(...COLORS.warning);
      this.addTextLine(`${vmsWithInvalidHostname} VMs with missing/invalid hostnames`);
      this.addTextLine('Configure proper hostname before migration');
    }
    this.doc.setTextColor(...COLORS.text);
  }

  private addInfrastructureDiscovery(data: RVToolsData): void {
    this.addSectionTitle('Infrastructure Discovery');

    const vms = data.vInfo.filter(vm => !vm.template && vm.powerState === 'poweredOn');
    const hosts = data.vHost;
    const clusters = data.vCluster;

    // Workload Detection Patterns
    const workloadPatterns: Record<string, { name: string; patterns: string[] }> = {
      databases: { name: 'Databases', patterns: ['oracle', 'postgres', 'mysql', 'mssql', 'mongodb', 'redis', 'sql'] },
      middleware: { name: 'Middleware', patterns: ['jboss', 'tomcat', 'weblogic', 'websphere', 'nginx', 'apache'] },
      enterprise: { name: 'Enterprise Apps', patterns: ['sap', 'sharepoint', 'exchange', 'dynamics'] },
      backup: { name: 'Backup/Recovery', patterns: ['veeam', 'veritas', 'commvault', 'avamar', 'rubrik'] },
      security: { name: 'Security', patterns: ['paloalto', 'qualys', 'cyberark', 'fortinet', 'crowdstrike'] },
      virtualization: { name: 'Virtualization', patterns: ['vcenter', 'nsx', 'vrops', 'vra', 'horizon'] },
    };

    // Detect workloads
    const workloadCounts: Record<string, number> = {};
    for (const [, config] of Object.entries(workloadPatterns)) {
      const count = vms.filter(vm => {
        const vmNameLower = vm.vmName.toLowerCase();
        return config.patterns.some(p => vmNameLower.includes(p));
      }).length;
      if (count > 0) {
        workloadCounts[config.name] = count;
      }
    }

    this.addSubsectionTitle('Detected Workloads');
    if (Object.keys(workloadCounts).length > 0) {
      Object.entries(workloadCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([name, count]) => {
          this.addTextLine(`${name}: ${count} VM${count !== 1 ? 's' : ''}`);
        });
    } else {
      this.addTextLine('No specific workloads detected from VM naming patterns');
    }

    this.currentY += 10;

    // Appliance Detection
    this.addSubsectionTitle('Virtual Appliances');
    const appliancePatterns = ['appliance', 'ova', 'vcsa', 'vcenter', 'nsx-manager', 'vrops', 'vra'];
    const appliances = vms.filter(vm => {
      const vmNameLower = vm.vmName.toLowerCase();
      const annotationLower = (vm.annotation || '').toLowerCase();
      return appliancePatterns.some(p => vmNameLower.includes(p) || annotationLower.includes(p));
    });

    if (appliances.length > 0) {
      this.doc.setTextColor(...COLORS.warning);
      this.addTextLine(`${appliances.length} virtual appliances detected`);
      this.addTextLine('Appliances may require vendor-specific migration paths');
    } else {
      this.doc.setTextColor(...COLORS.success);
      this.addTextLine('No virtual appliances detected');
    }
    this.doc.setTextColor(...COLORS.text);

    this.currentY += 10;

    // ESXi Version Status
    this.addSubsectionTitle('ESXi Version Analysis');
    const esxiVersions = hosts.reduce((acc, host) => {
      const version = host.esxiVersion || 'Unknown';
      acc[version] = (acc[version] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const eolVersions = ['5.0', '5.1', '5.5', '6.0', '6.5', '6.7'];
    let eolHostCount = 0;

    Object.entries(esxiVersions)
      .sort((a, b) => b[1] - a[1])
      .forEach(([version, count]) => {
        const isEOL = eolVersions.some(v => version.includes(v));
        if (isEOL) {
          eolHostCount += count;
          this.doc.setTextColor(...COLORS.error);
        } else {
          this.doc.setTextColor(...COLORS.success);
        }
        this.addTextLine(`${version}: ${count} host${count !== 1 ? 's' : ''} ${isEOL ? '(EOL)' : ''}`);
      });
    this.doc.setTextColor(...COLORS.text);

    if (eolHostCount > 0) {
      this.doc.setTextColor(...COLORS.warning);
      this.addTextLine(`Warning: ${eolHostCount} hosts running end-of-life ESXi versions`);
      this.doc.setTextColor(...COLORS.text);
    }

    this.currentY += 10;

    // Cluster HA Risk
    this.addSubsectionTitle('Cluster HA Analysis');
    const clustersUnder3Hosts = clusters.filter(c => c.hostCount < 3);
    if (clustersUnder3Hosts.length === 0) {
      this.doc.setTextColor(...COLORS.success);
      this.addTextLine('All clusters have 3+ hosts for proper HA');
    } else {
      this.doc.setTextColor(...COLORS.warning);
      this.addTextLine(`${clustersUnder3Hosts.length} cluster${clustersUnder3Hosts.length !== 1 ? 's' : ''} with fewer than 3 hosts:`);
      clustersUnder3Hosts.forEach(c => {
        this.addTextLine(`  - ${c.name}: ${c.hostCount} host${c.hostCount !== 1 ? 's' : ''}`);
      });
    }
    this.doc.setTextColor(...COLORS.text);

    this.currentY += 10;

    // Large Memory/Core Checks
    this.addSubsectionTitle('Compute Edge Cases');
    const MEMORY_2TB_MIB = 2 * 1024 * 1024;
    const largeMemoryVMs = vms.filter(vm => vm.memory >= MEMORY_2TB_MIB);
    const largeHostCores = hosts.filter(h => h.totalCpuCores > 64);
    const veryLargeHostCores = hosts.filter(h => h.totalCpuCores > 128);

    if (largeMemoryVMs.length > 0) {
      this.doc.setTextColor(...COLORS.warning);
      this.addTextLine(`${largeMemoryVMs.length} VM${largeMemoryVMs.length !== 1 ? 's' : ''} with 2TB+ memory`);
    }
    if (largeHostCores.length > 0) {
      this.addTextLine(`${largeHostCores.length} host${largeHostCores.length !== 1 ? 's' : ''} with 64+ CPU cores`);
    }
    if (veryLargeHostCores.length > 0) {
      this.addTextLine(`${veryLargeHostCores.length} host${veryLargeHostCores.length !== 1 ? 's' : ''} with 128+ CPU cores`);
    }
    if (largeMemoryVMs.length === 0 && largeHostCores.length === 0) {
      this.doc.setTextColor(...COLORS.success);
      this.addTextLine('No compute edge cases detected');
    }
    this.doc.setTextColor(...COLORS.text);

    // Memory Balloon Check
    this.currentY += 10;
    this.addSubsectionTitle('Memory Ballooning');
    const vMemoryMap = new Map(data.vMemory.map(m => [m.vmName, m]));
    const balloonedVMs = vms.filter(vm => {
      const memInfo = vMemoryMap.get(vm.vmName);
      return memInfo && (memInfo.ballooned || 0) > 0;
    });

    if (balloonedVMs.length === 0) {
      this.doc.setTextColor(...COLORS.success);
      this.addTextLine('No VMs with active memory ballooning');
    } else {
      this.doc.setTextColor(...COLORS.warning);
      this.addTextLine(`${balloonedVMs.length} VMs with active memory ballooning`);
      this.addTextLine('Review memory allocation before migration');
    }
    this.doc.setTextColor(...COLORS.text);

    // Host Hardware Models
    this.currentY += 10;
    this.addSubsectionTitle('Host Hardware Models');
    const hostModels = hosts.reduce((acc, host) => {
      const model = `${host.vendor || ''} ${host.model || ''}`.trim() || 'Unknown';
      acc[model] = (acc[model] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(hostModels)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([model, count]) => {
        this.addTextLine(`${model}: ${count} host${count !== 1 ? 's' : ''}`);
      });
  }

  private addVMList(data: RVToolsData): void {
    this.addSectionTitle('Virtual Machine Inventory');

    const vms = data.vInfo.filter(vm => !vm.template);

    // Table header
    const headers = ['VM Name', 'Power', 'vCPUs', 'Memory', 'Storage', 'OS'];
    const colWidths = [50, 20, 15, 20, 20, 45];

    this.addTableHeader(headers, colWidths);

    // Table rows
    vms.slice(0, 50).forEach(vm => { // Limit to 50 VMs to avoid huge PDFs
      this.checkPageBreak(8);

      const row = [
        vm.vmName.substring(0, 25),
        vm.powerState === 'poweredOn' ? 'On' : 'Off',
        vm.cpus.toString(),
        `${mibToGiB(vm.memory).toFixed(0)} GB`,
        `${mibToGiB(vm.provisionedMiB).toFixed(0)} GB`,
        (vm.guestOS || 'Unknown').substring(0, 25),
      ];

      this.addTableRow(row, colWidths);
    });

    if (vms.length > 50) {
      this.currentY += 5;
      this.doc.setFontSize(FONTS.small);
      this.doc.setTextColor(...COLORS.lightText);
      this.doc.text(`... and ${vms.length - 50} more VMs (truncated for PDF)`, MARGINS.left, this.currentY);
    }
  }

  // Helper methods
  private addNewPage(): void {
    this.doc.addPage();
    this.currentY = MARGINS.top;
  }

  private checkPageBreak(neededSpace: number): void {
    if (this.currentY + neededSpace > this.pageHeight - MARGINS.bottom) {
      this.addNewPage();
    }
  }

  private addSectionTitle(title: string): void {
    this.doc.setFontSize(FONTS.heading);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text(title, MARGINS.left, this.currentY);
    this.currentY += 3;

    // Underline
    this.doc.setDrawColor(...COLORS.primary);
    this.doc.setLineWidth(0.5);
    this.doc.line(MARGINS.left, this.currentY, MARGINS.left + 60, this.currentY);
    this.currentY += 10;
  }

  private addSubsectionTitle(title: string): void {
    this.checkPageBreak(15);
    this.doc.setFontSize(FONTS.subheading);
    this.doc.setTextColor(...COLORS.secondary);
    this.doc.text(title, MARGINS.left, this.currentY);
    this.currentY += 8;
  }

  private addTextLine(text: string): void {
    this.checkPageBreak(6);
    this.doc.setFontSize(FONTS.body);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(text, MARGINS.left + 5, this.currentY);
    this.currentY += 6;
  }

  private addMetricRow(metrics: { label: string; value: string }[]): void {
    this.checkPageBreak(20);

    const boxHeight = 15;
    const boxWidth = this.contentWidth / metrics.length - 2;

    metrics.forEach((metric, i) => {
      const x = MARGINS.left + i * (boxWidth + 2);

      // Box
      this.doc.setDrawColor(...COLORS.border);
      this.doc.setFillColor(248, 248, 248);
      this.doc.roundedRect(x, this.currentY, boxWidth, boxHeight, 2, 2, 'FD');

      // Value
      this.doc.setFontSize(FONTS.subheading);
      this.doc.setTextColor(...COLORS.primary);
      this.doc.text(metric.value, x + boxWidth / 2, this.currentY + 6, { align: 'center' });

      // Label
      this.doc.setFontSize(FONTS.small);
      this.doc.setTextColor(...COLORS.lightText);
      this.doc.text(metric.label, x + boxWidth / 2, this.currentY + 12, { align: 'center' });
    });

    this.currentY += boxHeight + 5;
  }

  private addTableHeader(headers: string[], colWidths: number[]): void {
    this.checkPageBreak(10);

    let x = MARGINS.left;
    this.doc.setFontSize(FONTS.small);
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFillColor(...COLORS.primary);

    // Header background
    this.doc.rect(MARGINS.left, this.currentY - 4, this.contentWidth, 7, 'F');

    headers.forEach((header, i) => {
      this.doc.text(header, x + 2, this.currentY);
      x += colWidths[i];
    });

    this.currentY += 5;
  }

  private addTableRow(cells: string[], colWidths: number[]): void {
    let x = MARGINS.left;
    this.doc.setFontSize(FONTS.small);
    this.doc.setTextColor(...COLORS.text);

    cells.forEach((cell, i) => {
      this.doc.text(cell, x + 2, this.currentY);
      x += colWidths[i];
    });

    // Row border
    this.doc.setDrawColor(...COLORS.border);
    this.doc.line(MARGINS.left, this.currentY + 2, MARGINS.left + this.contentWidth, this.currentY + 2);

    this.currentY += 6;
  }

  private addPageNumbers(): void {
    const totalPages = this.doc.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(FONTS.small);
      this.doc.setTextColor(...COLORS.lightText);
      this.doc.text(
        `Page ${i} of ${totalPages}`,
        this.pageWidth / 2,
        this.pageHeight - 10,
        { align: 'center' }
      );
    }
  }

  // Analysis helpers
  private getOSDistribution(vms: { guestOS: string }[]): { os: string; count: number }[] {
    const distribution = vms.reduce((acc, vm) => {
      let os = vm.guestOS || 'Unknown';

      // Simplify OS names
      if (os.toLowerCase().includes('windows server 2019')) os = 'Windows Server 2019';
      else if (os.toLowerCase().includes('windows server 2016')) os = 'Windows Server 2016';
      else if (os.toLowerCase().includes('windows server 2022')) os = 'Windows Server 2022';
      else if (os.toLowerCase().includes('windows server')) os = 'Windows Server (Other)';
      else if (os.toLowerCase().includes('rhel') || os.toLowerCase().includes('red hat')) os = 'RHEL';
      else if (os.toLowerCase().includes('centos')) os = 'CentOS';
      else if (os.toLowerCase().includes('ubuntu')) os = 'Ubuntu';
      else if (os.toLowerCase().includes('sles') || os.toLowerCase().includes('suse')) os = 'SLES';
      else if (os.toLowerCase().includes('linux')) os = 'Linux (Other)';

      acc[os] = (acc[os] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(distribution)
      .map(([os, count]) => ({ os, count }))
      .sort((a, b) => b.count - a.count);
  }

  private getCPUDistribution(vms: { cpus: number }[]): { bucket: string; count: number }[] {
    const buckets = [
      { bucket: '1-2', min: 1, max: 2 },
      { bucket: '3-4', min: 3, max: 4 },
      { bucket: '5-8', min: 5, max: 8 },
      { bucket: '9-16', min: 9, max: 16 },
      { bucket: '17-32', min: 17, max: 32 },
      { bucket: '33+', min: 33, max: Infinity },
    ];

    return buckets.map(({ bucket, min, max }) => ({
      bucket,
      count: vms.filter(vm => vm.cpus >= min && vm.cpus <= max).length,
    })).filter(b => b.count > 0);
  }

  private analyzeToolsStatus(data: RVToolsData): { running: number; outdated: number; notInstalled: number } {
    const vms = data.vInfo.filter(vm => !vm.template && vm.powerState === 'poweredOn');
    const toolsMap = new Map(data.vTools.map(t => [t.vmName, t]));

    let running = 0;
    let outdated = 0;
    let notInstalled = 0;

    vms.forEach(vm => {
      const tools = toolsMap.get(vm.vmName);
      if (!tools) {
        notInstalled++;
      } else if (tools.toolsStatus === 'toolsOk') {
        running++;
      } else if (tools.toolsStatus === 'toolsOld') {
        outdated++;
      } else if (tools.toolsStatus === 'toolsNotInstalled') {
        notInstalled++;
      } else {
        outdated++;
      }
    });

    return { running, outdated, notInstalled };
  }
}

export async function generatePDF(data: RVToolsData, options?: Partial<PDFOptions>): Promise<Blob> {
  const generator = new PDFGenerator();
  return generator.generate(data, options);
}

export function downloadPDF(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
