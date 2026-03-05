import { describe, it, expect } from 'vitest';
import { buildDefaultTimeline, calculateTimelineTotals, formatTimelineForExport } from './timelineEstimation';

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
