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
  it.each([
    [0, 1],
    [1, 1],
    [5, 1],
    [10, 1],
    [11, 2],
    [20, 2],
    [35, 4],
    [100, 10],
  ])('vmCount=%i → %i weeks', (vmCount, expected) => {
    expect(calculateWaveDurationWeeks(vmCount)).toBe(expected);
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

  it('scales pilot and production wave durations from waveVmCounts', () => {
    // waveVmCounts: [pilot=5, wave1=20, wave2=35]
    const phases = buildDefaultTimeline(2, undefined, [5, 20, 35]);
    const pilot = phases.find(p => p.type === 'pilot')!;
    const prods = phases.filter(p => p.type === 'production');

    expect(pilot.durationWeeks).toBe(1);       // ceil(5/10) = 1
    expect(pilot.defaultDurationWeeks).toBe(1);
    expect(prods[0].durationWeeks).toBe(2);     // ceil(20/10) = 2
    expect(prods[0].defaultDurationWeeks).toBe(2);
    expect(prods[1].durationWeeks).toBe(4);     // ceil(35/10) = 4
    expect(prods[1].defaultDurationWeeks).toBe(4);
  });

  it('user overrides take precedence over scaled defaults', () => {
    const overrides: Record<string, number> = {
      'phase-2': 5,  // pilot
      'phase-3': 8,  // wave 1
    };
    const phases = buildDefaultTimeline(2, overrides, [5, 20, 35]);
    const pilot = phases.find(p => p.type === 'pilot')!;
    const prods = phases.filter(p => p.type === 'production');

    expect(pilot.durationWeeks).toBe(5);
    expect(prods[0].durationWeeks).toBe(8);
    // defaultDurationWeeks still reflects the scaled value
    expect(pilot.defaultDurationWeeks).toBe(1);
    expect(prods[0].defaultDurationWeeks).toBe(2);
    // Non-overridden wave uses scaled default
    expect(prods[1].durationWeeks).toBe(4);
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
    const phases = buildDefaultTimeline(1, undefined, [50, 100]);
    const prep = phases.find(p => p.type === 'preparation')!;
    const val = phases.find(p => p.type === 'validation')!;
    const buf = phases.find(p => p.type === 'buffer')!;

    expect(prep.durationWeeks).toBe(PHASE_DEFAULTS.preparation);
    expect(val.durationWeeks).toBe(PHASE_DEFAULTS.validation);
    expect(buf.durationWeeks).toBe(PHASE_DEFAULTS.buffer);
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
