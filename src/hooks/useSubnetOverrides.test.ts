// Unit tests for useSubnetOverrides hook
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSubnetOverrides, isValidCIDR, isValidCIDRList, parseCIDRList } from './useSubnetOverrides';

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

describe('useSubnetOverrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('initialization', () => {
    it('should initialize with empty overrides when no stored data', () => {
      const { result } = renderHook(() => useSubnetOverrides());

      expect(result.current.overrides).toEqual({});
      expect(result.current.overrideCount).toBe(0);
    });

    it('should load stored overrides', () => {
      const storedData = {
        version: 1,
        overrides: {
          'VM Network': { portGroup: 'VM Network', subnet: '10.0.1.0/24', modifiedAt: '2024-01-01' },
        },
        createdAt: '2024-01-01',
        modifiedAt: '2024-01-01',
      };
      localStorageMock.setItem('vcf-subnet-overrides', JSON.stringify(storedData));
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData));

      const { result } = renderHook(() => useSubnetOverrides());

      expect(result.current.overrides['VM Network']).toBeDefined();
      expect(result.current.overrides['VM Network'].subnet).toBe('10.0.1.0/24');
      expect(result.current.overrideCount).toBe(1);
    });
  });

  describe('setSubnet', () => {
    it('should set a subnet override', () => {
      const { result } = renderHook(() => useSubnetOverrides());

      act(() => {
        result.current.setSubnet('VM Network', '10.0.1.0/24');
      });

      expect(result.current.getSubnet('VM Network')).toBe('10.0.1.0/24');
      expect(result.current.hasOverride('VM Network')).toBe(true);
      expect(result.current.overrideCount).toBe(1);
    });

    it('should trim whitespace from subnet', () => {
      const { result } = renderHook(() => useSubnetOverrides());

      act(() => {
        result.current.setSubnet('VM Network', '  10.0.1.0/24  ');
      });

      expect(result.current.getSubnet('VM Network')).toBe('10.0.1.0/24');
    });

    it('should update an existing subnet override', () => {
      const { result } = renderHook(() => useSubnetOverrides());

      act(() => {
        result.current.setSubnet('VM Network', '10.0.1.0/24');
      });

      expect(result.current.getSubnet('VM Network')).toBe('10.0.1.0/24');

      act(() => {
        result.current.setSubnet('VM Network', '192.168.1.0/24');
      });

      expect(result.current.getSubnet('VM Network')).toBe('192.168.1.0/24');
      expect(result.current.overrideCount).toBe(1);
    });

    it('should remove override when setting empty string', () => {
      const { result } = renderHook(() => useSubnetOverrides());

      act(() => {
        result.current.setSubnet('VM Network', '10.0.1.0/24');
      });

      expect(result.current.hasOverride('VM Network')).toBe(true);

      act(() => {
        result.current.setSubnet('VM Network', '');
      });

      expect(result.current.hasOverride('VM Network')).toBe(false);
      expect(result.current.overrideCount).toBe(0);
    });
  });

  describe('removeOverride', () => {
    it('should remove a specific override', () => {
      const { result } = renderHook(() => useSubnetOverrides());

      act(() => {
        result.current.setSubnet('VM Network', '10.0.1.0/24');
        result.current.setSubnet('Management', '10.0.2.0/24');
      });

      expect(result.current.overrideCount).toBe(2);

      act(() => {
        result.current.removeOverride('VM Network');
      });

      expect(result.current.hasOverride('VM Network')).toBe(false);
      expect(result.current.hasOverride('Management')).toBe(true);
      expect(result.current.overrideCount).toBe(1);
    });
  });

  describe('clearAllOverrides', () => {
    it('should clear all overrides', () => {
      const { result } = renderHook(() => useSubnetOverrides());

      act(() => {
        result.current.setSubnet('VM Network', '10.0.1.0/24');
        result.current.setSubnet('Management', '10.0.2.0/24');
        result.current.setSubnet('Storage', '10.0.3.0/24');
      });

      expect(result.current.overrideCount).toBe(3);

      act(() => {
        result.current.clearAllOverrides();
      });

      expect(result.current.overrideCount).toBe(0);
      expect(result.current.overrides).toEqual({});
    });
  });

  describe('query helpers', () => {
    it('should return undefined for non-existent port groups', () => {
      const { result } = renderHook(() => useSubnetOverrides());

      expect(result.current.getSubnet('Unknown')).toBeUndefined();
      expect(result.current.hasOverride('Unknown')).toBe(false);
    });
  });

  describe('export/import', () => {
    it('should export settings as JSON', () => {
      const { result } = renderHook(() => useSubnetOverrides());

      act(() => {
        result.current.setSubnet('VM Network', '10.0.1.0/24');
      });

      const exported = result.current.exportSettings();
      const parsed = JSON.parse(exported);

      expect(parsed.overrides['VM Network']).toBeDefined();
      expect(parsed.overrides['VM Network'].subnet).toBe('10.0.1.0/24');
      expect(parsed.exportedAt).toBeDefined();
    });

    it('should import settings from JSON', () => {
      const { result } = renderHook(() => useSubnetOverrides());

      const importData = JSON.stringify({
        version: 1,
        overrides: {
          'VM Network': { portGroup: 'VM Network', subnet: '172.16.0.0/16', modifiedAt: '2024-01-01' },
        },
        createdAt: '2024-01-01',
        modifiedAt: '2024-01-01',
      });

      let success = false;
      act(() => {
        success = result.current.importSettings(importData);
      });

      expect(success).toBe(true);
      expect(result.current.getSubnet('VM Network')).toBe('172.16.0.0/16');
    });

    it('should fail to import invalid JSON', () => {
      const { result } = renderHook(() => useSubnetOverrides());

      let success = true;
      act(() => {
        success = result.current.importSettings('invalid json');
      });

      expect(success).toBe(false);
    });

    it('should fail to import JSON without required fields', () => {
      const { result } = renderHook(() => useSubnetOverrides());

      let success = true;
      act(() => {
        success = result.current.importSettings('{"foo": "bar"}');
      });

      expect(success).toBe(false);
    });
  });

  describe('persistence', () => {
    it('should persist changes to localStorage', () => {
      const { result } = renderHook(() => useSubnetOverrides());

      act(() => {
        result.current.setSubnet('VM Network', '10.0.1.0/24');
      });

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1][1]);
      expect(savedData.overrides['VM Network'].subnet).toBe('10.0.1.0/24');
    });
  });
});

