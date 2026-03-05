import { useMemo } from 'react';
import { Grid, Column, Tile } from '@carbon/react';
import { HorizontalBarChart } from '@/components/charts';
import type { VMClassification } from '@/services/migration/targetClassification';
import { getCategoryDisplayName } from '@/utils/workloadClassification';

interface ArchitectureFitPanelProps {
  assignments: VMClassification[];
  workloadTypes: Map<string, string>;
}

export function ArchitectureFitPanel({ assignments, workloadTypes }: ArchitectureFitPanelProps) {
  const { roksWorkloads, vsiWorkloads, chartData } = useMemo(() => {
    const roksMap = new Map<string, number>();
    const vsiMap = new Map<string, number>();

    for (const a of assignments) {
      const category = workloadTypes.get(a.vmId) || 'unclassified';
      const displayName = getCategoryDisplayName(category) || 'Unclassified';
      if (a.target === 'roks') {
        roksMap.set(displayName, (roksMap.get(displayName) || 0) + 1);
      } else {
        vsiMap.set(displayName, (vsiMap.get(displayName) || 0) + 1);
      }
    }

    // Get all unique workload types
    const allTypes = new Set([...roksMap.keys(), ...vsiMap.keys()]);

    // Find which types are "best for" each target
    const roksWorkloads: string[] = [];
    const vsiWorkloads: string[] = [];
    for (const type of allTypes) {
      const roksCount = roksMap.get(type) || 0;
      const vsiCount = vsiMap.get(type) || 0;
      if (roksCount > vsiCount) roksWorkloads.push(type);
      else if (vsiCount > roksCount) vsiWorkloads.push(type);
    }

    // Build chart data — sorted by total count
    const chartData = Array.from(allTypes)
      .map(type => ({
        label: type,
        value: (roksMap.get(type) || 0) + (vsiMap.get(type) || 0),
      }))
      .sort((a, b) => b.value - a.value);

    return { roksWorkloads, vsiWorkloads, chartData };
  }, [assignments, workloadTypes]);

  return (
    <Grid>
      <Column lg={5} md={4} sm={4}>
        <Tile style={{ borderLeft: '4px solid #009d9a', height: '100%' }}>
          <h5>Best for ROKS</h5>
          {roksWorkloads.length > 0 ? (
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem' }}>
              {roksWorkloads.map(w => <li key={w}>{w}</li>)}
            </ul>
          ) : (
            <p style={{ color: '#525252', marginTop: '0.5rem' }}>No workload types favor ROKS</p>
          )}
        </Tile>
      </Column>
      <Column lg={5} md={4} sm={4}>
        <Tile style={{ borderLeft: '4px solid #0f62fe', height: '100%' }}>
          <h5>Best for VSI</h5>
          {vsiWorkloads.length > 0 ? (
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem' }}>
              {vsiWorkloads.map(w => <li key={w}>{w}</li>)}
            </ul>
          ) : (
            <p style={{ color: '#525252', marginTop: '0.5rem' }}>No workload types favor VSI</p>
          )}
        </Tile>
      </Column>
      <Column lg={6} md={4} sm={4} />
      <Column lg={16} md={8} sm={4} style={{ marginTop: '1rem' }}>
        <HorizontalBarChart
          title="VM Count by Workload Type"
          data={chartData}
          valueLabel="VMs"
          height={Math.max(200, chartData.length * 35)}
        />
      </Column>
    </Grid>
  );
}
