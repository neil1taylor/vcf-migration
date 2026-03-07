import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlatformSelection } from './usePlatformSelection';
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
  ],
  vInfo: [],
};

let mockRawData: Partial<RVToolsData> | null = mockRVToolsData;
vi.mock('./useData', () => ({
  useData: () => ({ rawData: mockRawData }),
}));

describe('usePlatformSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockRawData = mockRVToolsData;
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it('initializes with empty answers and neutral score', () => {
    const { result } = renderHook(() => usePlatformSelection());
    expect(result.current.answers).toEqual({});
    expect(result.current.score.vsiCount).toBe(0);
    expect(result.current.score.roksCount).toBe(0);
    expect(result.current.score.answeredCount).toBe(0);
    expect(result.current.score.leaning).toBe('neutral');
  });

  it('sets an answer and updates score', () => {
    const { result } = renderHook(() => usePlatformSelection());

    act(() => {
      result.current.setAnswer('vsi-change-risk', 'yes');
    });

    expect(result.current.answers['vsi-change-risk']).toBe('yes');
    expect(result.current.score.vsiCount).toBe(1);
    expect(result.current.score.roksCount).toBe(0);
    expect(result.current.score.leaning).toBe('vsi');
  });

  it('counts "no" and "no-preference" as answered but not in favour', () => {
    const { result } = renderHook(() => usePlatformSelection());

    act(() => {
      result.current.setAnswer('vsi-change-risk', 'no');
      result.current.setAnswer('roks-containerize', 'no-preference');
    });

    expect(result.current.score.answeredCount).toBe(2);
    expect(result.current.score.vsiCount).toBe(0);
    expect(result.current.score.roksCount).toBe(0);
    expect(result.current.score.leaning).toBe('neutral');
  });

  it('does not count "not-sure" as answered', () => {
    const { result } = renderHook(() => usePlatformSelection());

    act(() => {
      result.current.setAnswer('vsi-change-risk', 'not-sure');
    });

    expect(result.current.score.answeredCount).toBe(0);
  });

  it('leans toward roks when more roks factors are yes', () => {
    const { result } = renderHook(() => usePlatformSelection());

    act(() => {
      result.current.setAnswer('roks-containerize', 'yes');
      result.current.setAnswer('roks-kubernetes', 'yes');
      result.current.setAnswer('vsi-change-risk', 'no');
    });

    expect(result.current.score.roksCount).toBe(2);
    expect(result.current.score.vsiCount).toBe(0);
    expect(result.current.score.leaning).toBe('roks');
  });

  it('removes an answer when set to null', () => {
    const { result } = renderHook(() => usePlatformSelection());

    act(() => {
      result.current.setAnswer('vsi-change-risk', 'yes');
    });
    expect(result.current.answers['vsi-change-risk']).toBe('yes');

    act(() => {
      result.current.setAnswer('vsi-change-risk', null);
    });
    expect(result.current.answers['vsi-change-risk']).toBeUndefined();
    expect(result.current.score.vsiCount).toBe(0);
  });

  it('resets all answers', () => {
    const { result } = renderHook(() => usePlatformSelection());

    act(() => {
      result.current.setAnswer('vsi-change-risk', 'yes');
      result.current.setAnswer('roks-containerize', 'yes');
    });
    expect(result.current.score.answeredCount).toBe(2);

    act(() => {
      result.current.resetAll();
    });
    expect(result.current.answers).toEqual({});
    expect(result.current.score.answeredCount).toBe(0);
  });

  it('persists answers to localStorage', () => {
    const { result } = renderHook(() => usePlatformSelection());

    act(() => {
      result.current.setAnswer('vsi-change-risk', 'yes');
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'vcf-platform-selection',
      expect.stringContaining('"vsi-change-risk":"yes"')
    );
  });

  it('restores answers from localStorage for matching fingerprint', () => {
    // Pre-seed localStorage with matching fingerprint data
    const fingerprint = 'vcenter.test.com::test-uuid-123::Cluster1';
    const stored = {
      version: 1,
      environmentFingerprint: fingerprint,
      answers: { 'vsi-team-skills': 'yes' },
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };
    localStorageMock.setItem('vcf-platform-selection', JSON.stringify(stored));
    localStorageMock.setItem.mockClear();

    const { result } = renderHook(() => usePlatformSelection());
    expect(result.current.answers['vsi-team-skills']).toBe('yes');
  });

  it('resets when environment fingerprint does not match', () => {
    // Pre-seed localStorage with non-matching fingerprint
    const stored = {
      version: 1,
      environmentFingerprint: 'different-server::different-uuid::DifferentCluster',
      answers: { 'vsi-team-skills': 'yes' },
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };
    localStorageMock.setItem('vcf-platform-selection', JSON.stringify(stored));
    localStorageMock.setItem.mockClear();

    const { result } = renderHook(() => usePlatformSelection());
    expect(result.current.answers).toEqual({});
  });

  describe('dynamic cost factor', () => {
    it('increments vsiCount when cost-preference=yes and VSI is cheaper', () => {
      const { result } = renderHook(() =>
        usePlatformSelection({ roksMonthlyCost: 5000, vsiMonthlyCost: 3000 })
      );

      act(() => {
        result.current.setAnswer('cost-preference', 'yes');
      });

      expect(result.current.score.vsiCount).toBe(1);
      expect(result.current.score.roksCount).toBe(0);
      expect(result.current.score.costLeaning).toBe('vsi');
    });

    it('increments roksCount when cost-preference=yes and ROKS is cheaper', () => {
      const { result } = renderHook(() =>
        usePlatformSelection({ roksMonthlyCost: 2000, vsiMonthlyCost: 4000 })
      );

      act(() => {
        result.current.setAnswer('cost-preference', 'yes');
      });

      expect(result.current.score.roksCount).toBe(1);
      expect(result.current.score.vsiCount).toBe(0);
      expect(result.current.score.costLeaning).toBe('roks');
    });

    it('does not count cost factor when costs are equal', () => {
      const { result } = renderHook(() =>
        usePlatformSelection({ roksMonthlyCost: 3000, vsiMonthlyCost: 3000 })
      );

      act(() => {
        result.current.setAnswer('cost-preference', 'yes');
      });

      expect(result.current.score.vsiCount).toBe(0);
      expect(result.current.score.roksCount).toBe(0);
      expect(result.current.score.costLeaning).toBeNull();
    });

    it('does not count cost factor when cost data is unavailable', () => {
      const { result } = renderHook(() =>
        usePlatformSelection({ roksMonthlyCost: null, vsiMonthlyCost: null })
      );

      act(() => {
        result.current.setAnswer('cost-preference', 'yes');
      });

      expect(result.current.score.vsiCount).toBe(0);
      expect(result.current.score.roksCount).toBe(0);
      expect(result.current.score.costLeaning).toBeNull();
    });

    it('does not count cost factor when answer is no', () => {
      const { result } = renderHook(() =>
        usePlatformSelection({ roksMonthlyCost: 5000, vsiMonthlyCost: 3000 })
      );

      act(() => {
        result.current.setAnswer('cost-preference', 'no');
      });

      expect(result.current.score.vsiCount).toBe(0);
      expect(result.current.score.roksCount).toBe(0);
      expect(result.current.score.costLeaning).toBe('vsi');
    });

    it('does not count cost factor when no costData provided', () => {
      const { result } = renderHook(() => usePlatformSelection());

      act(() => {
        result.current.setAnswer('cost-preference', 'yes');
      });

      expect(result.current.score.vsiCount).toBe(0);
      expect(result.current.score.roksCount).toBe(0);
      expect(result.current.score.costLeaning).toBeNull();
    });
  });
});
