// Unit tests for useVMOverrides hook
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVMOverrides } from './useVMOverrides';
import type { RVToolsData } from '@/types/rvtools';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock RVTools data
const mockRVToolsData: Partial<RVToolsData> = {
  vSource: [
    {
      server: 'vcenter.test.com',
      instanceUuid: 'test-uuid-123',
      ipAddress: '192.168.1.1',
      version: '7.0',
      build: '12345',
      osType: 'linux',
      apiVersion: '7.0',
      serverTime: new Date(),
      fullName: 'VMware vCenter Server 7.0',
    },
  ],
  vCluster: [
    { name: 'Cluster1', configStatus: 'green', overallStatus: 'green', vmCount: 10, hostCount: 3, numEffectiveHosts: 3, totalCpuMHz: 100000, numCpuCores: 48, numCpuThreads: 96, effectiveCpuMHz: 90000, totalMemoryMiB: 393216, effectiveMemoryMiB: 360000, haEnabled: true, haFailoverLevel: 1, drsEnabled: true, drsBehavior: 'fullyAutomated', evcMode: null, datacenter: 'DC1' },
    { name: 'Cluster2', configStatus: 'green', overallStatus: 'green', vmCount: 5, hostCount: 2, numEffectiveHosts: 2, totalCpuMHz: 50000, numCpuCores: 24, numCpuThreads: 48, effectiveCpuMHz: 45000, totalMemoryMiB: 196608, effectiveMemoryMiB: 180000, haEnabled: true, haFailoverLevel: 1, drsEnabled: true, drsBehavior: 'fullyAutomated', evcMode: null, datacenter: 'DC1' },
  ],
  vInfo: [
    { vmName: 'vm1', uuid: 'uuid-1', powerState: 'poweredOn', template: false, srmPlaceholder: false, configStatus: 'green', dnsName: null, connectionState: 'connected', guestState: 'running', heartbeat: 'green', consolidationNeeded: false, powerOnDate: null, suspendedToMemory: false, suspendTime: null, creationDate: null, cpus: 4, memory: 8192, nics: 1, disks: 1, resourcePool: null, folder: null, vApp: null, ftState: null, ftRole: null, cbrcEnabled: false, hardwareVersion: 'vmx-19', guestOS: 'Red Hat Enterprise Linux 8', osToolsConfig: '', guestHostname: null, guestIP: null, annotation: null, datacenter: 'DC1', cluster: 'Cluster1', host: 'host1', provisionedMiB: 102400, inUseMiB: 51200, firmwareType: 'bios', latencySensitivity: 'normal', cbtEnabled: false },
    { vmName: 'vm2', uuid: 'uuid-2', powerState: 'poweredOn', template: false, srmPlaceholder: false, configStatus: 'green', dnsName: null, connectionState: 'connected', guestState: 'running', heartbeat: 'green', consolidationNeeded: false, powerOnDate: null, suspendedToMemory: false, suspendTime: null, creationDate: null, cpus: 2, memory: 4096, nics: 1, disks: 1, resourcePool: null, folder: null, vApp: null, ftState: null, ftRole: null, cbrcEnabled: false, hardwareVersion: 'vmx-19', guestOS: 'Windows Server 2019', osToolsConfig: '', guestHostname: null, guestIP: null, annotation: null, datacenter: 'DC1', cluster: 'Cluster1', host: 'host1', provisionedMiB: 51200, inUseMiB: 25600, firmwareType: 'efi', latencySensitivity: 'normal', cbtEnabled: false },
  ],
};

// Mock useData hook
let mockRawData: Partial<RVToolsData> | null = mockRVToolsData;
vi.mock('./useData', () => ({
  useData: () => ({ rawData: mockRawData }),
}));

