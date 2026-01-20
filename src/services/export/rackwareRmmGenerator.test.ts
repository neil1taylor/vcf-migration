// Unit tests for RackWare RMM Wave CSV generator
import { describe, it, expect } from 'vitest';
import {
  generateRackwareRmmCSV,
  generateRackwareRmmFromWaves,
  combineWaveAndVMData,
  generateRackwareRmmPerWave,
} from './rackwareRmmGenerator';
import type { RackwareVMData, RackwareRmmConfig } from './rackwareRmmGenerator';
import type { WaveGroup, VMWaveData } from '../migration/wavePlanning';
import type { VMDetail } from './bomXlsxGenerator';

// Helper function to create mock VM wave data
function createMockVMWaveData(overrides: Partial<VMWaveData> = {}): VMWaveData {
  return {
    vmName: 'test-vm',
    complexity: 25,
    osStatus: 'supported',
    hasBlocker: false,
    vcpus: 4,
    memoryGiB: 16,
    storageGiB: 100,
    networkName: 'VM Network',
    ipAddress: '192.168.1.100',
    subnet: '192.168.1.0/24',
    cluster: 'Cluster-01',
    ...overrides,
  };
}

// Helper function to create mock wave group
function createMockWaveGroup(overrides: Partial<WaveGroup> = {}): WaveGroup {
  return {
    name: 'Wave 1: Pilot',
    description: 'Simple VMs for initial validation',
    vms: [createMockVMWaveData()],
    vmCount: 1,
    vcpus: 4,
    memoryGiB: 16,
    storageGiB: 100,
    hasBlockers: false,
    ...overrides,
  };
}

// Helper function to create mock VM detail
function createMockVMDetail(overrides: Partial<VMDetail> = {}): VMDetail {
  return {
    vmName: 'test-vm',
    guestOS: 'Red Hat Enterprise Linux 8',
    profile: 'bx2-4x16',
    vcpus: 4,
    memoryGiB: 16,
    bootVolumeGiB: 100,
    dataVolumes: [],
    ...overrides,
  };
}

