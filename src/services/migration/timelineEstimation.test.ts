import { describe, it, expect } from 'vitest';
import { buildDefaultTimeline, calculateTimelineTotals, formatTimelineForExport, calculateWaveDurationWeeks } from './timelineEstimation';
import { PHASE_DEFAULTS } from '@/types/timeline';

describe('buildDefaultTimeline', () => {
  it('creates correct phases for 3 waves', () => {
    const phases = buildDefaultTimeline(3);
    expect(phases).toHaveLength(7); // prep + pilot + 3 waves + validation + buffer

    expect(phases[0].type).toBe('preparation');
    expect(phases[1].type).toBe('pilot');
    expect(phases[2].type).toBe('production');
    expect(phases[3].type).toBe('production');
    expect(phases[4].type).toBe('production');
    expect(phases[5].type).toBe('validation');
    expect(phases[6].type).toBe('buffer');
  });

  it('calculates cumulative start/end weeks', () => {
    const phases = buildDefaultTimeline(2);
    // prep=2, pilot=2, wave1=2, wave2=2, validation=1, buffer=1
    expect(phases[0].startWeek).toBe(0);
    expect(phases[0].endWeek).toBe(2);
    expect(phases[1].startWeek).toBe(2);
    expect(phases[1].endWeek).toBe(4);
    expect(phases[phases.length - 1].endWeek).toBe(10);
  });

  it('applies custom durations', () => {
    const phases = buildDefaultTimeline(1);
    const customDurations: Record<string, number> = {
      [phases[0].id]: 4, // Extend preparation to 4 weeks
    };
    const customPhases = buildDefaultTimeline(1, customDurations);
    expect(customPhases[0].durationWeeks).toBe(4);
  });

  it('handles 0 waves (minimum 1)', () => {
    const phases = buildDefaultTimeline(0);
    const productionPhases = phases.filter(p => p.type === 'production');
    expect(productionPhases).toHaveLength(1);
  });
});

describe('calculateWaveDurationWeeks', () => {
  describe('VM-floor-dominated cases (no storage or low storage)', () => {
    it.each([
      [0, undefined, 1],   // 0 VMs → minimum 1 week
      [1, undefined, 1],   // 1 * 0.25 = 0.25 days → 1 week
      [5, undefined, 1],   // 5 * 0.25 = 1.25 days → 1 week
      [10, undefined, 1],  // 10 * 0.25 = 2.5 days → 1 week
      [20, undefined, 1],  // 20 * 0.25 = 5 days → 1 week
      [21, undefined, 2],  // 21 * 0.25 = 5.25 days → 2 weeks
      [40, undefined, 2],  // 40 * 0.25 = 10 days → 2 weeks
      [100, undefined, 5], // 100 * 0.25 = 25 days → 5 weeks
      [10, 50, 1],         // storage: 50/500=0.1 days, VM floor: 2.5 days → VM floor wins → 1 week
    ])('vmCount=%i, storageGiB=%s → %i weeks', (vmCount, storageGiB, expected) => {
      expect(calculateWaveDurationWeeks(vmCount, storageGiB ?? undefined)).toBe(expected);
    });
  });

  describe('storage-dominated cases', () => {
    it.each([
      [10, 5000, 2],    // storage: 5000/500=10 days, VM floor: 2.5 days → storage wins → 2 weeks
      [5, 10000, 4],    // storage: 10000/500=20 days, VM floor: 1.25 days → storage wins → 4 weeks
      [2, 3000, 2],     // storage: 3000/500=6 days, VM floor: 0.5 days → storage wins → 2 weeks
      [1, 2500, 1],     // storage: 2500/500=5 days, VM floor: 0.25 days → storage wins → 1 week
      [1, 2501, 2],     // storage: 2501/500=5.002 days → 2 weeks
      [50, 50000, 20],  // storage: 50000/500=100 days → 20 weeks
    ])('vmCount=%i, storageGiB=%i → %i weeks', (vmCount, storageGiB, expected) => {
      expect(calculateWaveDurationWeeks(vmCount, storageGiB)).toBe(expected);
    });
  });

  describe('edge cases', () => {
    it('0 VMs returns minimum 1 week', () => {
      expect(calculateWaveDurationWeeks(0)).toBe(1);
      expect(calculateWaveDurationWeeks(0, 5000)).toBe(1);
    });

    it('0 storage falls back to VM floor', () => {
      expect(calculateWaveDurationWeeks(10, 0)).toBe(1);
    });

    it('both drivers produce same result', () => {
      // 10 VMs * 0.25 = 2.5 days, 1250 GiB / 500 = 2.5 days → tied → 1 week
      expect(calculateWaveDurationWeeks(10, 1250)).toBe(1);
    });
  });
});

