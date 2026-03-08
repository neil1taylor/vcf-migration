import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { VMDetailModal } from './VMDetailModal';
import type { RVToolsData } from '@/types/rvtools';

// Mock useData
const mockUseData = vi.fn();
vi.mock('@/hooks/useData', () => ({
  useData: () => mockUseData(),
}));

function makeRawData(overrides: Partial<RVToolsData> = {}): RVToolsData {
  const base: RVToolsData = {
    metadata: { fileName: 'test.xlsx', collectionDate: null, vCenterVersion: null, environment: null },
    vInfo: [{
      vmName: 'test-vm',
      powerState: 'poweredOn',
      template: false,
      srmPlaceholder: false,
      configStatus: 'green',
      dnsName: 'test-vm.local',
      connectionState: 'connected',
      guestState: 'running',
      heartbeat: 'green',
      consolidationNeeded: false,
      powerOnDate: new Date('2024-01-01'),
      suspendedToMemory: false,
      suspendTime: null,
      creationDate: new Date('2023-06-15'),
      cpus: 4,
      memory: 8192, // 8 GiB in MiB
      nics: 2,
      disks: 2,
      resourcePool: 'Resources',
      folder: '/vm',
      vApp: null,
      ftState: null,
      ftRole: null,
      cbrcEnabled: false,
      hardwareVersion: 'vmx-19',
      guestOS: 'Red Hat Enterprise Linux 8 (64-bit)',
      osToolsConfig: 'guestManaged',
      guestHostname: 'test-vm',
      guestIP: '10.0.0.5',
      annotation: 'Test annotation text',
      datacenter: 'DC1',
      cluster: 'Cluster1',
      host: 'esxi-01.local',
      provisionedMiB: 102400,
      inUseMiB: 51200,
      uuid: '1234-5678',
      firmwareType: 'BIOS',
      latencySensitivity: null,
      cbtEnabled: true,
    }],
    vCPU: [{
      vmName: 'test-vm',
      powerState: 'poweredOn',
      template: false,
      cpus: 4,
      sockets: 2,
      coresPerSocket: 2,
      maxCpu: 8,
      overallLevel: 'green',
      shares: 4000,
      reservation: 0,
      entitlement: null,
      drsEntitlement: null,
      limit: -1,
      hotAddEnabled: true,
      affinityRule: null,
    }],
    vMemory: [{
      vmName: 'test-vm',
      powerState: 'poweredOn',
      template: false,
      memoryMiB: 8192,
      overallLevel: 'green',
      shares: 81920,
      reservation: 0,
      entitlement: null,
      drsEntitlement: null,
      limit: -1,
      hotAddEnabled: false,
      active: 4096,
      consumed: 6000,
      ballooned: 0,
      swapped: 0,
      compressed: 0,
    }],
    vDisk: [
      {
        vmName: 'test-vm',
        powerState: 'poweredOn',
        template: false,
        diskLabel: 'Hard disk 1',
        diskKey: 2000,
        diskUuid: null,
        diskPath: '[datastore1] test-vm/test-vm.vmdk',
        capacityMiB: 51200,
        raw: false,
        diskMode: 'persistent',
        sharingMode: 'sharingNone',
        thin: true,
        eagerlyScrub: false,
        split: false,
        writeThrough: false,
        controllerType: 'SCSI',
        controllerKey: 1000,
        unitNumber: 0,
        datacenter: 'DC1',
        cluster: 'Cluster1',
        host: 'esxi-01.local',
      },
      {
        vmName: 'test-vm',
        powerState: 'poweredOn',
        template: false,
        diskLabel: 'Hard disk 2',
        diskKey: 2001,
        diskUuid: null,
        diskPath: '[datastore1] test-vm/test-vm_1.vmdk',
        capacityMiB: 51200,
        raw: false,
        diskMode: 'persistent',
        sharingMode: 'sharingNone',
        thin: false,
        eagerlyScrub: false,
        split: false,
        writeThrough: false,
        controllerType: 'SCSI',
        controllerKey: 1000,
        unitNumber: 1,
        datacenter: 'DC1',
        cluster: 'Cluster1',
        host: 'esxi-01.local',
      },
    ],
    vNetwork: [{
      vmName: 'test-vm',
      powerState: 'poweredOn',
      template: false,
      nicLabel: 'Network adapter 1',
      adapterType: 'VMXNET3',
      networkName: 'VM Network',
      switchName: 'vSwitch0',
      connected: true,
      startsConnected: true,
      macAddress: '00:50:56:ab:cd:ef',
      macType: 'assigned',
      ipv4Address: '10.0.0.5',
      ipv6Address: null,
      directPathIO: false,
      datacenter: 'DC1',
      cluster: 'Cluster1',
      host: 'esxi-01.local',
    }],
    vSnapshot: [{
      vmName: 'test-vm',
      powerState: 'poweredOn',
      snapshotName: 'pre-update',
      description: 'Before patching',
      dateTime: new Date('2023-01-01'),
      filename: 'test-vm-snap.vmdk',
      sizeVmsnMiB: 100,
      sizeTotalMiB: 500,
      quiesced: true,
      state: 'poweredOn',
      annotation: null,
      datacenter: 'DC1',
      cluster: 'Cluster1',
      host: 'esxi-01.local',
      folder: '/vm',
      ageInDays: 400,
    }],
    vTools: [{
      vmName: 'test-vm',
      powerState: 'poweredOn',
      template: false,
      vmVersion: 'vmx-19',
      toolsStatus: 'toolsOk',
      toolsVersion: '12352',
      requiredVersion: null,
      upgradeable: false,
      upgradePolicy: 'manual',
      syncTime: true,
      appStatus: null,
      heartbeatStatus: 'green',
      kernelCrashState: null,
      operationReady: true,
    }],
    vPartition: [{
      vmName: 'test-vm',
      powerState: 'poweredOn',
      partition: '/',
      capacityMiB: 40960,
      consumedMiB: 20480,
      freeMiB: 20480,
      freePercent: 50,
    }],
    vCD: [{
      vmName: 'test-vm',
      powerState: 'poweredOn',
      template: false,
      deviceNode: 'IDE 0:0',
      connected: true,
      startsConnected: false,
      deviceType: 'Client Device',
      annotation: null,
      datacenter: 'DC1',
      cluster: 'Cluster1',
      host: 'esxi-01.local',
      guestOS: 'RHEL 8',
      osFromTools: 'rhel8_64Guest',
    }],
    vCluster: [],
    vHost: [],
    vDatastore: [],
    vResourcePool: [],
    vLicense: [],
    vHealth: [],
    vSource: [],
  };
  return { ...base, ...overrides };
}

