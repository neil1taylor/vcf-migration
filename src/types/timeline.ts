// Migration Timeline Types

export type TimelinePhaseType = 'preparation' | 'pilot' | 'production' | 'validation' | 'buffer';

export interface TimelinePhase {
  id: string;
  name: string;
  type: TimelinePhaseType;
  durationWeeks: number;
  defaultDurationWeeks: number;
  waveIndex?: number;
  waveSourceName?: string;
  waveVmCount?: number;
  startWeek: number;  // cumulative
  endWeek: number;
  color: string;
}

export interface TimelineConfig {
  version: number;
  environmentFingerprint: string;
  phaseDurations: Record<string, number>;
  startDate?: string;  // ISO date string
  createdAt: string;
  modifiedAt: string;
}

export interface TimelineTotals {
  totalWeeks: number;
  phaseCount: number;
  waveCount: number;
  estimatedEndDate?: Date;
}

export const PHASE_COLORS: Record<TimelinePhaseType, string> = {
  preparation: '#0f62fe',
  pilot: '#8a3ffc',
  production: '#009d9a',
  validation: '#ee5396',
  buffer: '#878d96',
};

export const PHASE_DEFAULTS: Record<TimelinePhaseType, number> = {
  preparation: 2,
  pilot: 2,
  production: 2,
  validation: 1,
  buffer: 1,
};
