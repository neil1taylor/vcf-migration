// Wave VM Table component
// Shows VMs in migration waves with wave selection

import { useMemo } from 'react';
import { ClickableTile, Tag } from '@carbon/react';
import { EnhancedDataTable } from '@/components/tables';
import { formatNumber } from '@/utils/formatters';
import type { ColumnDef } from '@tanstack/react-table';
import type { WaveGroup, NetworkWaveGroup } from '@/services/migration';
import './WaveVMTable.scss';

interface WaveVMTableProps {
  waves: (WaveGroup | NetworkWaveGroup)[];
  selectedWave: string | null;
  onWaveSelect: (waveName: string | null) => void;
  mode: 'complexity' | 'network';
}

interface WaveVMRow {
  vmName: string;
  cluster: string;
  vcpus: number;
  memoryGiB: number;
  storageGiB: number;
  complexity: number;
  hasBlocker: boolean;
  osStatus: string;
  networkName: string;
}

export function WaveVMTable({
  waves,
  selectedWave,
  onWaveSelect,
  mode,
}: WaveVMTableProps) {
  // Get VMs for selected wave (or all waves if none selected)
  const selectedWaveData = useMemo(() => {
    if (!selectedWave) return null;
    return waves.find(w => w.name === selectedWave);
  }, [waves, selectedWave]);

  // Convert VMs to table rows - show all VMs when no wave selected
  const tableData: WaveVMRow[] = useMemo(() => {
    if (selectedWave && selectedWaveData) {
      return selectedWaveData.vms.map(vm => ({
        vmName: vm.vmName,
        cluster: vm.cluster,
        vcpus: vm.vcpus,
        memoryGiB: vm.memoryGiB,
        storageGiB: vm.storageGiB,
        complexity: vm.complexity,
        hasBlocker: vm.hasBlocker,
        osStatus: vm.osStatus,
        networkName: vm.networkName,
      }));
    }
    // Show all VMs from all waves when Overview is selected
    return waves.flatMap(wave =>
      wave.vms.map(vm => ({
        vmName: vm.vmName,
        cluster: vm.cluster,
        vcpus: vm.vcpus,
        memoryGiB: vm.memoryGiB,
        storageGiB: vm.storageGiB,
        complexity: vm.complexity,
        hasBlocker: vm.hasBlocker,
        osStatus: vm.osStatus,
        networkName: vm.networkName,
      }))
    );
  }, [selectedWave, selectedWaveData, waves]);

  // Define columns
  const columns: ColumnDef<WaveVMRow, unknown>[] = useMemo(() => [
    {
      accessorKey: 'vmName',
      header: 'VM Name',
      enableSorting: true,
    },
    {
      accessorKey: 'cluster',
      header: 'Cluster',
      enableSorting: true,
    },
    {
      accessorKey: 'vcpus',
      header: 'vCPUs',
      enableSorting: true,
      cell: ({ getValue }) => formatNumber(getValue() as number),
    },
    {
      accessorKey: 'memoryGiB',
      header: 'Memory (GiB)',
      enableSorting: true,
      cell: ({ getValue }) => formatNumber(getValue() as number),
    },
    {
      accessorKey: 'storageGiB',
      header: 'Storage (GiB)',
      enableSorting: true,
      cell: ({ getValue }) => formatNumber(getValue() as number),
    },
    {
      accessorKey: 'complexity',
      header: 'Complexity',
      enableSorting: true,
      cell: ({ getValue }) => {
        const score = getValue() as number;
        let type: 'green' | 'blue' | 'high-contrast' | 'red' = 'green';
        if (score > 55) type = 'red';
        else if (score > 30) type = 'high-contrast';
        else if (score > 15) type = 'blue';
        return <Tag type={type} size="sm">{score}</Tag>;
      },
    },
    {
      accessorKey: 'hasBlocker',
      header: 'Blocker',
      enableSorting: true,
      cell: ({ getValue }) => {
        const hasBlocker = getValue() as boolean;
        return hasBlocker ? <Tag type="red" size="sm">Yes</Tag> : <Tag type="green" size="sm">No</Tag>;
      },
    },
    {
      accessorKey: 'osStatus',
      header: 'OS Status',
      enableSorting: true,
      cell: ({ getValue }) => {
        const status = getValue() as string;
        let type: 'green' | 'blue' | 'gray' | 'red' = 'gray';
        if (status === 'supported' || status === 'fully-supported') type = 'green';
        else if (status === 'byol' || status === 'supported-with-caveats') type = 'blue';
        else if (status === 'unsupported') type = 'red';
        return <Tag type={type} size="sm">{status}</Tag>;
      },
    },
    {
      accessorKey: 'networkName',
      header: 'Network',
      enableSorting: true,
      cell: ({ getValue }) => {
        const name = getValue() as string;
        return name.length > 25 ? `${name.substring(0, 22)}...` : name;
      },
    },
  ], []);

  // Calculate total VMs across all waves
  const totalVMs = useMemo(() => {
    return waves.reduce((sum, w) => sum + w.vmCount, 0);
  }, [waves]);

  return (
    <div className="wave-vm-table">
      {/* Wave selection tiles */}
      <div className="wave-vm-table__filters">
        <span className="wave-vm-table__filter-label">
          {mode === 'complexity' ? 'Wave' : 'Group'}:
        </span>
        <ClickableTile
          className={`wave-vm-table__filter-tile ${selectedWave === null ? 'wave-vm-table__filter-tile--selected' : ''}`}
          onClick={() => onWaveSelect(null)}
        >
          <span className="wave-vm-table__filter-name">All</span>
          <Tag type={selectedWave === null ? 'blue' : 'gray'} size="sm">{formatNumber(totalVMs)}</Tag>
        </ClickableTile>
        {waves.map(wave => (
          <ClickableTile
            key={wave.name}
            className={`wave-vm-table__filter-tile ${selectedWave === wave.name ? 'wave-vm-table__filter-tile--selected' : ''} ${wave.hasBlockers ? 'wave-vm-table__filter-tile--warning' : ''}`}
            onClick={() => onWaveSelect(wave.name === selectedWave ? null : wave.name)}
          >
            <span className="wave-vm-table__filter-name" title={wave.name}>
              {wave.name.length > 20 ? `${wave.name.substring(0, 17)}...` : wave.name}
            </span>
            <Tag type={wave.hasBlockers ? 'red' : selectedWave === wave.name ? 'blue' : 'gray'} size="sm">
              {formatNumber(wave.vmCount)}
            </Tag>
          </ClickableTile>
        ))}
      </div>

      {/* VM Table - always show */}
      <div className="wave-vm-table__table">
        <EnhancedDataTable
          data={tableData}
          columns={columns}
          title={selectedWave ? `VMs in ${selectedWave}` : 'All VMs'}
          description={selectedWave && selectedWaveData
            ? (selectedWaveData.description || `${formatNumber(selectedWaveData.vmCount)} VMs`)
            : `${formatNumber(totalVMs)} VMs across all ${mode === 'complexity' ? 'waves' : 'groups'}`}
          enableSearch
          enablePagination
          enableSorting
          enableExport
          enableColumnVisibility
          defaultPageSize={15}
          exportFilename={selectedWave
            ? `wave-vms-${selectedWave.toLowerCase().replace(/\s+/g, '-')}`
            : 'wave-vms-all'}
        />
      </div>
    </div>
  );
}

export default WaveVMTable;
