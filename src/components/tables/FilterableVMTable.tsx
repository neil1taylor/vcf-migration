// Filterable VM Table component
// Reusable table for showing VMs with entity-based filtering (cluster, datastore, etc.)

import { useMemo } from 'react';
import { ClickableTile, Tag } from '@carbon/react';
import { EnhancedDataTable } from './EnhancedDataTable';
import { formatNumber } from '@/utils/formatters';
import type { ColumnDef } from '@tanstack/react-table';
import type { VirtualMachine } from '@/types/rvtools';
import './FilterableVMTable.scss';

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

interface VMTableRow {
  vmName: string;
  powerState: string;
  cpus: number;
  memoryGiB: number;
  storageGiB: number;
  guestOS: string;
  cluster: string;
  datacenter: string;
}

interface FilterableVMTableProps {
  vms: VirtualMachine[];
  filterOptions: FilterOption[];
  selectedFilter: string | null;
  onFilterChange: (value: string | null) => void;
  filterLabel: string;
  title?: string;
  description?: string;
}

export function FilterableVMTable({
  vms,
  filterOptions,
  selectedFilter,
  onFilterChange,
  filterLabel,
  title = 'Virtual Machines',
  description,
}: FilterableVMTableProps) {
  // Convert VMs to table rows
  const tableData: VMTableRow[] = useMemo(() => {
    return vms.map(vm => ({
      vmName: vm.vmName,
      powerState: vm.powerState || 'Unknown',
      cpus: vm.cpus || 0,
      memoryGiB: Math.round((vm.memory || 0) / 1024),
      storageGiB: Math.round((vm.provisionedMiB || 0) / 1024),
      guestOS: vm.guestOS || 'Unknown',
      cluster: vm.cluster || 'N/A',
      datacenter: vm.datacenter || 'N/A',
    }));
  }, [vms]);

  // Define columns
  const columns: ColumnDef<VMTableRow, unknown>[] = useMemo(() => [
    {
      accessorKey: 'vmName',
      header: 'VM Name',
      enableSorting: true,
    },
    {
      accessorKey: 'powerState',
      header: 'Power State',
      enableSorting: true,
      cell: ({ getValue }) => {
        const state = getValue() as string;
        return (
          <Tag type={state === 'poweredOn' ? 'green' : state === 'poweredOff' ? 'red' : 'gray'} size="sm">
            {state === 'poweredOn' ? 'On' : state === 'poweredOff' ? 'Off' : state}
          </Tag>
        );
      },
    },
    {
      accessorKey: 'cpus',
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
      accessorKey: 'guestOS',
      header: 'Guest OS',
      enableSorting: true,
      cell: ({ getValue }) => {
        const os = getValue() as string;
        return os.length > 30 ? `${os.substring(0, 27)}...` : os;
      },
    },
    {
      accessorKey: 'cluster',
      header: 'Cluster',
      enableSorting: true,
    },
    {
      accessorKey: 'datacenter',
      header: 'Datacenter',
      enableSorting: true,
    },
  ], []);

  const totalVMs = useMemo(() => {
    return filterOptions.reduce((sum, opt) => sum + opt.count, 0);
  }, [filterOptions]);

  return (
    <div className="filterable-vm-table">
      {/* Filter tiles */}
      <div className="filterable-vm-table__filters">
        <span className="filterable-vm-table__filter-label">{filterLabel}:</span>
        <ClickableTile
          className={`filterable-vm-table__filter-tile ${selectedFilter === null ? 'filterable-vm-table__filter-tile--selected' : ''}`}
          onClick={() => onFilterChange(null)}
        >
          <span className="filterable-vm-table__filter-name">All</span>
          <Tag type="gray" size="sm">{formatNumber(totalVMs)}</Tag>
        </ClickableTile>
        {filterOptions.map(option => (
          <ClickableTile
            key={option.value}
            className={`filterable-vm-table__filter-tile ${selectedFilter === option.value ? 'filterable-vm-table__filter-tile--selected' : ''}`}
            onClick={() => onFilterChange(option.value === selectedFilter ? null : option.value)}
          >
            <span className="filterable-vm-table__filter-name" title={option.label}>
              {option.label.length > 20 ? `${option.label.substring(0, 17)}...` : option.label}
            </span>
            <Tag type={selectedFilter === option.value ? 'blue' : 'gray'} size="sm">
              {formatNumber(option.count)}
            </Tag>
          </ClickableTile>
        ))}
      </div>

      {/* VM Table */}
      <EnhancedDataTable
        data={tableData}
        columns={columns}
        title={title}
        description={description || (selectedFilter
          ? `${formatNumber(vms.length)} VMs in ${selectedFilter}`
          : `${formatNumber(vms.length)} VMs total`)}
        enableSearch
        enablePagination
        enableSorting
        enableExport
        enableColumnVisibility
        defaultPageSize={15}
        exportFilename="vm-list"
      />
    </div>
  );
}

export default FilterableVMTable;
