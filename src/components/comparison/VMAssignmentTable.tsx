import { useState, useMemo } from 'react';
import {
  DataTable, Table, TableHead, TableRow, TableHeader, TableBody, TableCell,
  TableContainer, TableToolbar, TableToolbarContent, TableToolbarSearch,
  Tag, Button, Pagination, Dropdown, TextInput,
} from '@carbon/react';
import { Reset } from '@carbon/icons-react';
import type { VMClassification, MigrationTarget } from '@/services/migration/targetClassification';
import { getCategoryDisplayName } from '@/utils/workloadClassification';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/utils/constants';

interface VMAssignmentTableProps {
  assignments: VMClassification[];
  workloadTypes: Map<string, string>;
  overriddenVmIds: Set<string>;
  onOverride: (vmId: string, target: MigrationTarget) => void;
  onOverrideReason: (vmId: string, reason: string) => void;
  onReset: (vmId: string) => void;
  onResetAll: () => void;
  overrideCount: number;
}

const headers = [
  { key: 'vmName', header: 'VM Name' },
  { key: 'workloadType', header: 'Workload Type' },
  { key: 'target', header: 'Target' },
  { key: 'reasons', header: 'Reason' },
];

const targetOptions = [
  { id: 'roks', text: 'ROKS' },
  { id: 'vsi', text: 'VSI' },
  { id: 'powervs', text: 'PowerVS' },
];

export function VMAssignmentTable({
  assignments, workloadTypes, overriddenVmIds, onOverride, onOverrideReason, onReset, onResetAll, overrideCount,
}: VMAssignmentTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const filtered = useMemo(() => {
    if (!searchTerm) return assignments;
    const lower = searchTerm.toLowerCase();
    return assignments.filter(a =>
      a.vmName.toLowerCase().includes(lower) ||
      a.reasons.some(r => r.toLowerCase().includes(lower))
    );
  }, [assignments, searchTerm]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const rows = paged.map(a => ({
    id: a.vmId,
    vmName: a.vmName,
    workloadType: getCategoryDisplayName(workloadTypes.get(a.vmId) ?? null) ?? 'Unclassified',
    target: a.target,
    reasons: a.reasons.join('; '),
  }));


  return (
    <>
      <DataTable rows={rows} headers={headers} isSortable size="lg">
        {({ rows: tableRows, headers: tableHeaders, getTableProps, getHeaderProps, getRowProps }) => (
          <TableContainer>
            <TableToolbar>
              <TableToolbarContent>
                <TableToolbarSearch
                  onChange={(_e: unknown, newVal?: string) => { setSearchTerm(newVal || ''); setPage(1); }}
                  placeholder="Search VMs..."
                  persistent
                />
                {overrideCount > 0 && (
                  <Button kind="ghost" size="sm" renderIcon={Reset} onClick={onResetAll}>
                    Reset All ({overrideCount})
                  </Button>
                )}
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {tableHeaders.map(header => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map(row => {
                  const a = paged.find(p => p.vmId === row.id)!;
                  const selectedTarget = targetOptions.find(o => o.id === a.target) || targetOptions[0];
                  return (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      <TableCell>
                        {a.vmName}
                        {overriddenVmIds.has(a.vmId) && (
                          <Tag type="cyan" size="sm" style={{ marginLeft: '0.5rem' }}>Override</Tag>
                        )}
                      </TableCell>
                      <TableCell>
                        {getCategoryDisplayName(workloadTypes.get(a.vmId) ?? null) ?? 'Unclassified'}
                      </TableCell>
                      <TableCell>
                        <div style={{ minWidth: '140px' }}>
                          <Dropdown
                            id={`target-${a.vmId}`}
                            items={targetOptions}
                            selectedItem={selectedTarget}
                            itemToString={(item: { id: string; text: string } | null) => item?.text ?? ''}
                            onChange={({ selectedItem }: { selectedItem: { id: string; text: string } | null }) => {
                              if (selectedItem && selectedItem.id !== a.target) {
                                onOverride(a.vmId, selectedItem.id as MigrationTarget);
                              }
                            }}
                            size="sm"
                            label="Select target"
                            hideLabel
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <TextInput
                            id={`reason-${a.vmId}`}
                            size="sm"
                            value={a.reasons.join('; ')}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              onOverrideReason(a.vmId, e.target.value);
                            }}
                            labelText=""
                            hideLabel
                          />
                          {overriddenVmIds.has(a.vmId) && (
                            <Button
                              kind="ghost"
                              size="sm"
                              hasIconOnly
                              renderIcon={Reset}
                              iconDescription="Reset"
                              onClick={() => onReset(a.vmId)}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
      <Pagination
        totalItems={filtered.length}
        pageSize={pageSize}
        pageSizes={PAGE_SIZE_OPTIONS}
        page={page}
        onChange={({ page: p, pageSize: ps }: { page: number; pageSize: number }) => { setPage(p); setPageSize(ps); }}
      />
    </>
  );
}