describe('buildDefaultTimeline with waveVmCounts', () => {
  it('falls back to PHASE_DEFAULTS when no waveVmCounts provided', () => {
    const phases = buildDefaultTimeline(2);
    const pilot = phases.find(p => p.type === 'pilot')!;
    const prods = phases.filter(p => p.type === 'production');

    expect(pilot.durationWeeks).toBe(PHASE_DEFAULTS.pilot);
    expect(pilot.defaultDurationWeeks).toBe(PHASE_DEFAULTS.pilot);
    prods.forEach(p => {
      expect(p.durationWeeks).toBe(PHASE_DEFAULTS.production);
      expect(p.defaultDurationWeeks).toBe(PHASE_DEFAULTS.production);
    });
  });

  it('scales pilot and production wave durations from waveVmCounts and storage', () => {
    // waveVmCounts: [pilot=5, wave1=20, wave2=10]
    // waveStorageGiB: [100, 8000, 200]
    // pilot: max(100/500=0.2, 5*0.25=1.25) = 1.25 → ceil(1.25/5) = 1
    // wave1: max(8000/500=16, 20*0.25=5) = 16 → ceil(16/5) = 4
    // wave2: max(200/500=0.4, 10*0.25=2.5) = 2.5 → ceil(2.5/5) = 1
    const phases = buildDefaultTimeline(2, undefined, [5, 20, 10], undefined, [100, 8000, 200]);
    const pilot = phases.find(p => p.type === 'pilot')!;
    const prods = phases.filter(p => p.type === 'production');

    expect(pilot.durationWeeks).toBe(1);
    expect(pilot.defaultDurationWeeks).toBe(1);
    expect(prods[0].durationWeeks).toBe(4);     // storage-dominated
    expect(prods[0].defaultDurationWeeks).toBe(4);
    expect(prods[1].durationWeeks).toBe(1);     // VM-floor-dominated
    expect(prods[1].defaultDurationWeeks).toBe(1);
  });

  it('scales durations from VM counts alone when no storage provided', () => {
    // waveVmCounts: [pilot=5, wave1=20, wave2=40]
    // No storage → VM floor only
    // pilot: 5*0.25=1.25 → ceil(1.25/5) = 1
    // wave1: 20*0.25=5 → ceil(5/5) = 1
    // wave2: 40*0.25=10 → ceil(10/5) = 2
    const phases = buildDefaultTimeline(2, undefined, [5, 20, 40]);
    const pilot = phases.find(p => p.type === 'pilot')!;
    const prods = phases.filter(p => p.type === 'production');

    expect(pilot.durationWeeks).toBe(1);
    expect(prods[0].durationWeeks).toBe(1);
    expect(prods[1].durationWeeks).toBe(2);
  });

  it('user overrides take precedence over scaled defaults', () => {
    const overrides: Record<string, number> = {
      'phase-2': 5,  // pilot
      'phase-3': 8,  // wave 1
    };
    const phases = buildDefaultTimeline(2, overrides, [5, 20, 40], undefined, [100, 8000, 200]);
    const pilot = phases.find(p => p.type === 'pilot')!;
    const prods = phases.filter(p => p.type === 'production');

    expect(pilot.durationWeeks).toBe(5);
    expect(prods[0].durationWeeks).toBe(8);
    // defaultDurationWeeks still reflects the scaled value
    expect(pilot.defaultDurationWeeks).toBe(1);
    expect(prods[0].defaultDurationWeeks).toBe(4); // storage-dominated: 8000/500=16, ceil(16/5)=4
    // Non-overridden wave uses scaled default
    expect(prods[1].durationWeeks).toBe(2); // 40*0.25=10, ceil(10/5)=2
  });

  it('handles fewer waveVmCounts than production waves', () => {
    // Only pilot VM count provided, no production counts
    const phases = buildDefaultTimeline(2, undefined, [10]);
    const prods = phases.filter(p => p.type === 'production');

    prods.forEach(p => {
      expect(p.durationWeeks).toBe(PHASE_DEFAULTS.production);
    });
  });

  it('preparation, validation, and buffer phases are unaffected by waveVmCounts', () => {
    const phases = buildDefaultTimeline(1, undefined, [50, 100], undefined, [5000, 10000]);
    const prep = phases.find(p => p.type === 'preparation')!;
    const val = phases.find(p => p.type === 'validation')!;
    const buf = phases.find(p => p.type === 'buffer')!;

    expect(prep.durationWeeks).toBe(PHASE_DEFAULTS.preparation);
    expect(val.durationWeeks).toBe(PHASE_DEFAULTS.validation);
    expect(buf.durationWeeks).toBe(PHASE_DEFAULTS.buffer);
  });
});

