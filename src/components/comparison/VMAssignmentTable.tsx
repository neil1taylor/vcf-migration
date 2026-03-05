import { useState, useMemo } from 'react';
import {
  DataTable, Table, TableHead, TableRow, TableHeader, TableBody, TableCell,
  TableContainer, TableToolbar, TableToolbarContent, TableToolbarSearch,
  Tag, Button, Pagination,
} from '@carbon/react';
import { Reset } from '@carbon/icons-react';
import type { VMClassification, MigrationTarget } from '@/services/migration/targetClassification';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/utils/constants';

interface VMAssignmentTableProps {
  assignments: VMClassification[];
  onOverride: (vmId: string, target: MigrationTarget) => void;
  onReset: (vmId: string) => void;
  onResetAll: () => void;
  overrideCount: number;
}

const headers = [
  { key: 'vmName', header: 'VM Name' },
  { key: 'guestOS', header: 'Guest OS' },
  { key: 'target', header: 'Target' },
  { key: 'confidence', header: 'Confidence' },
  { key: 'reasons', header: 'Reasons' },
];

export function VMAssignmentTable({ assignments, onOverride, onReset, onResetAll, overrideCount }: VMAssignmentTableProps) {
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
    guestOS: '',
    target: a.target,
    confidence: a.confidence,
    reasons: a.reasons.join('; '),
  }));

  const isOverridden = (a: VMClassification) => a.reasons[0] === 'User override';

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
                  return (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      <TableCell>
                        {a.vmName}
                        {isOverridden(a) && (
                          <Tag type="cyan" size="sm" style={{ marginLeft: '0.5rem' }}>Override</Tag>
                        )}
                      </TableCell>
                      <TableCell>{''}</TableCell>
                      <TableCell>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <Tag
                            type={a.target === 'roks' ? 'teal' : 'outline'}
                            size="sm"
                            onClick={() => a.target !== 'roks' ? onOverride(a.vmId, 'roks') : isOverridden(a) ? onReset(a.vmId) : undefined}
                            style={{ cursor: 'pointer' }}
                          >
                            ROKS
                          </Tag>
                          <Tag
                            type={a.target === 'vsi' ? 'blue' : 'outline'}
                            size="sm"
                            onClick={() => a.target !== 'vsi' ? onOverride(a.vmId, 'vsi') : isOverridden(a) ? onReset(a.vmId) : undefined}
                            style={{ cursor: 'pointer' }}
                          >
                            VSI
                          </Tag>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Tag type={a.confidence === 'high' ? 'green' : a.confidence === 'medium' ? 'blue' : 'gray'} size="sm">
                          {a.confidence}
                        </Tag>
                      </TableCell>
                      <TableCell>{a.reasons.join('; ')}</TableCell>
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
