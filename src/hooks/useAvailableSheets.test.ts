import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAvailableSheets } from './useAvailableSheets';

// Mock useData
const mockUseData = vi.fn();
vi.mock('./useData', () => ({
  useData: () => mockUseData(),
}));

describe('useAvailableSheets', () => {
  it('returns all false when rawData is null', () => {
    mockUseData.mockReturnValue({ rawData: null });
    const { result } = renderHook(() => useAvailableSheets());

    expect(result.current.hasVDisk).toBe(false);
    expect(result.current.hasVDatastore).toBe(false);
    expect(result.current.hasVNetwork).toBe(false);
    expect(result.current.hasVHost).toBe(false);
    expect(result.current.hasVCluster).toBe(false);
    expect(result.current.hasVSnapshot).toBe(false);
    expect(result.current.hasVTools).toBe(false);
  });

  it('returns all false when arrays are empty', () => {
    mockUseData.mockReturnValue({
      rawData: {
        vDisk: [],
        vDatastore: [],
        vNetwork: [],
        vHost: [],
        vCluster: [],
        vSnapshot: [],
        vTools: [],
      },
    });
    const { result } = renderHook(() => useAvailableSheets());

    expect(result.current.hasVDisk).toBe(false);
    expect(result.current.hasVDatastore).toBe(false);
    expect(result.current.hasVNetwork).toBe(false);
    expect(result.current.hasVHost).toBe(false);
    expect(result.current.hasVCluster).toBe(false);
    expect(result.current.hasVSnapshot).toBe(false);
    expect(result.current.hasVTools).toBe(false);
  });

  it('returns true for populated arrays', () => {
    mockUseData.mockReturnValue({
      rawData: {
        vDisk: [{ vmName: 'test' }],
        vDatastore: [{ name: 'ds1' }],
        vNetwork: [{ vmName: 'test' }],
        vHost: [{ name: 'host1' }],
        vCluster: [],
        vSnapshot: [{ vmName: 'test' }],
        vTools: [],
      },
    });
    const { result } = renderHook(() => useAvailableSheets());

    expect(result.current.hasVDisk).toBe(true);
    expect(result.current.hasVDatastore).toBe(true);
    expect(result.current.hasVNetwork).toBe(true);
    expect(result.current.hasVHost).toBe(true);
    expect(result.current.hasVCluster).toBe(false);
    expect(result.current.hasVSnapshot).toBe(true);
    expect(result.current.hasVTools).toBe(false);
  });

  it('handles vInfo-only data (all optional sheets empty)', () => {
    mockUseData.mockReturnValue({
      rawData: {
        vInfo: [{ vmName: 'vm1' }],
        vDisk: [],
        vDatastore: [],
        vNetwork: [],
        vHost: [],
        vCluster: [],
        vSnapshot: [],
        vTools: [],
      },
    });
    const { result } = renderHook(() => useAvailableSheets());

    expect(result.current.hasVDisk).toBe(false);
    expect(result.current.hasVDatastore).toBe(false);
    expect(result.current.hasVNetwork).toBe(false);
    expect(result.current.hasVHost).toBe(false);
    expect(result.current.hasVCluster).toBe(false);
    expect(result.current.hasVSnapshot).toBe(false);
    expect(result.current.hasVTools).toBe(false);
  });
});