describe('buildDefaultTimeline with waveNames', () => {
  it('assigns waveSourceName to pilot and production phases', () => {
    const names = ['Pilot: VLAN-100', 'Wave 2: DMZ-Network', 'Wave 3: Prod-VLAN'];
    const phases = buildDefaultTimeline(2, undefined, undefined, names);
    const pilot = phases.find(p => p.type === 'pilot')!;
    const prods = phases.filter(p => p.type === 'production');

    expect(pilot.waveSourceName).toBe('Pilot: VLAN-100');
    expect(prods[0].waveSourceName).toBe('Wave 2: DMZ-Network');
    expect(prods[1].waveSourceName).toBe('Wave 3: Prod-VLAN');
  });

  it('non-wave phases have no waveSourceName', () => {
    const names = ['Pilot', 'Prod1'];
    const phases = buildDefaultTimeline(1, undefined, undefined, names);
    const prep = phases.find(p => p.type === 'preparation')!;
    const val = phases.find(p => p.type === 'validation')!;
    const buf = phases.find(p => p.type === 'buffer')!;

    expect(prep.waveSourceName).toBeUndefined();
    expect(val.waveSourceName).toBeUndefined();
    expect(buf.waveSourceName).toBeUndefined();
  });

  it('waveSourceName is undefined when waveNames not provided', () => {
    const phases = buildDefaultTimeline(2);
    phases.forEach(p => {
      expect(p.waveSourceName).toBeUndefined();
    });
  });
});

describe('buildDefaultTimeline with waveVmCount', () => {
  it('assigns waveVmCount to pilot and production phases from waveVmCounts', () => {
    const phases = buildDefaultTimeline(2, undefined, [5, 20, 35]);
    const pilot = phases.find(p => p.type === 'pilot')!;
    const prods = phases.filter(p => p.type === 'production');

    expect(pilot.waveVmCount).toBe(5);
    expect(prods[0].waveVmCount).toBe(20);
    expect(prods[1].waveVmCount).toBe(35);
  });

  it('non-wave phases have no waveVmCount', () => {
    const phases = buildDefaultTimeline(1, undefined, [10, 50]);
    const prep = phases.find(p => p.type === 'preparation')!;
    const val = phases.find(p => p.type === 'validation')!;
    const buf = phases.find(p => p.type === 'buffer')!;

    expect(prep.waveVmCount).toBeUndefined();
    expect(val.waveVmCount).toBeUndefined();
    expect(buf.waveVmCount).toBeUndefined();
  });

  it('waveVmCount is undefined when waveVmCounts not provided', () => {
    const phases = buildDefaultTimeline(2);
    phases.forEach(p => {
      expect(p.waveVmCount).toBeUndefined();
    });
  });
});

