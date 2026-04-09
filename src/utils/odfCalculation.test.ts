import { describe, it, expect } from 'vitest';
import { calculateOdfReservation, getOdfProfiles, type OdfTuningProfile } from './odfCalculation';

describe('calculateOdfReservation', () => {
  // balanced + 8 NVMe + 3 nodes, no RGW, vCPU mode
  // MGR(1×2/3)+MON(1×3/3)+OSD(2×8)+MDS(2×2/3) = 0.667+1+16+1.333 = 19.0
  it('calculates balanced profile with 8 NVMe, 3 nodes, vCPU mode', () => {
    const result = calculateOdfReservation('balanced', 8, 3, false, 'vcpu', 1.25, true);
    expect(result.mgr.count).toBeCloseTo(2 / 3);
    expect(result.mon.count).toBeCloseTo(1);
    expect(result.osd.count).toBe(8);
    expect(result.mds.count).toBeCloseTo(2 / 3);
    expect(result.rgw).toBeNull();
    expect(result.totalCpu).toBeCloseTo(19.0, 1);
    expect(result.profileLabel).toBe('Balanced');
    expect(result.profileWarning).toBeNull();
  });

  // balanced + 8 NVMe + 3 nodes, no RGW, physical mode (HT 1.25×): 19.0 / 1.25 = 15.2
  it('calculates balanced profile in physical cores mode', () => {
    const result = calculateOdfReservation('balanced', 8, 3, false, 'physical', 1.25, true);
    expect(result.totalCpu).toBeCloseTo(19.0 / 1.25, 1);
  });

  // balanced + 8 NVMe + 9 nodes, no RGW, vCPU mode
  // MGR(1×2/9)+MON(1×3/9)+OSD(2×8)+MDS(2×2/9) = 0.222+0.333+16+0.444 = 17.0
  it('calculates balanced profile with 9 nodes (cluster-wide diluted)', () => {
    const result = calculateOdfReservation('balanced', 8, 9, false, 'vcpu', 1.25, true);
    expect(result.totalCpu).toBeCloseTo(17.0, 1);
  });

  // performance + 8 NVMe + 3 nodes, vCPU mode
  // MGR(2×2/3)+MON(1.5×3/3)+OSD(4×8)+MDS(3×2/3) = 1.333+1.5+32+2 = 36.833
  it('calculates performance profile with 8 NVMe, 3 nodes', () => {
    const result = calculateOdfReservation('performance', 8, 3, false, 'vcpu', 1.25, true);
    expect(result.totalCpu).toBeCloseTo(36.833, 1);
  });

  // lean + 4 NVMe + 3 nodes, vCPU mode
  // MGR(0.5×2/3)+MON(0.5×3/3)+OSD(1.5×4)+MDS(1×2/3) = 0.333+0.5+6+0.667 = 7.5
  it('calculates lean profile with 4 NVMe, 3 nodes', () => {
    const result = calculateOdfReservation('lean', 4, 3, false, 'vcpu', 1.25, true);
    expect(result.totalCpu).toBeCloseTo(7.5, 1);
    expect(result.profileWarning).toContain('Not recommended');
  });

  // RGW enabled: balanced + 8 NVMe + 3 nodes
  it('includes RGW when enabled', () => {
    const withRgw = calculateOdfReservation('balanced', 8, 3, true, 'vcpu', 1.25, true);
    const withoutRgw = calculateOdfReservation('balanced', 8, 3, false, 'vcpu', 1.25, true);
    expect(withRgw.rgw).not.toBeNull();
    expect(withRgw.rgw!.count).toBeCloseTo(2 / 3);
    // RGW adds 2 cpu × 2/3 = 1.333 vCPUs
    expect(withRgw.totalCpu - withoutRgw.totalCpu).toBeCloseTo(1.333, 1);
    // RGW adds 2 GiB × 2/3 = 1.333 GiB
    expect(withRgw.totalMemoryGiB - withoutRgw.totalMemoryGiB).toBeCloseTo(1.333, 1);
  });

  // Physical vs vCPU mode: same capacity after applying HT
  it('physical and vCPU modes produce consistent final capacity', () => {
    const physicalCores = 96;
    const htMult = 1.25;

    const physical = calculateOdfReservation('balanced', 8, 3, false, 'physical', htMult, true);
    const vcpu = calculateOdfReservation('balanced', 8, 3, false, 'vcpu', htMult, true);

    // Available physical cores after ODF = physicalCores - physical.totalCpu
    // Available vCPUs = (physicalCores - physical.totalCpu) * htMult
    // Alternatively: physicalCores * htMult - vcpu.totalCpu
    const availableVcpuFromPhysical = (physicalCores - physical.totalCpu) * htMult;
    const availableVcpuFromVcpu = physicalCores * htMult - vcpu.totalCpu;
    expect(availableVcpuFromPhysical).toBeCloseTo(availableVcpuFromVcpu, 5);
  });

  // Edge: 0 NVMe devices
  it('handles 0 NVMe devices (only cluster-wide components)', () => {
    const result = calculateOdfReservation('balanced', 0, 3, false, 'vcpu', 1.25, true);
    expect(result.osd.count).toBe(0);
    expect(result.osd.totalCpu).toBe(0);
    // Only MGR + MON + MDS remain
    expect(result.totalCpu).toBeCloseTo(1 * 2 / 3 + 1 * 1 + 2 * 2 / 3, 1); // 0.667+1+1.333 = 3.0
  });

  // Edge: HT disabled in physical mode (divisor = 1)
  it('uses divisor of 1 when HT disabled in physical mode', () => {
    const result = calculateOdfReservation('balanced', 8, 3, false, 'physical', 1.25, false);
    // Should be same as vCPU mode since divisor is 1
    const vcpuResult = calculateOdfReservation('balanced', 8, 3, false, 'vcpu', 1.25, true);
    expect(result.totalCpu).toBeCloseTo(vcpuResult.totalCpu, 5);
  });

  // Memory calculations (unaffected by CPU unit mode)
  it('memory is the same regardless of CPU unit mode', () => {
    const physical = calculateOdfReservation('balanced', 8, 3, false, 'physical', 1.25, true);
    const vcpu = calculateOdfReservation('balanced', 8, 3, false, 'vcpu', 1.25, true);
    expect(physical.totalMemoryGiB).toBeCloseTo(vcpu.totalMemoryGiB, 5);
  });

  // Memory: balanced + 8 NVMe + 3 nodes
  // MGR(1.5×2/3)+MON(2×3/3)+OSD(5×8)+MDS(6×2/3) = 1+2+40+4 = 47.0
  it('calculates memory correctly for balanced 8 NVMe, 3 nodes', () => {
    const result = calculateOdfReservation('balanced', 8, 3, false, 'vcpu', 1.25, true);
    expect(result.totalMemoryGiB).toBeCloseTo(47.0, 1);
  });

  // Minimum 3 nodes enforcement
  it('enforces minimum 3 nodes for cluster-wide distribution', () => {
    const twoNodes = calculateOdfReservation('balanced', 8, 2, false, 'vcpu', 1.25, true);
    const threeNodes = calculateOdfReservation('balanced', 8, 3, false, 'vcpu', 1.25, true);
    // With 2 nodes, should still use 3 as minimum
    expect(twoNodes.totalCpu).toBeCloseTo(threeNodes.totalCpu, 5);
  });

  it('falls back to balanced for invalid profile', () => {
    const invalid = calculateOdfReservation('invalid' as OdfTuningProfile, 8, 3, false, 'vcpu', 1.25, true);
    const balanced = calculateOdfReservation('balanced', 8, 3, false, 'vcpu', 1.25, true);
    expect(invalid.totalCpu).toBeCloseTo(balanced.totalCpu, 5);
    expect(invalid.totalMemoryGiB).toBeCloseTo(balanced.totalMemoryGiB, 5);
  });

  // Large cluster (40 nodes) — cluster-wide overhead is negligible
  it('on large clusters, OSD dominates and cluster-wide is negligible', () => {
    const result = calculateOdfReservation('balanced', 8, 40, false, 'vcpu', 1.25, true);
    const osdShare = result.osd.totalCpu / result.totalCpu;
    // OSD should be > 95% of total CPU
    expect(osdShare).toBeGreaterThan(0.95);
  });
});

describe('getOdfProfiles', () => {
  it('returns 3 profiles in order', () => {
    const profiles = getOdfProfiles();
    expect(profiles).toHaveLength(3);
    expect(profiles.map(p => p.id)).toEqual(['lean', 'balanced', 'performance']);
  });

  it('lean profile has a warning', () => {
    const profiles = getOdfProfiles();
    const lean = profiles.find(p => p.id === 'lean')!;
    expect(lean.warning).toBeDefined();
  });

  it('balanced profile has no warning', () => {
    const profiles = getOdfProfiles();
    const balanced = profiles.find(p => p.id === 'balanced')!;
    expect(balanced.warning).toBeUndefined();
  });
});
