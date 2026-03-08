// Migration Timeline Estimation Service

import type { TimelinePhase, TimelinePhaseType, TimelineTotals } from '@/types/timeline';
import { PHASE_COLORS, PHASE_DEFAULTS } from '@/types/timeline';

export const MIGRATION_THROUGHPUT_GB_PER_DAY = 500;
export const MIN_DAYS_PER_VM = 0.25;
export const WORKING_DAYS_PER_WEEK = 5;

let idCounter = 0;
function nextId(): string {
  return `phase-${++idCounter}`;
}

export function calculateWaveDurationWeeks(vmCount: number, storageGiB?: number): number {
  if (vmCount <= 0) return 1;

  const storageGB = storageGiB ?? 0;
  const dataDays = storageGB / MIGRATION_THROUGHPUT_GB_PER_DAY;
  const vmFloorDays = vmCount * MIN_DAYS_PER_VM;
  const days = Math.max(dataDays, vmFloorDays);

  return Math.max(1, Math.ceil(days / WORKING_DAYS_PER_WEEK));
}

export function buildDefaultTimeline(
  waveCount: number,
  phaseDurations?: Record<string, number>,
  waveVmCounts?: number[],
  waveNames?: string[],
  waveStorageGiB?: number[]
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
  const pilotDefault = waveVmCounts?.[0] != null
    ? calculateWaveDurationWeeks(waveVmCounts[0], waveStorageGiB?.[0])
    : PHASE_DEFAULTS.pilot;
  phases.push({
    id: pilotId,
    name: 'Pilot Wave',
    type: 'pilot',
    durationWeeks: phaseDurations?.[pilotId] ?? pilotDefault,
    defaultDurationWeeks: pilotDefault,
    waveSourceName: waveNames?.[0],
    waveVmCount: waveVmCounts?.[0],
    waveStorageGiB: waveStorageGiB?.[0],
    startWeek: 0,
    endWeek: 0,
    color: PHASE_COLORS.pilot,
  });

  // Production waves
  const effectiveWaveCount = Math.max(1, waveCount);
  for (let i = 0; i < effectiveWaveCount; i++) {
    const waveId = nextId();
    // waveVmCounts index offset by 1: index 0 is pilot, production waves start at index 1
    const prodDefault = waveVmCounts?.[i + 1] != null
      ? calculateWaveDurationWeeks(waveVmCounts[i + 1], waveStorageGiB?.[i + 1])
      : PHASE_DEFAULTS.production;
    phases.push({
      id: waveId,
      name: `Wave ${i + 1}`,
      type: 'production',
      durationWeeks: phaseDurations?.[waveId] ?? prodDefault,
      defaultDurationWeeks: prodDefault,
      waveIndex: i,
      waveSourceName: waveNames?.[i + 1],
      waveVmCount: waveVmCounts?.[i + 1],
      waveStorageGiB: waveStorageGiB?.[i + 1],
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