describe('useVMOverrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockRawData = mockRVToolsData;
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('initialization', () => {
    it('should initialize with empty overrides when no stored data', () => {
      const { result } = renderHook(() => useVMOverrides());

      expect(result.current.overrides).toEqual({});
      expect(result.current.excludedCount).toBe(0);
      expect(result.current.overrideCount).toBe(0);
      expect(result.current.environmentMismatch).toBe(false);
    });

    it('should load stored overrides when fingerprints match', () => {
      // Pre-populate localStorage with matching fingerprint
      const fingerprint = 'vcenter.test.com::test-uuid-123::Cluster1,Cluster2';
      const storedData = {
        version: 1,
        environmentFingerprint: fingerprint,
        overrides: {
          'vm1::uuid-1': { vmId: 'vm1::uuid-1', vmName: 'vm1', excluded: true, modifiedAt: '2024-01-01' },
        },
        createdAt: '2024-01-01',
        modifiedAt: '2024-01-01',
      };
      localStorageMock.setItem('vcf-vm-overrides', JSON.stringify(storedData));
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData));

      const { result } = renderHook(() => useVMOverrides());

      expect(result.current.overrides['vm1::uuid-1']).toBeDefined();
      expect(result.current.overrides['vm1::uuid-1'].excluded).toBe(true);
      expect(result.current.excludedCount).toBe(1);
      expect(result.current.environmentMismatch).toBe(false);
    });
  });

  describe('setExcluded', () => {
    it('should exclude a VM', () => {
      const { result } = renderHook(() => useVMOverrides());

      act(() => {
        result.current.setExcluded('vm1::uuid-1', 'vm1', true);
      });

      expect(result.current.isExcluded('vm1::uuid-1')).toBe(true);
      expect(result.current.excludedCount).toBe(1);
    });

    it('should include a previously excluded VM', () => {
      const { result } = renderHook(() => useVMOverrides());

      act(() => {
        result.current.setExcluded('vm1::uuid-1', 'vm1', true);
      });

      expect(result.current.isExcluded('vm1::uuid-1')).toBe(true);

      act(() => {
        result.current.setExcluded('vm1::uuid-1', 'vm1', false);
      });

      expect(result.current.isExcluded('vm1::uuid-1')).toBe(false);
      expect(result.current.excludedCount).toBe(0);
    });
  });

  describe('setWorkloadType', () => {
    it('should set a workload type override', () => {
      const { result } = renderHook(() => useVMOverrides());

      act(() => {
        result.current.setWorkloadType('vm1::uuid-1', 'vm1', 'Databases');
      });

      expect(result.current.getWorkloadType('vm1::uuid-1')).toBe('Databases');
      expect(result.current.hasOverride('vm1::uuid-1')).toBe(true);
    });

    it('should clear workload type when using removeOverride', () => {
      const { result } = renderHook(() => useVMOverrides());

      act(() => {
        result.current.setWorkloadType('vm1::uuid-1', 'vm1', 'Databases');
      });

      expect(result.current.getWorkloadType('vm1::uuid-1')).toBe('Databases');

      act(() => {
        result.current.removeOverride('vm1::uuid-1');
      });

      expect(result.current.getWorkloadType('vm1::uuid-1')).toBeUndefined();
      // Override should be removed
      expect(result.current.hasOverride('vm1::uuid-1')).toBe(false);
    });
  });

  describe('setNotes', () => {
    it('should set notes on a VM', () => {
      const { result } = renderHook(() => useVMOverrides());

      act(() => {
        result.current.setNotes('vm1::uuid-1', 'vm1', 'This VM needs special handling');
      });

      expect(result.current.getNotes('vm1::uuid-1')).toBe('This VM needs special handling');
    });

    it('should clear notes when using removeOverride', () => {
      const { result } = renderHook(() => useVMOverrides());

      act(() => {
        result.current.setNotes('vm1::uuid-1', 'vm1', 'Some notes');
      });

      expect(result.current.getNotes('vm1::uuid-1')).toBe('Some notes');

      act(() => {
        result.current.removeOverride('vm1::uuid-1');
      });

      expect(result.current.getNotes('vm1::uuid-1')).toBeUndefined();
    });
  });

  describe('bulkSetExcluded', () => {
    it('should exclude multiple VMs at once', () => {
      const { result } = renderHook(() => useVMOverrides());

      act(() => {
        result.current.bulkSetExcluded([
          { vmId: 'vm1::uuid-1', vmName: 'vm1' },
          { vmId: 'vm2::uuid-2', vmName: 'vm2' },
        ], true);
      });

      expect(result.current.isExcluded('vm1::uuid-1')).toBe(true);
      expect(result.current.isExcluded('vm2::uuid-2')).toBe(true);
      expect(result.current.excludedCount).toBe(2);
    });

    it('should include multiple VMs at once', () => {
      const { result } = renderHook(() => useVMOverrides());

      // First exclude
      act(() => {
        result.current.bulkSetExcluded([
          { vmId: 'vm1::uuid-1', vmName: 'vm1' },
          { vmId: 'vm2::uuid-2', vmName: 'vm2' },
        ], true);
      });

      // Then include
      act(() => {
        result.current.bulkSetExcluded([
          { vmId: 'vm1::uuid-1', vmName: 'vm1' },
          { vmId: 'vm2::uuid-2', vmName: 'vm2' },
        ], false);
      });

      expect(result.current.isExcluded('vm1::uuid-1')).toBe(false);
      expect(result.current.isExcluded('vm2::uuid-2')).toBe(false);
      expect(result.current.excludedCount).toBe(0);
    });
  });

  describe('clearAllOverrides', () => {
    it('should clear all overrides', () => {
      const { result } = renderHook(() => useVMOverrides());

      act(() => {
        result.current.setExcluded('vm1::uuid-1', 'vm1', true);
        result.current.setWorkloadType('vm2::uuid-2', 'vm2', 'Databases');
      });

      expect(result.current.overrideCount).toBe(2);

      act(() => {
        result.current.clearAllOverrides();
      });

      expect(result.current.overrideCount).toBe(0);
      expect(result.current.excludedCount).toBe(0);
    });
  });

  describe('removeOverride', () => {
    it('should remove a specific override', () => {
      const { result } = renderHook(() => useVMOverrides());

      act(() => {
        result.current.setExcluded('vm1::uuid-1', 'vm1', true);
        result.current.setWorkloadType('vm2::uuid-2', 'vm2', 'Databases');
      });

      act(() => {
        result.current.removeOverride('vm1::uuid-1');
      });

      expect(result.current.hasOverride('vm1::uuid-1')).toBe(false);
      expect(result.current.hasOverride('vm2::uuid-2')).toBe(true);
    });
  });

  describe('export/import', () => {
    it('should export settings as JSON', () => {
      const { result } = renderHook(() => useVMOverrides());

      act(() => {
        result.current.setExcluded('vm1::uuid-1', 'vm1', true);
      });

      const exported = result.current.exportSettings();
      const parsed = JSON.parse(exported);

      expect(parsed.overrides['vm1::uuid-1']).toBeDefined();
      expect(parsed.overrides['vm1::uuid-1'].excluded).toBe(true);
      expect(parsed.exportedAt).toBeDefined();
    });

    it('should import settings from JSON', () => {
      const { result } = renderHook(() => useVMOverrides());

      const importData = JSON.stringify({
        version: 1,
        environmentFingerprint: 'some-fingerprint',
        overrides: {
          'vm1::uuid-1': { vmId: 'vm1::uuid-1', vmName: 'vm1', excluded: true, notes: 'Imported', modifiedAt: '2024-01-01' },
        },
        createdAt: '2024-01-01',
        modifiedAt: '2024-01-01',
      });

      let success = false;
      act(() => {
        success = result.current.importSettings(importData);
      });

      expect(success).toBe(true);
      expect(result.current.isExcluded('vm1::uuid-1')).toBe(true);
      expect(result.current.getNotes('vm1::uuid-1')).toBe('Imported');
    });

    it('should fail to import invalid JSON', () => {
      const { result } = renderHook(() => useVMOverrides());

      let success = true;
      act(() => {
        success = result.current.importSettings('invalid json');
      });

      expect(success).toBe(false);
    });
  });

  describe('combined operations', () => {
    it('should maintain multiple override types on the same VM', () => {
      const { result } = renderHook(() => useVMOverrides());

      act(() => {
        result.current.setExcluded('vm1::uuid-1', 'vm1', true);
        result.current.setWorkloadType('vm1::uuid-1', 'vm1', 'Databases');
        result.current.setNotes('vm1::uuid-1', 'vm1', 'Critical DB server');
      });

      expect(result.current.isExcluded('vm1::uuid-1')).toBe(true);
      expect(result.current.getWorkloadType('vm1::uuid-1')).toBe('Databases');
      expect(result.current.getNotes('vm1::uuid-1')).toBe('Critical DB server');
      expect(result.current.overrideCount).toBe(1); // Still one override entry
    });
  });

  describe('no data loaded', () => {
    beforeEach(() => {
      localStorageMock.clear();
      mockRawData = null;
    });

    it('should handle null rawData gracefully', () => {
      const { result } = renderHook(() => useVMOverrides());

      expect(result.current.overrides).toBeDefined();
      expect(typeof result.current.excludedCount).toBe('number');
    });
  });
});
