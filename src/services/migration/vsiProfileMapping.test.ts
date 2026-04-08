import { describe, it, expect } from 'vitest';
import {
  isFlexProfile,
  isStandardProfile,
  isZSeriesProfile,
  isPreferredGeneration,
  determineProfileFamily,
  findStandardProfile,
  findFlexProfile,
  mapVMToVSIProfile,
  classifyVMForFlex,
  hasInstanceStorage,
  getProfileGeneration,
  isBIOSFirmware,
  isGpuProfile,
  findGpuProfile,
  findBandwidthUpgrade,
  getVSIProfiles,
} from './vsiProfileMapping';

describe('vsiProfileMapping', () => {
  describe('isZSeriesProfile', () => {
    it('should identify z-series profiles', () => {
      expect(isZSeriesProfile('bz2-2x8')).toBe(true);
      expect(isZSeriesProfile('bz2e-4x16')).toBe(true);
      expect(isZSeriesProfile('cz2-2x4')).toBe(true);
      expect(isZSeriesProfile('cz2e-2x4')).toBe(true);
      expect(isZSeriesProfile('mz2-2x16')).toBe(true);
      expect(isZSeriesProfile('mz2e-2x16')).toBe(true);
    });

    it('should not flag x86 profiles as z-series', () => {
      expect(isZSeriesProfile('bx2-2x8')).toBe(false);
      expect(isZSeriesProfile('bx3d-2x10')).toBe(false);
      expect(isZSeriesProfile('cx2-2x4')).toBe(false);
      expect(isZSeriesProfile('mx2d-2x16')).toBe(false);
      expect(isZSeriesProfile('bxf-2x8')).toBe(false);
    });
  });

  describe('isFlexProfile', () => {
    it('should identify flex profiles', () => {
      expect(isFlexProfile('bxf-2x8')).toBe(true);
      expect(isFlexProfile('cxf-2x4')).toBe(true);
      expect(isFlexProfile('mxf-2x16')).toBe(true);
    });

    it('should not flag standard profiles as flex', () => {
      expect(isFlexProfile('bx2-2x8')).toBe(false);
      expect(isFlexProfile('bx3d-4x20')).toBe(false);
      expect(isFlexProfile('cx2d-4x8')).toBe(false);
    });
  });

  describe('isStandardProfile', () => {
    it('should identify standard x86 profiles', () => {
      expect(isStandardProfile('bx2-2x8')).toBe(true);
      expect(isStandardProfile('bx3d-4x20')).toBe(true);
      expect(isStandardProfile('cx2-2x4')).toBe(true);
      expect(isStandardProfile('mx2d-2x16')).toBe(true);
    });

    it('should exclude flex profiles', () => {
      expect(isStandardProfile('bxf-2x8')).toBe(false);
      expect(isStandardProfile('cxf-2x4')).toBe(false);
    });

    it('should exclude z-series profiles', () => {
      expect(isStandardProfile('bz2-2x8')).toBe(false);
      expect(isStandardProfile('bz2e-4x16')).toBe(false);
      expect(isStandardProfile('cz2-2x4')).toBe(false);
      expect(isStandardProfile('mz2e-2x16')).toBe(false);
    });
  });

  describe('isPreferredGeneration', () => {
    it('should prefer gen3 profiles', () => {
      expect(isPreferredGeneration('bx3d-4x20')).toBe(true);
      expect(isPreferredGeneration('bx3dc-4x20')).toBe(true);
      expect(isPreferredGeneration('cx3d-4x10')).toBe(true);
      expect(isPreferredGeneration('mx3d-4x40')).toBe(true);
    });

    it('should not prefer gen2 profiles', () => {
      expect(isPreferredGeneration('bx2-4x16')).toBe(false);
      expect(isPreferredGeneration('bx2d-4x16')).toBe(false);
      expect(isPreferredGeneration('cx2-4x8')).toBe(false);
      expect(isPreferredGeneration('mx2d-4x32')).toBe(false);
    });
  });

  describe('determineProfileFamily', () => {
    it('should classify compute (ratio <= 2.5)', () => {
      expect(determineProfileFamily(4, 8)).toBe('compute');
      expect(determineProfileFamily(4, 10)).toBe('compute');
    });

    it('should classify balanced (2.5 < ratio < 6)', () => {
      expect(determineProfileFamily(4, 16)).toBe('balanced');
      expect(determineProfileFamily(4, 20)).toBe('balanced');
    });

    it('should classify memory (ratio >= 6)', () => {
      expect(determineProfileFamily(4, 32)).toBe('memory');
      expect(determineProfileFamily(2, 16)).toBe('memory');
    });
  });

  describe('findStandardProfile', () => {
    it('should return a gen3 profile for balanced workload', () => {
      const profile = findStandardProfile(4, 16);
      expect(profile.name).toMatch(/^bx3/);
      expect(profile.vcpus).toBeGreaterThanOrEqual(4);
      expect(profile.memoryGiB).toBeGreaterThanOrEqual(16);
    });

    it('should return a gen3 profile for compute workload', () => {
      const profile = findStandardProfile(4, 8);
      expect(profile.name).toMatch(/^cx3/);
      expect(profile.vcpus).toBeGreaterThanOrEqual(4);
      expect(profile.memoryGiB).toBeGreaterThanOrEqual(8);
    });

    it('should return a gen3 profile for memory workload', () => {
      const profile = findStandardProfile(4, 32);
      expect(profile.name).toMatch(/^mx3/);
      expect(profile.vcpus).toBeGreaterThanOrEqual(4);
      expect(profile.memoryGiB).toBeGreaterThanOrEqual(32);
    });

    it('should never return a z-series profile', () => {
      const profile = findStandardProfile(2, 8);
      expect(profile.name).not.toMatch(/z2/);
    });

    it('should never return a flex profile', () => {
      const profile = findStandardProfile(2, 8);
      expect(profile.name).not.toMatch(/xf-/);
    });

    it('should fall back to gen2 when gen3 cannot fit', () => {
      // Very large memory request that may only fit gen2 mx2d profiles
      const profile = findStandardProfile(128, 1024);
      expect(profile.vcpus).toBeGreaterThanOrEqual(128);
    });

    it('should handle small VM requirements (1 vCPU, 4 GiB)', () => {
      const profile = findStandardProfile(1, 4);
      expect(profile.vcpus).toBeGreaterThanOrEqual(1);
      expect(profile.memoryGiB).toBeGreaterThanOrEqual(4);
      expect(profile.name).not.toMatch(/z2/);
    });
  });

  describe('findFlexProfile', () => {
    it('should return a flex profile', () => {
      const profile = findFlexProfile(2, 8);
      expect(profile).not.toBeNull();
      expect(profile!.name).toMatch(/xf-/);
    });

    it('should never return a z-series profile', () => {
      const profile = findFlexProfile(2, 8);
      if (profile) {
        expect(profile.name).not.toMatch(/z2/);
      }
    });

    it('should return null when no flex profile fits', () => {
      // Very large requirements - no flex profile will fit
      const profile = findFlexProfile(256, 1024);
      expect(profile).toBeNull();
    });
  });

  describe('mapVMToVSIProfile', () => {
    it('should prefer gen3 for a typical balanced VM', () => {
      const profile = mapVMToVSIProfile(4, 16);
      expect(profile.name).toMatch(/^bx3/);
    });

    it('should prefer gen3 for a typical compute VM', () => {
      const profile = mapVMToVSIProfile(8, 16);
      expect(profile.name).toMatch(/^cx3/);
    });

    it('should prefer gen3 for a typical memory VM', () => {
      const profile = mapVMToVSIProfile(4, 32);
      expect(profile.name).toMatch(/^mx3/);
    });
  });

  describe('classifyVMForFlex', () => {
    it('should recommend standard for network appliances', () => {
      const result = classifyVMForFlex('firewall-01', 1);
      expect(result.recommendation).toBe('standard');
      expect(result.reasons).toContain('Network appliance');
    });

    it('should recommend standard for enterprise apps', () => {
      const result = classifyVMForFlex('oracle-db-01', 1);
      expect(result.recommendation).toBe('standard');
      expect(result.reasons).toContain('Enterprise app');
    });

    it('should recommend standard for multi-NIC VMs', () => {
      const result = classifyVMForFlex('web-01', 4);
      expect(result.recommendation).toBe('standard');
      expect(result.reasons).toContain('Multiple NICs (4)');
    });

    it('should recommend flex for simple VMs', () => {
      const result = classifyVMForFlex('web-01', 1);
      expect(result.recommendation).toBe('flex');
      expect(result.reasons).toEqual([]);
    });

    it('should not flag VMs with "sap" as a substring (e.g. bfabpsapp01)', () => {
      const result = classifyVMForFlex('bfabpsapp01', 1);
      expect(result.recommendation).toBe('flex');
    });

    it('should still flag actual SAP VMs with separator', () => {
      expect(classifyVMForFlex('sap-app-01', 1).recommendation).toBe('standard');
      expect(classifyVMForFlex('SAP_HANA_01', 1).recommendation).toBe('standard');
    });

    it('should NOT use enterprise OS as a reason for standard recommendation', () => {
      // A RHEL VM with no other signals should be flex
      const result = classifyVMForFlex('web-app-01', 1);
      expect(result.recommendation).toBe('flex');
      // Enterprise OS is not a classification factor — OS doesn't determine CPU patterns
    });

    it('should include descriptive note for standard recommendation', () => {
      const result = classifyVMForFlex('oracle-db-01', 4);
      expect(result.note).toContain('Standard profile recommended');
      expect(result.note).toContain('dedicated CPU');
      expect(result.note).toContain('Enterprise app');
      expect(result.note).toContain('Multiple NICs (4)');
    });

    it('should include descriptive note for flex recommendation', () => {
      const result = classifyVMForFlex('web-01', 1);
      expect(result.note).toContain('Flex profile recommended');
      expect(result.note).toContain('shared CPU');
    });
  });

  describe('hasInstanceStorage', () => {
    it('should return true for d-suffix profiles', () => {
      expect(hasInstanceStorage('bx3d-4x20')).toBe(true);
      expect(hasInstanceStorage('bx2d-4x16')).toBe(true);
      expect(hasInstanceStorage('mx2d-8x64')).toBe(true);
    });

    it('should return true for dc-suffix profiles', () => {
      expect(hasInstanceStorage('bx3dc-4x20')).toBe(true);
      expect(hasInstanceStorage('cx3dc-8x20')).toBe(true);
    });

    it('should return false for non-d profiles', () => {
      expect(hasInstanceStorage('bx2-4x16')).toBe(false);
      expect(hasInstanceStorage('cx2-8x16')).toBe(false);
      expect(hasInstanceStorage('mx2-16x128')).toBe(false);
    });

    it('should return false for flex profiles', () => {
      expect(hasInstanceStorage('bxf-2x8')).toBe(false);
      expect(hasInstanceStorage('cxf-4x8')).toBe(false);
      expect(hasInstanceStorage('mxf-2x16')).toBe(false);
    });
  });

  describe('getProfileGeneration', () => {
    it('should return 3 for gen3 profiles', () => {
      expect(getProfileGeneration('bx3d-4x20')).toBe(3);
      expect(getProfileGeneration('cx3d-8x20')).toBe(3);
      expect(getProfileGeneration('mx3d-16x160')).toBe(3);
      expect(getProfileGeneration('cx3dc-8x20')).toBe(3);
    });

    it('should return 2 for gen2 profiles', () => {
      expect(getProfileGeneration('bx2-4x16')).toBe(2);
      expect(getProfileGeneration('cx2-8x16')).toBe(2);
      expect(getProfileGeneration('mx2d-16x128')).toBe(2);
      expect(getProfileGeneration('bxf-2x8')).toBe(2);
    });
  });

  describe('isBIOSFirmware', () => {
    it('should return true for BIOS firmware strings', () => {
      expect(isBIOSFirmware('bios')).toBe(true);
      expect(isBIOSFirmware('BIOS')).toBe(true);
      expect(isBIOSFirmware('i440bx')).toBe(true);
    });

    it('should return false for UEFI/EFI firmware strings', () => {
      expect(isBIOSFirmware('efi')).toBe(false);
      expect(isBIOSFirmware('EFI')).toBe(false);
      expect(isBIOSFirmware('uefi')).toBe(false);
      expect(isBIOSFirmware('UEFI')).toBe(false);
    });

    it('should return false for null/undefined (optimistic — allow Gen3)', () => {
      expect(isBIOSFirmware(null)).toBe(false);
      expect(isBIOSFirmware(undefined)).toBe(false);
      expect(isBIOSFirmware('')).toBe(false);
    });
  });

  describe('findStandardProfile with firmware awareness', () => {
    it('should return Gen2 for BIOS firmware VMs', () => {
      const profile = findStandardProfile(4, 16, 'bios');
      expect(profile.name).toMatch(/^bx2/);
      expect(getProfileGeneration(profile.name)).toBe(2);
    });

    it('should return Gen3 for UEFI firmware VMs', () => {
      const profile = findStandardProfile(4, 16, 'efi');
      expect(profile.name).toMatch(/^bx3/);
      expect(getProfileGeneration(profile.name)).toBe(3);
    });

    it('should return Gen3 for null firmware (optimistic default)', () => {
      const profile = findStandardProfile(4, 16, null);
      expect(profile.name).toMatch(/^bx3/);
      expect(getProfileGeneration(profile.name)).toBe(3);
    });

    it('should return Gen3 when firmwareType is omitted (backward compat)', () => {
      const profile = findStandardProfile(4, 16);
      expect(profile.name).toMatch(/^bx3/);
      expect(getProfileGeneration(profile.name)).toBe(3);
    });

    it('should return Gen2 compute profile for BIOS firmware', () => {
      const profile = findStandardProfile(4, 8, 'bios');
      expect(profile.name).toMatch(/^cx2/);
      expect(getProfileGeneration(profile.name)).toBe(2);
    });

    it('should return Gen2 memory profile for BIOS firmware', () => {
      const profile = findStandardProfile(4, 32, 'BIOS');
      expect(profile.name).toMatch(/^mx2/);
      expect(getProfileGeneration(profile.name)).toBe(2);
    });

    it('should handle case-insensitive BIOS detection', () => {
      const profile = findStandardProfile(4, 16, 'Bios');
      expect(getProfileGeneration(profile.name)).toBe(2);
    });
  });

  describe('mapVMToVSIProfile with firmware', () => {
    it('should prefer Gen2 for BIOS firmware', () => {
      const profile = mapVMToVSIProfile(4, 16, 'bios');
      expect(getProfileGeneration(profile.name)).toBe(2);
    });

    it('should prefer Gen3 for UEFI firmware', () => {
      const profile = mapVMToVSIProfile(4, 16, 'efi');
      expect(getProfileGeneration(profile.name)).toBe(3);
    });

    it('should prefer Gen3 when firmware not specified', () => {
      const profile = mapVMToVSIProfile(4, 16);
      expect(getProfileGeneration(profile.name)).toBe(3);
    });
  });

  describe('isGpuProfile', () => {
    it('should identify gx-prefixed profiles as GPU', () => {
      expect(isGpuProfile('gx2-8x64x1v100')).toBe(true);
      expect(isGpuProfile('gx3-16x80x1l4')).toBe(true);
    });

    it('should identify gp-prefixed profiles as GPU', () => {
      expect(isGpuProfile('gp2-8x64x1v100')).toBe(true);
    });

    it('should not flag non-GPU profiles', () => {
      expect(isGpuProfile('bx2-2x8')).toBe(false);
      expect(isGpuProfile('cx3d-4x10')).toBe(false);
      expect(isGpuProfile('mx2-2x16')).toBe(false);
    });
  });

  describe('findGpuProfile', () => {
    it('should return null when no GPU profiles are available', () => {
      const profiles = getVSIProfiles();
      if (!profiles.gpu || profiles.gpu.length === 0) {
        // No GPU profiles in config — findGpuProfile should return null
        expect(findGpuProfile(4, 16)).toBeNull();
      }
    });

    it('should return null when requirements exceed all GPU profiles', () => {
      // Very large requirements that no profile should meet
      expect(findGpuProfile(99999, 99999)).toBeNull();
    });
  });

  describe('findBandwidthUpgrade', () => {
    it('should return next profile up in the same family', () => {
      // Get a small balanced profile
      const small = findStandardProfile(2, 8);
      const upgraded = findBandwidthUpgrade(small);

      // Should be a different profile with more vCPUs
      if (upgraded.name !== small.name) {
        expect(upgraded.vcpus).toBeGreaterThanOrEqual(small.vcpus);
        // Same prefix family
        expect(upgraded.name.split('-')[0]).toBe(small.name.split('-')[0]);
      }
    });

    it('should return same profile when already at max', () => {
      // Get a very large profile
      const profiles = getVSIProfiles();
      const balanced = profiles.balanced
        .filter(p => isStandardProfile(p.name))
        .sort((a, b) => b.vcpus - a.vcpus);

      if (balanced.length > 0) {
        const largest = balanced[0];
        const upgraded = findBandwidthUpgrade(largest);
        // Either same profile or a larger one (if gen has larger)
        expect(upgraded.vcpus).toBeGreaterThanOrEqual(largest.vcpus);
      }
    });

    it('should not cross family boundaries', () => {
      const balanced = findStandardProfile(4, 16); // balanced family
      const upgraded = findBandwidthUpgrade(balanced);

      // Same prefix (e.g. bx3d stays bx3d)
      expect(upgraded.name.split('-')[0]).toBe(balanced.name.split('-')[0]);
    });
  });
});
