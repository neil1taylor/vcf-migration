// Migration Timeline Estimation Service

import type { TimelinePhase, TimelinePhaseType, TimelineTotals } from '@/types/timeline';
import { PHASE_COLORS, PHASE_DEFAULTS } from '@/types/timeline';

let idCounter = 0;
function nextId(): string {
  return `phase-${++idCounter}`;
}

export function buildDefaultTimeline(
  waveCount: number,
  phaseDurations?: Record<string, number>
): TimelinePhase[] {
  idCounter = 0;
  const phases: TimelinePhase[] = [];

  // Preparation
  const prepId = nextId();
  phases.push({
    id: prepId,
    name: 'Preparation',
    type: 'preparation',
    durationWeeks: phaseDurations?.[prepId] ?? PHASE_DEFAULTS.preparation,
    defaultDurationWeeks: PHASE_DEFAULTS.preparation,
    startWeek: 0,
    endWeek: 0,
    color: PHASE_COLORS.preparation,
  });

  // Pilot wave
  const pilotId = nextId();
  phases.push({
    id: pilotId,
    name: 'Pilot Wave',
    type: 'pilot',
    durationWeeks: phaseDurations?.[pilotId] ?? PHASE_DEFAULTS.pilot,
    defaultDurationWeeks: PHASE_DEFAULTS.pilot,
    startWeek: 0,
    endWeek: 0,
    color: PHASE_COLORS.pilot,
  });

  // Production waves
  const effectiveWaveCount = Math.max(1, waveCount);
  for (let i = 0; i < effectiveWaveCount; i++) {
    const waveId = nextId();
    phases.push({
      id: waveId,
      name: `Wave ${i + 1}`,
      type: 'production',
      durationWeeks: phaseDurations?.[waveId] ?? PHASE_DEFAULTS.production,
      defaultDurationWeeks: PHASE_DEFAULTS.production,
      waveIndex: i,
      startWeek: 0,
      endWeek: 0,
      color: PHASE_COLORS.production,
    });
  }

  // Validation
  const valId = nextId();
  phases.push({
    id: valId,
    name: 'Validation',
    type: 'validation',
    durationWeeks: phaseDurations?.[valId] ?? PHASE_DEFAULTS.validation,
    defaultDurationWeeks: PHASE_DEFAULTS.validation,
    startWeek: 0,
    endWeek: 0,
    color: PHASE_COLORS.validation,
  });

  // Buffer
  const bufId = nextId();
  phases.push({
    id: bufId,
    name: 'Buffer',
    type: 'buffer',
    durationWeeks: phaseDurations?.[bufId] ?? PHASE_DEFAULTS.buffer,
    defaultDurationWeeks: PHASE_DEFAULTS.buffer,
    startWeek: 0,
    endWeek: 0,
    color: PHASE_COLORS.buffer,
  });

  return calculateCumulativeWeeks(phases);
}

export function calculateCumulativeWeeks(phases: TimelinePhase[]): TimelinePhase[] {
  let cumulative = 0;
  return phases.map(phase => {
    const startWeek = cumulative;
    cumulative += phase.durationWeeks;
    return { ...phase, startWeek, endWeek: cumulative };
  });
}

export function calculateTimelineTotals(phases: TimelinePhase[], startDate?: Date): TimelineTotals {
  const totalWeeks = phases.reduce((sum, p) => sum + p.durationWeeks, 0);
  const waveCount = phases.filter(p => p.type === 'production').length;

  let estimatedEndDate: Date | undefined;
  if (startDate) {
    estimatedEndDate = new Date(startDate);
    estimatedEndDate.setDate(estimatedEndDate.getDate() + totalWeeks * 7);
  }

  return {
    totalWeeks,
    phaseCount: phases.length,
    waveCount,
    estimatedEndDate,
  };
}

export function formatTimelineForExport(phases: TimelinePhase[], startDate?: Date): Array<{
  name: string;
  type: TimelinePhaseType;
  durationWeeks: number;
  startWeek: number;
  endWeek: number;
  startDate?: string;
  endDate?: string;
}> {
  return phases.map(phase => {
    let start: string | undefined;
    let end: string | undefined;

    if (startDate) {
      const s = new Date(startDate);
      s.setDate(s.getDate() + phase.startWeek * 7);
      start = s.toISOString().split('T')[0];

      const e = new Date(startDate);
      e.setDate(e.getDate() + phase.endWeek * 7);
      end = e.toISOString().split('T')[0];
    }

    return {
      name: phase.name,
      type: phase.type,
      durationWeeks: phase.durationWeeks,
      startWeek: phase.startWeek,
      endWeek: phase.endWeek,
      startDate: start,
      endDate: end,
    };
  });
}
