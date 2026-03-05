// Migration Timeline Page
import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Grid,
  Column,
  Button,
  NumberInput,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Tag,
} from '@carbon/react';
import { Reset } from '@carbon/icons-react';
import { useData, useHasData } from '@/hooks';
import { useTimelineConfig } from '@/hooks/useTimelineConfig';
import { ROUTES } from '@/utils/constants';
import { MetricCard } from '@/components/common';
import { GanttTimeline } from '@/components/charts/GanttTimeline';
import { PHASE_COLORS } from '@/types/timeline';
import type { TimelinePhaseType } from '@/types/timeline';
import './MigrationTimelinePage.scss';

// Estimate wave count from network data or default
function estimateWaveCount(rawData: import('@/types/rvtools').RVToolsData | null): number {
  if (!rawData) return 3;
  // Use unique port groups as rough wave proxy
  const portGroups = new Set(rawData.vNetwork.map(n => n.networkName).filter(Boolean));
  return Math.max(1, Math.min(portGroups.size, 10));
}

const PHASE_TAG_TYPE: Record<TimelinePhaseType, 'blue' | 'purple' | 'teal' | 'magenta' | 'gray'> = {
  preparation: 'blue',
  pilot: 'purple',
  production: 'teal',
  validation: 'magenta',
  buffer: 'gray',
};

export function MigrationTimelinePage() {
  const hasData = useHasData();
  const { rawData } = useData();

  const waveCount = useMemo(() => estimateWaveCount(rawData), [rawData]);
  const { phases, totals, startDate, updatePhaseDuration, resetToDefaults } = useTimelineConfig(waveCount);

  if (!hasData || !rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  const endDateStr = totals.estimatedEndDate
    ? totals.estimatedEndDate.toLocaleDateString()
    : startDate
      ? new Date(startDate.getTime() + totals.totalWeeks * 7 * 86400000).toLocaleDateString()
      : `${totals.totalWeeks} weeks from start`;

  return (
    <Grid>
      <Column sm={4} md={8} lg={16}>
        <div className="timeline-page__header">
          <h1>Migration Timeline</h1>
          <Button kind="ghost" size="sm" renderIcon={Reset} onClick={() => resetToDefaults(waveCount)}>
            Reset to Defaults
          </Button>
        </div>
      </Column>

      {/* Metric Cards */}
      <Column sm={4} md={2} lg={4} style={{ marginBottom: '1rem' }}>
        <MetricCard label="Total Duration" value={`${totals.totalWeeks} weeks`} variant="primary" />
      </Column>
      <Column sm={4} md={2} lg={4} style={{ marginBottom: '1rem' }}>
        <MetricCard label="Migration Waves" value={totals.waveCount} variant="teal" />
      </Column>
      <Column sm={4} md={2} lg={4} style={{ marginBottom: '1rem' }}>
        <MetricCard label="Total Phases" value={totals.phaseCount} variant="info" />
      </Column>
      <Column sm={4} md={2} lg={4} style={{ marginBottom: '1rem' }}>
        <MetricCard label="Est. End Date" value={endDateStr} variant="purple" />
      </Column>

      {/* Gantt Chart */}
      <Column sm={4} md={8} lg={16} style={{ marginBottom: '1rem' }}>
        <GanttTimeline
          phases={phases}
          subtitle={`${totals.totalWeeks} weeks total across ${totals.phaseCount} phases`}
          height={120}
        />
      </Column>

      {/* Phase Configuration Table */}
      <Column sm={4} md={8} lg={16}>
        <h3 style={{ marginBottom: '0.5rem' }}>Phase Configuration</h3>
        <Table size="md">
          <TableHead>
            <TableRow>
              <TableHeader>Phase</TableHeader>
              <TableHeader>Type</TableHeader>
              <TableHeader>Duration (weeks)</TableHeader>
              <TableHeader>Start Week</TableHeader>
              <TableHeader>End Week</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {phases.map(phase => (
              <TableRow key={phase.id}>
                <TableCell>
                  <span
                    style={{
                      borderLeft: `4px solid ${phase.color || PHASE_COLORS[phase.type]}`,
                      paddingLeft: '0.5rem',
                    }}
                  >
                    {phase.name}
                  </span>
                </TableCell>
                <TableCell>
                  <Tag type={PHASE_TAG_TYPE[phase.type]} size="sm">
                    {phase.type}
                  </Tag>
                </TableCell>
                <TableCell>
                  <NumberInput
                    id={`duration-${phase.id}`}
                    label=""
                    hideLabel
                    min={1}
                    max={52}
                    value={phase.durationWeeks}
                    onChange={(_e: unknown, { value }: { value: string | number }) => {
                      const v = typeof value === 'string' ? parseInt(value, 10) : value;
                      if (!isNaN(v)) updatePhaseDuration(phase.id, v);
                    }}
                    size="sm"
                    style={{ maxWidth: '100px' }}
                  />
                </TableCell>
                <TableCell>{phase.startWeek}</TableCell>
                <TableCell>{phase.endWeek}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Column>
    </Grid>
  );
}
