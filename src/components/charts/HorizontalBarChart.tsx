// Horizontal bar chart component
import { Bar } from 'react-chartjs-2';
import { ChartWrapper } from './ChartWrapper';
import { defaultBarOptions, getBarColors, getChartColors } from '@/utils/chartConfig';
import type { ChartOptions } from 'chart.js';

interface DataPoint {
  label: string;
  value: number;
}

interface HorizontalBarChartProps {
  title?: string;
  subtitle?: string;
  data: DataPoint[];
  height?: number;
  valueLabel?: string;
  showLegend?: boolean;
  colors?: string[];
  formatValue?: (value: number) => string;
  onBarClick?: (label: string, value: number) => void;
}

export function HorizontalBarChart({
  title,
  subtitle,
  data,
  height = 300,
  valueLabel = 'Value',
  showLegend = false,
  colors,
  formatValue,
  onBarClick,
}: HorizontalBarChartProps) {
  const labels = data.map((d) => d.label);
  const values = data.map((d) => d.value);
  const barColors = colors || getBarColors(data.length);

  const chartData = {
    labels,
    datasets: [
      {
        label: valueLabel,
        data: values,
        backgroundColor: barColors,
        borderWidth: 0,
        borderRadius: 2,
      },
    ],
  };

  const chartColors = getChartColors();

  const options: ChartOptions<'bar'> = {
    ...defaultBarOptions,
    onClick: onBarClick
      ? (_event, activeElements) => {
          if (activeElements.length > 0) {
            const index = activeElements[0].index;
            onBarClick(data[index].label, data[index].value);
          }
        }
      : undefined,
    plugins: {
      ...defaultBarOptions.plugins,
      legend: {
        display: showLegend,
      },
      tooltip: {
        ...defaultBarOptions.plugins?.tooltip,
        backgroundColor: chartColors.tooltipBg,
        callbacks: formatValue
          ? {
              label: (context) => {
                const value = context.raw as number;
                return `${valueLabel}: ${formatValue(value)}`;
              },
            }
          : undefined,
      },
    },
    scales: {
      x: {
        grid: {
          color: chartColors.grid,
        },
        ticks: {
          color: chartColors.text,
        },
      },
      y: {
        grid: {
          display: false,
        },
        ticks: {
          color: chartColors.text,
        },
      },
    },
  };

  return (
    <ChartWrapper title={title} subtitle={subtitle} height={height}>
      <Bar data={chartData} options={options} />
    </ChartWrapper>
  );
}