describe('VMDetailModal', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render modal content when vmName is null', () => {
    mockUseData.mockReturnValue({ rawData: makeRawData() });
    const { container } = render(<VMDetailModal vmName={null} onClose={vi.fn()} />);
    // Modal should not be open
    expect(container.querySelector('.cds--modal--open')).toBeNull();
  });

  it('renders all tabs when full data is present', () => {
    mockUseData.mockReturnValue({ rawData: makeRawData() });
    render(<VMDetailModal vmName="test-vm" onClose={vi.fn()} />);

    // Use getByRole('tab') to target tab elements specifically
    const tabs = screen.getAllByRole('tab');
    const tabLabels = tabs.map(t => t.textContent);
    expect(tabLabels).toContain('General');
    expect(tabLabels).toContain('CPU');
    expect(tabLabels).toContain('Memory');
    expect(tabLabels).toContain('Storage');
    expect(tabLabels).toContain('Network');
    expect(tabLabels).toContain('Snapshots');
    expect(tabLabels).toContain('Tools');
    expect(tabLabels).toContain('Partitions');
    expect(tabLabels).toContain('CD/DVD');
  });

  it('hides tabs when related data arrays are empty', () => {
    const rawData = makeRawData({
      vCPU: [],
      vMemory: [],
      vDisk: [],
      vNetwork: [],
      vSnapshot: [],
      vTools: [],
      vPartition: [],
      vCD: [],
    });
    mockUseData.mockReturnValue({ rawData });
    render(<VMDetailModal vmName="test-vm" onClose={vi.fn()} />);

    // Query tab labels within the tab list
    const tabList = screen.getByRole('tablist');
    const tabButtons = tabList.querySelectorAll('[role="tab"]');
    const tabLabels = Array.from(tabButtons).map(t => t.textContent);
    expect(tabLabels).toEqual(['General']);
  });

  it('formats MiB values to GiB in General tab', () => {
    mockUseData.mockReturnValue({ rawData: makeRawData() });
    render(<VMDetailModal vmName="test-vm" onClose={vi.fn()} />);

    // 8192 MiB = 8.00 GiB — appears in the General tab structured list
    const giBElements = screen.getAllByText('8.00 GiB');
    expect(giBElements.length).toBeGreaterThan(0);
  });

  it('displays booleans as Yes/No', () => {
    mockUseData.mockReturnValue({ rawData: makeRawData() });
    render(<VMDetailModal vmName="test-vm" onClose={vi.fn()} />);

    // CBT Enabled = true → Yes
    const yesElements = screen.getAllByText('Yes');
    expect(yesElements.length).toBeGreaterThan(0);
  });

  it('displays nulls as N/A', () => {
    mockUseData.mockReturnValue({ rawData: makeRawData() });
    render(<VMDetailModal vmName="test-vm" onClose={vi.fn()} />);

    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThan(0);
  });

  it('shows snapshot age warning for old snapshots', () => {
    mockUseData.mockReturnValue({ rawData: makeRawData() });
    render(<VMDetailModal vmName="test-vm" onClose={vi.fn()} />);

    // Click on Snapshots tab
    const snapshotsTab = screen.getByText('Snapshots');
    snapshotsTab.click();

    expect(screen.getByText('Old snapshots detected')).toBeInTheDocument();
  });

  it('does not show snapshot warning when all snapshots are recent', () => {
    const rawData = makeRawData({
      vSnapshot: [{
        vmName: 'test-vm',
        powerState: 'poweredOn',
        snapshotName: 'recent-snap',
        description: null,
        dateTime: new Date(),
        filename: 'snap.vmdk',
        sizeVmsnMiB: 50,
        sizeTotalMiB: 50,
        quiesced: false,
        state: 'poweredOn',
        annotation: null,
        datacenter: 'DC1',
        cluster: 'Cluster1',
        host: 'esxi-01.local',
        folder: '/vm',
        ageInDays: 5,
      }],
    });
    mockUseData.mockReturnValue({ rawData });
    const { container } = render(<VMDetailModal vmName="test-vm" onClose={vi.fn()} />);

    // Click the Snapshots tab within this component's tablist
    const tabList = container.querySelector('[role="tablist"]')!;
    const snapshotsTab = Array.from(tabList.querySelectorAll('[role="tab"]'))
      .find(t => t.textContent === 'Snapshots') as HTMLElement;
    snapshotsTab.click();

    // Should NOT show old snapshot warning since ageInDays = 5
    const warningTitle = container.querySelector('.cds--inline-notification--warning');
    expect(warningTitle).toBeNull();
  });

  it('displays disk summary with count and total capacity', () => {
    mockUseData.mockReturnValue({ rawData: makeRawData() });
    render(<VMDetailModal vmName="test-vm" onClose={vi.fn()} />);

    // Click Storage tab
    screen.getByText('Storage').click();

    // 2 disks, each 51200 MiB = 100 GiB total
    expect(screen.getByText(/2 disks/)).toBeInTheDocument();
  });

  it('renders hardware version formatted', () => {
    mockUseData.mockReturnValue({ rawData: makeRawData() });
    render(<VMDetailModal vmName="test-vm" onClose={vi.fn()} />);

    expect(screen.getByText('v19')).toBeInTheDocument();
  });

  it('shows power state tag in heading', () => {
    mockUseData.mockReturnValue({ rawData: makeRawData() });
    render(<VMDetailModal vmName="test-vm" onClose={vi.fn()} />);

    // Power state tag in the heading area
    const heading = document.querySelector('.vm-detail-modal__heading');
    expect(heading).not.toBeNull();
    expect(heading!.textContent).toContain('Powered On');
  });
});