describe('buildDefaultTimeline with waveStorageGiB', () => {
  it('assigns waveStorageGiB to pilot and production phases', () => {
    const phases = buildDefaultTimeline(2, undefined, undefined, undefined, [500, 2048, 4096]);
    const pilot = phases.find(p => p.type === 'pilot')!;
    const prods = phases.filter(p => p.type === 'production');

    expect(pilot.waveStorageGiB).toBe(500);
    expect(prods[0].waveStorageGiB).toBe(2048);
    expect(prods[1].waveStorageGiB).toBe(4096);
  });

  it('non-wave phases have no waveStorageGiB', () => {
    const phases = buildDefaultTimeline(1, undefined, undefined, undefined, [100, 200]);
    const prep = phases.find(p => p.type === 'preparation')!;
    const val = phases.find(p => p.type === 'validation')!;
    const buf = phases.find(p => p.type === 'buffer')!;

    expect(prep.waveStorageGiB).toBeUndefined();
    expect(val.waveStorageGiB).toBeUndefined();
    expect(buf.waveStorageGiB).toBeUndefined();
  });

  it('waveStorageGiB is undefined when not provided', () => {
    const phases = buildDefaultTimeline(2);
    phases.forEach(p => {
      expect(p.waveStorageGiB).toBeUndefined();
    });
  });
});

describe('buildDefaultTimeline waveCount excludes pilot', () => {
  it('waveCount=2 (from 3 activeWaves minus pilot) creates pilot + 2 production waves', () => {
    const waveVmCounts = [5, 10, 20];
    const phases = buildDefaultTimeline(2, undefined, waveVmCounts);
    const pilot = phases.find(p => p.type === 'pilot')!;
    const prods = phases.filter(p => p.type === 'production');

    expect(prods).toHaveLength(2);
    expect(pilot.waveVmCount).toBe(5);
    expect(prods[0].waveVmCount).toBe(10);
    expect(prods[1].waveVmCount).toBe(20);
    expect(prods.every(p => p.waveVmCount !== undefined)).toBe(true);
  });

  it('waveCount=0 (single pilot wave) creates pilot + 1 minimum production wave', () => {
    const waveVmCounts = [5];
    const phases = buildDefaultTimeline(0, undefined, waveVmCounts);
    const pilot = phases.find(p => p.type === 'pilot')!;
    const prods = phases.filter(p => p.type === 'production');

    expect(pilot.waveVmCount).toBe(5);
    expect(prods).toHaveLength(1);
  });
});

describe('calculateTimelineTotals', () => {
  it('calculates totals correctly', () => {
    const phases = buildDefaultTimeline(3);
    const totals = calculateTimelineTotals(phases);
    expect(totals.totalWeeks).toBe(12); // 2+2+2+2+2+1+1
    expect(totals.waveCount).toBe(3);
    expect(totals.phaseCount).toBe(7);
  });

  it('calculates end date when start date provided', () => {
    const phases = buildDefaultTimeline(1);
    const startDate = new Date('2024-01-01');
    const totals = calculateTimelineTotals(phases, startDate);
    expect(totals.estimatedEndDate).toBeDefined();
    expect(totals.estimatedEndDate!.getTime()).toBeGreaterThan(startDate.getTime());
  });
});

describe('formatTimelineForExport', () => {
  it('formats phases for export', () => {
    const phases = buildDefaultTimeline(2);
    const exported = formatTimelineForExport(phases);
    expect(exported).toHaveLength(phases.length);
    expect(exported[0].name).toBe('Preparation');
    expect(exported[0].type).toBe('preparation');
  });

  it('includes dates when start date provided', () => {
    const phases = buildDefaultTimeline(1);
    const exported = formatTimelineForExport(phases, new Date('2024-06-01'));
    expect(exported[0].startDate).toBeDefined();
    expect(exported[0].endDate).toBeDefined();
  });
});