describe('isValidCIDR', () => {
  describe('valid CIDR notations', () => {
    const validCases = [
      '10.0.0.0/8',
      '10.0.1.0/24',
      '192.168.1.0/24',
      '172.16.0.0/16',
      '0.0.0.0/0',
      '255.255.255.255/32',
      '10.20.30.40/28',
    ];

    validCases.forEach(cidr => {
      it(`should accept ${cidr}`, () => {
        expect(isValidCIDR(cidr)).toBe(true);
      });
    });
  });

  describe('invalid CIDR notations', () => {
    const invalidCases = [
      '',
      'invalid',
      '10.0.0.0',        // Missing prefix
      '10.0.0.0/',       // Empty prefix
      '10.0.0.0/33',     // Prefix > 32
      '10.0.0.0/-1',     // Negative prefix
      '256.0.0.0/24',    // Octet > 255
      '10.0.0/24',       // Missing octet
      '10.0.0.0.0/24',   // Extra octet
      '10.0.0.a/24',     // Non-numeric
      null as unknown as string,
      undefined as unknown as string,
    ];

    invalidCases.forEach(cidr => {
      it(`should reject ${String(cidr)}`, () => {
        expect(isValidCIDR(cidr)).toBe(false);
      });
    });
  });
});

describe('isValidCIDRList', () => {
  describe('valid CIDR lists', () => {
    const validCases = [
      '10.0.0.0/24',
      '10.0.0.0/24, 10.0.1.0/24',
      '10.0.0.0/24,10.0.1.0/24',
      '10.0.0.0/24, 10.0.1.0/24, 10.0.2.0/24',
      '192.168.1.0/24, 172.16.0.0/16',
    ];

    validCases.forEach(list => {
      it(`should accept "${list}"`, () => {
        expect(isValidCIDRList(list)).toBe(true);
      });
    });
  });

  describe('invalid CIDR lists', () => {
    const invalidCases = [
      '',
      ',',
      '10.0.0.0/24,',
      ', 10.0.0.0/24',
      '10.0.0.0/24, invalid',
      'invalid, 10.0.0.0/24',
      null as unknown as string,
      undefined as unknown as string,
    ];

    invalidCases.forEach(list => {
      it(`should reject "${String(list)}"`, () => {
        expect(isValidCIDRList(list)).toBe(false);
      });
    });
  });
});

describe('parseCIDRList', () => {
  it('should parse single CIDR', () => {
    expect(parseCIDRList('10.0.0.0/24')).toEqual(['10.0.0.0/24']);
  });

  it('should parse multiple CIDRs', () => {
    expect(parseCIDRList('10.0.0.0/24, 10.0.1.0/24')).toEqual(['10.0.0.0/24', '10.0.1.0/24']);
  });

  it('should filter out invalid CIDRs', () => {
    expect(parseCIDRList('10.0.0.0/24, invalid, 10.0.1.0/24')).toEqual(['10.0.0.0/24', '10.0.1.0/24']);
  });

  it('should return empty array for empty input', () => {
    expect(parseCIDRList('')).toEqual([]);
  });

  it('should trim whitespace', () => {
    expect(parseCIDRList('  10.0.0.0/24  ,  10.0.1.0/24  ')).toEqual(['10.0.0.0/24', '10.0.1.0/24']);
  });
});
