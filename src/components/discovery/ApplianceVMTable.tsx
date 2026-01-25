/**
 * ApplianceVMTable Component
 *
 * Displays detected appliance VMs in a Carbon DataTable with:
 * - Clickable type filters
 * - Search functionality
 * - Pagination
 */

import { useState, useMemo, useCallback } from 'react';
import {
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  Button,
  Pagination,
  ClickableTile,
} from '@carbon/react';
import { Close, DocumentExport } from '@carbon/icons-react';
import { formatNumber } from '@/utils/formatters';
import './ApplianceVMTable.scss';

// ===== TYPES =====

export interface ApplianceMatch {
  vmName: string;
  matchedPattern: string;
  source: 'name' | 'annotation';
}

interface ApplianceVMTableProps {
  matches: ApplianceMatch[];
  appliancesByType: Record<string, string[]>;
}

interface ApplianceRow {
  id: string;
  vmName: string;
  matchedPattern: string;
  source: string;
}

// ===== COMPONENT =====

export function ApplianceVMTable({ matches, appliancesByType }: ApplianceVMTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Transform matches to rows
  const rows = useMemo((): ApplianceRow[] => {
    return matches.map((match, idx) => ({
      id: `${match.vmName}-${idx}`,
      vmName: match.vmName,
      matchedPattern: match.matchedPattern,
      source: match.source === 'name' ? 'VM Name' : 'Annotation',
    }));
  }, [matches]);

  // Filter by type and search term
  const filteredRows = useMemo(() => {
    let result = rows;

    if (selectedType) {
      result = result.filter(row => row.matchedPattern === selectedType);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(row =>
        row.vmName.toLowerCase().includes(term) ||
        row.matchedPattern.toLowerCase().includes(term)
      );
    }

    return result;
  }, [rows, selectedType, searchTerm]);

  // Paginate
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  // Type click handler
  const handleTypeClick = useCallback((type: string) => {
    setSelectedType(prev => prev === type ? null : type);
    setPage(1);
  }, []);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    const headers = ['VM Name', 'Matched Pattern', 'Source'];
    const csvRows = filteredRows.map(row => [
      row.vmName,
      row.matchedPattern,
      row.source,
    ]);

    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'appliance-vms.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRows]);

  const headers = [
    { key: 'vmName', header: 'VM Name' },
    { key: 'matchedPattern', header: 'Appliance Type' },
    { key: 'source', header: 'Source' },
  ];

  // Sort types by count
  const sortedTypes = useMemo(() => {
    return Object.entries(appliancesByType)
      .sort((a, b) => b[1].length - a[1].length);
  }, [appliancesByType]);

  return (
    <div className="appliance-vm-table">
      {/* Clickable type filters */}
      {sortedTypes.length > 0 && (
        <div className="appliance-vm-table__filters">
          <span className="appliance-vm-table__filters-label">Filter by type:</span>
          <div className="appliance-vm-table__filter-tags">
            {sortedTypes.map(([type, vmList]) => (
              <ClickableTile
                key={type}
                className={`appliance-vm-table__filter-tile ${selectedType === type ? 'appliance-vm-table__filter-tile--selected' : ''}`}
                onClick={() => handleTypeClick(type)}
              >
                <span className="appliance-vm-table__filter-name">{type}</span>
                <Tag type={selectedType === type ? 'purple' : 'gray'} size="sm">
                  {vmList.length}
                </Tag>
              </ClickableTile>
            ))}
            {selectedType && (
              <Button
                kind="ghost"
                size="sm"
                renderIcon={Close}
                onClick={() => {
                  setSelectedType(null);
                  setPage(1);
                }}
                hasIconOnly
                iconDescription="Clear filter"
              />
            )}
          </div>
        </div>
      )}

      {/* Data Table */}
      <DataTable rows={paginatedRows} headers={headers} isSortable>
        {({
          rows,
          headers,
          getHeaderProps,
          getRowProps,
          getTableProps,
          getTableContainerProps,
        }) => (
          <TableContainer {...getTableContainerProps()}>
            <TableToolbar>
              <TableToolbarContent>
                <TableToolbarSearch
                  placeholder="Search appliances..."
                  onChange={(e) => {
                    const value = typeof e === 'string' ? e : e.target.value;
                    setSearchTerm(value);
                    setPage(1);
                  }}
                  value={searchTerm}
                  persistent
                />
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={DocumentExport}
                  onClick={handleExportCSV}
                  hasIconOnly
                  iconDescription="Export to CSV"
                />
              </TableToolbarContent>
            </TableToolbar>

            <Table {...getTableProps()} size="md">
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const originalRow = paginatedRows.find(r => r.id === row.id);
                  if (!originalRow) return null;

                  return (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      <TableCell>{originalRow.vmName}</TableCell>
                      <TableCell>
                        <Tag type="purple" size="sm">{originalRow.matchedPattern}</Tag>
                      </TableCell>
                      <TableCell>{originalRow.source}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="appliance-vm-table__empty">
          <p>No appliance VMs detected</p>
        </div>
      )}

      {/* Pagination */}
      {rows.length > 0 && (
        <div className="appliance-vm-table__pagination">
          <div className="appliance-vm-table__pagination-info">
            <Tag type="gray" size="sm">
              {formatNumber(filteredRows.length)} appliances
            </Tag>
            {(searchTerm || selectedType) && (
              <Tag type="purple" size="sm">
                Filtered from {formatNumber(rows.length)}
              </Tag>
            )}
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            pageSizes={[10, 25, 50, 100]}
            totalItems={filteredRows.length}
            onChange={({ page: newPage, pageSize: newPageSize }) => {
              setPage(newPage);
              setPageSize(newPageSize);
            }}
            itemsPerPageText="Items per page:"
          />
        </div>
      )}
    </div>
  );
}

export default ApplianceVMTable;
