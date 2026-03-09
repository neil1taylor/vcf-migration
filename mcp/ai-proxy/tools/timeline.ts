// estimate_timeline — Migration phase durations and dates

import { buildDefaultTimeline, calculateTimelineTotals } from '@/services/migration/timelineEstimation';

export function estimateTimeline(
  waveCount?: number,
  startDate?: string,
): { content: Array<{ type: 'text'; text: string }> } {
  const waves = waveCount ?? 3;
  const phases = buildDefaultTimeline(waves);
  const totals = calculateTimelineTotals(phases);

  // Calculate estimated dates
  const start = startDate ? new Date(startDate) : new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const end = new Date(start.getTime() + totals.totalWeeks * msPerWeek);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        waveCount: waves,
        startDate: start.toISOString().slice(0, 10),
        estimatedEndDate: end.toISOString().slice(0, 10),
        totalWeeks: totals.totalWeeks,
        phases: phases.map(p => ({
          name: p.name,
          type: p.type,
          durationWeeks: p.durationWeeks,
          startWeek: p.startWeek,
          endWeek: p.endWeek,
        })),
      }, null, 2),
    }],
  };
}
