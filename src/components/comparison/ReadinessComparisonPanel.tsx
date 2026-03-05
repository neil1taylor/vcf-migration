import { Grid, Column, Tile } from '@carbon/react';
import { DoughnutChart } from '@/components/charts';
import type { ComparisonMetrics } from '@/hooks/useComparisonData';

interface ReadinessComparisonPanelProps {
  comparison: ComparisonMetrics;
}

export function ReadinessComparisonPanel({ comparison }: ReadinessComparisonPanelProps) {
  const { roks, vsi } = comparison;

  const complexityData = (dist: Record<string, number>) => [
    { label: 'Simple', value: dist['Simple'] || 0 },
    { label: 'Moderate', value: dist['Moderate'] || 0 },
    { label: 'Complex', value: dist['Complex'] || 0 },
    { label: 'Blocker', value: dist['Blocker'] || 0 },
  ].filter(d => d.value > 0);

  const osData = (counts: Record<string, number>) => [
    { label: 'Supported', value: counts['supported'] || 0 },
    { label: 'Partial', value: counts['partial'] || 0 },
    { label: 'Unsupported', value: counts['unsupported'] || 0 },
  ].filter(d => d.value > 0);

  const getScoreVariant = (score: number) =>
    score >= 80 ? '#24a148' : score >= 60 ? '#f1c21b' : '#da1e28';

  const renderSide = (label: string, metrics: typeof roks, color: string) => (
    <Column lg={8} md={4} sm={4}>
      <Tile style={{ borderTop: `4px solid ${color}`, height: '100%' }}>
        <h4 style={{ marginBottom: '1rem' }}>{label}</h4>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#525252' }}>Readiness Score</span>
            <p style={{ fontSize: '2rem', fontWeight: 600, color: getScoreVariant(metrics.readinessScore) }}>
              {metrics.readinessScore}%
            </p>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#525252' }}>VMs</span>
            <p style={{ fontSize: '2rem', fontWeight: 600 }}>{metrics.vmCount}</p>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#525252' }}>Blockers</span>
            <p style={{ fontSize: '2rem', fontWeight: 600, color: metrics.blockerCount > 0 ? '#da1e28' : '#24a148' }}>
              {metrics.blockerCount}
            </p>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#525252' }}>Waves</span>
            <p style={{ fontSize: '2rem', fontWeight: 600 }}>{metrics.estimatedWaveCount}</p>
          </div>
        </div>
        {metrics.vmCount > 0 && (
          <Grid narrow>
            <Column lg={8} md={4} sm={4}>
              <DoughnutChart
                title="Complexity Distribution"
                data={complexityData(metrics.complexityDistribution)}
                height={200}
                colors={['#24a148', '#0f62fe', '#f1c21b', '#da1e28']}
              />
            </Column>
            <Column lg={8} md={4} sm={4}>
              <DoughnutChart
                title="OS Compatibility"
                data={osData(metrics.osStatusCounts)}
                height={200}
                colors={['#24a148', '#f1c21b', '#da1e28']}
              />
            </Column>
          </Grid>
        )}
      </Tile>
    </Column>
  );

  return (
    <Grid>
      {renderSide('ROKS (OpenShift)', roks, '#009d9a')}
      {renderSide('VSI (Virtual Servers)', vsi, '#0f62fe')}
    </Grid>
  );
}
