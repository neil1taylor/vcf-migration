// Doughnut chart component
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  DoughnutController,
  ArcElement,
} from 'chart.js';
import { ChartWrapper } from './ChartWrapper';
import { defaultDoughnutOptions, getPieColors, getChartColors } from '@/utils/chartConfig';
import type { ChartOptions } from 'chart.js';

// Register doughnut controller
ChartJS.register(DoughnutController, ArcElement);

interface DataPoint {
  label: string;
  value: number;
}

interface DoughnutChartProps {
  title?: string;
  subtitle?: string;
  data: DataPoint[];
  height?: number;
  colors?: string[];
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  centerLabel?: string;
  centerValue?: string | number;
  formatValue?: (value: number) => string;
  onSegmentClick?: (label: string, value: number) => void;
}

export function DoughnutChart({
  title,
  subtitle,
  data,
  height = 300,
  colors,
  showLegend = true,
  legendPosition = 'right',
  formatValue,
  onSegmentClick,
}: DoughnutChartProps) {
  const labels = data.map((d) => d.label);
  const values = data.map((d) => d.value);
  const pieColors = colors || getPieColors(data.length);

  const chartData = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: pieColors,
        borderWidth: 0,
      },
    ],
  };

  const chartColors = getChartColors();

  const options: ChartOptions<'doughnut'> = {
    ...defaultDoughnutOptions,
    onClick: onSegmentClick
      ? (_event, activeElements) => {
          if (activeElements.length > 0) {
            const index = activeElements[0].index;
            onSegmentClick(data[index].label, data[index].value);
          }
        }
      : undefined,
    plugins: {
      ...defaultDoughnutOptions.plugins,
      legend: {
        display: showLegend,
        position: legendPosition,
        labels: {
          color: chartColors.text,
          padding: 12,
          usePointStyle: true,
          pointStyle: 'rect',
        },
      },
      tooltip: {
        ...defaultDoughnutOptions.plugins?.tooltip,
        backgroundColor: chartColors.tooltipBg,
        callbacks: formatValue
          ? {
              label: (context) => {
                const value = context.raw as number;
                const label = context.label || '';
                return `${label}: ${formatValue(value)}`;
              },
            }
          : undefined,
      },
    },
  };

  return (
    <ChartWrapper title={title} subtitle={subtitle} height={height}>
      <Doughnut data={chartData} options={options} />
    </ChartWrapper>
  );
}
