// Enhanced PDF Generator Tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFGenerator, generatePDF, downloadPDF } from './pdfGenerator';
import type { RVToolsData } from '@/types/rvtools';

// Mock jsPDF - factory must be inline for hoisting
vi.mock('jspdf', () => {
  return {
    default: class MockJsPDF {
      internal = {
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 297,
        },
      };
      setFontSize() {}
      setTextColor() {}
      setDrawColor() {}
      setFillColor() {}
      setLineWidth() {}
      setFont() {}
      text() {}
      line() {}
      rect() {}
      roundedRect() {}
      triangle() {}
      addPage() {}
      setPage() {}
      getNumberOfPages() { return 5; }
      output() { return new Blob(['PDF content'], { type: 'application/pdf' }); }
    },
  };
});

const mockRVToolsData: RVToolsData = {
  metadata: {
    fileName: 'test-export.xlsx',
    collectionDate: new Date('2024-01-15'),
    vCenterVersion: '7.0.3',
    environment: 'production',
  },
  vInfo: [
    {
      vmName: 'vm-1',
      powerState: 'poweredOn',
      template: false,
      srmPlaceholder: false,
      configStatus: 'green',
      dnsName: null,
      connectionState: 'connected',
      guestState: 'running',
      heartbeat: 'green',
      consolidationNeeded: false,
      powerOnDate: null,
      suspendedToMemory: false,
      suspendTime: null,
      creationDate: null,
      cpus: 4,
      memory: 8192,
      nics: 1,
      disks: 1,
      resourcePool: null,
      folder: null,
      vApp: null,
      ftState: null,
      ftRole: null,
      cbrcEnabled: false,
      provisionedMiB: 102400,
      inUseMiB: 51200,
      datacenter: 'dc-1',
      cluster: 'cluster-1',
      host: 'host-1',
      hardwareVersion: 'vmx-19',
      guestOS: 'Windows Server 2019',
      osToolsConfig: '',
      guestHostname: 'server1.example.com',
      guestIP: '10.0.0.1',
      annotation: '',
      cbtEnabled: true,
      uuid: 'uuid-1',
      firmwareType: 'bios',
      latencySensitivity: null,
    },
    {
      vmName: 'vm-2',
      powerState: 'poweredOff',
      template: false,
      srmPlaceholder: false,
      configStatus: 'green',
      dnsName: null,
      connectionState: 'connected',
      guestState: 'notRunning',
      heartbeat: 'gray',
      consolidationNeeded: false,
      powerOnDate: null,
      suspendedToMemory: false,
      suspendTime: null,
      creationDate: null,
      cpus: 2,
      memory: 4096,
      nics: 1,
      disks: 1,
      resourcePool: null,
      folder: null,
      vApp: null,
      ftState: null,
      ftRole: null,
      cbrcEnabled: false,
      provisionedMiB: 51200,
      inUseMiB: 25600,
      datacenter: 'dc-1',
      cluster: 'cluster-1',
      host: 'host-1',
      hardwareVersion: 'vmx-17',
      guestOS: 'Red Hat Enterprise Linux',
      osToolsConfig: '',
      guestHostname: 'localhost',
      guestIP: null,
      annotation: '',
      cbtEnabled: false,
      uuid: 'uuid-2',
      firmwareType: 'bios',
      latencySensitivity: null,
    },
    {
      vmName: 'template-1',
      powerState: 'poweredOff',
      template: true,
      srmPlaceholder: false,
      configStatus: 'green',
      dnsName: null,
      connectionState: 'connected',
      guestState: 'notRunning',
      heartbeat: 'gray',
      consolidationNeeded: false,
      powerOnDate: null,
      suspendedToMemory: false,
      suspendTime: null,
      creationDate: null,
      cpus: 2,
      memory: 2048,
      nics: 1,
      disks: 1,
      resourcePool: null,
      folder: null,
      vApp: null,
      ftState: null,
      ftRole: null,
      cbrcEnabled: false,
      provisionedMiB: 20480,
      inUseMiB: 10240,
      datacenter: 'dc-1',
      cluster: 'cluster-1',
      host: 'host-1',
      hardwareVersion: 'vmx-19',
      guestOS: 'Ubuntu Linux',
      osToolsConfig: '',
      guestHostname: '',
      guestIP: null,
      annotation: '',
      cbtEnabled: false,
      uuid: 'uuid-3',
      firmwareType: 'bios',
      latencySensitivity: null,
    },
  ],
  vHost: [
    {
      name: 'host-1',
      configStatus: 'green',
      overallStatus: 'green',
      powerState: 'poweredOn',
      connectionState: 'connected',
      cpuModel: 'Intel Xeon',
      cpuMHz: 2400,
      cpuSockets: 2,
      coresPerSocket: 16,
      totalCpuCores: 32,
      hyperthreading: true,
      cpuUsageMHz: 12000,
      memoryMiB: 131072,
      memoryUsageMiB: 98304,
      vmCount: 10,
      vmCpuCount: 48,
      vmMemoryMiB: 98304,
      vendor: 'Dell',
      model: 'PowerEdge R740',
      esxiVersion: '7.0.3',
      esxiBuild: '12345678',
      datacenter: 'dc-1',
      cluster: 'cluster-1',
      uptimeSeconds: 86400,
    },
  ],
  vCluster: [
    {
      name: 'cluster-1',
      configStatus: 'green',
      overallStatus: 'green',
      vmCount: 10,
      hostCount: 3,
      numEffectiveHosts: 3,
      totalCpuMHz: 76800,
      numCpuCores: 96,
      numCpuThreads: 192,
      effectiveCpuMHz: 64000,
      totalMemoryMiB: 393216,
      effectiveMemoryMiB: 350000,
      haEnabled: true,
      haFailoverLevel: 1,
      drsEnabled: true,
      drsBehavior: 'fullyAutomated',
      evcMode: null,
      datacenter: 'dc-1',
    },
  ],
  vDatastore: [
    {
      name: 'ds-1',
      configStatus: 'green',
      address: null,
      accessible: true,
      type: 'VMFS',
      vmTotalCount: 5,
      vmCount: 5,
      capacityMiB: 1048576,
      provisionedMiB: 1048576,
      inUseMiB: 838861,
      freeMiB: 209715,
      freePercent: 20,
      siocEnabled: false,
      siocThreshold: null,
      hosts: 'host-1',
      hostCount: 1,
      datacenter: 'dc-1',
      cluster: 'cluster-1',
    },
    {
      name: 'ds-2',
      configStatus: 'green',
      address: null,
      accessible: true,
      type: 'NFS',
      vmTotalCount: 3,
      vmCount: 3,
      capacityMiB: 524288,
      provisionedMiB: 524288,
      inUseMiB: 262144,
      freeMiB: 262144,
      freePercent: 50,
      siocEnabled: false,
      siocThreshold: null,
      hosts: 'host-1',
      hostCount: 1,
      datacenter: 'dc-1',
      cluster: 'cluster-1',
    },
  ],
  vTools: [
    { vmName: 'vm-1', powerState: 'poweredOn', template: false, vmVersion: '19', toolsStatus: 'toolsOk', toolsVersion: '12345', requiredVersion: null, upgradeable: false, upgradePolicy: 'manual', syncTime: true, appStatus: null, heartbeatStatus: null, kernelCrashState: null, operationReady: true },
    { vmName: 'vm-2', powerState: 'poweredOff', template: false, vmVersion: '17', toolsStatus: 'toolsNotInstalled', toolsVersion: '', requiredVersion: null, upgradeable: false, upgradePolicy: 'manual', syncTime: false, appStatus: null, heartbeatStatus: null, kernelCrashState: null, operationReady: false },
  ],
  vSnapshot: [
    { vmName: 'vm-1', powerState: 'poweredOn', snapshotName: 'snap-1', description: null, dateTime: new Date(), filename: 'snap1.vmdk', sizeVmsnMiB: 100, sizeTotalMiB: 100, quiesced: false, state: 'active', annotation: null, datacenter: 'dc-1', cluster: 'cluster-1', host: 'host-1', folder: '/', ageInDays: 5 },
    { vmName: 'vm-1', powerState: 'poweredOn', snapshotName: 'snap-2', description: null, dateTime: new Date(), filename: 'snap2.vmdk', sizeVmsnMiB: 100, sizeTotalMiB: 100, quiesced: false, state: 'active', annotation: null, datacenter: 'dc-1', cluster: 'cluster-1', host: 'host-1', folder: '/', ageInDays: 14 },
  ],
  vCD: [],
  vDisk: [
    { vmName: 'vm-1', powerState: 'poweredOn', template: false, diskLabel: 'Hard disk 1', diskKey: 2000, diskUuid: null, diskPath: '[ds-1] vm-1/vm-1.vmdk', capacityMiB: 51200, raw: false, diskMode: 'persistent', sharingMode: 'sharingNone', thin: true, eagerlyScrub: false, split: false, writeThrough: false, controllerType: 'SCSI', controllerKey: 1000, unitNumber: 0, datacenter: 'dc-1', cluster: 'cluster-1', host: 'host-1' },
    { vmName: 'vm-2', powerState: 'poweredOff', template: false, diskLabel: 'Hard disk 1', diskKey: 2000, diskUuid: null, diskPath: '[ds-1] vm-2/vm-2.vmdk', capacityMiB: 25600, raw: true, diskMode: 'persistent', sharingMode: 'sharingNone', thin: false, eagerlyScrub: false, split: false, writeThrough: false, controllerType: 'SCSI', controllerKey: 1000, unitNumber: 0, datacenter: 'dc-1', cluster: 'cluster-1', host: 'host-1' },
  ],
  vCPU: [
    { vmName: 'vm-1', powerState: 'poweredOn', template: false, cpus: 4, sockets: 2, coresPerSocket: 2, maxCpu: 8, overallLevel: null, shares: 4000, reservation: 0, entitlement: null, drsEntitlement: null, limit: -1, hotAddEnabled: false, affinityRule: null },
    { vmName: 'vm-2', powerState: 'poweredOff', template: false, cpus: 2, sockets: 1, coresPerSocket: 2, maxCpu: 4, overallLevel: null, shares: 2000, reservation: 0, entitlement: null, drsEntitlement: null, limit: -1, hotAddEnabled: true, affinityRule: null },
  ],
  vMemory: [
    { vmName: 'vm-1', powerState: 'poweredOn', template: false, memoryMiB: 8192, overallLevel: null, shares: 81920, reservation: 0, entitlement: null, drsEntitlement: null, limit: -1, hotAddEnabled: false, active: null, consumed: null, ballooned: 0, swapped: null, compressed: null },
    { vmName: 'vm-2', powerState: 'poweredOff', template: false, memoryMiB: 4096, overallLevel: null, shares: 40960, reservation: 0, entitlement: null, drsEntitlement: null, limit: -1, hotAddEnabled: true, active: null, consumed: null, ballooned: 512, swapped: null, compressed: null },
  ],
  vNetwork: [
    { vmName: 'vm-1', powerState: 'poweredOn', template: false, nicLabel: 'Network adapter 1', adapterType: 'vmxnet3', networkName: 'VM Network', switchName: 'vSwitch0', connected: true, startsConnected: true, macAddress: '00:50:56:00:00:01', macType: 'assigned', ipv4Address: '10.0.0.1', ipv6Address: null, directPathIO: false, datacenter: 'dc-1', cluster: 'cluster-1', host: 'host-1' },
  ],
  vPartition: [],
  vSource: [],
  vLicense: [],
  vHealth: [],
  vResourcePool: [
    { name: 'Resources', configStatus: 'green', cpuReservation: 0, cpuLimit: -1, cpuExpandable: true, cpuShares: 4000, memoryReservation: 0, memoryLimit: -1, memoryExpandable: true, memoryShares: 163840, vmCount: 10, datacenter: 'dc-1', cluster: 'cluster-1', parent: null },
  ],
};