describe('RackWare RMM Generator', () => {
  describe('generateRackwareRmmCSV', () => {
    it('should generate CSV with required columns', () => {
      const vmData: RackwareVMData[] = [
        {
          vmName: 'linux-server-01',
          ipAddress: '192.168.1.10',
          guestOS: 'Red Hat Enterprise Linux 8',
          profile: 'bx2-4x16',
          vcpus: 4,
          memoryGiB: 16,
          storageGiB: 100,
          waveName: 'Wave 1',
          cluster: 'Cluster-01',
          networkName: 'VM Network',
        },
      ];

      const csv = generateRackwareRmmCSV(vmData);

      // Check header row
      expect(csv).toContain('Origin Name');
      expect(csv).toContain('Origin IP');
      expect(csv).toContain('Target Name');
      expect(csv).toContain('Origin Username');
      expect(csv).toContain('OS');
    });

    it('should correctly identify Linux VMs and use root username', () => {
      const vmData: RackwareVMData[] = [
        {
          vmName: 'linux-server',
          ipAddress: '192.168.1.10',
          guestOS: 'Ubuntu 22.04',
          vcpus: 2,
          memoryGiB: 8,
          storageGiB: 50,
        },
      ];

      const csv = generateRackwareRmmCSV(vmData);
      const lines = csv.split('\n');
      const dataLine = lines[1];

      expect(dataLine).toContain('linux');
      expect(dataLine).toContain('root');
    });

    it('should correctly identify Windows VMs and use SYSTEM username', () => {
      const vmData: RackwareVMData[] = [
        {
          vmName: 'windows-server',
          ipAddress: '192.168.1.20',
          guestOS: 'Microsoft Windows Server 2019',
          vcpus: 4,
          memoryGiB: 16,
          storageGiB: 150,
        },
      ];

      const csv = generateRackwareRmmCSV(vmData);
      const lines = csv.split('\n');
      const dataLine = lines[1];

      expect(dataLine).toContain('windows');
      expect(dataLine).toContain('SYSTEM');
    });

    it('should sanitize VM names by removing spaces', () => {
      const vmData: RackwareVMData[] = [
        {
          vmName: 'my server with spaces',
          ipAddress: '192.168.1.30',
          guestOS: 'CentOS 7',
          vcpus: 2,
          memoryGiB: 4,
          storageGiB: 40,
        },
      ];

      const csv = generateRackwareRmmCSV(vmData);
      const lines = csv.split('\n');
      const dataLine = lines[1];

      expect(dataLine).toContain('my-server-with-spaces');
      expect(dataLine).not.toContain('my server with spaces');
    });

    it('should include wave column when configured', () => {
      const vmData: RackwareVMData[] = [
        {
          vmName: 'test-vm',
          ipAddress: '192.168.1.10',
          guestOS: 'RHEL 8',
          vcpus: 2,
          memoryGiB: 8,
          storageGiB: 50,
          waveName: 'Wave 2: Quick Wins',
        },
      ];

      const csv = generateRackwareRmmCSV(vmData, { includeWave: true });

      expect(csv).toContain('Wave');
      expect(csv).toContain('Wave 2: Quick Wins');
    });

    it('should include profile column when configured', () => {
      const vmData: RackwareVMData[] = [
        {
          vmName: 'test-vm',
          ipAddress: '192.168.1.10',
          guestOS: 'RHEL 8',
          profile: 'mx2-8x64',
          vcpus: 8,
          memoryGiB: 64,
          storageGiB: 200,
        },
      ];

      const csv = generateRackwareRmmCSV(vmData, { includeProfile: true });

      expect(csv).toContain('Profile');
      expect(csv).toContain('mx2-8x64');
    });

    it('should include VPC settings when configured', () => {
      const config: RackwareRmmConfig = {
        vpc: 'migration-vpc',
        subnet: 'subnet-zone-1',
        zone: 'us-south-1',
        sshKeyName: 'my-ssh-key',
        securityGroup: 'default-sg',
      };

      const vmData: RackwareVMData[] = [
        {
          vmName: 'test-vm',
          ipAddress: '192.168.1.10',
          guestOS: 'Ubuntu 20.04',
          vcpus: 2,
          memoryGiB: 4,
          storageGiB: 50,
        },
      ];

      const csv = generateRackwareRmmCSV(vmData, config);

      expect(csv).toContain('VPC');
      expect(csv).toContain('migration-vpc');
      expect(csv).toContain('Subnet');
      expect(csv).toContain('subnet-zone-1');
      expect(csv).toContain('Zone');
      expect(csv).toContain('us-south-1');
      expect(csv).toContain('SSH Key');
      expect(csv).toContain('my-ssh-key');
      expect(csv).toContain('Security Group');
      expect(csv).toContain('default-sg');
    });

    it('should not include SSH key for Windows VMs', () => {
      const config: RackwareRmmConfig = {
        sshKeyName: 'my-ssh-key',
      };

      const vmData: RackwareVMData[] = [
        {
          vmName: 'windows-vm',
          ipAddress: '192.168.1.10',
          guestOS: 'Windows Server 2022',
          vcpus: 4,
          memoryGiB: 16,
          storageGiB: 100,
        },
      ];

      const csv = generateRackwareRmmCSV(vmData, config);
      const lines = csv.split('\n');
      const dataLine = lines[1];
      const columns = dataLine.split(',');

      // Find SSH Key column index
      const headerColumns = lines[0].split(',');
      const sshKeyIndex = headerColumns.findIndex(h => h === 'SSH Key');

      // Windows VMs should have empty SSH key value
      expect(columns[sshKeyIndex]).toBe('');
    });

    it('should apply custom target name pattern', () => {
      const config: RackwareRmmConfig = {
        targetNamePattern: 'ibm-{vmName}-migrated',
      };

      const vmData: RackwareVMData[] = [
        {
          vmName: 'prod-server',
          ipAddress: '192.168.1.10',
          guestOS: 'RHEL 8',
          vcpus: 4,
          memoryGiB: 16,
          storageGiB: 100,
        },
      ];

      const csv = generateRackwareRmmCSV(vmData, config);

      expect(csv).toContain('ibm-prod-server-migrated');
    });

    it('should use custom linux username when specified', () => {
      const config: RackwareRmmConfig = {
        linuxUsername: 'rackware',
      };

      const vmData: RackwareVMData[] = [
        {
          vmName: 'linux-vm',
          ipAddress: '192.168.1.10',
          guestOS: 'Debian 11',
          vcpus: 2,
          memoryGiB: 4,
          storageGiB: 50,
        },
      ];

      const csv = generateRackwareRmmCSV(vmData, config);

      expect(csv).toContain('rackware');
    });

    it('should escape CSV fields with commas', () => {
      const vmData: RackwareVMData[] = [
        {
          vmName: 'test-vm',
          ipAddress: '192.168.1.10',
          guestOS: 'RHEL 8',
          vcpus: 4,
          memoryGiB: 16,
          storageGiB: 100,
          waveName: 'Wave 1, Pilot Group',  // Wave name with comma
        },
      ];

      const csv = generateRackwareRmmCSV(vmData, { includeWave: true });

      // Value with comma should be quoted
      expect(csv).toContain('"Wave 1, Pilot Group"');
    });
  });

  describe('combineWaveAndVMData', () => {
    it('should combine wave data with VM details', () => {
      const waves: WaveGroup[] = [
        createMockWaveGroup({
          vms: [
            createMockVMWaveData({ vmName: 'vm-01' }),
            createMockVMWaveData({ vmName: 'vm-02' }),
          ],
          vmCount: 2,
        }),
      ];

      const vmDetails: VMDetail[] = [
        createMockVMDetail({ vmName: 'vm-01', profile: 'bx2-4x16', guestOS: 'RHEL 8' }),
        createMockVMDetail({ vmName: 'vm-02', profile: 'cx2-8x16', guestOS: 'Ubuntu 22.04' }),
      ];

      const result = combineWaveAndVMData(waves, vmDetails);

      expect(result).toHaveLength(2);
      expect(result[0].profile).toBe('bx2-4x16');
      expect(result[0].guestOS).toBe('RHEL 8');
      expect(result[1].profile).toBe('cx2-8x16');
      expect(result[1].guestOS).toBe('Ubuntu 22.04');
    });

    it('should work without VM details', () => {
      const waves: WaveGroup[] = [
        createMockWaveGroup({
          vms: [createMockVMWaveData({ vmName: 'vm-01' })],
        }),
      ];

      const result = combineWaveAndVMData(waves);

      expect(result).toHaveLength(1);
      expect(result[0].vmName).toBe('vm-01');
      expect(result[0].guestOS).toBe(''); // No VM details provided
    });

    it('should include wave name in combined data', () => {
      const waves: WaveGroup[] = [
        createMockWaveGroup({
          name: 'Wave 3: Standard',
          vms: [createMockVMWaveData({ vmName: 'vm-01' })],
        }),
      ];

      const result = combineWaveAndVMData(waves);

      expect(result[0].waveName).toBe('Wave 3: Standard');
    });
  });

  describe('generateRackwareRmmFromWaves', () => {
    it('should generate CSV from wave groups', () => {
      const waves: WaveGroup[] = [
        createMockWaveGroup({
          name: 'Wave 1: Pilot',
          vms: [
            createMockVMWaveData({ vmName: 'pilot-vm-01', ipAddress: '10.0.0.1' }),
            createMockVMWaveData({ vmName: 'pilot-vm-02', ipAddress: '10.0.0.2' }),
          ],
          vmCount: 2,
        }),
        createMockWaveGroup({
          name: 'Wave 2: Quick Wins',
          vms: [
            createMockVMWaveData({ vmName: 'quick-win-01', ipAddress: '10.0.0.3' }),
          ],
          vmCount: 1,
        }),
      ];

      const vmDetails: VMDetail[] = [
        createMockVMDetail({ vmName: 'pilot-vm-01', guestOS: 'RHEL 8' }),
        createMockVMDetail({ vmName: 'pilot-vm-02', guestOS: 'Windows Server 2019' }),
        createMockVMDetail({ vmName: 'quick-win-01', guestOS: 'Ubuntu 22.04' }),
      ];

      const csv = generateRackwareRmmFromWaves(waves, vmDetails);
      const lines = csv.split('\n');

      // Header + 3 data rows
      expect(lines).toHaveLength(4);
      expect(csv).toContain('pilot-vm-01');
      expect(csv).toContain('pilot-vm-02');
      expect(csv).toContain('quick-win-01');
    });
  });

  describe('generateRackwareRmmPerWave', () => {
    it('should generate separate CSV files per wave', () => {
      const waves: WaveGroup[] = [
        createMockWaveGroup({
          name: 'Wave 1: Pilot',
          vms: [createMockVMWaveData({ vmName: 'pilot-vm' })],
        }),
        createMockWaveGroup({
          name: 'Wave 2: Quick Wins',
          vms: [createMockVMWaveData({ vmName: 'quick-win-vm' })],
        }),
      ];

      const result = generateRackwareRmmPerWave(waves);

      expect(result.size).toBe(2);
      expect(result.has('Wave-1-Pilot')).toBe(true);
      expect(result.has('Wave-2-Quick-Wins')).toBe(true);

      const wave1Csv = result.get('Wave-1-Pilot');
      expect(wave1Csv).toContain('pilot-vm');
      expect(wave1Csv).not.toContain('quick-win-vm');

      const wave2Csv = result.get('Wave-2-Quick-Wins');
      expect(wave2Csv).toContain('quick-win-vm');
      expect(wave2Csv).not.toContain('pilot-vm');
    });
  });

  describe('OS Detection', () => {
    const testCases = [
      { guestOS: 'Microsoft Windows Server 2019', expectedOS: 'windows' },
      { guestOS: 'Microsoft Windows 10 (64-bit)', expectedOS: 'windows' },
      { guestOS: 'Red Hat Enterprise Linux 8', expectedOS: 'linux' },
      { guestOS: 'RHEL 7', expectedOS: 'linux' },
      { guestOS: 'Ubuntu 22.04 LTS', expectedOS: 'linux' },
      { guestOS: 'CentOS 7', expectedOS: 'linux' },
      { guestOS: 'SUSE Linux Enterprise Server 15', expectedOS: 'linux' },
      { guestOS: 'Debian 11', expectedOS: 'linux' },
      { guestOS: 'Oracle Linux 8', expectedOS: 'linux' },
      { guestOS: 'Rocky Linux 9', expectedOS: 'linux' },
      { guestOS: 'AlmaLinux 8', expectedOS: 'linux' },
    ];

    testCases.forEach(({ guestOS, expectedOS }) => {
      it(`should detect ${guestOS} as ${expectedOS}`, () => {
        const vmData: RackwareVMData[] = [
          {
            vmName: 'test-vm',
            ipAddress: '192.168.1.10',
            guestOS,
            vcpus: 2,
            memoryGiB: 4,
            storageGiB: 50,
          },
        ];

        const csv = generateRackwareRmmCSV(vmData);

        expect(csv).toContain(expectedOS);
      });
    });
  });
});
