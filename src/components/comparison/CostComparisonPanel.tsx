import { Grid, Column, Tile } from '@carbon/react';
import { useData } from '@/hooks';
import { VerticalBarChart } from '@/components/charts';
import { formatCurrency } from '@/services/costEstimation';

interface CostComparisonPanelProps {
  roksVMCount: number;
  vsiVMCount: number;
  totalVMCount: number;
}

export function CostComparisonPanel({ roksVMCount, vsiVMCount, totalVMCount }: CostComparisonPanelProps) {
  const { calculatedCosts } = useData();

  const roksCost = calculatedCosts?.roksMonthlyCost;
  const vsiCost = calculatedCosts?.vsiMonthlyCost;
  const hasCosts = roksCost != null || vsiCost != null;

  // Estimate split cost as weighted average
  const splitCost = roksCost != null && vsiCost != null && totalVMCount > 0
    ? (roksCost * roksVMCount / totalVMCount) + (vsiCost * vsiVMCount / totalVMCount)
    : null;

  const chartData = [
    ...(roksCost != null ? [{ label: 'All ROKS', value: roksCost }] : []),
    ...(vsiCost != null ? [{ label: 'All VSI', value: vsiCost }] : []),
    ...(splitCost != null ? [{ label: 'Split', value: splitCost }] : []),
  ];

  if (!hasCosts) {
    return (
      <Tile>
        <h4 style={{ marginBottom: '0.5rem' }}>Cost Comparison</h4>
        <p>Configure costs on the ROKS Migration and VSI Migration pages first to see cost comparisons here.</p>
      </Tile>
    );
  }

  return (
    <Grid>
      <Column lg={5} md={4} sm={4}>
        <Tile style={{ borderLeft: '4px solid #009d9a', height: '100%' }}>
          <h5>All ROKS</h5>
          <p style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {roksCost != null ? `${formatCurrency(roksCost)}/mo` : 'Not configured'}
          </p>
          <p style={{ fontSize: '0.875rem', color: '#525252' }}>
            All {totalVMCount} VMs on OpenShift Virtualization
          </p>
        </Tile>
      </Column>
      <Column lg={5} md={4} sm={4}>
        <Tile style={{ borderLeft: '4px solid #0f62fe', height: '100%' }}>
          <h5>All VSI</h5>
          <p style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {vsiCost != null ? `${formatCurrency(vsiCost)}/mo` : 'Not configured'}
          </p>
          <p style={{ fontSize: '0.875rem', color: '#525252' }}>
            All {totalVMCount} VMs on Virtual Servers
          </p>
        </Tile>
      </Column>
      <Column lg={6} md={4} sm={4}>
        <Tile style={{ borderLeft: '4px solid #8a3ffc', height: '100%' }}>
          <h5>Split Migration</h5>
          <p style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {splitCost != null ? `${formatCurrency(splitCost)}/mo` : 'Requires both'}
          </p>
          <p style={{ fontSize: '0.875rem', color: '#525252' }}>
            {roksVMCount} ROKS + {vsiVMCount} VSI
          </p>
        </Tile>
      </Column>
      {chartData.length > 0 && (
        <Column lg={16} md={8} sm={4} style={{ marginTop: '1rem' }}>
          <VerticalBarChart
            title="Monthly Cost Comparison"
            data={chartData}
            valueLabel="Monthly Cost ($)"
            colors={['#009d9a', '#0f62fe', '#8a3ffc']}
            formatValue={(v) => formatCurrency(v)}
            height={250}
          />
        </Column>
      )}
    </Grid>
  );
}