describe('EnhancedPDFGenerator (as PDFGenerator)', () => {
  let generator: PDFGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new PDFGenerator();
  });

  describe('generate', () => {
    it('generates a PDF blob with all sections', async () => {
      const blob = await generator.generate(mockRVToolsData);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/pdf');
    });
  });
});

describe('generatePDF', () => {
  it('creates a PDF generator and returns blob', async () => {
    const blob = await generatePDF(mockRVToolsData);

    expect(blob).toBeInstanceOf(Blob);
  });
});

describe('downloadPDF', () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
    global.URL.revokeObjectURL = vi.fn();

    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLAnchorElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as unknown as HTMLAnchorElement);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as unknown as HTMLAnchorElement);
  });

  it('creates object URL and triggers download', () => {
    const blob = new Blob(['PDF content'], { type: 'application/pdf' });
    downloadPDF(blob, 'report.pdf');

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});

describe('PDF Content Sections', () => {
  let generator: PDFGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new PDFGenerator();
  });

  it('handles empty VM list gracefully', async () => {
    const emptyData: RVToolsData = {
      ...mockRVToolsData,
      vInfo: [],
      vHost: [],
      vCluster: [],
      vDatastore: [],
    };

    const blob = await generator.generate(emptyData);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('handles data without collection date', async () => {
    const noDateData: RVToolsData = {
      ...mockRVToolsData,
      metadata: {
        ...mockRVToolsData.metadata,
        collectionDate: null,
      },
    };

    const blob = await generator.generate(noDateData);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('handles VMs with missing optional fields', async () => {
    const sparseData: RVToolsData = {
      ...mockRVToolsData,
      vInfo: [
        {
          ...mockRVToolsData.vInfo[0],
          vmName: 'sparse-vm',
          datacenter: '',
          cluster: '',
          hardwareVersion: '',
          guestOS: '',
        },
      ],
    };

    const blob = await generator.generate(sparseData);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('handles data with RDM disks', async () => {
    const rdmData: RVToolsData = {
      ...mockRVToolsData,
      vDisk: [
        { ...mockRVToolsData.vDisk[0], vmName: 'vm-1', raw: true },
        { ...mockRVToolsData.vDisk[0], vmName: 'vm-2', raw: true },
      ],
    };

    const blob = await generator.generate(rdmData);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('handles data with shared disks', async () => {
    const sharedDiskData: RVToolsData = {
      ...mockRVToolsData,
      vDisk: [
        { ...mockRVToolsData.vDisk[0], sharingMode: 'sharingMultiWriter' },
      ],
    };

    const blob = await generator.generate(sharedDiskData);
    expect(blob).toBeInstanceOf(Blob);
  });
});

describe('OS Distribution Analysis', () => {
  let generator: PDFGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new PDFGenerator();
  });

  it('correctly handles various Windows Server versions', async () => {
    const windowsData: RVToolsData = {
      ...mockRVToolsData,
      vInfo: [
        { ...mockRVToolsData.vInfo[0], guestOS: 'Microsoft Windows Server 2019 (64-bit)' },
        { ...mockRVToolsData.vInfo[0], vmName: 'vm-ws16', guestOS: 'Microsoft Windows Server 2016 Standard' },
        { ...mockRVToolsData.vInfo[0], vmName: 'vm-ws22', guestOS: 'Microsoft Windows Server 2022 Datacenter' },
      ],
    };

    const blob = await generator.generate(windowsData);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('correctly handles various Linux distributions', async () => {
    const linuxData: RVToolsData = {
      ...mockRVToolsData,
      vInfo: [
        { ...mockRVToolsData.vInfo[0], guestOS: 'Red Hat Enterprise Linux 8 (64-bit)' },
        { ...mockRVToolsData.vInfo[0], vmName: 'vm-centos', guestOS: 'CentOS 7 (64-bit)' },
        { ...mockRVToolsData.vInfo[0], vmName: 'vm-ubuntu', guestOS: 'Ubuntu Linux (64-bit)' },
        { ...mockRVToolsData.vInfo[0], vmName: 'vm-suse', guestOS: 'SUSE Linux Enterprise Server 15' },
      ],
    };

    const blob = await generator.generate(linuxData);
    expect(blob).toBeInstanceOf(Blob);
  });
});

describe('CPU Distribution Analysis', () => {
  let generator: PDFGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new PDFGenerator();
  });

  it('correctly handles VMs with various CPU counts', async () => {
    const cpuData: RVToolsData = {
      ...mockRVToolsData,
      vInfo: [
        { ...mockRVToolsData.vInfo[0], cpus: 1 },
        { ...mockRVToolsData.vInfo[0], vmName: 'vm-4cpu', cpus: 4 },
        { ...mockRVToolsData.vInfo[0], vmName: 'vm-8cpu', cpus: 8 },
        { ...mockRVToolsData.vInfo[0], vmName: 'vm-16cpu', cpus: 16 },
        { ...mockRVToolsData.vInfo[0], vmName: 'vm-32cpu', cpus: 32 },
        { ...mockRVToolsData.vInfo[0], vmName: 'vm-64cpu', cpus: 64 },
      ],
    };

    const blob = await generator.generate(cpuData);
    expect(blob).toBeInstanceOf(Blob);
  });
});

describe('Storage Analysis', () => {
  let generator: PDFGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new PDFGenerator();
  });

  it('handles high utilization datastores', async () => {
    const highUtilData: RVToolsData = {
      ...mockRVToolsData,
      vDatastore: [
        { ...mockRVToolsData.vDatastore[0], name: 'ds-high', capacityMiB: 100000, inUseMiB: 95000, freeMiB: 5000, freePercent: 5 },
        { ...mockRVToolsData.vDatastore[0], name: 'ds-critical', capacityMiB: 100000, inUseMiB: 99000, freeMiB: 1000, freePercent: 1 },
      ],
    };

    const blob = await generator.generate(highUtilData);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('handles datastores with zero capacity', async () => {
    const zeroCap: RVToolsData = {
      ...mockRVToolsData,
      vDatastore: [
        { ...mockRVToolsData.vDatastore[0], name: 'ds-empty', capacityMiB: 0, inUseMiB: 0, freeMiB: 0, freePercent: 0 },
      ],
    };

    const blob = await generator.generate(zeroCap);
    expect(blob).toBeInstanceOf(Blob);
  });
});

describe('VMware Tools Analysis', () => {
  let generator: PDFGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new PDFGenerator();
  });

  it('handles various VMware Tools statuses', async () => {
    const toolsData: RVToolsData = {
      ...mockRVToolsData,
      vTools: [
        { ...mockRVToolsData.vTools[0], vmName: 'vm-1', toolsStatus: 'toolsOk' },
        { ...mockRVToolsData.vTools[0], vmName: 'vm-2', toolsStatus: 'toolsOld' },
        { ...mockRVToolsData.vTools[0], vmName: 'vm-3', toolsStatus: 'toolsNotInstalled' },
        { ...mockRVToolsData.vTools[0], vmName: 'vm-4', toolsStatus: 'toolsNotRunning' },
      ],
      vInfo: [
        { ...mockRVToolsData.vInfo[0], vmName: 'vm-1' },
        { ...mockRVToolsData.vInfo[0], vmName: 'vm-2' },
        { ...mockRVToolsData.vInfo[0], vmName: 'vm-3' },
        { ...mockRVToolsData.vInfo[0], vmName: 'vm-4' },
      ],
    };

    const blob = await generator.generate(toolsData);
    expect(blob).toBeInstanceOf(Blob);
  });
});
