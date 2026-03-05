// Environment Snapshot Tile — summary metrics for Pre-Assessment tab
import { Grid, Column, Tile } from '@carbon/react';
import { MetricCard } from '@/components/common';
import type { RVToolsData } from '@/types/rvtools';
import { mibToGiB } from '@/utils/formatters';

interface EnvironmentSnapshotTileProps {
  rawData: RVToolsData;
}

export function EnvironmentSnapshotTile({ rawData }: EnvironmentSnapshotTileProps) {
  const activeVMs = rawData.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template);
  const totalVCPUs = activeVMs.reduce((sum, vm) => sum + (vm.cpus || 0), 0);
  const totalRAMGiB = Math.round(activeVMs.reduce((sum, vm) => sum + mibToGiB(vm.memory || 0), 0));
  const totalStorageGiB = Math.round(activeVMs.reduce((sum, vm) => sum + mibToGiB(vm.provisionedMiB || 0), 0));
  const clusterCount = rawData.vCluster?.length ?? 0;
  const hostCount = rawData.vHost?.length ?? 0;

  return (
    <Tile>
      <h4 style={{ marginBottom: '1rem' }}>Environment Snapshot</h4>
      <Grid condensed>
        <Column sm={4} md={2} lg={3}>
          <MetricCard label="Active VMs" value={activeVMs.length} variant="primary" />
        </Column>
        <Column sm={4} md={2} lg={3}>
          <MetricCard label="Total vCPUs" value={totalVCPUs.toLocaleString()} variant="info" />
        </Column>
        <Column sm={4} md={2} lg={3}>
          <MetricCard label="Total RAM" value={`${totalRAMGiB.toLocaleString()} GiB`} variant="teal" />
        </Column>
        <Column sm={4} md={2} lg={3}>
          <MetricCard label="Total Storage" value={`${totalStorageGiB.toLocaleString()} GiB`} variant="purple" />
        </Column>
        <Column sm={4} md={2} lg={3}>
          <MetricCard label="Clusters" value={clusterCount} />
        </Column>
        <Column sm={4} md={2} lg={3}>
          <MetricCard label="Hosts" value={hostCount} />
        </Column>
      </Grid>
    </Tile>
  );
}
