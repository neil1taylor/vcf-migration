// Gantt Timeline Chart — horizontal stacked bar for migration phases
import { Bar } from 'react-chartjs-2';
import { ChartWrapper } from './ChartWrapper';
import { getBarColors } from '@/utils/chartConfig';
import type { ChartOptions } from 'chart.js';
import type { TimelinePhase } from '@/types/timeline';

interface GanttTimelineProps {
  title?: string;
  subtitle?: string;
  phases: TimelinePhase[];
  height?: number;
}

export function GanttTimeline({
  title = 'Migration Timeline',
  subtitle,
  phases,
  height = 400,
}: GanttTimelineProps) {
  const fallbackColors = getBarColors(phases.length);

  // Build stacked bar data: each phase is a separate dataset
  // All datasets share a single row (y-axis label "Timeline")
  const datasets = phases.map((phase, index) => ({
    label: phase.name,
    data: [phase.durationWeeks],
    backgroundColor: phase.color || fallbackColors[index],
    borderWidth: 0,
    borderRadius: 2,
    barPercentage: 0.6,
  }));

  const chartData = {
    labels: ['Migration Timeline'],
    datasets,
  };

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 16,
          font: { family: "'IBM Plex Sans', sans-serif", size: 12 },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const phase = phases[ctx.datasetIndex];
            if (!phase) return '';
            return `${phase.name}: ${phase.durationWeeks}w (Week ${phase.startWeek}–${phase.endWeek})`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        title: {
          display: true,
          text: 'Weeks',
          font: { family: "'IBM Plex Sans', sans-serif" },
        },
        ticks: {
          stepSize: 1,
          font: { family: "'IBM Plex Sans', sans-serif" },
        },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
      y: {
        stacked: true,
        display: false,
      },
    },
  };

  return (
    <ChartWrapper title={title} subtitle={subtitle}>
      <div style={{ height }}>
        <Bar data={chartData} options={options} />
      </div>
    </ChartWrapper>
  );
}
